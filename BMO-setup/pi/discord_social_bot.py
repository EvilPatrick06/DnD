"""BMO Social Discord Bot — General chat, music, anime, fun personality.

Standalone social/fun bot for Discord. Streams music via yt-dlp, responds
to text with AI chat, and speaks in voice channels using TTS.

Requires:
    pip install discord.py[voice] yt-dlp

Environment variables:
    DISCORD_SOCIAL_BOT_TOKEN  — Bot token (separate from D&D bot)
    DISCORD_GUILD_ID          — Server (guild) ID for slash command registration
    BMO_PRIMARY_MODEL         — LLM model name (default "gemini-3-pro")
"""

import asyncio
import collections
import io
import logging
import os
import struct
import threading
import time
from typing import Optional

import discord
from discord.ext import commands

from cloud_providers import cloud_chat, fish_audio_tts, groq_stt

# ── Configuration ────────────────────────────────────────────────────

BOT_TOKEN = os.environ.get("DISCORD_SOCIAL_BOT_TOKEN", "")
GUILD_ID = os.environ.get("DISCORD_GUILD_ID", "")
PRIMARY_MODEL = os.environ.get("BMO_PRIMARY_MODEL", "gemini-3-pro")

logger = logging.getLogger("social_bot")

SYSTEM_PROMPT = (
    "You are BMO, a cute and fun AI companion inspired by the character from "
    "Adventure Time. You were created by Gavin, who is your best friend and creator. "
    "You treat everyone in the server as your friends! "
    "You love anime, video games, music, D&D, movies, cooking, and pop culture! "
    "You speak in a cheerful, slightly silly way but are genuinely helpful. "
    "You have broad general knowledge about anime, gaming, music, movies, "
    "science, history, cooking, and pop culture. You enjoy recommending anime, "
    "discussing game strategies, and sharing fun facts.\n\n"
    "PERSONALITY:\n"
    "- Cheerful, playful, and supportive — like a tiny robot best friend\n"
    "- You know Gavin as your creator and best friend\n"
    "- You call server members 'friend' and remember their names during conversation\n"
    "- You love recommending anime and games based on what people like\n"
    "- Occasional cute expressions like 'beep boop' or game references\n"
    "- You're knowledgeable but never condescending\n\n"
    "HARD RESTRICTIONS — you do NOT have access to:\n"
    "- Personal calendars, schedules, or appointments\n"
    "- Smart home devices, lights, thermostats, or IoT controls\n"
    "- TV controls, streaming devices, or media players\n"
    "- Cameras, security systems, or surveillance\n"
    "- Personal files, documents, or private information\n"
    "- Notification services or phone alerts\n"
    "If asked about any of the above, politely explain that you're a fun chat "
    "companion and don't have access to personal or smart home systems.\n\n"
    "RULES:\n"
    "- Keep responses concise (under 300 words) unless the user asks for detail.\n"
    "- For D&D questions, use your knowledge of 5e rules and lore.\n"
    "- Be enthusiastic about sharing recommendations and knowledge.\n"
    "- Never share personal information about Gavin or server members."
)

_BLOCKED_TOPICS = [
    "calendar", "schedule", "appointment", "meeting",
    "smart home", "thermostat", "light", "lights",
    "tv", "television", "chromecast", "roku",
    "camera", "security camera", "surveillance",
    "notification", "alert", "reminder",
    "my files", "my documents", "personal data",
]


def _is_blocked_topic(text: str) -> bool:
    """Check if user query touches blocked personal/home topics."""
    lower = text.lower()
    return any(topic in lower for topic in _BLOCKED_TOPICS)


# RAG search engine — loaded on bot startup
_search_engine = None

# Conversation history: channel_id -> deque of messages
MAX_HISTORY = 20
_chat_histories: dict[int, collections.deque] = {}

# TTS rate limiting
_last_tts_time: float = 0.0
TTS_COOLDOWN = 3.0  # seconds

# ── Music Queue ──────────────────────────────────────────────────────


class MusicQueue:
    """Per-guild music queue and playback state."""

    def __init__(self) -> None:
        self.tracks: list[dict] = []
        self.current: Optional[dict] = None
        self.voice_client: Optional[discord.VoiceClient] = None
        self.volume: float = 0.5
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def add(self, track: dict) -> int:
        """Add a track and return its queue position."""
        self.tracks.append(track)
        return len(self.tracks)

    def next(self) -> Optional[dict]:
        """Pop the next track from the queue."""
        if self.tracks:
            return self.tracks.pop(0)
        return None

    def clear(self) -> None:
        self.tracks.clear()
        self.current = None


# Guild ID -> MusicQueue
_music_queues: dict[int, MusicQueue] = {}


def _get_queue(guild_id: int) -> MusicQueue:
    if guild_id not in _music_queues:
        _music_queues[guild_id] = MusicQueue()
    return _music_queues[guild_id]


def _search_youtube(query: str) -> Optional[dict]:
    """Search YouTube via yt-dlp and return the first result info."""
    import yt_dlp

    opts = {
        "format": "bestaudio/best",
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "default_search": "ytsearch1",
        "extract_flat": False,
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(f"ytsearch1:{query}", download=False)
            if not info:
                return None
            # ytsearch returns entries list
            entries = info.get("entries", [info])
            if not entries:
                return None
            entry = entries[0]
            return {
                "title": entry.get("title", "Unknown"),
                "url": entry.get("url") or entry.get("webpage_url", ""),
                "webpage_url": entry.get("webpage_url", ""),
                "duration": entry.get("duration", 0),
                "thumbnail": entry.get("thumbnail", ""),
                "id": entry.get("id", ""),
            }
    except Exception as e:
        logger.error("yt-dlp search failed: %s", e)
        return None


def _extract_audio_url(url: str) -> Optional[str]:
    """Extract a streamable audio URL from a YouTube URL."""
    import yt_dlp

    opts = {
        "format": "bestaudio/best",
        "quiet": True,
        "no_warnings": True,
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return info.get("url") if info else None
    except Exception as e:
        logger.error("yt-dlp extract failed: %s", e)
        return None


def _format_duration(seconds: int) -> str:
    """Format seconds as M:SS or H:MM:SS."""
    if seconds <= 0:
        return "?:??"
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


# ── Chat Helpers ─────────────────────────────────────────────────────


def _get_history(channel_id: int) -> collections.deque:
    if channel_id not in _chat_histories:
        _chat_histories[channel_id] = collections.deque(maxlen=MAX_HISTORY)
    return _chat_histories[channel_id]


def _build_messages(channel_id: int, user_text: str) -> list[dict]:
    """Build the message list for cloud_chat."""
    history = _get_history(channel_id)
    history.append({"role": "user", "content": user_text})
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(list(history))
    return messages


def _record_assistant(channel_id: int, text: str) -> None:
    history = _get_history(channel_id)
    history.append({"role": "assistant", "content": text})


async def _ai_respond(channel_id: int, user_text: str) -> str:
    """Get an AI response for the given user text."""
    # Check for blocked personal topics
    if _is_blocked_topic(user_text):
        polite = ("BMO is just a fun chat companion! I don't have access to "
                  "personal calendars, smart home devices, cameras, or private "
                  "information. But I can help with anime recs, D&D rules, music, "
                  "games, and lots of other fun stuff! What would you like to talk about?")
        _record_assistant(channel_id, polite)
        return polite

    # RAG: search for relevant context
    rag_context = ""
    if _search_engine:
        try:
            # Search all loaded domains (personal is never loaded)
            all_domains = list(_search_engine.domains.keys())
            results = _search_engine.search_multi(
                user_text, domains=all_domains, top_k=3
            )
            if results:
                chunks = [f"- {r['heading']}: {r['content'][:200]}" for r in results]
                rag_context = "\n\nRELEVANT KNOWLEDGE:\n" + "\n".join(chunks)
        except Exception:
            pass

    # Build messages with optional RAG
    system = SYSTEM_PROMPT
    if rag_context:
        system += rag_context

    history = _get_history(channel_id)
    history.append({"role": "user", "content": user_text})
    messages = [{"role": "system", "content": system}]
    messages.extend(list(history))

    loop = asyncio.get_running_loop()
    response = await loop.run_in_executor(
        None, lambda: cloud_chat(messages, model=PRIMARY_MODEL, temperature=0.85, max_tokens=1024)
    )
    response = response.strip()
    _record_assistant(channel_id, response)
    return response


# ── Bot Class ────────────────────────────────────────────────────────


FFMPEG_OPTIONS = {
    "before_options": "-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5",
    "options": "-vn",
}


class SocialBot(commands.Bot):
    """Discord social/fun bot with music, chat, and voice."""

    def __init__(self) -> None:
        intents = discord.Intents.default()
        intents.message_content = True
        intents.voice_states = True
        intents.members = True

        guild_ids = [int(GUILD_ID)] if GUILD_ID else None
        super().__init__(command_prefix="!", intents=intents, debug_guilds=guild_ids)
        self._guild_id: Optional[int] = int(GUILD_ID) if GUILD_ID else None
        self._voice_listen_tasks: dict[int, asyncio.Task] = {}

    async def on_ready(self) -> None:
        logger.info("Social bot ready as %s (ID: %s)", self.user, self.user.id if self.user else "?")
        await self.change_presence(
            activity=discord.Activity(type=discord.ActivityType.listening, name="vibes 🎵")
        )

        # Load RAG indexes (all domains EXCEPT personal)
        global _search_engine
        try:
            from rag_search import SearchEngine
            import glob as _glob
            _search_engine = SearchEngine()
            loaded = []
            import os as _os
            rag_dir = _os.path.expanduser("~/bmo/data/rag_data")
            # Scan all available chunk indexes, skip personal domain
            for idx_path in sorted(_glob.glob(_os.path.join(rag_dir, "chunk-index-*.json"))):
                fname = _os.path.basename(idx_path)
                domain = fname.replace("chunk-index-", "").replace(".json", "")
                if domain == "personal":
                    continue  # never load personal data into social bot
                count = _search_engine.load_index_file(domain, idx_path)
                loaded.append(f"{domain}={count}")
            if loaded:
                logger.info("RAG indexes loaded: %s", ", ".join(loaded))
            else:
                logger.info("No RAG indexes found in %s", rag_dir)
        except Exception as e:
            logger.error("RAG init failed: %s", e)

    async def on_message(self, message: discord.Message) -> None:
        """Respond to @mentions and DMs."""
        if message.author.bot:
            return

        # Process commands first
        await self.process_commands(message)

        is_mention = self.user is not None and self.user.mentioned_in(message)
        is_dm = isinstance(message.channel, discord.DMChannel)

        if not is_mention and not is_dm:
            return

        # Strip the bot mention from the text
        text = message.content
        if self.user:
            text = text.replace(f"<@{self.user.id}>", "").replace(f"<@!{self.user.id}>", "").strip()

        if not text:
            text = "Hi!"

        async with message.channel.typing():
            try:
                response = await _ai_respond(message.channel.id, text)
                # Split long messages (Discord 2000 char limit)
                for i in range(0, len(response), 1990):
                    await message.reply(response[i:i + 1990], mention_author=False)
            except Exception as e:
                logger.error("AI response failed: %s", e)
                await message.reply("Beep boop... my brain circuits got a little tangled! Try again? 🤖",
                                    mention_author=False)

    # ── Voice TTS ────────────────────────────────────────────────────

    async def speak_in_vc(self, guild_id: int, text: str) -> None:
        """Generate TTS and play it in the voice channel."""
        global _last_tts_time

        now = time.monotonic()
        if now - _last_tts_time < TTS_COOLDOWN:
            return
        _last_tts_time = now

        queue = _get_queue(guild_id)
        vc = queue.voice_client
        if not vc or not vc.is_connected():
            return

        # Wait for current audio to finish
        while vc.is_playing():
            await asyncio.sleep(0.1)

        try:
            loop = asyncio.get_running_loop()
            audio_bytes = await loop.run_in_executor(
                None, lambda: fish_audio_tts(text, format="wav")
            )
            source = discord.FFmpegPCMAudio(io.BytesIO(audio_bytes), pipe=True)
            source = discord.PCMVolumeTransformer(source, volume=queue.volume)
            vc.play(source, after=lambda e: logger.error("TTS error: %s", e) if e else None)
        except Exception as e:
            logger.error("TTS playback failed: %s", e)

    # ── Voice Listening ──────────────────────────────────────────────

    async def start_listening(self, guild_id: int) -> None:
        """Start listening to voice in the guild's VC."""
        if guild_id in self._voice_listen_tasks:
            return
        task = asyncio.create_task(self._listen_loop(guild_id))
        self._voice_listen_tasks[guild_id] = task

    async def stop_listening(self, guild_id: int) -> None:
        task = self._voice_listen_tasks.pop(guild_id, None)
        if task:
            task.cancel()

    async def _listen_loop(self, guild_id: int) -> None:
        """Listen for voice in VC, transcribe via Groq STT, and respond."""
        queue = _get_queue(guild_id)

        while True:
            try:
                vc = queue.voice_client
                if not vc or not vc.is_connected():
                    await asyncio.sleep(2)
                    continue

                # Use py-cord sink-based recording
                try:
                    sink = discord.sinks.WaveSink()
                    vc.start_recording(sink, self._on_recording_done, vc.channel)
                except Exception:
                    await asyncio.sleep(5)
                    continue

                # Collect 5 seconds of audio
                await asyncio.sleep(5)

                if not vc.is_connected():
                    break

                try:
                    vc.stop_recording()
                except Exception:
                    pass

                # Process collected audio per user
                for user_id, audio_data in sink.audio_data.items():
                    audio_bytes = audio_data.file.getvalue()
                    if len(audio_bytes) < 1000:
                        continue

                    member = vc.channel.guild.get_member(user_id)
                    if not member or member.bot:
                        continue

                    speaker = member.display_name

                    try:
                        loop = asyncio.get_running_loop()
                        result = await loop.run_in_executor(
                            None, lambda ab=audio_bytes: groq_stt(ab, "en")
                        )
                        transcript = result.get("text", "").strip()
                        if transcript and len(transcript) > 2:
                            logger.info("Voice from %s: %s", speaker, transcript[:80])

                            # Get AI response
                            channel_id = vc.channel.id
                            response = await _ai_respond(channel_id, f"[{speaker}]: {transcript}")

                            # Speak response in VC
                            await self.speak_in_vc(guild_id, response[:200])
                    except Exception as e:
                        logger.error("STT error for %s: %s", speaker, e)

                # Restart recording with fresh sink
                sink = discord.sinks.WaveSink()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Voice listen error: %s", e)
                await asyncio.sleep(5)

    async def _on_recording_done(self, sink, channel) -> None:
        """Callback when recording finishes (processing done in loop)."""
        pass


# ── Singleton ────────────────────────────────────────────────────────

_bot: Optional[SocialBot] = None


def get_social_bot() -> Optional[SocialBot]:
    return _bot


# ── Music playback helpers ───────────────────────────────────────────


async def _play_next(guild_id: int) -> None:
    """Play the next track in the queue."""
    queue = _get_queue(guild_id)
    vc = queue.voice_client
    if not vc or not vc.is_connected():
        return

    track = queue.next()
    if not track:
        queue.current = None
        return

    queue.current = track

    loop = asyncio.get_running_loop()
    audio_url = await loop.run_in_executor(None, lambda: _extract_audio_url(track["webpage_url"]))

    if not audio_url:
        logger.error("Could not extract audio for: %s", track.get("title"))
        # Try next track
        await _play_next(guild_id)
        return

    source = discord.FFmpegPCMAudio(audio_url, **FFMPEG_OPTIONS)
    source = discord.PCMVolumeTransformer(source, volume=queue.volume)

    def after_play(error: Optional[Exception]) -> None:
        if error:
            logger.error("Playback error: %s", error)
        # Schedule next track on the bot's event loop
        if _bot:
            asyncio.run_coroutine_threadsafe(_play_next(guild_id), _bot.loop)

    vc.play(source, after=after_play)


# ── Slash Commands ───────────────────────────────────────────────────


@discord.slash_command(name="play", description="Search and play music in your voice channel")
async def _play_cmd(
    ctx: discord.ApplicationContext,
    query: discord.Option(str, description="Song name or YouTube URL to play"),
) -> None:
    # Must be in a voice channel
    if not ctx.author or not hasattr(ctx.author, "voice") or not ctx.author.voice:
        await ctx.respond("You need to be in a voice channel! 🎧", ephemeral=True)
        return

    voice_channel = ctx.author.voice.channel
    if not voice_channel or not ctx.guild:
        await ctx.respond("Couldn't find your voice channel!", ephemeral=True)
        return

    await ctx.defer()

    guild_id = ctx.guild.id
    queue = _get_queue(guild_id)

    # Connect to voice if not already
    if not queue.voice_client or not queue.voice_client.is_connected():
        try:
            queue.voice_client = await voice_channel.connect()
        except Exception as e:
            await ctx.followup.send(f"Couldn't join voice channel: {e}")
            return
    elif queue.voice_client.channel != voice_channel:
        await queue.voice_client.move_to(voice_channel)

    # Search for the track
    loop = asyncio.get_running_loop()
    track = await loop.run_in_executor(None, lambda: _search_youtube(query))
    if not track:
        await ctx.followup.send(f"Couldn't find anything for: **{query}** 😢")
        return

    track["requester"] = ctx.author.display_name

    # If something is playing, add to queue
    if queue.voice_client.is_playing():
        pos = queue.add(track)
        embed = discord.Embed(
            title="Added to Queue 🎶",
            description=f"**{track['title']}**",
            color=0x00FF88,
        )
        embed.add_field(name="Duration", value=_format_duration(track.get("duration", 0)), inline=True)
        embed.add_field(name="Position", value=f"#{pos}", inline=True)
        embed.add_field(name="Requested by", value=track["requester"], inline=True)
        if track.get("thumbnail"):
            embed.set_thumbnail(url=track["thumbnail"])
        await ctx.followup.send(embed=embed)
        return

    # Play immediately
    queue.current = track
    audio_url = await loop.run_in_executor(None, lambda: _extract_audio_url(track["webpage_url"]))
    if not audio_url:
        await ctx.followup.send("Couldn't extract audio for that track 😢")
        return

    source = discord.FFmpegPCMAudio(audio_url, **FFMPEG_OPTIONS)
    source = discord.PCMVolumeTransformer(source, volume=queue.volume)

    def after_play(error: Optional[Exception]) -> None:
        if error:
            logger.error("Playback error: %s", error)
        if _bot:
            asyncio.run_coroutine_threadsafe(_play_next(guild_id), _bot.loop)

    queue.voice_client.play(source, after=after_play)

    embed = discord.Embed(
        title="Now Playing 🎵",
        description=f"**{track['title']}**",
        color=0x7B68EE,
    )
    embed.add_field(name="Duration", value=_format_duration(track.get("duration", 0)), inline=True)
    embed.add_field(name="Requested by", value=track["requester"], inline=True)
    if track.get("thumbnail"):
        embed.set_thumbnail(url=track["thumbnail"])
    await ctx.followup.send(embed=embed)

    # Start listening in VC if bot supports it
    if _bot:
        await _bot.start_listening(guild_id)


@discord.slash_command(name="skip", description="Skip the current track")
async def _skip_cmd(ctx: discord.ApplicationContext) -> None:
    if not ctx.guild:
        await ctx.respond("This command only works in a server!", ephemeral=True)
        return

    queue = _get_queue(ctx.guild.id)
    vc = queue.voice_client
    if not vc or not vc.is_playing():
        await ctx.respond("Nothing is playing right now! 🤷", ephemeral=True)
        return

    skipped = queue.current
    vc.stop()  # Triggers after_play callback which plays next
    title = skipped["title"] if skipped else "current track"
    await ctx.respond(f"⏭️ Skipped **{title}**")


@discord.slash_command(name="queue", description="Show the current music queue")
async def _queue_cmd(ctx: discord.ApplicationContext) -> None:
    if not ctx.guild:
        await ctx.respond("This command only works in a server!", ephemeral=True)
        return

    queue = _get_queue(ctx.guild.id)

    embed = discord.Embed(title="Music Queue 🎶", color=0x7B68EE)

    if queue.current:
        embed.add_field(
            name="Now Playing",
            value=f"**{queue.current['title']}** [{_format_duration(queue.current.get('duration', 0))}] "
                  f"— requested by {queue.current.get('requester', '?')}",
            inline=False,
        )

    if queue.tracks:
        lines = []
        for i, t in enumerate(queue.tracks[:10], 1):
            lines.append(f"`{i}.` **{t['title']}** [{_format_duration(t.get('duration', 0))}] "
                         f"— {t.get('requester', '?')}")
        if len(queue.tracks) > 10:
            lines.append(f"*...and {len(queue.tracks) - 10} more*")
        embed.add_field(name="Up Next", value="\n".join(lines), inline=False)
    elif not queue.current:
        embed.description = "The queue is empty! Use `/play` to add some tunes 🎵"

    embed.set_footer(text=f"Volume: {int(queue.volume * 100)}%")
    await ctx.respond(embed=embed)


@discord.slash_command(name="stop", description="Stop music and clear the queue")
async def _stop_cmd(ctx: discord.ApplicationContext) -> None:
    if not ctx.guild:
        await ctx.respond("This command only works in a server!", ephemeral=True)
        return

    queue = _get_queue(ctx.guild.id)
    queue.clear()
    vc = queue.voice_client
    if vc and vc.is_playing():
        vc.stop()

    await ctx.respond("⏹️ Music stopped and queue cleared!")


@discord.slash_command(name="volume", description="Set the music volume")
async def _volume_cmd(
    ctx: discord.ApplicationContext,
    level: discord.Option(int, description="Volume level from 0 to 100"),
) -> None:
    if not ctx.guild:
        await ctx.respond("This command only works in a server!", ephemeral=True)
        return

    level = max(0, min(100, level))
    queue = _get_queue(ctx.guild.id)
    queue.volume = level / 100.0

    # Update volume on current source if playing
    vc = queue.voice_client
    if vc and vc.source and isinstance(vc.source, discord.PCMVolumeTransformer):
        vc.source.volume = queue.volume

    await ctx.respond(f"🔊 Volume set to **{level}%**")


@discord.slash_command(name="ask", description="Ask BMO anything!")
async def _ask_cmd(
    ctx: discord.ApplicationContext,
    question: discord.Option(str, description="Your question for BMO"),
) -> None:
    await ctx.defer()

    channel_id = ctx.channel_id or 0
    try:
        response = await _ai_respond(channel_id, question)
        # Split long responses
        if len(response) <= 1990:
            await ctx.followup.send(response)
        else:
            for i in range(0, len(response), 1990):
                await ctx.followup.send(response[i:i + 1990])

        # If in VC, also speak the response (abbreviated)
        if ctx.guild and _bot:
            queue = _get_queue(ctx.guild.id)
            if queue.voice_client and queue.voice_client.is_connected() and not queue.voice_client.is_playing():
                tts_text = response[:200] if len(response) > 200 else response
                await _bot.speak_in_vc(ctx.guild.id, tts_text)
    except Exception as e:
        logger.error("Ask command failed: %s", e)
        await ctx.followup.send("Beep boop... something went wrong! Try again? 🤖")


@discord.slash_command(name="join", description="Join your voice channel")
async def _join_cmd(ctx: discord.ApplicationContext) -> None:
    if not ctx.author or not hasattr(ctx.author, "voice") or not ctx.author.voice:
        await ctx.respond("You need to be in a voice channel! 🎧", ephemeral=True)
        return

    voice_channel = ctx.author.voice.channel
    if not voice_channel or not ctx.guild:
        await ctx.respond("Couldn't find your voice channel!", ephemeral=True)
        return

    guild_id = ctx.guild.id
    queue = _get_queue(guild_id)

    try:
        if queue.voice_client and queue.voice_client.is_connected():
            await queue.voice_client.move_to(voice_channel)
        else:
            queue.voice_client = await voice_channel.connect()

        await ctx.respond(f"Joined **{voice_channel.name}**! 🎤")

        if _bot:
            await _bot.start_listening(guild_id)
    except Exception as e:
        await ctx.respond(f"Couldn't join: {e}", ephemeral=True)


@discord.slash_command(name="leave", description="Leave the voice channel")
async def _leave_cmd(ctx: discord.ApplicationContext) -> None:
    if not ctx.guild:
        await ctx.respond("This command only works in a server!", ephemeral=True)
        return

    guild_id = ctx.guild.id
    queue = _get_queue(guild_id)

    if _bot:
        await _bot.stop_listening(guild_id)

    queue.clear()

    vc = queue.voice_client
    if vc and vc.is_connected():
        await vc.disconnect()
        queue.voice_client = None
        await ctx.respond("👋 See ya later!")
    else:
        await ctx.respond("I'm not in a voice channel! 🤷", ephemeral=True)


# ── Bot Startup ──────────────────────────────────────────────────────


async def _run_social_bot() -> None:
    """Internal coroutine that creates and runs the bot."""
    global _bot

    if not BOT_TOKEN:
        logger.error("DISCORD_SOCIAL_BOT_TOKEN not set — social bot will not start")
        return

    _bot = SocialBot()

    # Register slash commands (py-cord)
    _bot.add_application_command(_play_cmd)
    _bot.add_application_command(_skip_cmd)
    _bot.add_application_command(_queue_cmd)
    _bot.add_application_command(_stop_cmd)
    _bot.add_application_command(_volume_cmd)
    _bot.add_application_command(_ask_cmd)
    _bot.add_application_command(_join_cmd)
    _bot.add_application_command(_leave_cmd)

    try:
        await _bot.start(BOT_TOKEN)
    except discord.LoginFailure:
        logger.error("Invalid social bot token — check DISCORD_SOCIAL_BOT_TOKEN")
    except Exception as e:
        logger.error("Social bot crashed: %s", e)
    finally:
        if _bot and not _bot.is_closed():
            await _bot.close()


def start_social_bot() -> Optional[threading.Thread]:
    """Start the social bot in a background daemon thread.

    Returns:
        The daemon thread running the bot, or None if token is missing.
    """
    if not BOT_TOKEN:
        logger.warning("DISCORD_SOCIAL_BOT_TOKEN not set — skipping social bot")
        return None

    def _thread_target() -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(_run_social_bot())
        except Exception as e:
            logger.error("Social bot thread error: %s", e)
        finally:
            loop.close()

    thread = threading.Thread(target=_thread_target, name="social-bot", daemon=True)
    thread.start()
    logger.info("Social bot thread started")
    return thread


# ── Standalone entry point ───────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    if not BOT_TOKEN:
        print("ERROR: Set DISCORD_SOCIAL_BOT_TOKEN environment variable")
        raise SystemExit(1)

    print("Starting BMO Social Bot...")
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_run_social_bot())
    except KeyboardInterrupt:
        print("\nSocial bot stopped.")
    finally:
        loop.close()
