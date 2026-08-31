/**
 * PrivAgent - Content Script
 * Runs in the context of web pages.
 * Coordinates DOM extraction, PII detection, sanitization,
 * and action execution.
 */

(function() {
  'use strict';

  const API_BASE = 'http://localhost:8000';

  // State
  let _lastPayload = null;
  let _lastActions = null;
  let _processingState = 'READY';

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'ANALYZE_PAGE':
        handleAnalyze(message).then(sendResponse);
        return true; // async

      case 'EXECUTE_ACTION':
        handleExecuteAction(message.action).then(sendResponse);
        return true;

      case 'GET_STATUS':
        sendResponse({
          state: _processingState,
          lastPayload: _lastPayload,
          lastActions: _lastActions,
        });
        return false;

      case 'GET_SANITIZED_PREVIEW':
        handleSanitizedPreview().then(sendResponse);
        return true;

      case 'EXECUTE_COMMAND':
        handleCommand(message.command).then(sendResponse);
        return true;

      default:
        sendResponse({ error: 'Unknown message type' });
        return false;
    }
  });

  /**
   * Main analysis flow:
   * 1. Extract DOM
   * 2. Detect PII locally
   * 3. Build sanitized payload
   * 4. Send to backend
   * 5. Receive actions
   * 6. Execute actions
   */
  async function handleAnalyze(message) {
    const timings = {};
    const overallStart = performance.now();

    try {
      _processingState = 'ANALYZING';
      _notifyPopup({ state: 'ANALYZING' });

      // Step 1: Build sanitized payload (includes PII detection & redaction)
      const sanitizeStart = performance.now();
      const payload = Sanitizer.buildSanitizedPayload();
      timings.sanitization_ms = Math.round(performance.now() - sanitizeStart);
      _lastPayload = payload;

      _processingState = 'PRIVACY_PROTECTED';
      _notifyPopup({
        state: 'PRIVACY_PROTECTED',
        privacySummary: payload.privacy_summary,
      });

      // Step 2: Send sanitized payload to backend
      const networkStart = performance.now();
      const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      timings.network_ms = Math.round(performance.now() - networkStart);

      _lastActions = result.actions;
      _processingState = 'ACTION_RECEIVED';
      _notifyPopup({
        state: 'ACTION_RECEIVED',
        actions: result.actions,
        privacyVerified: result.privacy_verified,
      });

      // Step 3: Execute actions if auto-execute is enabled
      if (message.autoExecute !== false && result.actions && result.actions.length > 0) {
        const execStart = performance.now();
        const execResults = await ActionExecutor.executeAll(result.actions);
        timings.execution_ms = Math.round(performance.now() - execStart);

        _processingState = 'ACTION_EXECUTED';
        _notifyPopup({
          state: 'ACTION_EXECUTED',
          executionResults: execResults,
        });
      }

      timings.total_ms = Math.round(performance.now() - overallStart);

      return {
        success: true,
        state: _processingState,
        payload: payload,
        actions: result.actions,
        timings,
        privacyVerified: result.privacy_verified,
      };

    } catch (err) {
      _processingState = 'ERROR';
      _notifyPopup({ state: 'ERROR', error: err.message });

      return {
        success: false,
        state: 'ERROR',
        error: err.message,
        timings,
      };
    }
  }

  /**
   * Handle a user text command.
   */
  async function handleCommand(command) {
    try {
      _processingState = 'ANALYZING';
      _notifyPopup({ state: 'ANALYZING' });

      const payload = Sanitizer.buildSanitizedPayload();
      _lastPayload = payload;

      const response = await fetch(`${API_BASE}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: command,
          page: payload.page,
          fields: payload.fields,
          buttons: payload.buttons,
          links: payload.links,
        }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const result = await response.json();
      _lastActions = result.actions;

      if (result.actions && result.actions.length > 0) {
        const execResults = await ActionExecutor.executeAll(result.actions);
        _processingState = 'ACTION_EXECUTED';
        _notifyPopup({
          state: 'ACTION_EXECUTED',
          executionResults: execResults,
        });
      }

      return { success: true, actions: result.actions };
    } catch (err) {
      _processingState = 'ERROR';
      _notifyPopup({ state: 'ERROR', error: err.message });
      return { success: false, error: err.message };
    }
  }

  async function handleExecuteAction(action) {
    const result = ActionExecutor.execute(action);
    return result;
  }

  async function handleSanitizedPreview() {
    const payload = Sanitizer.buildSanitizedPayload();
    _lastPayload = payload;
    return {
      payload,
      serialized: JSON.stringify(payload, null, 2),
    };
  }

  function _notifyPopup(data) {
    try {
      chrome.runtime.sendMessage({
        type: 'STATE_UPDATE',
        ...data,
      });
    } catch (e) {
      // Popup might not be open
    }
  }

  // Mark content script as loaded
  console.log('[PrivAgent] Content script loaded');
})();
