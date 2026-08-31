"""
PrivAgent Backend - LLM Client Abstraction
Supports mock mode (default) and configurable real providers.
"""

from __future__ import annotations

import os
import json
import logging
from abc import ABC, abstractmethod
from typing import Optional

from backend.api.schemas import (
    AnalyzeRequest, BrowserAction, ActionType, ScrollDirection,
    CommandRequest, PageField,
)

logger = logging.getLogger("privagent.llm")


class LLMProvider(ABC):
    """Abstract base for LLM providers."""

    @abstractmethod
    async def analyze_page(self, request: AnalyzeRequest) -> list[BrowserAction]:
        """Analyze sanitized page context and return browser actions."""
        ...

    @abstractmethod
    async def process_command(self, request: CommandRequest) -> list[BrowserAction]:
        """Process a user command and return browser actions."""
        ...


class MockLLMProvider(LLMProvider):
    """Deterministic mock provider for demo/testing.
    Inspects sanitized page structure and returns intelligent actions."""

    async def analyze_page(self, request: AnalyzeRequest) -> list[BrowserAction]:
        actions: list[BrowserAction] = []

        # Look for empty required fields to fill
        for field in request.fields:
            if field.redacted:
                continue  # Skip redacted fields
            if field.type in ("text", "email", "tel", "number") and not field.value:
                if field.type == "email" or _is_email_field(field):
                    actions.append(BrowserAction(
                        action=ActionType.FILL,
                        target=field.id or field.name or "email",
                        value="user@example.com",
                        reasoning=f"Fill email field '{field.label or field.id}'",
                    ))
                elif field.type == "tel" or _is_phone_field(field):
                    actions.append(BrowserAction(
                        action=ActionType.FILL,
                        target=field.id or field.name or "phone",
                        value="9876543210",
                        reasoning=f"Fill phone field '{field.label or field.id}'",
                    ))
                else:
                    actions.append(BrowserAction(
                        action=ActionType.FILL,
                        target=field.id or field.name or "input",
                        value="Demo User",
                        reasoning=f"Fill text field '{field.label or field.id}'",
                    ))

        # Find submit button
        for btn in request.buttons:
            text = (btn.text or btn.label or btn.value or "").lower()
            if any(kw in text for kw in ("submit", "login", "sign in", "register", "apply")):
                actions.append(BrowserAction(
                    action=ActionType.CLICK,
                    target=btn.id or btn.name or btn.text or "submit",
                    reasoning=f"Click submit button '{btn.text or btn.label}'",
                ))
                break

        if not actions:
            # Default: scroll down to explore the page
            actions.append(BrowserAction(
                action=ActionType.SCROLL,
                direction=ScrollDirection.DOWN,
                reasoning="No actionable elements found, scrolling to explore",
            ))

        return actions

    async def process_command(self, request: CommandRequest) -> list[BrowserAction]:
        cmd = request.command.lower().strip()

        if "click" in cmd:
            target = _extract_target_from_command(cmd, request.buttons)
            return [BrowserAction(
                action=ActionType.CLICK,
                target=target,
                reasoning=f"User requested click: '{request.command}'",
            )]

        if "fill" in cmd or "type" in cmd or "enter" in cmd:
            target = _extract_target_from_command(cmd, request.fields)
            value = _extract_value_from_command(cmd)
            return [BrowserAction(
                action=ActionType.FILL,
                target=target,
                value=value or "Demo Value",
                reasoning=f"User requested fill: '{request.command}'",
            )]

        if "scroll" in cmd:
            direction = ScrollDirection.DOWN
            if "up" in cmd:
                direction = ScrollDirection.UP
            return [BrowserAction(
                action=ActionType.SCROLL,
                direction=direction,
                reasoning=f"User requested scroll: '{request.command}'",
            )]

        if "submit" in cmd:
            return [BrowserAction(
                action=ActionType.CLICK,
                target="submit",
                reasoning=f"User requested submit: '{request.command}'",
            )]

        return [BrowserAction(
            action=ActionType.SCROLL,
            direction=ScrollDirection.DOWN,
            reasoning=f"Could not parse command, scrolling: '{request.command}'",
        )]


def _is_email_field(field: PageField) -> bool:
    indicators = [field.id, field.name, field.label, field.placeholder, field.aria_label]
    return any("email" in (s or "").lower() for s in indicators)


def _is_phone_field(field: PageField) -> bool:
    indicators = [field.id, field.name, field.label, field.placeholder, field.aria_label]
    return any(kw in (s or "").lower() for s in indicators for kw in ("phone", "tel", "mobile"))


def _extract_target_from_command(cmd: str, elements: list[PageField]) -> str:
    for el in elements:
        for attr in [el.id, el.name, el.text, el.label]:
            if attr and attr.lower() in cmd:
                return el.id or el.name or attr
    return "target"


def _extract_value_from_command(cmd: str) -> Optional[str]:
    # Try to extract quoted value
    import re
    match = re.search(r'["\'](.+?)["\']', cmd)
    if match:
        return match.group(1)
    # Try "with <value>"
    match = re.search(r'with\s+(.+?)(?:\s+in|\s+on|$)', cmd)
    if match:
        return match.group(1).strip()
    return None


def get_llm_provider() -> LLMProvider:
    """Factory: return the configured LLM provider."""
    provider = os.getenv("LLM_PROVIDER", "mock").lower()

    if provider == "mock":
        logger.info("Using MockLLMProvider (demo mode)")
        return MockLLMProvider()

    # Future: add real providers here
    logger.warning("Provider '%s' not implemented, falling back to mock", provider)
    return MockLLMProvider()
