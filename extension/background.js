/**
 * PrivAgent - Background Service Worker
 * Manages extension lifecycle, tab communication, and local screenshot capture.
 * PRIVACY GUARANTEE: Raw screenshots captured here are processed strictly
 * within the local browser sandbox and are NEVER transmitted to remote servers.
 */

const API_BASE = 'http://localhost:8000';

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await analyzeTab(tab.id);
  }
});

// Handle messages from popup / content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'ANALYZE_TAB':
      handleAnalyzeTab(message.tabId).then(sendResponse);
      return true;

    case 'CHECK_HEALTH':
      checkHealth().then(sendResponse);
      return true;

    case 'GET_PRIVACY_STATUS':
      getPrivacyStatus().then(sendResponse);
      return true;

    case 'CAPTURE_SCREENSHOT_LOCAL':
      // Captures viewport locally for on-device face detection / vision processing
      captureLocalScreenshot().then(sendResponse);
      return true;

    default:
      return false;
  }
});

async function captureLocalScreenshot() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.windowId) {
      return { success: false, error: 'No active window found' };
    }
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    return { success: true, dataUrl };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function handleAnalyzeTab(tabId) {
  try {
    // Send analyze message to content script
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'ANALYZE_PAGE',
      autoExecute: true,
    });
    return response;
  } catch (err) {
    // Content script might not be injected yet — inject and retry
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [
          'privacy/pii-detector.js',
          'privacy/redactor.js',
          'privacy/sanitizer.js',
          'privacy/face-detector.js',
          'ai/local-model.js',
          'ai/inference.js',
          'actions/executor.js',
          'content.js',
        ],
      });

      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'ANALYZE_PAGE',
        autoExecute: true,
      });
      return response;
    } catch (injectErr) {
      return { success: false, error: injectErr.message };
    }
  }
}

async function analyzeTab(tabId) {
  return handleAnalyzeTab(tabId);
}

async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    return { connected: true, ...data };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

async function getPrivacyStatus() {
  try {
    const response = await fetch(`${API_BASE}/privacy/status`);
    const data = await response.json();
    return { connected: true, ...data };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

console.log('[PrivAgent] Background service worker loaded');
