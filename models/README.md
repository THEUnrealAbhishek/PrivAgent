# PrivAgent Models Directory

This directory contains configuration, documentation, and model files for PrivAgent's **local** visual processing and on-device AI.

## Privacy Guarantee

> **Strict Rule:** All visual processing models in PrivAgent run **locally within the user's browser runtime** (via ONNX Runtime Web using WebGPU or WebAssembly). Raw screenshots and webcam images are NEVER sent to the backend server.

---

## Supported Models

### 1. Face Detection Model (`face_detect.onnx`)
- **Purpose**: Detect faces locally in web page images/video elements and apply redaction before any context is gathered.
- **Format**: ONNX (Open Neural Network Exchange)
- **Target Size**: ~1.5 MB (Ultra-lightweight RFB / UltraFace architecture)
- **Input**: `[1, 3, 320, 320]` Float32 tensor (Normalized RGB)
- **Output**: Bounding box coordinates and confidence scores
- **Placement**: Place `face_detect.onnx` into `extension/models/face_detect.onnx` or this directory.

### 2. Optical Character Recognition (OCR)
- **Engine**: Tesseract.js (WebAssembly)
- **Execution**: 100% Client-side in browser sandbox.
- **Privacy Policy**: OCR text is processed through regex PII filters locally; raw OCR transcripts containing PII are immediately redacted.

---

## WebGPU & WASM Execution Providers

PrivAgent automatically feature-detects browser capabilities in the following order:

```
WebGPU (Hardware Accelerated)
   ↓ (fallback if unsupported)
WebAssembly (WASM with SIMD)
   ↓ (fallback if model unavailable)
Local DOM Heuristic Filtering (Zero-dependency safe mode)
```

Even if no `.onnx` model files are placed in this directory, PrivAgent **gracefully falls back** to DOM-based heuristics and regex filtering without losing privacy protection or breaking execution.

---

## How to download optional pre-converted ONNX weights

For live production deployment with ONNX models:
```bash
# Example: Download ultra-lightweight face detector ONNX
curl -L -o extension/models/face_detect.onnx https://github.com/onnx/models/raw/main/validated/vision/body_analysis/ultraface/models/version-RFB-320.onnx
```
