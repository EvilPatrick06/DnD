"""BMO Agent — GPU-accelerated AI with local Ollama fallback.

Routes LLM calls to GPU server (EC2 g5.xlarge) for fast 70B model inference.
Falls back to local Ollama (Gemma3:4b) when GPU server is unreachable.
"""

import glob
import json
import os
import random
import re
import datetime
import platform
import time

import requests
import ollama as ollama_client

from dev_tools import dispatch_tool, get_tool_descriptions, MAX_TOOL_CALLS_PER_TURN
from voice_personality import parse_response_tags
from agents.settings import init_settings, get_settings

# ── GPU Server Configuration ─────────────────────────────────────────
# Primary AI brain: EC2 g5.xlarge with A10G 24GB VRAM
GPU_SERVER_URL = os.environ.get("GPU_SERVER_URL", "https://ai.yourdomain.com")
GPU_SERVER_KEY = os.environ.get("GPU_SERVER_KEY", "")
GPU_SERVER_TIMEOUT = 10  # seconds to wait before falling back to local
GPU_HEALTH_CHECK_INTERVAL = 30  # seconds between health checks

# Local fallback model (runs on Pi's CPU)
LOCAL_MODEL = "bmo"
GPU_MODEL = "bmo"

# Track GPU server availability
_gpu_available = None  # None = unknown, True/False = last known state
_gpu_last_check = 0

# ── Platform Detection ────────────────────────────────────────────────
_IS_PI = platform.machine().startswith("aarch64") or platform.machine().startswith("arm")

# Ollama options for LOCAL fallback only (GPU server handles its own config)
if _IS_PI:
    OLLAMA_OPTIONS = {
        "num_ctx": 8192,
        "num_predict": 1024,
        "temperature": 0.8,
    }
    OLLAMA_PLAN_OPTIONS = {
        "num_ctx": 4096,
        "num_predict": 256,
        "temperature": 0.5,
    }
else:
    OLLAMA_OPTIONS = {
        "num_ctx": 32768,
        "num_predict": 2048,
        "temperature": 0.8,
    }
    OLLAMA_PLAN_OPTIONS = {
        "num_ctx": 8192,
        "num_predict": 512,
        "temperature": 0.5,
    }

# Paths BMO has explicit read access to
DND_DATA_DIR = r"C:\Users\evilp\dnd\src\renderer\public\data\5e"


# ── GPU Server Routing ────────────────────────────────────────────────

def _gpu_headers() -> dict:
    """Build auth headers for GPU server."""
    headers = {"Content-Type": "application/json"}
    if GPU_SERVER_KEY:
        headers["Authorization"] = f"Bearer {GPU_SERVER_KEY}"
    return headers


def _check_gpu_available() -> bool:
    """Check if GPU server is reachable. Caches result for GPU_HEALTH_CHECK_INTERVAL."""
    global _gpu_available, _gpu_last_check

    now = time.time()
    if _gpu_available is not None and (now - _gpu_last_check) < GPU_HEALTH_CHECK_INTERVAL:
        return _gpu_available

    try:
        r = requests.get(f"{GPU_SERVER_URL}/health", timeout=3, headers=_gpu_headers())
        _gpu_available = r.status_code == 200
    except Exception:
        _gpu_available = False

    _gpu_last_check = now
    if not _gpu_available:
        print("[agent] GPU server unreachable — using local fallback")
    else:
        print("[agent] GPU server connected")
    return _gpu_available


def _gpu_chat(messages: list[dict], options: dict | None = None) -> str:
    """Call GPU server's LLM endpoint. Returns response text or raises on failure."""
    payload = {
        "model": GPU_MODEL,
        "messages": messages,
        "stream": False,
        "options": options or {},
    }
    r = requests.post(
        f"{GPU_SERVER_URL}/llm/chat",
        json=payload,
        headers=_gpu_headers(),
        timeout=120,
    )
    r.raise_for_status()
    data = r.json()
    return data.get("message", {}).get("content", "")


def _local_chat(messages: list[dict], options: dict | None = None) -> str:
    """Call local Ollama as fallback. Returns response text."""
    response = ollama_client.chat(
        model=LOCAL_MODEL,
        messages=messages,
        options=options or OLLAMA_OPTIONS,
    )
    return response["message"]["content"]


def llm_chat(messages: list[dict], options: dict | None = None) -> str:
    """Route LLM call to GPU server, falling back to local Ollama.

    This is the primary entry point for all LLM calls.
    The user doesn't notice the switch — just slightly slower/less accurate on fallback.
    """
    if _check_gpu_available():
        try:
            return _gpu_chat(messages, options)
        except Exception as e:
            print(f"[agent] GPU LLM failed ({e}), falling back to local")
            global _gpu_available
            _gpu_available = False

    return _local_chat(messages, options)


def rag_search(query: str, domain: str = "dnd", top_k: int = 5) -> list[dict]:
    """Search RAG knowledge base on GPU server."""
    if not _check_gpu_available():
        return []
    try:
        r = requests.post(
            f"{GPU_SERVER_URL}/rag/search",
            json={"query": query, "domain": domain, "top_k": top_k, "source": "bmo"},
            headers=_gpu_headers(),
            timeout=10,
        )
        r.raise_for_status()
        return r.json().get("results", [])
    except Exception as e:
        print(f"[agent] RAG search failed: {e}")
        return []

# Game state persistence
GAMESTATE_DIR = os.path.expanduser("~/bmo/data")
GAMESTATE_FILE = os.path.join(GAMESTATE_DIR, "dnd_gamestate.json")

# System prompt addition for structured command output
COMMAND_INSTRUCTION = """IMPORTANT: Most messages are just conversation. Only use command blocks when the user EXPLICITLY asks you to DO something (play music, set a timer, check the weather, etc.). Questions, chatting, jokes, and opinions do NOT need command blocks.

When an action IS needed, put it at the END of your response in this exact format:

```command
{"action": "action_name", "params": {...}}
```

Available actions:
- music_play: {"query": "song name"} — Search and play a song
- music_pause: {} — Pause/resume music
- music_next: {} — Skip to next track
- music_previous: {} — Previous track
- music_volume: {"level": 50} — Set volume (0-100)
- music_cast: {"device": "device name"} — Cast to a device
- tv_pause: {} — Pause the TV
- tv_play: {} — Resume the TV
- tv_stop: {} — Stop the TV
- tv_volume: {"level": 50} — TV volume (0-100)
- tv_off: {} — Turn off the TV
- device_list: {} — List available smart devices
- calendar_today: {} — Show today's events
- calendar_week: {} — Show this week's events
- calendar_create: {"summary": "Event name", "date": "2026-02-23", "time": "14:00", "duration_hours": 1}
- calendar_delete: {"summary": "Event name"} — Delete an event by name
- timer_set: {"minutes": 10, "label": "Pizza"} — Set a countdown timer
- alarm_set: {"hour": 7, "minute": 30, "label": "Wake up"} — Set an alarm
- timer_cancel: {"label": "Pizza"} — Cancel a timer
- camera_snapshot: {} — Take a photo
- camera_describe: {"prompt": "What do you see?"} — Describe what the camera sees
- camera_motion: {"enabled": true} — Toggle motion detection
- weather: {} — Get current weather
- identify_face: {} — Identify who's in front of the camera
- identify_voice: {} — Identify who's speaking
- read_file: {"path": "monsters/goblin.json"} — Read a file from the D&D 5e data directory
- list_dir: {"path": "monsters"} — List files in a D&D 5e data subdirectory

NEVER describe or mention command blocks in your conversational response. The user cannot see them. Just talk normally as BMO, and silently append the command block at the end only when needed.
"""

# Dev tool calling instruction — appended when coding assistant mode is active
DEV_TOOL_INSTRUCTION = """
You also have access to coding/dev tools. When the user asks you to help with code,
debug something, read files, search the web, run commands, or do any dev work, use
tool_call blocks to invoke tools. You can chain multiple tool calls in one response.

Format:
```tool_call
{"tool": "tool_name", "args": {"param1": "value1"}}
```

{tool_list}

When you receive tool results, analyze them and either make more tool calls or
respond with your findings. You can make up to {max_calls} tool calls per turn.

For destructive operations (delete, overwrite, push), the tool will return
a confirmation request. Tell the user what you want to do and wait for approval.
"""


# ── Map Environmental Effects ────────────────────────────────────────
MAP_ENVIRONMENTS = {
    "barrow-crypt": {
        "name": "Barrow Crypt",
        "hazards": [
            "Haunted Whispers: At initiative count 20, creatures within 30ft of sarcophagi make WIS save DC 12 or become frightened until end of next turn.",
            "Crumbling Floor: Squares marked as unstable require DEX save DC 13 or creature falls 10ft (1d6 bludgeoning) into lower crypt.",
            "Dim Light: Beyond 20ft from torches, all areas are dim light (disadvantage on Perception checks relying on sight).",
        ],
        "atmosphere": "cold, damp stone corridors with faint green phosphorescence on the walls",
    },
    "volcanic-caves": {
        "name": "Volcanic Caves",
        "hazards": [
            "Lava Pools: Creatures entering or starting turn in lava take 2d10 fire damage. Adjacent squares: 1d10 fire damage.",
            "Toxic Fumes: At initiative count 20, all creatures make CON save DC 12 or become poisoned until end of next turn.",
            "Unstable Ground: After loud impacts (Thunder damage, explosions), DEX save DC 14 or knocked prone by tremor.",
        ],
        "atmosphere": "oppressive heat, rivers of molten rock casting orange light, sulfurous air",
    },
    "ship": {
        "name": "Ship",
        "hazards": [
            "Rocking Deck: At initiative count 20, all creatures on deck make DEX save DC 10 or fall prone from a wave.",
            "Rigging: Creatures can climb rigging (Athletics DC 12) to gain high ground (+2 ranged attacks from crow's nest).",
            "Overboard: Creatures pushed off the ship's edge fall into the sea. Swimming requires Athletics DC 12 each turn or be swept 15ft away.",
        ],
        "atmosphere": "creaking timbers, salt spray, the snap of canvas sails in a brisk wind",
    },
    "underdark-warren": {
        "name": "Underdark Warren",
        "hazards": [
            "Total Darkness: No natural light. Creatures without darkvision are blinded. Torches draw attention (encounters within 1d4 rounds).",
            "Fungi Spores: Certain patches release spores when disturbed. CON save DC 13 or poisoned for 1 minute.",
            "Narrow Tunnels: Some passages are 5ft wide — no room to pass, disadvantage on attack rolls with heavy weapons.",
        ],
        "atmosphere": "oppressive silence broken by dripping water, bioluminescent fungi casting eerie purple light",
    },
    "dragons-lair": {
        "name": "Dragon's Lair",
        "hazards": [
            "Lair Actions (Initiative 20): Tremor — all creatures make DEX save DC 15 or fall prone. OR magma eruption — 10ft radius, 2d6 fire damage (DEX save DC 15 half).",
            "Hoard Avalanche: If combat occurs near the treasure hoard, loud impacts cause gold to cascade — DEX save DC 12 or buried (restrained, 5ft dig to free).",
            "Extreme Heat: Creatures without fire resistance that end their turn within 10ft of magma vents take 1d6 fire damage.",
        ],
        "atmosphere": "immense cavern with pillars of volcanic rock, a glittering hoard of gold and gems, the acrid smell of brimstone",
    },
    "dungeon-hideout": {
        "name": "Dungeon Hideout",
        "hazards": [
            "Trapped Hallways: Investigation DC 14 to spot tripwires. Failure triggers crossbow bolt (1d8+2 piercing, +6 to hit) or pit trap (2d6 falling).",
            "Barricades: Bandits have overturned tables and crates for half cover (+2 AC, +2 DEX saves).",
            "Dim Torchlight: Torches every 30ft. Between them, dim light. Alcoves are in darkness (good for hiding).",
        ],
        "atmosphere": "rough-hewn stone walls, the smell of stale beer and sweat, scattered playing cards and stolen goods",
    },
    "farmstead": {
        "name": "Farmstead",
        "hazards": [
            "Haystacks: Provide full cover but are flammable. Any fire damage ignites them (1d6 fire damage to adjacent creatures each turn).",
            "Livestock Panic: If combat starts near the barn, panicking animals burst out. DEX save DC 11 or take 1d6 bludgeoning and be pushed 10ft.",
            "Muddy Ground: After rain, open ground is difficult terrain. Prone creatures require Athletics DC 10 to stand.",
        ],
        "atmosphere": "rolling fields of golden wheat, a weathered red barn, the sound of chickens and a distant cowbell",
    },
    "crossroads-village": {
        "name": "Crossroads Village",
        "hazards": [
            "Civilians: 2d6 commoners are present. They flee in random directions, providing half cover but also getting in the way.",
            "Market Stalls: Provide half cover. Can be toppled (Athletics DC 12) to create difficult terrain in a 10ft area.",
            "Buildings: Doors can be barred (Athletics DC 15 to force). Second-story windows give advantage on ranged attacks against targets below.",
        ],
        "atmosphere": "a bustling crossroads with a stone well at the center, market stalls, half-timbered buildings, and a weathered signpost",
    },
    "roadside-inn": {
        "name": "Roadside Inn",
        "hazards": [
            "Tavern Furniture: Tables provide half cover. Chairs can be thrown (improvised weapon, 1d4 bludgeoning, range 20/60).",
            "Chandelier: Can be cut down (AC 11, 5 HP). Falls on 10ft area — DEX save DC 12 or 2d6 bludgeoning + prone. Then oil fire (1d6 fire/turn).",
            "Cramped Quarters: Upstairs hallway is 5ft wide. No room for large creatures. Disadvantage on two-handed weapon attacks.",
        ],
        "atmosphere": "warm firelight, the smell of roasting meat and ale, wooden beams hung with dried herbs",
    },
    "spooky-house": {
        "name": "Spooky House",
        "hazards": [
            "Haunted Objects: At initiative count 20, one random object (chair, portrait, candlestick) animates and attacks nearest creature: +4 to hit, 1d6 bludgeoning.",
            "Rotting Floors: Certain squares give way under weight >100lbs. DEX save DC 13 or fall 10ft to basement (1d6 bludgeoning).",
            "Choking Dust: Disturbing old rooms fills the air with dust. Creatures in the area make CON save DC 11 or are blinded until end of next turn.",
        ],
        "atmosphere": "creaking floorboards, cobwebs in every corner, portraits whose eyes seem to follow you, a persistent cold draft",
    },
    "keep": {
        "name": "Keep",
        "hazards": [
            "Arrow Slits: Defenders behind arrow slits have three-quarters cover (+5 AC, +5 DEX saves) and can attack with ranged weapons.",
            "Murder Holes: Above the gatehouse, defenders can pour boiling oil. 10ft area, 2d6 fire damage, DEX save DC 13 half.",
            "Battlements: Creatures atop the walls can push enemies off (Athletics contest). Fall is 20ft (2d6 bludgeoning).",
        ],
        "atmosphere": "grey stone walls topped with crenellations, a heavy portcullis, banners snapping in the wind",
    },
    "manor": {
        "name": "Manor",
        "hazards": [
            "Grand Staircase: Creatures pushed down the stairs take 1d6 bludgeoning per 10ft and land prone at the bottom.",
            "Glass Windows: Can be shattered (AC 13, 3 HP) for an escape route. Creatures passing through take 1d4 slashing.",
            "Servants' Passages: Hidden doors (Investigation DC 15) lead to narrow passages connecting rooms — useful for flanking.",
        ],
        "atmosphere": "polished marble floors, crystal chandeliers, portraits of stern nobles, the faint scent of lavender",
    },
    "mine": {
        "name": "Mine",
        "hazards": [
            "Cave-In Risk: Thunder damage or loud explosions trigger CON save DC 14 or 2d8 bludgeoning from falling rocks in 15ft radius.",
            "Mine Cart Tracks: Carts can be pushed (Athletics DC 12) at targets. +4 to hit, 2d6 bludgeoning, and target is pushed 10ft.",
            "Flooded Lower Level: Water is 3ft deep (difficult terrain). Creatures knocked prone must hold breath or begin drowning.",
        ],
        "atmosphere": "rough-cut tunnels shored up with rotting timbers, the glint of ore in the walls, the echo of dripping water",
    },
    "caravan-encampment": {
        "name": "Caravan Encampment",
        "hazards": [
            "Wagon Circle: Wagons provide full cover. Can be climbed (Athletics DC 10) for elevation advantage.",
            "Campfire: 5ft area deals 1d6 fire damage to creatures entering or starting turn in it. Can be kicked to scatter embers in 10ft.",
            "Draft Animals: Horses and oxen panic in combat. At initiative count 20, they bolt in a random direction. DEX save DC 11 or 1d6 bludgeoning.",
        ],
        "atmosphere": "circled wagons around a crackling fire, the smell of trail rations, canvas tents flapping in the night breeze",
    },
    "wizards-tower": {
        "name": "Wizard's Tower",
        "hazards": [
            "Wild Magic Zone: When a spell of 1st level or higher is cast, roll d20. On a 1, a random Wild Magic Surge occurs.",
            "Animated Books: At initiative count 20, books fly off shelves and swarm one creature. WIS save DC 13 or blinded until end of next turn.",
            "Arcane Wards: Certain doorways have glyphs. First creature to pass through takes 2d6 force damage (INT save DC 14 half). Investigation DC 14 to spot.",
        ],
        "atmosphere": "spiraling stone staircase, shelves overflowing with tomes and scrolls, alchemical equipment bubbling, an astrolabe spinning on its own",
    },
}


def _summarize_character(data: dict) -> str:
    """Build a concise character summary string from a .dndchar JSON file."""
    name = data.get("name", "Unknown")
    species = data.get("species", "Unknown")
    classes = data.get("classes", [])
    class_str = ", ".join(f"{c['name']} {c['level']}" for c in classes) if classes else "Unknown"
    level = data.get("level", 1)
    background = data.get("background", "Unknown")
    alignment = data.get("alignment", "Unknown")
    hp = data.get("hitPoints", {})
    ac = data.get("armorClass", 10)
    speed = data.get("speed", 30)
    size = data.get("size", "Medium")
    abilities = data.get("abilityScores", {})
    details = data.get("details", {})
    proficiencies = data.get("proficiencies", {})
    features = data.get("features", [])
    weapons = data.get("weapons", [])
    equipment = data.get("equipment", [])
    spellcasting = data.get("spellcasting", {})
    known_spells = data.get("knownSpells", [])
    senses = data.get("senses", [])
    resistances = data.get("resistances", [])
    skills = data.get("skills", [])

    # Ability scores
    ab_str = ", ".join(f"{k[:3].upper()} {v}" for k, v in abilities.items())

    # Proficient skills
    prof_skills = [s["name"] + (" (expertise)" if s.get("expertise") else "")
                   for s in skills if s.get("proficient")]

    # Weapons
    wep_str = "; ".join(f"{w['name']} ({w['damage']} {w['damageType']})" for w in weapons)

    # Equipment (just names)
    equip_names = [f"{e['name']} x{e.get('quantity',1)}" for e in equipment[:15]]

    # Features
    feat_str = "; ".join(f"{f['name']}: {f['description'][:80]}" for f in features)

    # Spells
    spell_str = ""
    if known_spells:
        cantrips = [s["name"] for s in known_spells if s.get("level", 0) == 0]
        leveled = [f"{s['name']} (lvl {s['level']})" for s in known_spells if s.get("level", 0) > 0]
        slot_info = data.get("spellSlotLevels", {})
        parts = []
        if cantrips:
            parts.append(f"Cantrips: {', '.join(cantrips)}")
        if leveled:
            parts.append(f"Spells: {', '.join(leveled)}")
        if slot_info:
            slots = ", ".join(f"Lvl {k}: {v['max']}" for k, v in slot_info.items())
            parts.append(f"Slots: {slots}")
        if spellcasting:
            parts.append(f"Save DC {spellcasting.get('spellSaveDC', '?')}, Attack +{spellcasting.get('spellAttackBonus', '?')}")
        spell_str = " | ".join(parts)

    lines = [
        f"## {name}",
        f"{species} {class_str} (Level {level}), {background}, {alignment}",
        f"HP: {hp.get('maximum', '?')}, AC: {ac}, Speed: {speed} ft, Size: {size}",
        f"Abilities: {ab_str}",
        f"Proficient Skills: {', '.join(prof_skills) if prof_skills else 'None'}",
        f"Saves: {', '.join(proficiencies.get('savingThrows', []))}",
        f"Languages: {', '.join(proficiencies.get('languages', []))}",
        f"Weapons: {wep_str}" if wep_str else "",
        f"Equipment: {', '.join(equip_names)}" if equip_names else "",
        f"Features: {feat_str}" if feat_str else "",
        f"Spellcasting: {spell_str}" if spell_str else "",
        f"Senses: {', '.join(senses)}" if senses else "",
        f"Resistances: {', '.join(resistances)}" if resistances else "",
        f"Personality: {details.get('personality', 'N/A')}",
        f"Ideals: {details.get('ideals', 'N/A')}",
        f"Bonds: {details.get('bonds', 'N/A')}",
        f"Flaws: {details.get('flaws', 'N/A')}",
        f"Appearance: {details.get('appearance', 'N/A')}",
    ]
    return "\n".join(line for line in lines if line)


def _load_character_file(path: str) -> dict | None:
    """Load a .dndchar JSON file, returning None on failure."""
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[agent] Failed to load character file {path}: {e}")
        return None


def _discover_maps(maps_dir: str) -> list[str]:
    """Return list of map filenames (without extension) from the maps directory."""
    maps = []
    if os.path.isdir(maps_dir):
        for f in sorted(os.listdir(maps_dir)):
            if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                maps.append(os.path.splitext(f)[0])
    return maps


def _parse_cr(cr) -> float:
    """Parse a CR value that might be a string like '1/4'."""
    if isinstance(cr, (int, float)):
        return float(cr)
    if isinstance(cr, str):
        if "/" in cr:
            n, d = cr.split("/")
            return float(n) / float(d)
        try:
            return float(cr)
        except ValueError:
            return 99.0
    return 99.0


def _build_dm_data_context(party_level: int) -> str:
    """Build a LIGHTWEIGHT data context — just monster names/CR and directory listing.
    Full stat blocks and NPC tables are loaded on demand when needed.
    """
    sections = []
    max_cr = party_level + 2

    # ── Monster Index (names + CR only — lightweight) ─────────────
    monsters_file = os.path.join(DND_DATA_DIR, "creatures", "monsters.json")
    try:
        with open(monsters_file, encoding="utf-8") as f:
            all_monsters = json.load(f)
        usable = [m for m in all_monsters if _parse_cr(m.get("cr", 99)) <= max_cr]
        usable.sort(key=lambda m: (_parse_cr(m.get("cr", 0)), m["name"]))
        lines = [f"  CR {m['cr']}: {m['name']} ({m['type']})" for m in usable]
        sections.append(
            f"# MONSTER INDEX (CR 0–{max_cr}, {len(usable)} creatures)\n"
            f"These are available monsters by name and CR. When you decide to use a monster in combat,\n"
            f"use the read_file command to load its full stat block:\n"
            f'  read_file {{"path": "creatures/monsters.json"}} — then find the monster by name\n'
            + "\n".join(lines)
        )
    except Exception as e:
        print(f"[agent] Failed to load monster index: {e}")

    # ── Available Data Directories ────────────────────────────────
    try:
        dirs = sorted(os.listdir(DND_DATA_DIR))
        dir_listing = ", ".join(dirs)
        sections.append(
            f"# D&D DATA FILES\n"
            f"Root: {DND_DATA_DIR}\n"
            f"Subdirectories: {dir_listing}\n\n"
            f"Use these commands to load data ON DEMAND (do NOT preload everything):\n"
            f"- read_file: {{\"path\": \"npc/npc-names.json\"}} — Load NPC name tables when introducing a random NPC\n"
            f"- read_file: {{\"path\": \"npc/npc-appearance.json\"}} — Load appearance tables for random NPCs\n"
            f"- read_file: {{\"path\": \"npc/personality-tables.json\"}} — Load personality traits\n"
            f"- read_file: {{\"path\": \"encounters/encounter-presets.json\"}} — Load encounter templates\n"
            f"- read_file: {{\"path\": \"adventures/adventures.json\"}} — Load adventure hooks for story ideas\n"
            f"- list_dir: {{\"path\": \"subdir\"}} — Browse any subdirectory\n\n"
            f"KEY STORY NPCs: Craft these yourself with unique names, personalities, and motivations.\n"
            f"RANDOM/MINOR NPCs (shopkeepers, guards, tavern patrons): Use the NPC tables from the data files."
        )
    except Exception:
        pass

    return "\n\n".join(sections)


def _calculate_encounter_difficulty(party_size: int, party_level: int, monsters: list[tuple[str, int]]) -> str:
    """Calculate encounter difficulty using DMG XP budgets.

    Args:
        party_size: Number of player characters
        party_level: Average party level
        monsters: List of (monster_name, count) tuples

    Returns:
        String with difficulty rating and XP breakdown
    """
    # Load encounter budgets
    budgets_file = os.path.join(DND_DATA_DIR, "encounters", "encounter-budgets.json")
    try:
        with open(budgets_file, encoding="utf-8") as f:
            budgets_data = json.load(f)
    except Exception:
        return "Could not load encounter budgets."

    # Find budget for this level
    per_char = None
    for entry in budgets_data.get("perCharacterBudget", []):
        if entry["level"] == party_level:
            per_char = entry
            break
    if not per_char:
        # Clamp to nearest
        per_char = budgets_data["perCharacterBudget"][-1] if party_level > 20 else budgets_data["perCharacterBudget"][0]

    low_budget = per_char["low"] * party_size
    mod_budget = per_char["moderate"] * party_size
    high_budget = per_char["high"] * party_size

    # Load monster data for XP values
    monsters_file = os.path.join(DND_DATA_DIR, "creatures", "monsters.json")
    try:
        with open(monsters_file, encoding="utf-8") as f:
            all_monsters = json.load(f)
    except Exception:
        return "Could not load monster data."

    monster_lookup = {m["name"].lower(): m for m in all_monsters}

    total_xp = 0
    breakdown = []
    for name, count in monsters:
        m = monster_lookup.get(name.lower())
        if m:
            xp = m.get("xp", 0) * count
            total_xp += xp
            breakdown.append(f"{name} x{count} = {xp} XP")
        else:
            breakdown.append(f"{name} x{count} = ?? XP (not found)")

    # Determine difficulty
    if total_xp <= low_budget:
        difficulty = "Low"
    elif total_xp <= mod_budget:
        difficulty = "Moderate"
    elif total_xp <= high_budget:
        difficulty = "High"
    else:
        difficulty = "Overwhelming"

    warning = ""
    if difficulty == "Overwhelming":
        warning = "\nWARNING: This encounter is Overwhelming for the party. Consider reducing monsters or providing an escape route."

    return (
        f"Encounter Difficulty: {difficulty}\n"
        f"Total XP: {total_xp}\n"
        f"Party Budget (Lvl {party_level}, {party_size} chars): Low {low_budget} / Moderate {mod_budget} / High {high_budget}\n"
        f"Monsters: {', '.join(breakdown)}"
        f"{warning}"
    )


def _load_monster_stat_block(monster_name: str) -> str | None:
    """Load the full stat block for a specific monster by name."""
    monsters_file = os.path.join(DND_DATA_DIR, "creatures", "monsters.json")
    try:
        with open(monsters_file, encoding="utf-8") as f:
            all_monsters = json.load(f)
        for m in all_monsters:
            if m["name"].lower() == monster_name.lower():
                return json.dumps(m, indent=2)
    except Exception:
        pass
    return None


class BmoAgent:
    """Manages conversations with the BMO Ollama model and parses action commands.

    Delegates to the multi-agent orchestrator for routing to specialized agents.
    Keeps shared infrastructure: llm_chat, rag_search, history, command parsing.
    """

    def __init__(self, services: dict = None, socketio=None):
        self.services = services or {}
        self.socketio = socketio
        self.conversation_history: list[dict] = []
        self._pending_confirmations: list[dict] = []  # Destructive ops awaiting user OK

        # Initialize hierarchical settings system
        self.settings = init_settings()
        self._apply_settings_globals()
        self._max_history = self.settings.get("ui.max_history", 200)

        # Start file watcher for hot reload
        self.settings.on_change(self._apply_settings_globals)
        self.settings.start_watching()

        # Initialize the multi-agent orchestrator
        from agents.orchestrator import AgentOrchestrator
        from agents.scratchpad import SharedScratchpad
        from agents.conversation import create_conversation_agent
        from agents.code_agent import create_code_agent
        from agents.dnd_dm import create_dnd_dm_agent
        from agents.plan_agent import create_plan_agent
        from agents.research_agent import create_research_agent

        self.orchestrator = AgentOrchestrator(
            services=self.services,
            socketio=self.socketio,
            llm_func=llm_chat,
            settings=self.settings,
        )

        # Create and register core agents
        scratchpad = self.orchestrator.scratchpad
        core_agents = [
            create_conversation_agent(scratchpad, self.services, self.socketio),
            create_code_agent(scratchpad, self.services, self.socketio),
            create_dnd_dm_agent(scratchpad, self.services, self.socketio),
            create_plan_agent(scratchpad, self.services, self.socketio),
            create_research_agent(scratchpad, self.services, self.socketio),
        ]
        self.orchestrator.register_agents(core_agents)

        # Try to register all remaining specialized agents
        try:
            from agents._registry import create_all_agents
            extra_agents = create_all_agents(scratchpad, self.services, self.socketio)
            self.orchestrator.register_agents(extra_agents)
        except ImportError:
            pass  # Remaining agents not yet implemented

        # Initialize MCP manager if servers are configured
        self._init_mcp()

        # Register MCP reload callback for hot-reload
        self.settings.on_change(self._reload_mcp_servers)

    def _init_mcp(self) -> None:
        """Initialize MCP manager if any servers are configured."""
        servers = self.settings.get("mcp.servers", {})
        if servers:
            try:
                from agents.mcp_manager import McpManager
                manager = McpManager(self.settings)
                manager.initialize()
                self.orchestrator.mcp_manager = manager
                status = manager.get_status()
                print(f"[mcp] Initialized: {status['connected']}/{status['total']} servers, {status['total_tools']} tools")
            except Exception as e:
                print(f"[mcp] Failed to initialize: {e}")

    def _reload_mcp_servers(self) -> None:
        """Reload MCP server connections when settings change."""
        servers = self.settings.get("mcp.servers", {})
        manager = self.orchestrator.mcp_manager

        if not servers and manager:
            # All servers removed — shut down
            manager.shutdown()
            self.orchestrator.mcp_manager = None
            print("[mcp] All servers removed")
        elif servers and not manager:
            # Servers added — initialize
            self._init_mcp()
        elif servers and manager:
            # Servers changed — reconcile
            current = set(manager._clients.keys())
            desired = set(servers.keys())

            # Remove deleted servers
            for name in current - desired:
                manager.remove_server(name)
                print(f"[mcp] Removed server: {name}")

            # Add new / update existing servers
            for name in desired:
                if name not in current:
                    manager.add_server(name, servers[name])
                    print(f"[mcp] Added server: {name}")

    # ── Settings ─────────────────────────────────────────────────────

    def _apply_settings_globals(self) -> None:
        """Apply LLM-related settings to module-level globals."""
        global GPU_SERVER_URL, GPU_SERVER_KEY, GPU_SERVER_TIMEOUT
        global GPU_HEALTH_CHECK_INTERVAL, LOCAL_MODEL, GPU_MODEL
        global OLLAMA_OPTIONS, OLLAMA_PLAN_OPTIONS

        s = self.settings
        GPU_SERVER_URL = s.get("llm.gpu_server_url", GPU_SERVER_URL)
        GPU_SERVER_KEY = s.get("llm.gpu_server_key", GPU_SERVER_KEY)
        GPU_SERVER_TIMEOUT = s.get("llm.gpu_server_timeout", GPU_SERVER_TIMEOUT)
        GPU_HEALTH_CHECK_INTERVAL = s.get("llm.gpu_health_check_interval", GPU_HEALTH_CHECK_INTERVAL)
        LOCAL_MODEL = s.get("llm.local_model", LOCAL_MODEL)
        GPU_MODEL = s.get("llm.gpu_model", GPU_MODEL)
        OLLAMA_OPTIONS = s.get("llm.ollama_options", OLLAMA_OPTIONS)
        OLLAMA_PLAN_OPTIONS = s.get("llm.ollama_plan_options", OLLAMA_PLAN_OPTIONS)

        # Update max_history if changed
        self._max_history = s.get("ui.max_history", 200)

    # ── Context Compression ──────────────────────────────────────────

    def compact(self) -> str:
        """Summarize conversation history to reclaim context.

        Keeps the most recent messages verbatim and replaces older ones
        with an LLM-generated summary.
        """
        preserve_last = self.settings.get("ui.compact_preserve_last", 5)

        if len(self.conversation_history) <= preserve_last + 1:
            return "Nothing to compact — history is already short."

        # Split: old messages to summarize, recent to keep verbatim
        to_summarize = self.conversation_history[:-preserve_last]
        to_keep = self.conversation_history[-preserve_last:]

        # Ask LLM to summarize
        summary_prompt = [
            {"role": "system", "content": (
                "Summarize this conversation concisely. Capture key decisions, "
                "important context, and any ongoing tasks. Keep it to 2-3 paragraphs."
            )},
            *to_summarize,
            {"role": "user", "content": "Summarize the above conversation."},
        ]
        summary = llm_chat(summary_prompt, OLLAMA_PLAN_OPTIONS)

        # Replace history
        old_count = len(to_summarize)
        self.conversation_history = [
            {"role": "system", "content": f"[Conversation Summary]\n{summary}"},
            *to_keep,
        ]

        return f"Compacted {old_count} messages into summary. Kept last {preserve_last}."

    # ── Chat ─────────────────────────────────────────────────────────

    def chat(self, user_message: str, speaker: str = "unknown") -> dict:
        """Send a message to BMO and get a response.

        Delegates to the multi-agent orchestrator for routing, then handles
        command parsing, tag extraction, and history management.

        Returns {text, commands_executed, tags} where tags contains parsed
        hardware control tags (face, led, sound, emotion, music, npc).
        """
        # Handle pending destructive confirmations (from code agent)
        if self._pending_confirmations and user_message.lower().strip() in ("yes", "y", "confirm", "do it"):
            return self._execute_pending_confirmation(speaker)

        # Add speaker context
        if speaker != "unknown":
            context_msg = f"[Speaker: {speaker}] {user_message}"
        else:
            context_msg = user_message

        self.conversation_history.append({"role": "user", "content": context_msg})

        # Trim history
        if len(self.conversation_history) > self._max_history:
            self.conversation_history = self.conversation_history[-self._max_history:]

        # Auto-compact if threshold reached
        threshold = self.settings.get("ui.auto_compact_threshold", 150)
        if threshold > 0 and len(self.conversation_history) >= threshold:
            compact_msg = self.compact()
            print(f"[agent] Auto-compact: {compact_msg}")

        try:
            # Route to the best agent via orchestrator
            result = self.orchestrator.handle(
                message=user_message,
                speaker=speaker,
                history=self.conversation_history,
                services=self.services,
            )
            reply = result.get("text", "")
            agent_used = result.get("agent_used", "conversation")
        except Exception as e:
            reply = f"Oh no! BMO's brain is fuzzy right now... ({e})"
            agent_used = "error"

        self.conversation_history.append({"role": "assistant", "content": reply})

        # Parse and execute BMO command blocks (music, tv, calendar, etc.)
        text, commands = self._parse_response(reply)
        results = []
        for cmd in commands:
            cmd_result = self._execute_command(cmd)
            results.append(cmd_result)

        # Parse response tags for hardware control ([FACE:x], [LED:x], etc.)
        tags = parse_response_tags(text)
        text = tags.pop("clean_text", text)

        return {
            "text": text,
            "speaker": speaker,
            "commands_executed": results,
            "tags": tags,
            "agent_used": agent_used,
        }

    # ── Confirmation Handling (shared across agents) ────────────────

    def _execute_pending_confirmation(self, speaker: str) -> dict:
        """Execute all pending destructive operations after user confirmation."""
        from dev_tools import execute_confirmed, write_file_confirmed

        results_text = []
        for pc in self._pending_confirmations:
            tool = pc["tool"]
            args = pc["args"]
            print(f"[agent] Confirmed: {tool}({json.dumps(args)[:100]})")

            if tool == "execute_command":
                result = execute_confirmed(args.get("cmd", ""), args.get("cwd"))
            elif tool == "write_file":
                result = write_file_confirmed(args.get("path", ""), args.get("content", ""))
            elif tool == "ssh_command":
                result = execute_confirmed(
                    f"ssh {args.get('host', '')} {args.get('cmd', '')}",
                )
            else:
                result = dispatch_tool(tool, args)

            results_text.append(f"{tool}: {json.dumps(result)[:500]}")

        self._pending_confirmations = []
        text = "BMO executed the confirmed operations:\n" + "\n".join(results_text)

        return {
            "text": text,
            "speaker": speaker,
            "commands_executed": [],
            "tags": {},
        }

    # ── DnD Delegators (app.py backward compatibility) ────────────

    @property
    def _dnd_context(self):
        """Delegate to DnD DM agent's context."""
        dm = self.orchestrator.agents.get("dnd_dm")
        return dm._dnd_context if dm else None

    @_dnd_context.setter
    def _dnd_context(self, value):
        dm = self.orchestrator.agents.get("dnd_dm")
        if dm:
            dm._dnd_context = value

    @property
    def _dnd_pending(self):
        dm = self.orchestrator.agents.get("dnd_dm")
        return dm._dnd_pending if dm else None

    @_dnd_pending.setter
    def _dnd_pending(self, value):
        dm = self.orchestrator.agents.get("dnd_dm")
        if dm:
            dm._dnd_pending = value

    @property
    def _gamestate(self):
        dm = self.orchestrator.agents.get("dnd_dm")
        return dm._gamestate if dm else None

    @_gamestate.setter
    def _gamestate(self, value):
        dm = self.orchestrator.agents.get("dnd_dm")
        if dm:
            dm._gamestate = value

    def load_dnd_context(self, character_paths: list[str], maps_dir: str, chosen_map: str | None = None) -> str:
        """Delegate to DnD DM agent."""
        dm = self.orchestrator.agents.get("dnd_dm")
        if dm:
            return dm.load_dnd_context(character_paths, maps_dir, chosen_map)
        return "unknown"

    def get_gamestate(self) -> dict:
        """Delegate to DnD DM agent."""
        dm = self.orchestrator.agents.get("dnd_dm")
        if dm:
            return dm.get_gamestate()
        return {}

    def get_player_names(self) -> list[str]:
        """Delegate to DnD DM agent."""
        dm = self.orchestrator.agents.get("dnd_dm")
        if dm:
            return dm.get_player_names()
        return []

    def generate_session_recap(self, messages: list[dict]) -> str:
        """Delegate to DnD DM agent."""
        dm = self.orchestrator.agents.get("dnd_dm")
        if dm:
            return dm.generate_session_recap(messages)
        return ""

    def _is_dnd_request(self, message: str) -> bool:
        """Detect if the user is asking BMO to be a DM."""
        lower = message.lower()
        dm_keywords = ["be the dm", "dungeon master", "dnd campaign", "d&d campaign",
                       "one shot", "one-shot", "run a campaign", "dm for"]
        return any(kw in lower for kw in dm_keywords)

    def _auto_load_dnd(self, message: str) -> None:
        """Delegate to DnD DM agent."""
        dm = self.orchestrator.agents.get("dnd_dm")
        if dm:
            dm._auto_load_dnd(message)

    # ── Removed Methods (now in specialized agents) ──────────────
    # _is_dev_request → handled by AgentRouter
    # _run_tool_loop → agents/code_agent.py
    # _parse_tool_calls → agents/base_agent.py
    # _strip_tool_calls → agents/base_agent.py
    # _dm_planning_phase → agents/dnd_dm.py

    # ── Command Parsing ──────────────────────────────────────────────

    def _parse_response(self, response: str) -> tuple[str, list[dict]]:
        """Extract the conversational text and any command blocks from the response."""
        commands = []

        # Find ```command ... ``` blocks (proper fenced format)
        fenced_pattern = r"```command\s*\n?(.*?)\n?```"
        matches = re.findall(fenced_pattern, response, re.DOTALL)

        for match in matches:
            try:
                cmd = json.loads(match.strip())
                commands.append(cmd)
            except json.JSONDecodeError:
                print(f"[agent] Failed to parse command: {match}")

        # Remove fenced command blocks from the display text
        text = re.sub(fenced_pattern, "", response, flags=re.DOTALL)

        # Also catch inline JSON command objects that BMO sometimes writes
        # without proper fencing (e.g. {"action": "...", "params": {...}})
        inline_pattern = r'\{["\']action["\']:\s*["\'][^"\']+["\'],\s*["\']params["\']:\s*\{[^}]*\}\s*\}'
        inline_matches = re.findall(inline_pattern, text)
        for match in inline_matches:
            try:
                cmd = json.loads(match.replace("'", '"'))
                commands.append(cmd)
            except (json.JSONDecodeError, ValueError):
                pass
        text = re.sub(inline_pattern, "", text)

        # Remove lines that only talk about command blocks (not real content)
        lines = text.split('\n')
        cleaned_lines = []
        for line in lines:
            lower = line.lower().strip()
            # Skip lines that are purely about command blocks
            if any(phrase in lower for phrase in [
                'command block', 'include the following', 'your command should',
                'here is the command', 'the command for this',
            ]):
                continue
            cleaned_lines.append(line)
        text = '\n'.join(cleaned_lines)

        # Remove leading dashes/bullets that are orphaned from stripped content
        text = re.sub(r'^\s*[—\-\*]\s*$', '', text, flags=re.MULTILINE)

        # Clean up extra whitespace
        text = re.sub(r'\n{3,}', '\n\n', text).strip()

        return text, commands

    # ── Command Execution ────────────────────────────────────────────

    def _execute_command(self, cmd: dict) -> dict:
        """Execute a parsed command and return the result."""
        action = cmd.get("action", "")
        params = cmd.get("params", {})

        try:
            handler = self._get_handler(action)
            if handler:
                result = handler(params)
                return {"action": action, "success": True, "result": result}
            else:
                return {"action": action, "success": False, "error": f"Unknown action: {action}"}
        except Exception as e:
            print(f"[agent] Command failed: {action} — {e}")
            return {"action": action, "success": False, "error": str(e)}

    def _get_handler(self, action: str):
        """Map action names to handler functions."""
        handlers = {
            # Music
            "music_play": self._handle_music_play,
            "music_pause": self._handle_music_pause,
            "music_next": self._handle_music_next,
            "music_previous": self._handle_music_previous,
            "music_volume": self._handle_music_volume,
            "music_cast": self._handle_music_cast,
            # TV / Smart Home
            "tv_pause": self._handle_tv_pause,
            "tv_play": self._handle_tv_play,
            "tv_stop": self._handle_tv_stop,
            "tv_volume": self._handle_tv_volume,
            "tv_off": self._handle_tv_off,
            "device_list": self._handle_device_list,
            # Calendar
            "calendar_today": self._handle_calendar_today,
            "calendar_week": self._handle_calendar_week,
            "calendar_create": self._handle_calendar_create,
            "calendar_delete": self._handle_calendar_delete,
            # Timer / Alarm
            "timer_set": self._handle_timer_set,
            "alarm_set": self._handle_alarm_set,
            "timer_cancel": self._handle_timer_cancel,
            # Camera
            "camera_snapshot": self._handle_camera_snapshot,
            "camera_describe": self._handle_camera_describe,
            "camera_motion": self._handle_camera_motion,
            # Other
            "weather": self._handle_weather,
            "identify_face": self._handle_identify_face,
            "identify_voice": self._handle_identify_voice,
            # File access (D&D data)
            "read_file": self._handle_read_file,
            "list_dir": self._handle_list_dir,
        }
        return handlers.get(action)

    # ── Music Handlers ───────────────────────────────────────────────

    def _handle_music_play(self, params):
        music = self.services.get("music")
        if not music:
            return "Music service not available"
        query = params.get("query", "")
        results = music.search(query, limit=5)
        if results:
            music.play(results[0])
            return f"Playing: {results[0]['title']} by {results[0]['artist']}"
        return f"No results found for '{query}'"

    def _handle_music_pause(self, params):
        music = self.services.get("music")
        if music:
            music.pause()
            return "Toggled pause"

    def _handle_music_next(self, params):
        music = self.services.get("music")
        if music:
            music.next_track()
            return "Skipped to next track"

    def _handle_music_previous(self, params):
        music = self.services.get("music")
        if music:
            music.previous_track()
            return "Went to previous track"

    def _handle_music_volume(self, params):
        music = self.services.get("music")
        if music:
            music.set_volume(params.get("level", 50))
            return f"Volume set to {params.get('level', 50)}%"

    def _handle_music_cast(self, params):
        music = self.services.get("music")
        if music:
            music.set_output_device(params.get("device", "pi"))
            return f"Output switched to {params.get('device', 'pi')}"

    # ── TV / Smart Home Handlers ─────────────────────────────────────

    def _handle_tv_pause(self, params):
        home = self.services.get("smart_home")
        if home:
            # Find first TV device
            for d in home.get_devices():
                if "tv" in d["name"].lower():
                    home.pause(d["name"])
                    return f"Paused {d['name']}"
        return "No TV found"

    def _handle_tv_play(self, params):
        home = self.services.get("smart_home")
        if home:
            for d in home.get_devices():
                if "tv" in d["name"].lower():
                    home.play(d["name"])
                    return f"Resumed {d['name']}"
        return "No TV found"

    def _handle_tv_stop(self, params):
        home = self.services.get("smart_home")
        if home:
            for d in home.get_devices():
                if "tv" in d["name"].lower():
                    home.stop(d["name"])
                    return f"Stopped {d['name']}"
        return "No TV found"

    def _handle_tv_volume(self, params):
        home = self.services.get("smart_home")
        if home:
            level = params.get("level", 50) / 100.0
            for d in home.get_devices():
                if "tv" in d["name"].lower():
                    home.set_volume(d["name"], level)
                    return f"TV volume set to {params.get('level', 50)}%"
        return "No TV found"

    def _handle_tv_off(self, params):
        home = self.services.get("smart_home")
        if home:
            for d in home.get_devices():
                if "tv" in d["name"].lower():
                    home.quit_app(d["name"])
                    return f"Turned off {d['name']}"
        return "No TV found"

    def _handle_device_list(self, params):
        home = self.services.get("smart_home")
        if home:
            return home.get_devices()
        return []

    # ── Calendar Handlers ────────────────────────────────────────────

    def _handle_calendar_today(self, params):
        cal = self.services.get("calendar")
        if cal:
            events = cal.get_today_events()
            if not events:
                return "No events today!"
            return events

    def _handle_calendar_week(self, params):
        cal = self.services.get("calendar")
        if cal:
            return cal.get_upcoming_events(days_ahead=7)

    def _handle_calendar_create(self, params):
        cal = self.services.get("calendar")
        if not cal:
            return "Calendar not available"

        date_str = params.get("date", "")
        time_str = params.get("time", "12:00")
        duration = params.get("duration_hours", 1)

        start = datetime.datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        end = start + datetime.timedelta(hours=duration)

        event = cal.create_event(
            summary=params.get("summary", "New Event"),
            start_dt=start,
            end_dt=end,
            description=params.get("description", ""),
        )
        return f"Created: {event['summary']} at {event['start']}"

    def _handle_calendar_delete(self, params):
        cal = self.services.get("calendar")
        if not cal:
            return "Calendar not available"

        summary = params.get("summary", "").lower()
        events = cal.get_upcoming_events(days_ahead=30)
        for event in events:
            if summary in event["summary"].lower():
                cal.delete_event(event["id"])
                return f"Deleted: {event['summary']}"
        return f"No event found matching '{params.get('summary', '')}'"

    # ── Timer / Alarm Handlers ───────────────────────────────────────

    def _handle_timer_set(self, params):
        timers = self.services.get("timers")
        if timers:
            minutes = params.get("minutes", 5)
            label = params.get("label", "")
            timer = timers.create_timer(minutes * 60, label)
            return f"Timer set for {minutes} minutes"

    def _handle_alarm_set(self, params):
        timers = self.services.get("timers")
        if timers:
            alarm = timers.create_alarm(
                params.get("hour", 7),
                params.get("minute", 0),
                params.get("label", ""),
            )
            return f"Alarm set for {alarm['target_time']}"

    def _handle_timer_cancel(self, params):
        timers = self.services.get("timers")
        if not timers:
            return "Timer service not available"
        label = params.get("label", "").lower()
        for item in timers.get_all():
            if item["type"] == "timer" and label in item["label"].lower():
                timers.cancel_timer(item["id"])
                return f"Cancelled timer: {item['label']}"
        return f"No timer found matching '{label}'"

    # ── Camera Handlers ──────────────────────────────────────────────

    def _handle_camera_snapshot(self, params):
        camera = self.services.get("camera")
        if camera:
            path = camera.take_snapshot()
            return f"Photo saved to {path}"

    def _handle_camera_describe(self, params):
        camera = self.services.get("camera")
        if camera:
            prompt = params.get("prompt", "What do you see?")
            return camera.describe_scene(prompt)

    def _handle_camera_motion(self, params):
        camera = self.services.get("camera")
        if camera:
            if params.get("enabled", True):
                camera.start_motion_detection()
                return "Motion detection enabled"
            else:
                camera.stop_motion_detection()
                return "Motion detection disabled"

    # ── Other Handlers ───────────────────────────────────────────────

    def _handle_weather(self, params):
        weather = self.services.get("weather")
        if weather:
            return weather.get_current()

    def _handle_identify_face(self, params):
        camera = self.services.get("camera")
        if camera:
            faces = camera.identify_faces()
            if faces:
                names = [f["name"] for f in faces]
                return f"I see: {', '.join(names)}"
            return "I don't see anyone right now"

    def _handle_identify_voice(self, params):
        return "Voice identification happens automatically during speech input"

    # ── File Access Handlers (D&D data) ──────────────────────────────

    def _handle_read_file(self, params):
        """Read a file from the D&D 5e data directory."""
        path = params.get("path", "")
        # Resolve relative to the data dir
        if not os.path.isabs(path):
            path = os.path.join(DND_DATA_DIR, path)
        # Security: only allow reads under the data dir
        real = os.path.realpath(path)
        if not real.startswith(os.path.realpath(DND_DATA_DIR)):
            return "Access denied — can only read files under the D&D 5e data directory"
        try:
            with open(real, encoding="utf-8") as f:
                content = f.read(100000)  # Cap at 100KB
            return content
        except Exception as e:
            return f"Failed to read {path}: {e}"

    def _handle_list_dir(self, params):
        """List files in a subdirectory of the D&D 5e data directory."""
        subdir = params.get("path", "")
        path = os.path.join(DND_DATA_DIR, subdir)
        real = os.path.realpath(path)
        if not real.startswith(os.path.realpath(DND_DATA_DIR)):
            return "Access denied"
        try:
            entries = os.listdir(real)
            return entries
        except Exception as e:
            return f"Failed to list {path}: {e}"
