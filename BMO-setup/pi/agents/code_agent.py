"""Code agent — extracted dev tool loop from agent.py.

Full access to dev_tools, implements the agentic tool-calling loop where
the LLM generates tool_call blocks, BMO executes them, injects results,
and lets the LLM continue reasoning.
"""

from __future__ import annotations

import json
import os

from agents.base_agent import ALL_DEV_TOOLS, AgentConfig, AgentResult, BaseAgent

SYSTEM_PROMPT = """You are BMO's coding assistant mode. You help with programming, debugging, file operations, git, SSH, and system administration.

You have access to dev tools via tool_call blocks. When the user asks you to help with code, debug something, read files, search the web, run commands, or do any dev work, use tool_call blocks to invoke tools.

Format:
```tool_call
{{"tool": "tool_name", "args": {{"param1": "value1"}}}}
```

{tool_list}

When you receive tool results, analyze them and either make more tool calls or respond with your findings. You can make up to {max_calls} tool calls per turn.

For destructive operations (delete, overwrite, push), the tool will return a confirmation request. Tell the user what you want to do and wait for approval.

Keep responses focused and technical. Show relevant code/output. Be concise."""

MAX_TOOL_CALLS_PER_TURN = 10


class CodeAgent(BaseAgent):
    """Coding assistant with full dev tool access and agentic loop."""

    def run(self, message: str, history: list[dict], context: dict | None = None) -> AgentResult:
        """Run the code agent with agentic tool-calling loop."""
        system_prompt = self._build_system_prompt(context)
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history[-30:])
        messages.append({"role": "user", "content": message})

        # Initial LLM call
        reply = self.llm_call(messages)

        # Agentic tool-calling loop
        reply, tool_calls_made = self._run_tool_loop(reply, messages)

        # Strip tool calls from display text
        clean_text = self.strip_tool_calls(reply)

        return AgentResult(
            text=clean_text,
            agent_name=self.config.name,
        )

    def _build_system_prompt(self, context: dict | None = None) -> str:
        """Build system prompt with available tool descriptions and project context."""
        tool_list = self.get_tool_descriptions()
        prompt = SYSTEM_PROMPT.format(
            tool_list=tool_list,
            max_calls=MAX_TOOL_CALLS_PER_TURN,
        )

        # Inject BMO.md project context if available
        try:
            from agents.project_context import load_bmo_md
            project_ctx = load_bmo_md(os.getcwd() if os.path.exists(os.getcwd()) else None)
            if project_ctx:
                prompt += f"\n\n{project_ctx}"
        except Exception:
            pass

        # Inject scratchpad context
        summary = self.scratchpad.summary()
        if summary:
            prompt += f"\n\n[Scratchpad Context]\n{summary}"

        # Inject plan step context if executing a plan
        if context and "plan_step" in context:
            prompt += f"\n\n[Plan Step {context['plan_step']}/{context['plan_total']}]"
            plan = self.scratchpad.read("Plan")
            if plan:
                prompt += f"\n{plan}"

        return prompt

    def _run_tool_loop(self, reply: str, messages: list[dict]) -> tuple[str, int]:
        """Execute tool calls from the LLM response and loop until no more tool calls.

        Returns (final_reply, tool_calls_made).
        """
        from agent import OLLAMA_OPTIONS

        tool_calls_made = 0
        pending_confirmations = []

        for _ in range(MAX_TOOL_CALLS_PER_TURN):
            tool_calls = self.parse_tool_calls(reply)
            if not tool_calls:
                break

            tool_results = []
            for tc in tool_calls:
                tool_calls_made += 1
                name = tc.get("tool", "")
                args = tc.get("args", {})

                print(f"[code_agent] Tool call #{tool_calls_made}: {name}({json.dumps(args)[:100]})")
                result = self.dispatch_tool(name, args)

                if result.get("needs_confirmation"):
                    pending_confirmations.append({
                        "tool": name,
                        "args": args,
                        "reason": result.get("reason", "Destructive operation"),
                        "command": result.get("command", ""),
                    })
                    tool_results.append({
                        "tool": name,
                        "result": f"CONFIRMATION NEEDED: {result['reason']}",
                    })
                else:
                    tool_results.append({"tool": name, "result": result})

            # Strip tool_call blocks from reply text
            clean_reply = self.strip_tool_calls(reply)

            # Inject tool results back into conversation
            messages.append({"role": "assistant", "content": reply})
            result_text = "\n".join(
                f"[Tool Result: {tr['tool']}]\n{json.dumps(tr['result'], indent=2)[:4000]}"
                for tr in tool_results
            )
            messages.append({"role": "system", "content": result_text})

            # If there are pending confirmations, stop and ask the user
            if pending_confirmations:
                reasons = "\n".join(
                    f"- {pc['reason']} ({pc.get('command', '')})"
                    for pc in pending_confirmations
                )
                reply = (
                    clean_reply
                    + f"\n\nBMO needs your permission for:\n{reasons}\n\n"
                    "Say 'yes' to confirm or 'no' to cancel."
                )
                break

            # Get the next LLM response with tool results
            try:
                options = dict(OLLAMA_OPTIONS)
                options["temperature"] = self.config.temperature
                reply = self.llm_call(messages, options)
            except Exception as e:
                reply = clean_reply + f"\n\n(BMO's tool loop hit an error: {e})"
                break

        if tool_calls_made > 0:
            print(f"[code_agent] Agentic loop completed: {tool_calls_made} tool calls")

        return reply, tool_calls_made


def create_code_agent(scratchpad, services, socketio=None):
    """Factory function to create the code agent."""
    config = AgentConfig(
        name="code",
        display_name="Code Agent",
        system_prompt=SYSTEM_PROMPT,
        temperature=0.3,
        tools=list(ALL_DEV_TOOLS),
        services=[],
        max_turns=MAX_TOOL_CALLS_PER_TURN,
        can_nest=True,
    )
    return CodeAgent(config, scratchpad, services, socketio)
