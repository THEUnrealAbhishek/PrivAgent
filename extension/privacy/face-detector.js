/**
 * PrivAgent - Face Detector Abstraction
 * Local face detection using ONNX Runtime Web.
 * If no model is available, provides a safe fallback that flags
 * img/canvas elements but NEVER uploads raw images.
 */

const FaceDetector = (() => {
  let _initialized = false;
  let _session = null;
  let _useONNX = false;

  /**
   * Initialize the face detector.
   * Attempts ONNX Runtime Web; falls back to DOM heuristics.
   */
  async function initialize() {
    try {
      // Check if ONNX Runtime Web is available
      if (typeof ort !== 'undefined') {
        // Check for WebGPU support
        const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

        const options = {
          executionProviders: hasWebGPU
            ? ['webgpu', 'wasm']
            : ['wasm'],
        };

        // Try to load the face detection model
        try {
          _session = await ort.InferenceSession.create(
            chrome.runtime.getURL('models/face_detect.onnx'),
            options
          );
          _useONNX = true;
          console.log('[PrivAgent] Face detector: ONNX model loaded');
        } catch (modelErr) {
          console.log('[PrivAgent] Face detector: ONNX model not found, using heuristic fallback');
          _useONNX = false;
        }
      } else {
        console.log('[PrivAgent] Face detector: ONNX Runtime not available, using heuristic fallback');
        _useONNX = false;
      }
    } catch (err) {
      console.warn('[PrivAgent] Face detector init error:', err.message);
      _useONNX = false;
    }

    _initialized = true;
    return { initialized: true, useONNX: _useONNX };
  }

  /**
   * Detect faces in an image element or canvas.
   * Returns detection metadata only — NEVER the raw image data.
   */
  async function detect(imageElement) {
    if (!_initialized) await initialize();

    if (_useONNX && _session) {
      return await _detectONNX(imageElement);
    }
    return _detectHeuristic(imageElement);
  }

  /**
   * ONNX-based face detection.
   */
  async function _detectONNX(imageElement) {
    try {
      // Create canvas and get image data
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 320;
      canvas.height = 320;
      ctx.drawImage(imageElement, 0, 0, 320, 320);
      const imageData = ctx.getImageData(0, 0, 320, 320);

      // Preprocess for model
      const tensor = new ort.Tensor('float32',
        _preprocessImage(imageData), [1, 3, 320, 320]);

      const results = await _session.run({ input: tensor });

      // Parse detections
      const faceCount = _parseDetections(results);

      // Clean up — do NOT keep the image data
      canvas.remove();

      return {
        detected: faceCount > 0,
        count: faceCount,
        method: 'onnx',
        // NO raw image data returned
      };
    } catch (err) {
      console.warn('[PrivAgent] ONNX face detection error:', err.message);
      return _detectHeuristic(imageElement);
    }
  }

  /**
   * Heuristic fallback: checks for face-like image elements.
   */
  function _detectHeuristic(element) {
    if (!element) {
      // Scan the whole page
      const images = document.querySelectorAll('img, canvas, video, [role="img"]');
      let possibleFaces = 0;

      images.forEach((img) => {
        if (_mightContainFace(img)) possibleFaces++;
      });

      return {
        detected: possibleFaces > 0,
        count: possibleFaces,
        method: 'heuristic',
        confidence: 0.3,  // Low confidence for heuristic
      };
    }

    return {
      detected: _mightContainFace(element),
      count: _mightContainFace(element) ? 1 : 0,
      method: 'heuristic',
      confidence: 0.3,
    };
  }

  /**
   * Heuristic: does an image element likely contain a face?
   */
  function _mightContainFace(img) {
    const attrs = [
      img.alt, img.title, img.className, img.id,
      img.getAttribute('aria-label'),
    ].filter(Boolean).join(' ').toLowerCase();

    const faceKeywords = [
      'profile', 'avatar', 'photo', 'portrait',
      'headshot', 'face', 'user', 'selfie', 'passport',
    ];

    return faceKeywords.some(kw => attrs.includes(kw));
  }

  function _preprocessImage(imageData) {
    // HWC to CHW, normalize to [0,1]
    const { data, width, height } = imageData;
    const float32 = new Float32Array(3 * width * height);
    for (let i = 0; i < width * height; i++) {
      float32[i] = data[i * 4] / 255.0;                    // R
      float32[width * height + i] = data[i * 4 + 1] / 255.0; // G
      float32[2 * width * height + i] = data[i * 4 + 2] / 255.0; // B
    }
    return float32;
  }

  function _parseDetections(results) {
    // Generic parsing — actual parsing depends on model output format
    try {
      const output = Object.values(results)[0];
      if (output && output.data) {
        // Count detections with confidence > 0.5
        let count = 0;
        for (let i = 0; i < output.data.length; i += 5) {
          if (output.data[i + 4] > 0.5) count++;
        }
        return count;
      }
    } catch (e) {
      // Fallback
    }
    return 0;
  }

  function dispose() {
    if (_session) {
      _session.release();
      _session = null;
    }
    _initialized = false;
    _useONNX = false;
  }

  return {
    initialize,
    detect,
    dispose,
  };
})();

if (typeof window !== 'undefined') {
  window.FaceDetector = FaceDetector;
}
