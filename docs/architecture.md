# PrivAgent Architecture

PrivAgent is a privacy-first AI browser agent designed to enable autonomous web interaction without exposing users' Personally Identifiable Information (PII) to remote servers or cloud AI models.

---

## High-Level System Flow

```mermaid
flowchart TD
    subgraph Browser ["Client Browser (Local Privacy Boundary)"]
        DOM[DOM Tree & Inputs] --> Extractor[DOM & Element Extractor]
        Visual[Visual / Screenshot Stream] --> VisionProc[Local Vision & ONNX Face Detector]
        
        Extractor --> PIIDetector[PII Detector (Regex + Heuristics)]
        VisionProc --> PIIDetector
        
        PIIDetector --> Redactor[Redactor Engine]
        Redactor --> Sanitizer[Payload Sanitizer]
        
        ActionExec[Browser Action Executor]
    end

    Sanitizer -- "Sanitized JSON Context ONLY\n(e.g., [REDACTED_EMAIL], [REDACTED_ID])" --> ServerValidation[FastAPI Privacy Validator]
    
    subgraph Server ["PrivAgent Backend (Cloud / Local Server)"]
        ServerValidation --> Router[API Router: /analyze, /command]
        Router --> LLMAbst[LLM Provider Abstraction]
        LLMAbst --> MockOrReal[Mock Mode / Configurable LLM]
        MockOrReal --> ActionParser[Structured Action JSON Generator]
    end

    ActionParser -- "Validated Action JSON\n{action: 'click', target: 'submit'}" --> ActionExec
    ActionExec --> Execution[Local Browser Event Dispatch: Click/Fill/Scroll]
```

---

## Architectural Components

### 1. Browser Extension (Manifest V3)
- **Popup (`popup.html`, `popup.js`, `popup.css`)**:
  - Displays real-time connection status, privacy verification badge, detected PII breakdown, and performance metrics.
  - Interactive "Sanitized Payload Preview" enabling developers and auditors to verify that no raw PII leaves the browser.
- **Content Script (`content.js`)**:
  - Injected on the active webpage.
  - Extracts interactive elements (inputs, buttons, select, textarea, links) and coordinates with privacy redactors.
- **Privacy Engine (`extension/privacy/`)**:
  - `pii-detector.js`: Scans DOM attributes, input types, labels, and values for sensitive patterns.
  - `redactor.js`: Replaces sensitive values with safe placeholders on copy data (never mutates user input prematurely).
  - `sanitizer.js`: Assembles the final network payload and runs anti-leak verification before HTTP dispatch.
  - `face-detector.js`: Runs on-device face detection via ONNX Runtime Web.
- **AI & Vision Abstraction (`extension/ai/`)**:
  - `local-model.js`: Hardware acceleration via WebGPU with graceful WASM fallback.
  - `inference.js`: Coordinates local processing pipelines.
- **Action Executor (`extension/actions/executor.js`)**:
  - Securely dispatches `click`, `fill`, and `scroll` events using priority matching (`id` -> `name` -> `aria-label` -> `text`).
  - **Strict Security**: Blocks `eval`, `Function()`, javascript injection, and arbitrary script execution.

---

### 2. Backend Server (FastAPI + Pydantic)
- **`backend/main.py`**: Application entry point with CORS, PII-safe logging filter, and demo static file server.
- **`backend/privacy/validator.py`**:
  - Secondary line of defense: Scans incoming requests for unintentional PII leaks.
  - Automatically sanitizes and flags payloads if raw PII is discovered.
  - Safe log masking (never logs credentials or full numbers).
- **`backend/agent/llm_client.py`**:
  - Provider abstraction for AI model reasoning.
  - `MockLLMProvider`: Deterministic heuristic-based planner enabling standalone demo execution without API keys.
  - Extensible to OpenAI, Google Gemini, and Anthropic Claude via `.env`.
- **`backend/api/schemas.py`**:
  - Strict Pydantic models ensuring actions conform to safe schemas (`click`, `fill`, `scroll`).

---

## The Core Privacy Guarantee

$$\text{Raw PII} \cap \text{Outgoing Network Traffic} = \emptyset$$

All PII detection, redaction, and visual processing happen **locally in the browser memory space**. The server receives only structural schema and semantic tokens.
