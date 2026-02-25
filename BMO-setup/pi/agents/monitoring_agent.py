"""Monitoring/SRE agent — health checks, GPU status, disk/CPU/memory usage."""

import json

from agents.base_agent import AgentConfig, AgentResult, BaseAgent

SYSTEM_PROMPT = """You are BMO's monitoring agent. You check system health, GPU status, disk space, CPU/memory usage, and service health.

You have access to command execution tools:
{tool_list}

Use tool_call blocks:
```tool_call
{{"tool": "tool_name", "args": {{"param1": "value1"}}}}
```

Common health checks:
- GPU: nvidia-smi (on GPU server via SSH)
- Disk: df -h
- Memory: free -h
- CPU: top -bn1 | head -20
- Services: systemctl status <service>
- Network: ping, curl health endpoints
- Docker: docker ps, docker stats

Report findings in a clear, structured format with status indicators."""


class MonitoringAgent(BaseAgent):
    def run(self, message: str, history: list[dict], context: dict | None = None) -> AgentResult:
        tool_list = self.get_tool_descriptions()
        prompt = SYSTEM_PROMPT.format(tool_list=tool_list)
        messages = [{"role": "system", "content": prompt}]
        messages.extend(history[-6:])
        messages.append({"role": "user", "content": message})

        reply = self.llm_call(messages)
        reply, _ = self._run_tool_loop(reply, messages)
        return AgentResult(text=self.strip_tool_calls(reply), agent_name=self.config.name)

    def _run_tool_loop(self, reply, messages):
        from agent import OLLAMA_OPTIONS
        tool_calls_made = 0
        for _ in range(self.config.max_turns):
            tool_calls = self.parse_tool_calls(reply)
            if not tool_calls:
                break
            tool_results = []
            for tc in tool_calls:
                tool_calls_made += 1
                result = self.dispatch_tool(tc.get("tool", ""), tc.get("args", {}))
                tool_results.append({"tool": tc["tool"], "result": result})
            messages.append({"role": "assistant", "content": reply})
            result_text = "\n".join(
                f"[Tool Result: {tr['tool']}]\n{json.dumps(tr['result'], indent=2)[:4000]}"
                for tr in tool_results
            )
            messages.append({"role": "system", "content": result_text})
            try:
                options = dict(OLLAMA_OPTIONS)
                options["temperature"] = self.config.temperature
                reply = self.llm_call(messages, options)
            except Exception as e:
                reply = self.strip_tool_calls(reply) + f"\n\n(Error: {e})"
                break
        return reply, tool_calls_made


def create_monitoring_agent(scratchpad, services, socketio=None):
    config = AgentConfig(
        name="monitoring",
        display_name="Monitoring Agent",
        system_prompt=SYSTEM_PROMPT,
        temperature=0.3,
        tools=["execute_command", "ssh_command", "read_file"],
        services=[],
        max_turns=6,
        can_nest=False,
    )
    return MonitoringAgent(config, scratchpad, services, socketio)
