"""
PrivAgent Backend - Pydantic Schemas
Defines request/response models with strict validation.
"""

from __future__ import annotations

import enum
from typing import Optional

# pyrefly: ignore [missing-import]
from pydantic import BaseModel
# pyrefly: ignore [missing-import]
from pydantic import Field
# pyrefly: ignore [missing-import]
from pydantic import field_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ActionType(str, enum.Enum):
    CLICK = "click"
    FILL = "fill"
    SCROLL = "scroll"


class ScrollDirection(str, enum.Enum):
    UP = "up"
    DOWN = "down"
    LEFT = "left"
    RIGHT = "right"


# ---------------------------------------------------------------------------
# Field / Element models
# ---------------------------------------------------------------------------

class PageField(BaseModel):
    """A single form field or interactive element extracted from the DOM."""
    id: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None
    tag: Optional[str] = None
    label: Optional[str] = None
    placeholder: Optional[str] = None
    value: Optional[str] = None
    visible: bool = True
    redacted: bool = False
    aria_label: Optional[str] = None
    text: Optional[str] = None


class PageMetadata(BaseModel):
    """Safe page-level metadata."""
    url: Optional[str] = None
    title: Optional[str] = None
    domain: Optional[str] = None


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    """Request body for POST /analyze.
    Contains sanitized page context — NO raw PII."""
    page: Optional[PageMetadata] = None
    fields: list[PageField] = Field(default_factory=list)
    buttons: list[PageField] = Field(default_factory=list)
    links: list[PageField] = Field(default_factory=list)
    text_content: Optional[str] = None
    user_intent: Optional[str] = None
    privacy_summary: Optional[dict] = None


class CommandRequest(BaseModel):
    """Request body for POST /command — user instruction."""
    command: str = Field(..., min_length=1, max_length=1000)
    page: Optional[PageMetadata] = None
    fields: list[PageField] = Field(default_factory=list)
    buttons: list[PageField] = Field(default_factory=list)
    links: list[PageField] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class BrowserAction(BaseModel):
    """A single browser action to be executed by the extension."""
    action: ActionType
    target: Optional[str] = None
    value: Optional[str] = None
    direction: Optional[ScrollDirection] = None
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    reasoning: Optional[str] = None

    @field_validator("value")
    @classmethod
    def block_executable_code(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        dangerous = ["eval(", "Function(", "javascript:", "<script",
                      "document.cookie", "window.location", "exec(",
                      "subprocess", "os.system"]
        for pattern in dangerous:
            if pattern.lower() in v.lower():
                raise ValueError(f"Blocked potentially dangerous value containing '{pattern}'")
        return v


class AnalyzeResponse(BaseModel):
    """Response from POST /analyze."""
    actions: list[BrowserAction] = Field(default_factory=list)
    message: Optional[str] = None
    request_id: Optional[str] = None
    privacy_verified: bool = True


class CommandResponse(BaseModel):
    """Response from POST /command."""
    actions: list[BrowserAction] = Field(default_factory=list)
    message: Optional[str] = None
    request_id: Optional[str] = None


class HealthResponse(BaseModel):
    """Response from GET /health."""
    status: str = "ok"
    service: str = "privagent"
    version: str = "1.0.0"
    llm_provider: str = "mock"


class PrivacyStatusResponse(BaseModel):
    """Response from GET /privacy/status."""
    privacy_engine: str = "active"
    server_side_validation: bool = True
    pii_patterns_checked: list[str] = Field(default_factory=lambda: [
        "email", "phone", "password", "aadhaar", "credit_card",
        "ssn", "pan_card"
    ])
    raw_pii_logging: bool = False
    message: str = "Server enforces privacy validation on all incoming payloads"
