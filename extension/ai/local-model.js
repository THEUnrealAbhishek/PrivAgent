/**
 * PrivAgent - Local AI / Vision Model Abstraction
 * Wraps ONNX Runtime Web with WebGPU/WASM fallback.
 */

const LocalVisionProcessor = (() => {
  let _initialized = false;
  let _backend = null;  // 'webgpu' | 'wasm' | 'none'
  let _capabilities = {};

  /**
   * Initialize the local vision processor.
   * Feature-detects WebGPU, falls back to WASM.
   */
  async function initialize() {
    _capabilities = {
      webgpu: false,
      wasm: true,  // WASM is baseline
      onnx: false,
    };

    // Check WebGPU
    try {
      if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          _capabilities.webgpu = true;
          _backend = 'webgpu';
          console.log('[PrivAgent] WebGPU available');
        }
      }
    } catch (e) {
      console.log('[PrivAgent] WebGPU not available:', e.message);
    }

    if (!_backend) {
      _backend = 'wasm';
      console.log('[PrivAgent] Using WASM backend');
    }

    // Check ONNX Runtime
    if (typeof ort !== 'undefined') {
      _capabilities.onnx = true;
      console.log('[PrivAgent] ONNX Runtime Web available');
    }

    _initialized = true;

    return {
      backend: _backend,
      capabilities: _capabilities,
    };
  }

  /**
   * Process an image for PII detection.
   * Returns metadata only — NEVER raw image data.
   */
  async function process(imageData) {
    if (!_initialized) await initialize();

    const startTime = performance.now();

    // If ONNX is available, try model inference
    if (_capabilities.onnx) {
      try {
        const result = await _processONNX(imageData);
        result.processingTime = Math.round(performance.now() - startTime);
        return result;
      } catch (e) {
        console.warn('[PrivAgent] ONNX processing failed:', e.message);
      }
    }

    // Fallback: return safe metadata
    return {
      processed: true,
      method: 'fallback',
      backend: _backend,
      detections: [],
      message: 'No ONNX model loaded — using heuristic detection only',
      processingTime: Math.round(performance.now() - startTime),
    };
  }

  async function _processONNX(imageData) {
    // Placeholder for actual ONNX inference
    // Real implementation would load a model and run inference
    return {
      processed: true,
      method: 'onnx',
      backend: _backend,
      detections: [],
      message: 'ONNX runtime available but no model loaded',
    };
  }

  function dispose() {
    _initialized = false;
    _backend = null;
  }

  function getCapabilities() {
    return {
      initialized: _initialized,
      backend: _backend,
      capabilities: { ..._capabilities },
    };
  }

  return {
    initialize,
    process,
    dispose,
    getCapabilities,
  };
})();

if (typeof window !== 'undefined') {
  window.LocalVisionProcessor = LocalVisionProcessor;
}
