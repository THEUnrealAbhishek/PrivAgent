"""
Redaction verification tests ensuring sensitive types are properly handled.
"""

from backend.privacy.validator import scan_string, SAFE_PLACEHOLDERS, sanitize_payload

def test_safe_placeholders_enumeration():
    expected = {
        "[REDACTED_EMAIL]",
        "[REDACTED_PHONE]",
        "[REDACTED_PASSWORD]",
        "[REDACTED_ID]",
        "[REDACTED_AADHAAR]",
        "[REDACTED_CREDIT_CARD]",
        "[REDACTED_SSN]",
        "[REDACTED_PAN]",
        "[REDACTED_PII]",
        "[FACE_REDACTED]"
    }
    for p in expected:
        assert p in SAFE_PLACEHOLDERS

def test_redact_mixed_text():
    raw_text = "Please reach out to me at contact@demo.com with PAN ABCDE1234F"
    data = {"comment": raw_text}
    sanitized = sanitize_payload(data)
    assert "contact@demo.com" not in sanitized["comment"]
    assert "ABCDE1234F" not in sanitized["comment"]
    assert "[REDACTED_EMAIL]" in sanitized["comment"]
    assert "[REDACTED_PAN]" in sanitized["comment"]
