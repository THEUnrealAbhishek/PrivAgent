# 🛡️ PrivAgent: Privacy-First AI Browser Agent

> **Smart India Hackathon (SIH) Project**  
> Autonomous, privacy-preserving browser automation that redacts sensitive PII *locally* in the browser before communicating with AI backends.

[![PrivAgent CI](https://github.com/THEUnrealAbhishek/PrivAgent/actions/workflows/ci.yml/badge.svg)](https://github.com/THEUnrealAbhishek/PrivAgent/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

---

## 1. Project Overview

Modern AI web agents often capture and transmit full DOM trees, form input values, and full-resolution screenshots to remote LLM APIs. This compromises sensitive user data like passwords, emails, phone numbers, government ID numbers (Aadhaar, PAN), and banking credentials.

**PrivAgent solves this fundamental privacy risk.**

PrivAgent acts as an intelligent intermediary. It extracts webpage structure, executes local AI and regex-based PII detection, replaces sensitive user data with semantic placeholders (`[REDACTED_EMAIL]`, `[REDACTED_PASSWORD]`, etc.), and sends **only sanitized structural context** to the backend AI. The AI returns high-level structured JSON actions (`click`, `fill`, `scroll`) which are executed locally inside the browser.

---

## 2. Architecture & Privacy Boundary

```
Browser (Local Client Sandbox)
  ├── DOM Extraction & Elements
  ├── Local AI / Heuristic Face & Vision Processor (WebGPU / WASM)
  ├── PII Detection (Regex + DOM Context Engine)
  ├── Local Redactor & Sanitizer
  └── Browser Action Executor
         │
         │  SANITIZED PAYLOAD ONLY (e.g. "[REDACTED_EMAIL]")
         ▼  [STRICT PRIVACY BOUNDARY: RAW PII NEVER TRANSMITTED]
FastAPI Backend (Local / Cloud)
  ├── Server-Side Privacy Validator (Secondary defense & auto-sanitization)
  ├── PII-Safe Logging Filter (No credentials logged to console/files)
  └── LLM Provider Abstraction (Mock Mode / OpenAI / Gemini / Claude)
         │
         │  STRUCTURED ACTION JSON ({action: "click", target: "submit"})
         ▼
Chrome Extension
  └── Executes Click / Fill / Scroll Events (Zero arbitrary JS execution)
```

---

## 3. The Core Privacy Guarantee

$$\text{Raw PII} \cap \text{Outgoing Network Traffic} = \emptyset$$

1. **Client-Side Processing**: Detection and redaction occur 100% locally inside the browser content script before any fetch call.
2. **Semantic Context Preservation**: Form labels and field types remain intact so AI models understand page intent without needing raw user values.
3. **Multi-Layer Defense**: If a raw value ever escapes client detection, the FastAPI backend validator intercepts it, masks the logs, and auto-sanitizes the payload.
4. **No Code Execution**: Action responses are strictly limited to `click`, `fill`, and `scroll`. Injection strings like `eval()`, `Function()`, and `javascript:` URLs are unconditionally blocked.

---

## 4. Tech Stack

- **Browser Extension**: Manifest V3, JavaScript (ES6+), Chrome Extension APIs (ActiveTab, Scripting).
- **Local AI & Vision Abstraction**: ONNX Runtime Web, WebGPU hardware acceleration, WebAssembly fallback.
- **Backend API**: Python 3.10+, FastAPI, Uvicorn, Pydantic v2 (Strict typing & validation), Pydantic Settings.
- **Testing**: Pytest, Pytest-Asyncio, FastAPI TestClient, Requests/HTTPX.
- **Containerization**: Docker, Docker Compose.

---

## 5. Folder Structure

```
PrivAgent/
├── extension/                 # Chrome Manifest V3 Extension
│   ├── manifest.json          # Extension configuration & permissions
│   ├── popup.html             # Polished UI with real-time privacy breakdown
│   ├── popup.css              # Dark theme presentation styles
│   ├── popup.js               # Popup controller & state management
│   ├── content.js             # Content script coordinator
│   ├── background.js          # Background service worker
│   ├── privacy/
│   │   ├── pii-detector.js    # Regex & DOM keyword heuristics
│   │   ├── redactor.js        # Safe semantic placeholder replacer
│   │   ├── sanitizer.js       # Outgoing network payload builder
│   │   └── face-detector.js   # ONNX/WebGPU local face detector abstraction
│   ├── ai/
│   │   ├── local-model.js     # WebGPU & WASM feature-detection layer
│   │   └── inference.js       # Local pipeline runner
│   ├── actions/
│   │   └── executor.js        # Safe browser action executor
│   └── icons/                 # Extension toolbar icons (16x16, 48x48, 128x128)
│
├── backend/                   # FastAPI Server
│   ├── main.py                # Server entry point & CORS configuration
│   ├── requirements.txt       # Python dependencies
│   ├── api/
│   │   ├── routes.py          # API endpoints (/health, /analyze, /command)
│   │   └── schemas.py         # Pydantic models with safety validators
│   ├── privacy/
│   │   └── validator.py       # Server-side PII scanning & auto-sanitization
│   ├── agent/
│   │   └── llm_client.py      # LLM provider abstraction + Mock planner
│   └── utils/
│       └── logger.py          # PII-masking logging filter
│
├── demo/                      # Standalone Local Demo Pages
│   ├── index.html             # Interactive demo homepage & architecture
│   ├── scholarship.html       # Scholarship application form (with test PII)
│   ├── login.html             # Login portal (with test credentials)
│   └── styles.css             # Polished demo stylesheets
│
├── tests/                     # Automated Test Suite
│   ├── test_pii.py            # PII detection regex & boundary tests
│   ├── test_privacy.py        # Leak-prevention & anti-leak assertions
│   ├── test_actions.py        # Action validation & injection blocking
│   ├── test_server.py         # FastAPI endpoint integration tests
│   ├── test_dom.py            # DOM schema representation tests
│   └── test_redaction.py      # Redaction verification tests
│
├── docs/                      # Technical Documentation
│   ├── architecture.md        # Comprehensive system architecture & diagrams
│   ├── privacy.md             # Threat model, PII matrix & verification methods
│   └── setup.md               # Step-by-step setup instructions
│
├── models/                    # ONNX Model Artifacts & Documentation
│   ├── README.md              # Instructions for downloading ONNX weights
│   └── model_config.json      # Runtime configuration for local models
│
├── .github/workflows/ci.yml   # GitHub Actions CI workflow
├── docker-compose.yml         # Container orchestration
├── Dockerfile                 # Slim backend container definition
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
├── package.json               # NPM metadata & helper scripts
└── README.md                  # Project documentation
```

---

## 6. Requirements

- Python 3.9+ (Python 3.10, 3.11 recommended)
- Google Chrome or Chromium-based browser
- (Optional) Docker and Docker Compose

---

## 7. Installation & Setup

### 1. Clone & Prepare Environment
```bash
git clone https://github.com/THEUnrealAbhishek/PrivAgent.git
cd PrivAgent
python -m venv venv
```

**Activate Environment:**
- Windows (PowerShell): `.\venv\Scripts\Activate.ps1`
- Linux / macOS: `source venv/bin/activate`

### 2. Install Dependencies
```bash
pip install -r backend/requirements.txt
```

### 3. Configure Environment Variables
```bash
cp .env.example .env
```

---

## 8. Running the Backend

Start the development server:
```bash
python -m backend.main
```
The server will start at `http://localhost:8000`.
- **Health Check**: `http://localhost:8000/health`
- **Privacy Status**: `http://localhost:8000/privacy/status`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **Demo Pages**: `http://localhost:8000/demo/index.html`

---

## 9. Loading the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** (top-right switch).
3. Click **Load unpacked** (top-left button).
4. Select the `extension/` directory inside this repository.
5. PrivAgent will appear in your extensions list and toolbar.

---

## 10. Running the SIH Demo

1. Start the backend: `python -m backend.main`
2. Open the scholarship demo page: `http://localhost:8000/demo/scholarship.html`
3. Click the **PrivAgent** extension icon to open the popup.
4. Verify the connection indicator shows **Connected (MOCK Mode)**.
5. Click **Start PrivAgent**.
6. **Watch the live demo flow**:
   - **Privacy Panel**: Immediately displays all detected and redacted sensitive fields (`Email`, `Phone`, `Aadhaar`, `Password`, `PAN`).
   - **Sanitized Payload Preview**: Click `View Sanitized Payload` to view the exact sanitized JSON sent to the server.
   - **Action Execution**: The extension receives a structured action (`fill` or `click`) and updates the webpage.

---

## 11. Running Automated Tests

Run the full test suite with Pytest:
```bash
pytest tests/ -v
```

All tests pass without requiring external API keys.

---

## 12. Mock LLM vs Real LLM Configuration

PrivAgent works out-of-the-box in **Mock LLM mode** (`LLM_PROVIDER=mock`), which uses intelligent heuristic rules to parse page structures and generate deterministic actions for demonstrations.

To connect a real LLM provider, update `.env`:

### OpenAI
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

### Google Gemini
```env
LLM_PROVIDER=google
GOOGLE_API_KEY=...
GOOGLE_MODEL=gemini-2.0-flash
```

### Anthropic Claude
```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

---

## 13. Local ONNX & WebGPU Setup

PrivAgent includes full architectural support for ONNX Runtime Web:
- Automatically detects hardware acceleration via `navigator.gpu`.
- Falls back to WebAssembly (`wasm`) when WebGPU is unavailable.
- Falls back to DOM heuristics if no model weight files are downloaded.
- See [`models/README.md`](models/README.md) for instructions on downloading optional `face_detect.onnx`.

---

## 14. Known Limitations

- **Complex Dynamic Canvas / WebGL UIs**: Canvas-rendered forms (non-DOM) require OCR rendering before PII detection can take place.
- **Custom Non-Standard Input Controls**: Elements that do not use standard `<input>`, `<textarea>`, or ARIA roles rely on text heuristics.
- **Language Coverage**: Regex patterns are optimized for English, standard international formats, and Indian government identifiers (Aadhaar, PAN).

---

## 15. GitHub Actions & Docker Deployment

- **CI Workflow**: Automatic test execution and Manifest V3 JSON validation on every push/PR (`.github/workflows/ci.yml`).
- **Docker Compose**: Run backend with `docker compose up --build`.
