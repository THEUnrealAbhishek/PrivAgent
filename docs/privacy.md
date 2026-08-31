# PrivAgent Privacy Model & Verification

PrivAgent implements a **Zero-PII Transmission Model**. This document details the privacy boundaries, threat model, redaction rules, and formal verification methods.

---

## 1. The Privacy Boundary

The client-side sandbox inside the Chrome Extension is the strict boundary:

```
┌────────────────────────────────────────────────────────┐
│ BROWSER CLIENT (Untrusted Network Boundary)            │
│                                                        │
│  User Input (rahul@gmail.com, Passwords, Aadhaar)      │
│     │                                                  │
│     ▼                                                  │
│  [PII Detector & Redactor Engine]                      │
│     │                                                  │
│     ▼                                                  │
│  Sanitized Struct (value: "[REDACTED_EMAIL]")          │
└───────────────────────────┬────────────────────────────┘
                            │
              ═════════════════════════════ PRIVACY BOUNDARY
                            │  (HTTP / POST /analyze)
                            ▼
┌────────────────────────────────────────────────────────┐
│ BACKEND SERVER (FastAPI + LLM)                         │
│                                                        │
│  Server-side Privacy Validator                         │
│  (Failsafe regex check & auto-sanitization)            │
│     │                                                  │
│     ▼                                                  │
│  LLM / Mock Reasoning                                  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Supported PII Entities & Redaction Placeholders

| Category | Detection Heuristics | Redacted Placeholder |
| :--- | :--- | :--- |
| **Passwords** | `type="password"`, keywords (`pwd`, `token`, `secret`) | `[REDACTED_PASSWORD]` |
| **Email Addresses** | `type="email"`, RFC 5322 regex, label keywords | `[REDACTED_EMAIL]` |
| **Phone Numbers** | `type="tel"`, E.164 / International / 10-digit regex | `[REDACTED_PHONE]` |
| **Aadhaar / National IDs**| 12-digit spaced/hyphenated regex, `uid` keywords | `[REDACTED_ID]` |
| **Credit / Debit Cards** | 16-digit card regex, `cvv`/`card` keywords | `[REDACTED_CREDIT_CARD]`|
| **PAN Cards (India)** | 10-character alphanumeric regex (`[A-Z]{5}[0-9]{4}[A-Z]`) | `[REDACTED_PAN]` |
| **Faces in Visuals** | ONNX Face Detector / Profile heuristics | `[FACE_REDACTED]` |

---

## 3. Server-Side Secondary Defense Layer

Even if an extension bug or edge-case bypasses client-side redaction, the backend enforces:
1. **Request Payload Scanning**: Every JSON key and value is scanned against PII regex patterns.
2. **Auto-Sanitization**: Any detected raw PII is immediately converted into placeholders before reaching the LLM layer.
3. **PII-Safe Logging**: Custom logging filter masks sensitive patterns with `****` in console and file logs.

---

## 4. Threat Model & Mitigations

| Threat | Risk Level | PrivAgent Mitigation |
| :--- | :---: | :--- |
| **Malicious Server / LLM Provider logging credentials** | CRITICAL | Credentials never leave browser; replaced with `[REDACTED_PASSWORD]`. |
| **Server returning executable JS to exploit page** | HIGH | Action Executor only accepts structured actions (`click`, `fill`, `scroll`). Any script tag, `eval()`, or `Function()` payload is blocked by Pydantic schema validation. |
| **Accidental Logging of PII in backend stdout** | MEDIUM | `PIISafeFilter` installed on logging root stream. |
| **Screenshot leakage** | HIGH | Visual processing runs on WebGPU/WASM locally in browser. No raw images sent across network. |

---

## 5. Network Privacy Verification Method

To verify zero-PII transmission during tests and live demos:
1. Open Chrome DevTools -> **Network** tab.
2. Filter requests by `/analyze`.
3. Inspect the `Request Payload`.
4. Run automated test suite:
   ```bash
   pytest tests/test_privacy.py -v
   ```
   This asserts that synthetic test credentials (e.g. `rahul.sharma@gmail.com`, `MyS3cret!Pass`, `1234 5678 9012`) never appear in serialized outgoing requests.
