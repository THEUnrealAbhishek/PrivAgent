/**
 * PrivAgent - Popup Controller
 * Manages popup UI state and communication with content/background scripts.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const analyzeBtn = document.getElementById('analyzeBtn');
  const commandBtn = document.getElementById('commandBtn');
  const commandInput = document.getElementById('commandInput');
  const statusBadge = document.getElementById('statusBadge');
  const privacyBadge = document.getElementById('privacyBadge');
  const connectionBadge = document.getElementById('connectionBadge');
  const connectionText = document.getElementById('connectionText');
  const privacyPanel = document.getElementById('privacyPanel');
  const detectedList = document.getElementById('detectedList');
  const actionsPanel = document.getElementById('actionsPanel');
  const actionsList = document.getElementById('actionsList');
  const previewBtn = document.getElementById('previewBtn');
  const previewPanel = document.getElementById('previewPanel');
  const payloadPreview = document.getElementById('payloadPreview');
  const perfPanel = document.getElementById('perfPanel');
  const perfMetrics = document.getElementById('perfMetrics');
  const errorPanel = document.getElementById('errorPanel');
  const errorText = document.getElementById('errorText');
  const llmMode = document.getElementById('llmMode');

  // Check backend health
  checkHealth();

  // Event listeners
  analyzeBtn.addEventListener('click', handleAnalyze);
  commandBtn.addEventListener('click', handleCommand);
  commandInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleCommand();
  });
  previewBtn.addEventListener('click', handlePreview);

  // Listen for state updates from content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'STATE_UPDATE') {
      updateState(message);
    }
  });

  async function checkHealth() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_HEALTH' });
      if (response && response.connected) {
        connectionBadge.className = 'badge badge-ok';
        connectionText.textContent = 'Connected';
        llmMode.textContent = (response.llm_provider || 'mock').toUpperCase() + ' Mode';
      } else {
        connectionBadge.className = 'badge badge-error';
        connectionText.textContent = 'Disconnected';
      }
    } catch (err) {
      connectionBadge.className = 'badge badge-error';
      connectionText.textContent = 'Error';
    }
  }

  async function handleAnalyze() {
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span class="btn-icon">⏳</span> Analyzing...';
    hideError();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');

      const response = await chrome.runtime.sendMessage({
        type: 'ANALYZE_TAB',
        tabId: tab.id,
      });

      if (response && response.success) {
        showResults(response);
      } else {
        showError(response?.error || 'Analysis failed');
      }
    } catch (err) {
      showError(err.message);
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = '<span class="btn-icon">▶</span> Start PrivAgent';
    }
  }

  async function handleCommand() {
    const command = commandInput.value.trim();
    if (!command) return;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');

      await chrome.tabs.sendMessage(tab.id, {
        type: 'EXECUTE_COMMAND',
        command: command,
      });
      commandInput.value = '';
    } catch (err) {
      showError(err.message);
    }
  }

  async function handlePreview() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_SANITIZED_PREVIEW',
      });

      if (response && response.serialized) {
        previewPanel.classList.toggle('hidden');
        payloadPreview.textContent = response.serialized;
      }
    } catch (err) {
      showError('Could not get preview: ' + err.message);
    }
  }

  function updateState(data) {
    const stateMap = {
      'READY': { class: 'state-ready', text: 'READY' },
      'ANALYZING': { class: 'state-analyzing', text: 'ANALYZING' },
      'PRIVACY_PROTECTED': { class: 'state-protected', text: 'PRIVACY PROTECTED' },
      'ACTION_RECEIVED': { class: 'state-action', text: 'ACTION RECEIVED' },
      'ACTION_EXECUTED': { class: 'state-executed', text: 'ACTION EXECUTED' },
      'ERROR': { class: 'state-error', text: 'ERROR' },
    };

    const stateInfo = stateMap[data.state] || stateMap['READY'];
    statusBadge.className = `state-badge ${stateInfo.class}`;
    statusBadge.textContent = stateInfo.text;

    if (data.privacySummary) {
      privacyPanel.classList.remove('hidden');
      updatePrivacyPanel(data.privacySummary);
    }

    if (data.actions) {
      actionsPanel.classList.remove('hidden');
      updateActionsPanel(data.actions);
    }

    if (data.executionResults) {
      updateExecutionResults(data.executionResults);
    }

    if (data.error) {
      showError(data.error);
    }
  }

  function showResults(response) {
    if (response.payload && response.payload.privacy_summary) {
      privacyPanel.classList.remove('hidden');
      updatePrivacyPanel(response.payload.privacy_summary);
    }

    if (response.actions) {
      actionsPanel.classList.remove('hidden');
      updateActionsPanel(response.actions);
    }

    if (response.timings) {
      perfPanel.classList.remove('hidden');
      updatePerfPanel(response.timings);
    }

    if (response.privacyVerified) {
      privacyBadge.textContent = '🔒 Verified';
      privacyBadge.style.color = 'var(--accent-green)';
    }

    statusBadge.className = 'state-badge state-executed';
    statusBadge.textContent = 'ACTION EXECUTED';
  }

  function updatePrivacyPanel(summary) {
    detectedList.innerHTML = '';

    if (summary.detected_types && Object.keys(summary.detected_types).length > 0) {
      for (const [type, count] of Object.entries(summary.detected_types)) {
        const li = document.createElement('li');
        li.className = 'detection-item';
        li.textContent = `✓ ${type} (${count})`;
        li.style.background = 'rgba(52, 168, 83, 0.1)';
        li.style.color = 'var(--accent-green)';
        detectedList.appendChild(li);
      }
    } else {
      const li = document.createElement('li');
      li.className = 'detection-item muted';
      li.textContent = 'No PII detected on this page';
      detectedList.appendChild(li);
    }
  }

  function updateActionsPanel(actions) {
    actionsList.innerHTML = '';

    actions.forEach((action) => {
      const div = document.createElement('div');
      div.className = 'action-item';
      div.innerHTML = `
        <span class="action-type">${action.action}</span>
        <span class="action-details">
          ${action.target ? `Target: ${action.target}` : ''}
          ${action.value ? ` → "${action.value}"` : ''}
          ${action.direction ? `Direction: ${action.direction}` : ''}
        </span>
        <span class="action-status">⏳</span>
      `;
      actionsList.appendChild(div);
    });
  }

  function updateExecutionResults(results) {
    const items = actionsList.querySelectorAll('.action-item');
    results.forEach((result, i) => {
      if (items[i]) {
        const status = items[i].querySelector('.action-status');
        status.textContent = result.result.success ? '✅' : '❌';
      }
    });
  }

  function updatePerfPanel(timings) {
    perfMetrics.innerHTML = '';
    const metrics = {
      'Sanitization': timings.sanitization_ms,
      'Network': timings.network_ms,
      'Execution': timings.execution_ms,
      'Total': timings.total_ms,
    };

    for (const [label, value] of Object.entries(metrics)) {
      if (value !== undefined) {
        const div = document.createElement('div');
        div.className = 'perf-item';
        div.innerHTML = `
          <span class="perf-label">${label}</span>
          <span class="perf-value">${value}ms</span>
        `;
        perfMetrics.appendChild(div);
      }
    }
  }

  function showError(message) {
    errorPanel.classList.remove('hidden');
    errorText.textContent = message;
    statusBadge.className = 'state-badge state-error';
    statusBadge.textContent = 'ERROR';
  }

  function hideError() {
    errorPanel.classList.add('hidden');
    errorText.textContent = '';
  }
});
