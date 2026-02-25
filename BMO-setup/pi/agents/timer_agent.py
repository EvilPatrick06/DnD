"""Timer/Alarm agent — timer and alarm management."""

from agents.base_agent import AgentConfig, AgentResult, BaseAgent

SYSTEM_PROMPT = """You are BMO's timer and alarm manager. You set timers, alarms, and reminders.

When the user asks to set a timer or alarm, output command blocks:

```command
{"action": "timer_set", "params": {"minutes": 10, "label": "Pizza"}}
```

Available commands:
- timer_set: {"minutes": N, "label": "description"} — Set countdown timer
- alarm_set: {"hour": 7, "minute": 30, "label": "Wake up"} — Set alarm for specific time
- timer_cancel: {"label": "description"} — Cancel a timer

Parse natural language time expressions:
- "5 minutes" → minutes: 5
- "half an hour" → minutes: 30
- "2 hours" → minutes: 120
- "7:30 AM" → hour: 7, minute: 30

Confirm what you set with a friendly response. Use [EMOTION:happy] when confirming."""


class TimerAgent(BaseAgent):
    def run(self, message: str, history: list[dict], context: dict | None = None) -> AgentResult:
        system_prompt = self._build_system_prompt(context)
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history[-6:])
        messages.append({"role": "user", "content": message})
        reply = self.llm_call(messages)
        return AgentResult(text=reply, agent_name=self.config.name)


def create_timer_agent(scratchpad, services, socketio=None):
    config = AgentConfig(
        name="timer",
        display_name="Timer Agent",
        system_prompt=SYSTEM_PROMPT,
        temperature=0.5,
        tools=[],
        services=["timers"],
        max_turns=1,
        can_nest=False,
    )
    return TimerAgent(config, scratchpad, services, socketio)
