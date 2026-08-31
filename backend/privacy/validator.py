"""
PrivAgent Backend - Server-Side Privacy Validator
Second line of defense: rejects or sanitizes payloads containing raw PII.
"""

from __future__ import annotations

import re
import logging
from dataclasses import dataclass, field

logger = logging.getLogger("privagent.privacy")

# ---------------------------------------------------------------------------
# PII Regex Patterns
# ---------------------------------------------------------------------------

PII_PATTERNS: dict[str, re.Pattern] = {
    "email": re.compile(
        r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
    ),
    "phone": re.compile(
        r"(?<!\d)(?:\+?\d{1,3}[\s\-]?)?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}(?!\d)",
    ),
    "aadhaar": re.compile(
        r"(?<!\d)\d{4}[\s\-]?\d{4}[\s\-]?\d{4}(?!\d)",
    ),
    "credit_card": re.compile(
        r"(?<!\d)\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}(?!\d)",
    ),
    "ssn": re.compile(
        r"(?<!\d)\d{3}[\s\-]\d{2}[\s\-]\d{4}(?!\d)",
    ),
    "pan_card": re.compile(
        r"[A-Z]{5}\d{4}[A-Z]",
    ),
}

# Placeholder tags that are safe
SAFE_PLACEHOLDERS = {
    "[REDACTED_EMAIL]",
    "[REDACTED_PHONE]",
    "[REDACTED_PASSWORD]",
    "[REDACTED_ID]",
    "[REDACTED_AADHAAR]",
    "[REDACTED_CREDIT_CARD]",
    "[REDACTED_SSN]",
    "[REDACTED_PAN]",
    "[REDACTED_PII]",
    "[FACE_REDACTED]",
}


@dataclass
class PrivacyViolation:
    """A detected PII leak."""
    field_path: str
    pii_type: str
    matched_value: str  # Will be partially masked in logs
    severity: str = "high"


@dataclass
class ValidationResult:
    """Result of privacy validation."""
    is_safe: bool = True
    violations: list[PrivacyViolation] = field(default_factory=list)
    sanitized: bool = False

    @property
    def violation_count(self) -> int:
        return len(self.violations)

    def summary(self) -> str:
        if self.is_safe:
            return "Payload is privacy-safe"
        types = set(v.pii_type for v in self.violations)
        return f"Found {self.violation_count} PII violation(s): {', '.join(types)}"


def _mask_for_log(value: str) -> str:
    """Mask a value for safe logging (show first 2 and last 2 chars only)."""
    if len(value) <= 4:
        return "****"
    return value[:2] + "*" * (len(value) - 4) + value[-2:]


def _is_safe_placeholder(value: str) -> bool:
    """Check if a value is an allowed redaction placeholder."""
    return value.strip().upper() in {p.upper() for p in SAFE_PLACEHOLDERS}


def scan_string(value: str, field_path: str = "") -> list[PrivacyViolation]:
    """Scan a single string for PII patterns."""
    violations = []
    if not value or _is_safe_placeholder(value):
        return violations

    for pii_type, pattern in PII_PATTERNS.items():
        matches = pattern.findall(value)
        for match in matches:
            # Skip if the match IS the placeholder
            if _is_safe_placeholder(match):
                continue
            violations.append(PrivacyViolation(
                field_path=field_path,
                pii_type=pii_type,
                matched_value=_mask_for_log(match),
            ))
    return violations


def scan_dict(data: dict, path: str = "root") -> list[PrivacyViolation]:
    """Recursively scan a dictionary for PII."""
    violations = []
    for key, value in data.items():
        current_path = f"{path}.{key}"
        if isinstance(value, str):
            violations.extend(scan_string(value, current_path))
        elif isinstance(value, dict):
            violations.extend(scan_dict(value, current_path))
        elif isinstance(value, list):
            for i, item in enumerate(value):
                item_path = f"{current_path}[{i}]"
                if isinstance(item, str):
                    violations.extend(scan_string(item, item_path))
                elif isinstance(item, dict):
                    violations.extend(scan_dict(item, item_path))
    return violations


def validate_payload(data: dict) -> ValidationResult:
    """Validate an incoming payload for PII leaks.
    Returns a ValidationResult — caller decides whether to reject."""
    violations = scan_dict(data)
    result = ValidationResult(
        is_safe=len(violations) == 0,
        violations=violations,
    )

    if not result.is_safe:
        logger.warning(
            "Privacy violation detected: %s",
            result.summary(),
        )

    return result


def sanitize_payload(data: dict) -> dict:
    """Best-effort server-side sanitization of a payload.
    Replaces detected PII with placeholders."""
    import json
    text = json.dumps(data)

    replacements = {
        "email": "[REDACTED_EMAIL]",
        "phone": "[REDACTED_PHONE]",
        "aadhaar": "[REDACTED_ID]",
        "credit_card": "[REDACTED_CREDIT_CARD]",
        "ssn": "[REDACTED_SSN]",
        "pan_card": "[REDACTED_PAN]",
    }

    for pii_type, pattern in PII_PATTERNS.items():
        placeholder = replacements.get(pii_type, "[REDACTED_PII]")
        text = pattern.sub(placeholder, text)

    return json.loads(text)
