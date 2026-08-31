/**
 * PrivAgent - Sanitizer
 * Builds a sanitized page representation safe for network transmission.
 * This is the privacy boundary — output from this module is the ONLY
 * thing that leaves the browser.
 */

const Sanitizer = (() => {
  /**
   * Extract and sanitize all interactive elements from the DOM.
   * Returns a payload safe for the backend.
   */
  function buildSanitizedPayload() {
    const startTime = performance.now();

    const fields = _extractFields();
    const buttons = _extractButtons();
    const links = _extractLinks();
    const pageMetadata = _extractPageMetadata();
    const privacySummary = _buildPrivacySummary(fields);

    const payload = {
      page: pageMetadata,
      fields: fields,
      buttons: buttons,
      links: links,
      privacy_summary: privacySummary,
      _timing: {
        extraction_ms: Math.round(performance.now() - startTime),
      },
    };

    // Final safety check — scan the serialized payload
    const serialized = JSON.stringify(payload);
    const leakCheck = _checkForLeaks(serialized);
    if (leakCheck.hasLeaks) {
      console.warn('[PrivAgent] Leak detected in payload, re-sanitizing...');
      return _deepSanitize(payload);
    }

    return payload;
  }

  function _extractFields() {
    const elements = document.querySelectorAll('input, textarea, select');
    const fields = [];

    elements.forEach((el) => {
      if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button') return;

      const sensitivity = PIIDetector.isFieldSensitive(el);
      const label = _getLabel(el);

      const field = {
        id: el.id || null,
        name: el.name || null,
        type: el.type || el.tagName.toLowerCase(),
        tag: el.tagName.toLowerCase(),
        label: label,
        placeholder: el.placeholder || null,
        visible: _isVisible(el),
        aria_label: el.getAttribute('aria-label') || null,
        redacted: false,
        value: null,
      };

      // Handle value — redact if sensitive
      if (sensitivity.sensitive || el.value) {
        if (sensitivity.sensitive && el.value) {
          const redacted = Redactor.redactValue(el.value, sensitivity.type);
          field.value = redacted.value;
          field.redacted = true;
        } else if (sensitivity.sensitive) {
          field.value = Redactor.PLACEHOLDERS[sensitivity.type] || '[REDACTED_PII]';
          field.redacted = true;
        } else {
          // Non-sensitive field — still scan value for PII
          const valueScans = PIIDetector.scanValue(el.value);
          if (valueScans.length > 0) {
            field.value = Redactor.redactText(el.value);
            field.redacted = true;
          } else {
            field.value = el.value;
          }
        }
      }

      fields.push(field);
    });

    return fields;
  }

  function _extractButtons() {
    const buttons = [];
    const elements = document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]');

    elements.forEach((el) => {
      buttons.push({
        id: el.id || null,
        name: el.name || null,
        type: 'button',
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || el.value || '').trim().substring(0, 100),
        label: el.getAttribute('aria-label') || null,
        visible: _isVisible(el),
      });
    });

    return buttons;
  }

  function _extractLinks() {
    const links = [];
    const elements = document.querySelectorAll('a[href]');

    elements.forEach((el) => {
      if (!_isVisible(el)) return;
      links.push({
        id: el.id || null,
        text: (el.textContent || '').trim().substring(0, 100),
        href: el.href ? new URL(el.href, window.location.href).pathname : null,
        visible: true,
      });
    });

    // Limit to first 20 links
    return links.slice(0, 20);
  }

  function _extractPageMetadata() {
    return {
      url: window.location.pathname,  // Only path, not full URL with params
      title: document.title || null,
      domain: window.location.hostname,
    };
  }

  function _buildPrivacySummary(fields) {
    const detected = {};
    let totalRedacted = 0;

    fields.forEach((f) => {
      if (f.redacted) {
        totalRedacted++;
        // Track what types were redacted
        const type = _inferPIIType(f);
        detected[type] = (detected[type] || 0) + 1;
      }
    });

    return {
      total_fields: fields.length,
      redacted_count: totalRedacted,
      detected_types: detected,
      privacy_applied: totalRedacted > 0,
    };
  }

  function _inferPIIType(field) {
    if (field.value && field.value.includes('PASSWORD')) return 'password';
    if (field.value && field.value.includes('EMAIL')) return 'email';
    if (field.value && field.value.includes('PHONE')) return 'phone';
    if (field.value && field.value.includes('ID')) return 'id';
    if (field.value && field.value.includes('CREDIT')) return 'credit_card';
    if (field.type === 'password') return 'password';
    if (field.type === 'email') return 'email';
    if (field.type === 'tel') return 'phone';
    return 'pii';
  }

  function _checkForLeaks(serialized) {
    // Check for obvious PII patterns in the serialized payload
    const checks = PIIDetector.scanValue(serialized);
    return {
      hasLeaks: checks.length > 0,
      types: checks.map(c => c.type),
    };
  }

  function _deepSanitize(payload) {
    // Nuclear option: re-sanitize by serializing and replacing
    let text = JSON.stringify(payload);
    text = Redactor.redactText(text);
    return JSON.parse(text);
  }

  function _getLabel(element) {
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label.textContent.trim();
    }
    const parent = element.closest('label');
    if (parent) return parent.textContent.trim();
    return element.getAttribute('aria-label') || element.placeholder || null;
  }

  function _isVisible(el) {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
  }

  return {
    buildSanitizedPayload,
  };
})();

if (typeof window !== 'undefined') {
  window.Sanitizer = Sanitizer;
}
