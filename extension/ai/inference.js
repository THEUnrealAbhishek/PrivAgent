/**
 * PrivAgent - Inference Engine
 * Coordinates local AI inference (vision, OCR, face detection).
 * All processing happens locally — nothing leaves the browser.
 */

const InferenceEngine = (() => {
  let _initialized = false;

  async function initialize() {
    const results = {
      vision: null,
      face: null,
    };

    try {
      results.vision = await LocalVisionProcessor.initialize();
    } catch (e) {
      console.warn('[PrivAgent] Vision init failed:', e.message);
      results.vision = { backend: 'none', error: e.message };
    }

    try {
      results.face = await FaceDetector.initialize();
    } catch (e) {
      console.warn('[PrivAgent] Face detector init failed:', e.message);
      results.face = { initialized: false, error: e.message };
    }

    _initialized = true;
    return results;
  }

  /**
   * Run the full local inference pipeline.
   * Returns only safe metadata — no raw images or PII.
   */
  async function runPipeline() {
    if (!_initialized) await initialize();

    const startTime = performance.now();

    // 1. PII Detection (DOM-based)
    const piiResults = PIIDetector.scanPage();

    // 2. Face detection (heuristic or ONNX)
    let faceResults = { detected: false, count: 0, method: 'skipped' };
    try {
      faceResults = await FaceDetector.detect(null); // scan full page
    } catch (e) {
      console.warn('[PrivAgent] Face detection error:', e.message);
    }

    // 3. Vision capabilities
    const capabilities = LocalVisionProcessor.getCapabilities();

    return {
      pii: piiResults,
      faces: faceResults,
      vision: capabilities,
      totalTime: Math.round(performance.now() - startTime),
    };
  }

  function getStatus() {
    return {
      initialized: _initialized,
      vision: LocalVisionProcessor.getCapabilities(),
    };
  }

  return {
    initialize,
    runPipeline,
    getStatus,
  };
})();

if (typeof window !== 'undefined') {
  window.InferenceEngine = InferenceEngine;
}
