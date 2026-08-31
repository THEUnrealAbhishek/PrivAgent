"""
API and payload integration tests.
"""

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_api_docs_available():
    response = client.get("/docs")
    assert response.status_code == 200

def test_cors_headers():
    response = client.options("/analyze", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"})
    assert response.status_code == 200
