beforeAll(() => {
  require('../js/utils.js');
});

test('formatCurrency formats numbers as USD', () => {
  expect(window.utils.formatCurrency(1234.56)).toBe('$1,234.56');
});

test('isValidEmail validates email strings', () => {
  expect(window.utils.isValidEmail('test@example.com')).toBe(true);
  expect(window.utils.isValidEmail('invalid-email')).toBe(false);
});
