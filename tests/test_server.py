"""
FastAPI Server integration tests using TestClient.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "privagent"
    assert "version" in data
    assert "llm_provider" in data

def test_privacy_status_endpoint():
    response = client.get("/privacy/status")
    assert response.status_code == 200
    data = response.json()
    assert data["privacy_engine"] == "active"
    assert data["server_side_validation"] is True
    assert data["raw_pii_logging"] is False
    assert "email" in data["pii_patterns_checked"]

def test_analyze_endpoint_sanitized_payload():
    payload = {
        "page": {
            "url": "/demo/scholarship.html",
            "title": "Scholarship Form",
            "domain": "localhost"
        },
        "fields": [
            {
                "id": "email",
                "type": "email",
                "label": "Email",
                "value": "[REDACTED_EMAIL]",
                "redacted": True
            },
            {
                "id": "phone",
                "type": "tel",
                "label": "Phone",
                "value": "[REDACTED_PHONE]",
                "redacted": True
            }
        ],
        "buttons": [
            {
                "id": "submitApplication",
                "text": "Submit Application",
                "type": "button"
            }
        ]
    }
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "actions" in data
    assert data["privacy_verified"] is True
    assert "request_id" in data

def test_analyze_endpoint_with_accidental_pii_triggers_sanitization():
    """If payload accidentally contains raw PII, server handles it safely."""
    raw_email = "accidental_leak@private.com"
    payload = {
        "page": {"url": "/demo/login.html"},
        "fields": [
            {
                "id": "email",
                "value": raw_email,
                "redacted": False
            }
        ]
    }
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["privacy_verified"] is False  # Server detected violation and auto-sanitized

def test_command_endpoint():
    payload = {
        "command": "click the submit button",
        "buttons": [
            {"id": "submitBtn", "text": "Submit"}
        ]
    }
    response = client.post("/command", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["actions"]) >= 1
    assert data["actions"][0]["action"] == "click"
