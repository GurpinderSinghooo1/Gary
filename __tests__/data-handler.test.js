import { jest } from '@jest/globals';

beforeEach(async () => {
  jest.resetModules();
  await import('../js/config.js');
  await import('../js/utils.js');
  await import('../js/data-handler.js');
});

test('calculateSectorDistribution counts sectors', () => {
  const DataHandlerClass = window.dataHandler.constructor;
  const handler = new DataHandlerClass();
  const signals = [
    { Sector: 'Tech' },
    { Sector: 'Finance' },
    { Sector: 'Tech' }
  ];
  const dist = handler.calculateSectorDistribution(signals);
  expect(dist).toEqual({ Tech: 2, Finance: 1 });
});

test('getSignalsForDate filters by date', () => {
  const DataHandlerClass = window.dataHandler.constructor;
  const handler = new DataHandlerClass();
  handler.data = [
    { Ticker: 'AAA', Date: '2024-01-01' },
    { Ticker: 'BBB', Date: '2024-01-02' },
    { Ticker: 'CCC', Date: '2024-01-01' }
  ];
  const result = handler.getSignalsForDate('2024-01-01');
  expect(result.length).toBe(2);
});

test('API_FULL_URL contains no whitespace', async () => {
  const { API_FULL_URL } = await import('../js/config.js');
  expect(/\s/.test(API_FULL_URL)).toBe(false);
});
