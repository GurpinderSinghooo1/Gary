// Import utils module - it attaches to window.utils
require('../js/utils.js');

describe('SEC-01: XSS Prevention', () => {
  test('should escape malicious script tags', () => {
    expect.assertions(3);
    
    const maliciousInput = '<script>alert("XSS")</script>';
    const result = window.utils.escapeHtml(maliciousInput);
    
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('&lt;/script&gt;');
  });

  test('should escape HTML entities in signal data', () => {
    expect.assertions(2);
    
    const maliciousSignal = {
      CompanyName: '<img src=x onerror=alert(1)>',
      Summary: 'Company & <b>Bold</b> text'
    };
    
    const escapedName = window.utils.escapeHtml(maliciousSignal.CompanyName);
    const escapedSummary = window.utils.escapeHtml(maliciousSignal.Summary);
    
    expect(escapedName).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escapedSummary).toBe('Company &amp; &lt;b&gt;Bold&lt;/b&gt; text');
  });

  test('should handle XSS payloads in various formats', () => {
    expect.assertions(6);
    
    const xssPayloads = [
      '<img src=x onerror=alert(1)>',
      'javascript:alert(1)',
      '<svg onload=alert(1)>',
      '"><script>alert(1)</script>',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<div onclick="alert(1)">Click me</div>'
    ];
    
    xssPayloads.forEach(payload => {
      const escaped = window.utils.escapeHtml(payload);
      expect(escaped).not.toMatch(/<script|<iframe|<svg|onclick=|onerror=|onload=/i);
    });
  });

  test('should handle null and undefined values safely', () => {
    expect.assertions(3);
    
    expect(window.utils.escapeHtml(null)).toBe('');
    expect(window.utils.escapeHtml(undefined)).toBe('');
    expect(window.utils.escapeHtml('')).toBe('');
  });

  test('should preserve safe HTML entities', () => {
    expect.assertions(2);
    
    const safeText = 'Price: $100 & rising (5% increase)';
    const result = window.utils.escapeHtml(safeText);
    
    expect(result).toContain('&amp;');
    expect(result).not.toContain('<');
  });

  test('should handle complex nested XSS attempts', () => {
    expect.assertions(1);
    
    const complexXSS = '<div><script>var x="<img src=x onerror=alert(1)>"</script></div>';
    const result = window.utils.escapeHtml(complexXSS);
    
    expect(result).toBe('&lt;div&gt;&lt;script&gt;var x=\"&lt;img src=x onerror=alert(1)&gt;\"&lt;/script&gt;&lt;/div&gt;');
  });
}); 