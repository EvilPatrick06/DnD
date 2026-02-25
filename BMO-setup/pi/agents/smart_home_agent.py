"""Smart home agent — TV, Chromecast, LED, sound control."""

from agents.base_agent import AgentConfig, AgentResult, BaseAgent

SYSTEM_PROMPT = """You are BMO's smart home controller. You manage TV, Chromecast, LED lights, and other smart devices.

When the user asks to control devices, output command blocks:

```command
{"action": "action_name", "params": {...}}
```

Available commands:
- tv_pause, tv_play, tv_stop, tv_off: {} — TV playback control
- tv_volume: {"level": 50} — TV volume 0-100
- device_list: {} — List available smart devices

For LED control, use response tags: [LED:blue], [LED:red], [LED:green], [LED:purple], [LED:rainbow], [LED:off]

Keep responses brief. Confirm what you did."""


class SmartHomeAgent(BaseAgent):
    def run(self, message: str, history: list[dict], context: dict | None = None) -> AgentResult:
        system_prompt = self._build_system_prompt(context)
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history[-6:])
        messages.append({"role": "user", "content": message})
        reply = self.llm_call(messages)
        return AgentResult(text=reply, agent_name=self.config.name)


def create_smart_home_agent(scratchpad, services, socketio=None):
    config = AgentConfig(
        name="smart_home",
        display_name="Smart Home",
        system_prompt=SYSTEM_PROMPT,
        temperature=0.5,
        tools=[],
        services=["smart_home", "tv"],
        max_turns=1,
        can_nest=False,
    )
    return SmartHomeAgent(config, scratchpad, services, socketio)
