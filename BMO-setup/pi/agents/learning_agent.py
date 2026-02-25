"""Learning/Memory agent — saves and recalls user preferences, long-term memory.

Manages a persistent memory file (BMO.md-style) for cross-session context.
"""

from __future__ import annotations

import json
import os

from agents.base_agent import AgentConfig, AgentResult, BaseAgent

MEMORY_DIR = os.path.expanduser("~/bmo/data")
MEMORY_FILE = os.path.join(MEMORY_DIR, "memory.json")

SYSTEM_PROMPT = """You are BMO's learning/memory agent. You save and recall user preferences, facts, and context across sessions.

Current memory:
{memory_context}

When the user tells you to remember something:
1. Extract the key fact or preference
2. Save it to memory with a clear category
3. Confirm what you saved

When the user asks what you know or recalls something:
1. Search your memory for relevant entries
2. Present what you found

Categories: preferences, facts, people, projects, reminders, other

Keep memory entries concise and factual."""


class LearningAgent(BaseAgent):
    """Persistent memory agent — saves/recalls facts across sessions."""

    def __init__(self, config, scratchpad, services, socketio=None, orchestrator=None):
        super().__init__(config, scratchpad, services, socketio, orchestrator)
        self._memory = self._load_memory()

    def run(self, message: str, history: list[dict], context: dict | None = None) -> AgentResult:
        memory_context = self._format_memory()
        prompt = SYSTEM_PROMPT.format(memory_context=memory_context or "No memories saved yet.")

        messages = [{"role": "system", "content": prompt}]
        messages.extend(history[-6:])
        messages.append({"role": "user", "content": message})

        reply = self.llm_call(messages)

        # Check if the LLM wants to save something
        lower = message.lower()
        if any(kw in lower for kw in ["remember", "save this", "don't forget", "keep in mind"]):
            # Extract and save the memory
            self._save_from_message(message, reply)

        return AgentResult(text=reply, agent_name=self.config.name)

    def _load_memory(self) -> dict:
        """Load persistent memory from disk."""
        try:
            if os.path.exists(MEMORY_FILE):
                with open(MEMORY_FILE, encoding="utf-8") as f:
                    return json.load(f)
        except Exception as e:
            print(f"[learning] Failed to load memory: {e}")
        return {"entries": []}

    def _save_memory(self):
        """Persist memory to disk."""
        try:
            os.makedirs(MEMORY_DIR, exist_ok=True)
            with open(MEMORY_FILE, "w", encoding="utf-8") as f:
                json.dump(self._memory, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[learning] Failed to save memory: {e}")

    def _format_memory(self) -> str:
        """Format memory entries for the system prompt."""
        entries = self._memory.get("entries", [])
        if not entries:
            return ""
        lines = []
        for entry in entries[-20:]:  # Last 20 entries
            cat = entry.get("category", "other")
            text = entry.get("text", "")
            lines.append(f"- [{cat}] {text}")
        return "\n".join(lines)

    def _save_from_message(self, message: str, reply: str):
        """Extract a memory entry from the user's message and save it."""
        # Simple extraction — the LLM response usually confirms what was saved
        entry = {
            "category": "other",
            "text": message[:200],
            "source": "user",
        }

        # Try to categorize
        lower = message.lower()
        if any(kw in lower for kw in ["prefer", "always use", "i like", "my favorite"]):
            entry["category"] = "preferences"
        elif any(kw in lower for kw in ["my name", "i am", "i work"]):
            entry["category"] = "people"
        elif any(kw in lower for kw in ["project", "codebase", "repo"]):
            entry["category"] = "projects"

        if "entries" not in self._memory:
            self._memory["entries"] = []
        self._memory["entries"].append(entry)
        self._save_memory()
        print(f"[learning] Saved memory: [{entry['category']}] {entry['text'][:80]}")


def create_learning_agent(scratchpad, services, socketio=None):
    config = AgentConfig(
        name="learning",
        display_name="Memory Agent",
        system_prompt=SYSTEM_PROMPT,
        temperature=0.5,
        tools=[],
        services=[],
        max_turns=1,
        can_nest=False,
    )
    return LearningAgent(config, scratchpad, services, socketio)
