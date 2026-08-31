# PrivAgent Setup & Run Guide

Step-by-step instructions to set up, run, and evaluate the PrivAgent project.

---

## Prerequisites

- **Python**: 3.9+ (Python 3.10+ recommended)
- **Node.js**: 18+ (Optional, for npm toolchain)
- **Browser**: Google Chrome / Chromium-based browser with Manifest V3 support

---

## 1. Backend Setup

### Option A: Python Virtual Environment (Standard)

1. Clone or navigate to the project directory:
   ```bash
   cd PrivAgent
   ```

2. Create and activate a virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

4. Create environment file:
   ```bash
   cp .env.example .env
   ```

5. Start the FastAPI backend:
   ```bash
   python -m backend.main
   ```
   *The server will run on `http://localhost:8000`.*
   - Health check: `http://localhost:8000/health`
   - Interactive Swagger API docs: `http://localhost:8000/docs`
   - Built-in Demo Pages: `http://localhost:8000/demo/index.html`

---

## 2. Chrome Extension Setup

1. Open Google Chrome.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the `extension` folder inside this repository (`c:\...\PrivAgent\extension`).
6. The **PrivAgent** icon with shield badge will appear in your Chrome toolbar. Pin it for easy access.

---

## 3. Running the Live SIH Demo

1. Ensure the backend is running (`python -m backend.main`).
2. Open the demo page in your browser:
   ```
   http://localhost:8000/demo/scholarship.html
   ```
   *(Or open `demo/scholarship.html` directly in Chrome).*
3. Open the **PrivAgent** extension popup.
4. Verify the top badge shows `Connected (MOCK Mode)`.
5. Click **Start PrivAgent**.
6. **Observe**:
   - **Status Card**: Transitions smoothly from `READY` -> `ANALYZING` -> `PRIVACY PROTECTED` -> `ACTION EXECUTED`.
   - **Privacy Panel**: Shows detected items (Email, Phone, Aadhaar, Password, PAN) and lists what was redacted.
   - **Payload Preview**: Click `View Sanitized Payload` to inspect the exact JSON sent over the wire (only `[REDACTED_*]` tokens).
   - **Browser Action**: The extension automatically interacts with the page (fills necessary fields and focuses submission).

---

## 4. Running Automated Tests

Run the complete test suite with `pytest`:

```bash
pytest tests/ -v
```

This runs:
- `tests/test_pii.py`: Validates regex and DOM PII detection logic.
- `tests/test_privacy.py`: Verifies zero-PII leak assertions on payloads.
- `tests/test_actions.py`: Validates action schemas and security restrictions.
- `tests/test_server.py`: Validates FastAPI endpoints (`/health`, `/analyze`, `/command`).
- `tests/test_api.py`, `tests/test_dom.py`, `tests/test_redaction.py`: Schema and header tests.

---

## 5. Docker Deployment (Optional)

To run the backend with Docker:

```bash
docker compose up --build
```
The server will be accessible at `http://localhost:8000`.
