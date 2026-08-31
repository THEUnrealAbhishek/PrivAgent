"""
Unit tests for PII detection in backend/privacy/validator.py
"""

import pytest
from backend.privacy.validator import (
    PII_PATTERNS,
    scan_string,
    scan_dict,
    _mask_for_log,
    _is_safe_placeholder,
    SAFE_PLACEHOLDERS,
)

def test_email_pattern():
    pattern = PII_PATTERNS["email"]
    assert pattern.search("user@example.com") is not None
    assert pattern.search("john.doe+tag@sub.domain.co.in") is not None
    assert pattern.search("not-an-email") is None

def test_phone_pattern():
    pattern = PII_PATTERNS["phone"]
    assert pattern.search("9876543210") is not None
    assert pattern.search("+91 9876543210") is not None
    assert pattern.search("123-456-7890") is not None
    assert pattern.search("(123) 456-7890") is not None

def test_aadhaar_pattern():
    pattern = PII_PATTERNS["aadhaar"]
    assert pattern.search("1234 5678 9012") is not None
    assert pattern.search("123456789012") is not None
    assert pattern.search("1234-5678-9012") is not None

def test_credit_card_pattern():
    pattern = PII_PATTERNS["credit_card"]
    assert pattern.search("4111 1111 1111 1111") is not None
    assert pattern.search("1234567812345678") is not None

def test_pan_card_pattern():
    pattern = PII_PATTERNS["pan_card"]
    assert pattern.search("ABCDE1234F") is not None
    assert pattern.search("INVALIDPAN") is None

def test_scan_string_detects_pii():
    violations = scan_string("Contact me at test@example.com or call 9876543210", field_path="user.note")
    types = [v.pii_type for v in violations]
    assert "email" in types
    assert "phone" in types
    assert len(violations) >= 2

def test_scan_string_ignores_safe_placeholders():
    for placeholder in SAFE_PLACEHOLDERS:
        violations = scan_string(placeholder, field_path="field.value")
        assert len(violations) == 0

def test_mask_for_log():
    masked = _mask_for_log("secret_email@test.com")
    assert "secret_email@test.com" not in masked
    assert masked.startswith("se")
    assert masked.endswith("om")
    assert "****" == _mask_for_log("123")

def test_scan_dict_nested():
    data = {
        "user": {
            "profile": {
                "email": "leak@domain.com",
                "phone": "+91 9876543210"
            }
        },
        "safe_list": ["[REDACTED_PASSWORD]", "[REDACTED_ID]"]
    }
    violations = scan_dict(data)
    paths = [v.field_path for v in violations]
    assert any("user.profile.email" in p for p in paths)
    assert any("user.profile.phone" in p for p in paths)
    # placeholders shouldn't trigger violation
    assert not any("safe_list" in p for p in paths)
