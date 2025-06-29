beforeEach(() => {
  jest.resetModules();
  require('../js/utils.js');
  require('../js/data-handler.js');
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
