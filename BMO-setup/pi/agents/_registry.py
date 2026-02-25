"""Agent registry — creates and returns all specialized agents.

This is imported by BmoAgent.__init__ to register all agents with the orchestrator.
Core agents (conversation, code, dnd_dm, plan, research) are registered separately.
This file registers the remaining 14 agents.
"""

from __future__ import annotations
from typing import Any

from agents.scratchpad import SharedScratchpad


def create_all_agents(scratchpad: SharedScratchpad, services: dict[str, Any], socketio: Any = None) -> list:
    """Create and return all non-core specialized agents."""
    agents = []

    from agents.music_agent import create_music_agent
    agents.append(create_music_agent(scratchpad, services, socketio))

    from agents.smart_home_agent import create_smart_home_agent
    agents.append(create_smart_home_agent(scratchpad, services, socketio))

    from agents.test_agent import create_test_agent
    agents.append(create_test_agent(scratchpad, services, socketio))

    from agents.security_agent import create_security_agent
    agents.append(create_security_agent(scratchpad, services, socketio))

    from agents.design_agent import create_design_agent
    agents.append(create_design_agent(scratchpad, services, socketio))

    from agents.cleanup_agent import create_cleanup_agent
    agents.append(create_cleanup_agent(scratchpad, services, socketio))

    from agents.monitoring_agent import create_monitoring_agent
    agents.append(create_monitoring_agent(scratchpad, services, socketio))

    from agents.deploy_agent import create_deploy_agent
    agents.append(create_deploy_agent(scratchpad, services, socketio))

    from agents.review_agent import create_review_agent
    agents.append(create_review_agent(scratchpad, services, socketio))

    from agents.docs_agent import create_docs_agent
    agents.append(create_docs_agent(scratchpad, services, socketio))

    from agents.timer_agent import create_timer_agent
    agents.append(create_timer_agent(scratchpad, services, socketio))

    from agents.calendar_agent import create_calendar_agent
    agents.append(create_calendar_agent(scratchpad, services, socketio))

    from agents.weather_agent import create_weather_agent
    agents.append(create_weather_agent(scratchpad, services, socketio))

    from agents.learning_agent import create_learning_agent
    agents.append(create_learning_agent(scratchpad, services, socketio))

    return agents
