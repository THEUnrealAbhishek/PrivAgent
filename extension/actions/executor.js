/**
 * PrivAgent - Browser Action Executor
 * Executes validated JSON actions from the backend.
 * STRICT: No eval, no arbitrary code, no Function(), no arbitrary selectors.
 */

const ActionExecutor = (() => {
  const ALLOWED_ACTIONS = ['click', 'fill', 'scroll'];

  /**
   * Execute a validated browser action.
   */
  function execute(action) {
    if (!action || !action.action) {
      return { success: false, error: 'Invalid action object' };
    }

    if (!ALLOWED_ACTIONS.includes(action.action)) {
      return { success: false, error: `Blocked action type: ${action.action}` };
    }

    // Security: block dangerous values
    if (action.value && _isDangerous(action.value)) {
      return { success: false, error: 'Blocked potentially dangerous value' };
    }

    try {
      switch (action.action) {
        case 'click':
          return _executeClick(action);
        case 'fill':
          return _executeFill(action);
        case 'scroll':
          return _executeScroll(action);
        default:
          return { success: false, error: 'Unknown action' };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Execute a list of actions sequentially.
   */
  async function executeAll(actions) {
    const results = [];
    for (const action of actions) {
      const result = execute(action);
      results.push({ action, result });

      // Small delay between actions for stability
      if (result.success) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
    return results;
  }

  // --- Action implementations ---

  function _executeClick(action) {
    const target = _findTarget(action.target);
    if (!target) {
      return { success: false, error: `Target not found: ${action.target}` };
    }

    target.focus();
    target.click();

    return {
      success: true,
      action: 'click',
      target: action.target,
      element: _describeElement(target),
    };
  }

  function _executeFill(action) {
    const target = _findTarget(action.target);
    if (!target) {
      return { success: false, error: `Target not found: ${action.target}` };
    }

    if (!_isInputElement(target)) {
      return { success: false, error: 'Target is not an input element' };
    }

    // Set the value
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(target, action.value || '');
    } else {
      target.value = action.value || '';
    }

    // Trigger events for frameworks
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));

    return {
      success: true,
      action: 'fill',
      target: action.target,
      element: _describeElement(target),
    };
  }

  function _executeScroll(action) {
    const direction = (action.direction || 'down').toLowerCase();
    const amount = 400;

    switch (direction) {
      case 'down':
        window.scrollBy({ top: amount, behavior: 'smooth' });
        break;
      case 'up':
        window.scrollBy({ top: -amount, behavior: 'smooth' });
        break;
      case 'left':
        window.scrollBy({ left: -amount, behavior: 'smooth' });
        break;
      case 'right':
        window.scrollBy({ left: amount, behavior: 'smooth' });
        break;
      default:
        return { success: false, error: `Invalid scroll direction: ${direction}` };
    }

    return {
      success: true,
      action: 'scroll',
      direction,
    };
  }

  // --- Target resolution ---

  function _findTarget(targetId) {
    if (!targetId) return null;

    // Priority 1: exact ID match
    let el = document.getElementById(targetId);
    if (el) return el;

    // Priority 2: name attribute
    el = document.querySelector(`[name="${CSS.escape(targetId)}"]`);
    if (el) return el;

    // Priority 3: data-privagent attribute
    el = document.querySelector(`[data-privagent="${CSS.escape(targetId)}"]`);
    if (el) return el;

    // Priority 4: aria-label
    el = document.querySelector(`[aria-label="${CSS.escape(targetId)}"]`);
    if (el) return el;

    // Priority 5: button text match
    const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
    for (const btn of buttons) {
      const text = (btn.textContent || btn.value || '').trim().toLowerCase();
      if (text === targetId.toLowerCase() || text.includes(targetId.toLowerCase())) {
        return btn;
      }
    }

    // Priority 6: normalized text in clickable elements
    const clickables = document.querySelectorAll('a, button, [role="button"]');
    for (const el of clickables) {
      const text = (el.textContent || '').trim().toLowerCase();
      if (text.includes(targetId.toLowerCase())) {
        return el;
      }
    }

    // Priority 7: placeholder match for inputs
    const inputs = document.querySelectorAll('input, textarea');
    for (const input of inputs) {
      if (input.placeholder && input.placeholder.toLowerCase().includes(targetId.toLowerCase())) {
        return input;
      }
    }

    return null;
  }

  // --- Safety helpers ---

  function _isDangerous(value) {
    if (typeof value !== 'string') return false;
    const dangerous = [
      'javascript:', 'eval(', 'Function(', '<script',
      'document.cookie', 'window.location.href=',
      'onclick=', 'onerror=', 'onload=',
    ];
    const lower = value.toLowerCase();
    return dangerous.some(d => lower.includes(d.toLowerCase()));
  }

  function _isInputElement(el) {
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
  }

  function _describeElement(el) {
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      type: el.type || null,
      text: (el.textContent || '').trim().substring(0, 50),
    };
  }

  return {
    execute,
    executeAll,
    ALLOWED_ACTIONS,
  };
})();

if (typeof window !== 'undefined') {
  window.ActionExecutor = ActionExecutor;
}
