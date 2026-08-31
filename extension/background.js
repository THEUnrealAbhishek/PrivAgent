/**
 * PrivAgent - Background Service Worker
 * Manages extension lifecycle and tab communication.
 */

const API_BASE = 'http://localhost:8000';

// Handle extension icon click (when popup is not configured)
chrome.action.onClicked.addListener(async (tab) => {
  await analyzeTab(tab.id);
});

// Handle messages from popup
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

    default:
      return false;
  }
});

async function handleAnalyzeTab(tabId) {
  try {
    // Inject content scripts if needed, then send analyze message
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'ANALYZE_PAGE',
      autoExecute: true,
    });
    return response;
  } catch (err) {
    // Content script might not be loaded — try injecting
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

      // Retry after injection
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
