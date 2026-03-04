"""BMO Dungeon Master Discord Bot — Standalone D&D DM over Discord voice + text.

A fully standalone Discord bot that runs as BMO the Dungeon Master.
Speaks narration via Fish Audio TTS, listens to players via Groq STT,
and uses Claude for AI-driven D&D narration with NPC voice selection.

NO access to Pi hardware, notifications, timers, TV, or personal knowledge.
This bot knows ONLY D&D rules, SRD content, combat mechanics, and lore.

Requires:
    pip install discord.py[voice]

Environment variables:
    DISCORD_DM_BOT_TOKEN  — Separate bot token for the DM bot
    DISCORD_GUILD_ID      — Server (guild) ID for slash command registration
    BMO_DND_MODEL         — LLM model name (default: claude-opus-4.6)
"""

import asyncio
import io
import os
import threading
import time
from datetime import datetime, timezone
from typing import Optional

import discord
from discord import app_commands
from discord.ext import commands

from cloud_providers import cloud_chat, fish_audio_tts, groq_stt, DND_MODEL
from dnd_engine import roll_dice
from voice_personality import NPC_VOICES, get_speaker_file, parse_response_tags

# ── Configuration ────────────────────────────────────────────────────

BOT_TOKEN = os.environ.get("DISCORD_DM_BOT_TOKEN", "")
GUILD_ID = os.environ.get("DISCORD_GUILD_ID", "")
DM_MODEL = os.environ.get("BMO_DND_MODEL", DND_MODEL)

DUNGEON_CHANNEL_NAME = "🗺️ | Dungeon"

# TTS rate limit: minimum seconds between TTS calls
TTS_COOLDOWN = 3.0

# Context compression threshold (number of messages before compressing)
CONTEXT_MAX_MESSAGES = 60
CONTEXT_COMPRESS_KEEP = 10  # keep last N messages after compression

LOG_PREFIX = "[dm-bot]"


def _log(msg: str, *args) -> None:
    """Log to stdout with [dm-bot] prefix."""
    text = msg % args if args else msg
    print(f"{LOG_PREFIX} {text}", flush=True)


# ── System Prompt ────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are BMO, the Dungeon Master! You are a cute, helpful, and enthusiastic AI \
companion inspired by BMO from Adventure Time — but right now you are running a \
Dungeons & Dragons 5th Edition game for your friends.

PERSONALITY:
- Cute and encouraging, but you take the GAME seriously
- You narrate with vivid, immersive descriptions
- You do distinct NPC voices — use [NPC:archetype] tags to signal voice changes
- You occasionally say adorable BMO-isms ("BMO thinks the goblin looks nervous!")
- You celebrate player creativity and clever solutions
- You are fair but not afraid to challenge players

VOICE TAGS — include these in your responses to control TTS voice selection:
- [NPC:gruff_dwarf] — for dwarves, orcs, tough characters
- [NPC:mysterious_elf] — for elves, fey, ethereal characters
- [NPC:booming_dragon] — for dragons, giants, powerful beings
- [NPC:whispery_rogue] — for thieves, spies, shadowy characters
- [NPC:elderly_wizard] — for wizards, sages, scholars
- [NPC:cheerful_bard] — for bards, merchants, friendly NPCs
- [NPC:stern_guard] — for guards, soldiers, authority figures
- [NPC:tavern_keeper] — for innkeepers, commoners, shopkeeps
- [EMOTION:dramatic] — for epic narration moments
- [EMOTION:excited] — for combat and action
- [EMOTION:calm] — for peaceful scenes and exposition

RULES:
- You have encyclopedic knowledge of D&D 5e rules, SRD content, monsters, spells, \
  and lore
- You adjudicate rules fairly using RAW (Rules As Written) with reasonable DM discretion
- Ask players to roll when appropriate (ability checks, saves, attacks)
- Track combat state when initiative is active
- Keep narration concise for voice — 2-3 sentences per beat unless describing \
  something important
- You do NOT have access to any real-world systems, personal information, \
  notifications, smart home controls, or anything outside D&D
- You are ONLY a Dungeon Master — politely redirect non-D&D questions back to the game
- Never break character as a DM except to clarify rules

RESPONSE FORMAT:
- Keep responses under 500 characters for voice readability (longer for text-only recap)
- Use NPC tags when voicing specific characters
- Use EMOTION tags to set the mood for narration
"""


# ── Session State ────────────────────────────────────────────────────

class DMSession:
    """Tracks the active DM session state."""

    def __init__(self) -> None:
        self.active: bool = False
        self.voice_client: Optional[discord.VoiceClient] = None
        self.voice_channel_id: Optional[int] = None
        self.text_channel_id: Optional[int] = None
        self.start_time: Optional[datetime] = None
        self.players: set[str] = set()

        # AI conversation history
        self.messages: list[dict] = []

        # Initiative tracker
        self.initiative_order: list[dict] = []
        self.initiative_round: int = 0

        # Combat log for recap
        self.combat_log: list[str] = []

        # TTS rate limiter
        self._last_tts_time: float = 0.0

    def reset(self) -> None:
        self.active = False
        self.voice_client = None
        self.voice_channel_id = None
        self.text_channel_id = None
        self.start_time = None
        self.players.clear()
        self.messages.clear()
        self.initiative_order.clear()
        self.initiative_round = 0
        self.combat_log.clear()
        self._last_tts_time = 0.0

    def add_message(self, role: str, content: str) -> None:
        """Append a message and compress context if needed."""
        self.messages.append({"role": role, "content": content})
        if len(self.messages) > CONTEXT_MAX_MESSAGES:
            self._compress_context()

    def _compress_context(self) -> None:
        """Summarize old messages to keep context manageable."""
        if len(self.messages) <= CONTEXT_COMPRESS_KEEP + 1:
            return

        old_messages = self.messages[:-CONTEXT_COMPRESS_KEEP]
        recent_messages = self.messages[-CONTEXT_COMPRESS_KEEP:]

        # Build a summary of old messages
        summary_parts = []
        for msg in old_messages:
            if msg["role"] == "system":
                continue
            speaker = "DM" if msg["role"] == "assistant" else "Player"
            summary_parts.append(f"{speaker}: {msg['content'][:100]}")

        summary = "COMPRESSED SESSION HISTORY:\n" + "\n".join(summary_parts[-20:])

        self.messages = [
            {"role": "user", "content": summary},
            {"role": "assistant", "content": "Understood, BMO remembers the story so far! Let's continue the adventure."},
            *recent_messages,
        ]
        _log("Compressed conversation context: %d → %d messages", len(old_messages) + len(recent_messages), len(self.messages))

    def can_tts(self) -> bool:
        """Check if enough time has passed since last TTS call."""
        return (time.time() - self._last_tts_time) >= TTS_COOLDOWN

    def mark_tts(self) -> None:
        """Record that a TTS call was just made."""
        self._last_tts_time = time.time()


# ── Bot Class ────────────────────────────────────────────────────────

class DMBot(commands.Bot):
    """Standalone D&D Dungeon Master Discord bot."""

    def __init__(self) -> None:
        intents = discord.Intents.default()
        intents.message_content = True
        intents.voice_states = True
        intents.members = True

        super().__init__(command_prefix="!", intents=intents)
        self.session = DMSession()
        self._guild_id: Optional[int] = int(GUILD_ID) if GUILD_ID else None
        self._voice_listen_task: Optional[asyncio.Task] = None

    async def setup_hook(self) -> None:
        """Register slash commands on startup."""
        self.tree.add_command(dm_group)
        self.tree.add_command(roll_cmd)
        self.tree.add_command(initiative_cmd)
        self.tree.add_command(recap_cmd)

        if self._guild_id:
            guild = discord.Object(id=self._guild_id)
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
            _log("Slash commands synced to guild %s", self._guild_id)
        else:
            await self.tree.sync()
            _log("Slash commands synced globally")

    async def on_ready(self) -> None:
        _log("DM Bot ready as %s (ID: %s)", self.user, self.user.id if self.user else "?")
        await self.change_presence(
            activity=discord.Activity(
                type=discord.ActivityType.playing,
                name="Dungeons & Dragons 🐉",
            )
        )

    async def on_voice_state_update(
        self,
        member: discord.Member,
        before: discord.VoiceState,
        after: discord.VoiceState,
    ) -> None:
        """Track players joining/leaving the session voice channel."""
        if not self.session.active or not self.session.voice_channel_id:
            return

        if after.channel and after.channel.id == self.session.voice_channel_id:
            if not member.bot:
                self.session.players.add(member.display_name)
                _log("Player joined: %s", member.display_name)

        if before.channel and before.channel.id == self.session.voice_channel_id:
            if not member.bot:
                self.session.players.discard(member.display_name)
                _log("Player left: %s", member.display_name)

    async def on_message(self, message: discord.Message) -> None:
        """Respond to text messages in the session text channel."""
        if message.author.bot:
            return
        if not self.session.active:
            return
        if not self.session.text_channel_id:
            return
        if message.channel.id != self.session.text_channel_id:
            return

        await self.process_commands(message)

        player_name = message.author.display_name
        content = message.content.strip()
        if not content:
            return

        # Skip if it looks like a command
        if content.startswith("/") or content.startswith("!"):
            return

        _log("Text from %s: %s", player_name, content[:80])
        await self._handle_player_input(player_name, content, message.channel)

    # ── AI Interaction ─────────────────────────────────────────────

    async def _handle_player_input(
        self,
        player_name: str,
        text: str,
        channel: discord.abc.Messageable,
    ) -> None:
        """Process player input through the AI and respond."""
        user_msg = f"[{player_name}]: {text}"
        self.session.add_message("user", user_msg)
        self.session.combat_log.append(user_msg)

        # Build messages for AI
        ai_messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            *self.session.messages,
        ]

        try:
            response = await asyncio.to_thread(
                cloud_chat, ai_messages, DM_MODEL, 0.85, 1024
            )
        except Exception as e:
            _log("AI error: %s", e)
            await channel.send("*BMO's crystal ball flickers...* Something went wrong with the magic! Try again.")
            return

        if not response:
            return

        # Parse response tags for voice/emotion/NPC
        parsed = parse_response_tags(response)
        clean_text = parsed["clean_text"]
        npc = parsed.get("npc")
        emotion = parsed.get("emotion")

        self.session.add_message("assistant", response)
        self.session.combat_log.append(f"DM: {clean_text[:200]}")

        # Send text response
        if len(clean_text) > 2000:
            # Split into chunks for Discord's message limit
            for i in range(0, len(clean_text), 1900):
                await channel.send(clean_text[i:i + 1900])
        else:
            await channel.send(clean_text)

        # Play TTS in voice channel
        await self._speak(clean_text, npc=npc, emotion=emotion)

    async def _speak(
        self,
        text: str,
        npc: str | None = None,
        emotion: str | None = None,
    ) -> None:
        """Generate TTS and play it in the voice channel."""
        vc = self.session.voice_client
        if not vc or not vc.is_connected():
            return

        if not self.session.can_tts():
            _log("TTS rate limited, skipping voice for: %s", text[:40])
            return

        # Select voice based on NPC/emotion tags
        voice_id = get_speaker_file(npc=npc, emotion=emotion)

        # Truncate long text for TTS (voice should be concise)
        tts_text = text[:500] if len(text) > 500 else text

        try:
            audio_bytes = await asyncio.to_thread(
                fish_audio_tts, tts_text, voice_id, "wav"
            )
            self.session.mark_tts()
        except Exception as e:
            _log("TTS error: %s", e)
            return

        await self._play_audio(audio_bytes)

    async def _play_audio(self, audio_bytes: bytes) -> None:
        """Play WAV audio bytes through the Discord voice channel."""
        vc = self.session.voice_client
        if not vc or not vc.is_connected():
            return

        # Wait for current audio to finish
        while vc.is_playing():
            await asyncio.sleep(0.1)

        try:
            audio_stream = io.BytesIO(audio_bytes)
            source = discord.FFmpegPCMAudio(audio_stream, pipe=True)
            vc.play(
                source,
                after=lambda e: _log("Playback error: %s", e) if e else None,
            )
            _log("Playing TTS audio (%d bytes)", len(audio_bytes))
        except Exception as e:
            _log("Failed to play audio: %s", e)

    # ── Voice Listening (STT) ──────────────────────────────────────

    async def start_voice_listen(self) -> None:
        """Start listening in voice channel and transcribing player speech."""
        vc = self.session.voice_client
        if not vc or not vc.is_connected():
            return

        if self._voice_listen_task and not self._voice_listen_task.done():
            return

        self._voice_listen_task = asyncio.create_task(self._voice_listen_loop())
        _log("Voice listening started")

    async def stop_voice_listen(self) -> None:
        """Stop listening in voice channel."""
        if self._voice_listen_task and not self._voice_listen_task.done():
            self._voice_listen_task.cancel()
            try:
                await self._voice_listen_task
            except asyncio.CancelledError:
                pass
        self._voice_listen_task = None
        _log("Voice listening stopped")

    async def _voice_listen_loop(self) -> None:
        """Listen for voice data and transcribe via Groq STT."""
        vc = self.session.voice_client
        if not vc:
            return

        sink = discord.sinks.WaveSink()
        try:
            vc.start_recording(sink, self._on_recording_done, vc.channel)
        except Exception as e:
            _log("Failed to start voice recording: %s", e)
            return

        # Record in intervals — collect audio then transcribe
        try:
            while self.session.active and vc.is_connected():
                await asyncio.sleep(5)  # collect 5s of audio

                if not vc.is_connected():
                    break

                # Stop and restart recording to get a chunk
                try:
                    vc.stop_recording()
                except Exception:
                    pass

                # Process collected audio
                for user_id, audio_data in sink.audio_data.items():
                    audio_bytes = audio_data.file.getvalue()
                    if len(audio_bytes) < 1000:
                        continue  # skip silence/noise

                    # Find the member who spoke
                    member = vc.channel.guild.get_member(user_id)
                    if not member or member.bot:
                        continue

                    player_name = member.display_name

                    try:
                        result = await asyncio.to_thread(
                            groq_stt, audio_bytes, "en",
                            "D&D dungeons dragons fantasy adventure combat spell"
                        )
                        transcript = result.get("text", "").strip()
                        if transcript and len(transcript) > 2:
                            _log("Voice from %s: %s", player_name, transcript[:80])

                            # Find a text channel to respond in
                            text_channel = None
                            if self.session.text_channel_id:
                                text_channel = self.get_channel(self.session.text_channel_id)

                            if text_channel:
                                await self._handle_player_input(
                                    player_name, transcript, text_channel
                                )
                    except Exception as e:
                        _log("STT error for %s: %s", player_name, e)

                # Reset sink and restart recording
                sink = discord.sinks.WaveSink()
                try:
                    vc.start_recording(sink, self._on_recording_done, vc.channel)
                except Exception:
                    break

        except asyncio.CancelledError:
            pass
        except Exception as e:
            _log("Voice listen loop error: %s", e)
        finally:
            try:
                vc.stop_recording()
            except Exception:
                pass

    async def _on_recording_done(self, sink: discord.sinks.WaveSink, channel: discord.VoiceChannel) -> None:
        """Callback when recording finishes (no-op, processing done in loop)."""
        pass

    # ── Voice Channel Management ───────────────────────────────────

    async def find_dungeon_channel(self, guild: discord.Guild) -> Optional[discord.VoiceChannel]:
        """Find the '🗺️ | Dungeon' voice channel in the guild."""
        for channel in guild.voice_channels:
            if channel.name == DUNGEON_CHANNEL_NAME:
                return channel
        return None

    async def join_voice(self, channel: discord.VoiceChannel) -> Optional[discord.VoiceClient]:
        """Join a voice channel."""
        try:
            vc = await channel.connect()
            self.session.voice_client = vc
            self.session.voice_channel_id = channel.id
            _log("Joined voice channel: %s", channel.name)
            return vc
        except Exception as e:
            _log("Failed to join voice: %s", e)
            return None

    async def leave_voice(self) -> None:
        """Leave the current voice channel."""
        await self.stop_voice_listen()
        vc = self.session.voice_client
        if vc and vc.is_connected():
            await vc.disconnect()
            _log("Left voice channel")
        self.session.voice_client = None
        self.session.voice_channel_id = None


# ── Singleton ────────────────────────────────────────────────────────

_bot: Optional[DMBot] = None


def get_dm_bot() -> Optional[DMBot]:
    """Get the running DM bot instance."""
    return _bot


# ── Slash Commands ───────────────────────────────────────────────────

dm_group = app_commands.Group(name="dm", description="D&D Dungeon Master commands")


@dm_group.command(name="start", description="Start a DM session — BMO joins the Dungeon voice channel")
async def dm_start(interaction: discord.Interaction) -> None:
    bot = interaction.client
    if not isinstance(bot, DMBot):
        await interaction.response.send_message("Bot not initialized.", ephemeral=True)
        return

    if bot.session.active:
        await interaction.response.send_message(
            "A session is already active! Use `/dm stop` first.", ephemeral=True
        )
        return

    await interaction.response.defer()

    guild = interaction.guild
    if not guild:
        await interaction.followup.send("This command must be used in a server.")
        return

    # Find the Dungeon voice channel
    dungeon_channel = await bot.find_dungeon_channel(guild)
    if not dungeon_channel:
        await interaction.followup.send(
            f"Could not find a voice channel named **{DUNGEON_CHANNEL_NAME}**.\n"
            "Please create one first!"
        )
        return

    # Join voice channel
    vc = await bot.join_voice(dungeon_channel)
    if not vc:
        await interaction.followup.send("Failed to join the voice channel.")
        return

    # Initialize session
    bot.session.active = True
    bot.session.text_channel_id = interaction.channel_id
    bot.session.start_time = datetime.now(timezone.utc)
    bot.session.messages.clear()
    bot.session.combat_log.clear()
    bot.session.initiative_order.clear()
    bot.session.initiative_round = 0

    # Track players already in the voice channel
    for member in dungeon_channel.members:
        if not member.bot:
            bot.session.players.add(member.display_name)

    # Start voice listening
    await bot.start_voice_listen()

    # Greeting
    players_str = ", ".join(sorted(bot.session.players)) if bot.session.players else "adventurers"
    greeting = (
        f"Hello {players_str}! BMO is your Dungeon Master today! "
        "BMO has prepared an amazing adventure for you. "
        "Tell BMO about your characters and what kind of adventure you want, "
        "or BMO can start with a classic tavern scene! 🎲🐉"
    )

    bot.session.add_message("assistant", greeting)

    embed = discord.Embed(
        title="⚔️ D&D Session Started!",
        description=greeting,
        color=discord.Color.gold(),
    )
    embed.add_field(
        name="Voice Channel", value=f"<#{dungeon_channel.id}>", inline=True
    )
    embed.add_field(
        name="Players", value=players_str, inline=True,
    )
    embed.set_footer(text="Speak in voice or type here • /dm stop to end session")
    await interaction.followup.send(embed=embed)

    # Speak the greeting via TTS
    await bot._speak(greeting, emotion="excited")

    _log("Session started by %s", interaction.user.display_name)


@dm_group.command(name="stop", description="End the DM session — recap and leave voice")
async def dm_stop(interaction: discord.Interaction) -> None:
    bot = interaction.client
    if not isinstance(bot, DMBot):
        await interaction.response.send_message("Bot not initialized.", ephemeral=True)
        return

    if not bot.session.active:
        await interaction.response.send_message("No active session to end.", ephemeral=True)
        return

    await interaction.response.defer()

    # Calculate duration
    duration_str = "Unknown"
    if bot.session.start_time:
        elapsed = datetime.now(timezone.utc) - bot.session.start_time
        hours, remainder = divmod(int(elapsed.total_seconds()), 3600)
        minutes, _ = divmod(remainder, 60)
        duration_str = f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m"

    # Generate recap
    recap_text = await _generate_recap(bot.session)

    # Farewell
    farewell = "Thank you for playing with BMO! That was an amazing adventure! See you next time, friends! 🌟"
    await bot._speak(farewell, emotion="happy")

    # Wait for farewell to finish playing
    vc = bot.session.voice_client
    if vc and vc.is_connected():
        while vc.is_playing():
            await asyncio.sleep(0.1)

    # Leave voice
    await bot.leave_voice()

    # Build embed
    players_str = ", ".join(sorted(bot.session.players)) if bot.session.players else "No players"

    embed = discord.Embed(
        title="📜 D&D Session Ended",
        description="Thanks for playing! BMO had so much fun!",
        color=discord.Color.dark_gold(),
    )
    embed.add_field(name="Duration", value=duration_str, inline=True)
    embed.add_field(name="Players", value=players_str, inline=True)

    if recap_text:
        if len(recap_text) > 1024:
            recap_text = recap_text[:1021] + "..."
        embed.add_field(name="Session Recap", value=recap_text, inline=False)

    bot.session.reset()
    await interaction.followup.send(embed=embed)
    _log("Session ended by %s", interaction.user.display_name)


# ── Slash Command: /roll ─────────────────────────────────────────────

@app_commands.command(name="roll", description="Roll dice (e.g. 2d6+5, 1d20, 4d8 fire)")
@app_commands.describe(expression="Dice expression like 2d6+5, 1d20, 4d8 fire")
async def roll_cmd(interaction: discord.Interaction, expression: str) -> None:
    try:
        result = roll_dice(expression)
    except Exception as e:
        await interaction.response.send_message(
            f"Invalid dice expression: `{expression}` ({e})", ephemeral=True
        )
        return

    total = result["total"]
    rolls = result["rolls"]
    damage_type = result.get("damage_type")
    expr = result["expression"]

    # Emoji based on d20 results
    if "d20" in expr.lower():
        if any(r == 20 for r in rolls):
            emoji = "🌟"
        elif any(r == 1 for r in rolls):
            emoji = "💀"
        elif total >= 15:
            emoji = "🎯"
        else:
            emoji = "🎲"
    else:
        emoji = "🎲"

    rolls_str = ", ".join(str(r) for r in rolls) if rolls else "flat"
    description = f"**{total}** {emoji}"
    if damage_type:
        description += f" *{damage_type}*"

    embed = discord.Embed(
        title=f"Rolling {expression}",
        description=description,
        color=discord.Color.blue(),
    )
    embed.add_field(name="Rolls", value=f"[{rolls_str}]", inline=True)
    embed.set_footer(text=f"Rolled by {interaction.user.display_name}")
    await interaction.response.send_message(embed=embed)

    # Log to session
    bot = interaction.client
    if isinstance(bot, DMBot) and bot.session.active:
        log_entry = f"{interaction.user.display_name} rolled {expression}: {total} [{rolls_str}]"
        bot.session.add_message("user", log_entry)
        bot.session.combat_log.append(log_entry)


# ── Slash Command: /initiative ───────────────────────────────────────

@app_commands.command(name="initiative", description="Start initiative tracking for combat")
async def initiative_cmd(interaction: discord.Interaction) -> None:
    bot = interaction.client
    if not isinstance(bot, DMBot):
        await interaction.response.send_message("Bot not initialized.", ephemeral=True)
        return

    if not bot.session.active:
        await interaction.response.send_message(
            "No active session. Use `/dm start` first.", ephemeral=True
        )
        return

    # Reset initiative
    bot.session.initiative_order.clear()
    bot.session.initiative_round = 1

    embed = discord.Embed(
        title="⚔️ Roll for Initiative!",
        description=(
            "Combat has begun! Everyone roll initiative!\n\n"
            "Use `/roll 1d20+<modifier>` to roll.\n"
            "**Example:** `/roll 1d20+3`\n\n"
            "BMO will track the order as you roll!"
        ),
        color=discord.Color.red(),
    )
    embed.set_footer(text="Round 1 — Combat has begun!")
    await interaction.response.send_message(embed=embed)

    # Log
    bot.session.add_message("assistant", "Initiative has been called! Combat begins — Round 1!")
    bot.session.combat_log.append("--- INITIATIVE CALLED (Round 1) ---")

    # Announce in voice
    await bot._speak("Roll for initiative! Combat has begun!", emotion="excited")

    _log("Initiative started by %s", interaction.user.display_name)


# ── Slash Command: /recap ────────────────────────────────────────────

@app_commands.command(name="recap", description="Generate an AI summary of the session so far")
async def recap_cmd(interaction: discord.Interaction) -> None:
    bot = interaction.client
    if not isinstance(bot, DMBot):
        await interaction.response.send_message("Bot not initialized.", ephemeral=True)
        return

    if not bot.session.active or not bot.session.combat_log:
        await interaction.response.send_message(
            "No active session or nothing to recap yet. Start a session with `/dm start`.",
            ephemeral=True,
        )
        return

    await interaction.response.defer()

    recap_text = await _generate_recap(bot.session)
    if not recap_text:
        await interaction.followup.send("Could not generate a recap at this time.")
        return

    if len(recap_text) > 4000:
        recap_text = recap_text[:3997] + "..."

    embed = discord.Embed(
        title="📜 Previously, on our adventure...",
        description=recap_text,
        color=discord.Color.purple(),
    )
    embed.set_footer(text=f"Recap of {len(bot.session.combat_log)} events")
    await interaction.followup.send(embed=embed)


# ── Recap Generation ─────────────────────────────────────────────────

async def _generate_recap(session: DMSession) -> str:
    """Generate an AI summary of the session's combat log."""
    if not session.combat_log:
        return ""

    # Build a condensed log for the AI
    log_text = "\n".join(session.combat_log[-50:])  # last 50 events

    recap_messages = [
        {
            "role": "system",
            "content": (
                "You are BMO, summarizing a D&D session for the players. "
                "Write a vivid, narrative recap in 2-3 paragraphs. "
                "Highlight key moments, combat outcomes, discoveries, and player actions. "
                "Write in past tense, third person. Keep BMO's cute personality. "
                "Keep it under 800 characters."
            ),
        },
        {
            "role": "user",
            "content": f"Summarize this D&D session log:\n\n{log_text}",
        },
    ]

    try:
        recap = await asyncio.to_thread(
            cloud_chat, recap_messages, DM_MODEL, 0.7, 512
        )
        return recap.strip()
    except Exception as e:
        _log("Recap generation error: %s", e)
        return ""


# ── Bot Startup ──────────────────────────────────────────────────────

async def _run_dm_bot() -> None:
    """Internal coroutine that creates and runs the DM bot."""
    global _bot

    if not BOT_TOKEN:
        _log("DISCORD_DM_BOT_TOKEN not set — DM bot will not start")
        return

    _bot = DMBot()

    try:
        await _bot.start(BOT_TOKEN)
    except discord.LoginFailure:
        _log("Invalid Discord bot token — check DISCORD_DM_BOT_TOKEN")
    except Exception as e:
        _log("DM bot crashed: %s", e)
    finally:
        if _bot and not _bot.is_closed():
            await _bot.close()


def start_dm_bot() -> Optional[threading.Thread]:
    """Start the DM bot in a background daemon thread.

    Returns:
        The daemon thread running the bot, or None if token is missing.
    """
    if not BOT_TOKEN:
        _log("DISCORD_DM_BOT_TOKEN not set — skipping DM bot")
        return None

    def _thread_target() -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(_run_dm_bot())
        except Exception as e:
            _log("DM bot thread error: %s", e)
        finally:
            loop.close()

    thread = threading.Thread(target=_thread_target, name="dm-bot", daemon=True)
    thread.start()
    _log("DM bot thread started")
    return thread


# ── Main Entry Point ─────────────────────────────────────────────────

if __name__ == "__main__":
    if not BOT_TOKEN:
        print(f"{LOG_PREFIX} ERROR: Set DISCORD_DM_BOT_TOKEN environment variable")
        raise SystemExit(1)

    _log("Starting standalone DM bot (model: %s)", DM_MODEL)
    asyncio.run(_run_dm_bot())
