// Mock global objects
global.console = {
  ...console,
  log: process.env.NODE_ENV !== 'production' ? console.log : jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 1000000,
    jsHeapSizeLimit: 10000000
  }
};

// Mock localStorage with error handling
const localStorageMock = {
  getItem: jest.fn((key) => {
    const items = localStorageMock._items || {};
    return items[key] || null;
  }),
  setItem: jest.fn((key, value) => {
    const items = localStorageMock._items || {};
    items[key] = value;
    localStorageMock._items = items;
  }),
  removeItem: jest.fn((key) => {
    const items = localStorageMock._items || {};
    delete items[key];
    localStorageMock._items = items;
  }),
  clear: jest.fn(() => {
    localStorageMock._items = {};
  }),
  _items: {}
};
global.localStorage = localStorageMock;

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn(() => Promise.resolve()),
  },
  writable: true
});

// Mock navigator.onLine (read-only property)
Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true
});

// Mock service worker
global.navigator.serviceWorker = {
  register: jest.fn(() => Promise.resolve({
    addEventListener: jest.fn(),
    installing: null,
    waiting: null,
    active: null
  })),
  addEventListener: jest.fn(),
  controller: null
};

// Mock Google Apps Script globals for backend tests
global.SpreadsheetApp = {
  openById: jest.fn(() => ({
    getSheetByName: jest.fn(() => ({
      getDataRange: jest.fn(() => ({
        getValues: jest.fn(() => [])
      })),
      appendRow: jest.fn(),
      clear: jest.fn()
    }))
  }))
};

global.Utilities = {
  formatDate: jest.fn((date, timezone, format) => '2024-01-01')
};

// Environment variables for testing
process.env.APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxjC5rcbSwKzeXgFG2LU4hgkrVYGcufvyP301v7wat6t_55y2wxyudn6qmiT3j1O48/exec';
process.env.SHEET_ID = process.env.SHEET_ID || '1t8DsP38rtuKgIPXh98QvxPOyPjc3wV14tHYPTK31Fuc';

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  
  // Reset DOM
  document.body.innerHTML = `
    <div id="loading-screen" class="loading-screen"></div>
    <div id="signals-container"></div>
    <div id="empty-state" class="empty-state hidden"></div>
    <div id="error-banner" class="error-banner hidden"></div>
    <div id="sentiment-bar" class="sentiment-bar"></div>
    <div id="filter-panel" class="filter-panel hidden"></div>
    <div id="copy-modal" class="modal hidden"></div>
    <button id="refresh-btn"></button>
    <div id="market-mood"></div>
    <div id="volatility-level"></div>
    <div id="sentiment-summary"></div>
    <div id="signal-count"></div>
    <div id="last-updated"></div>
  `;
});

// Handle live testing
if (process.env.RUN_LIVE === '1') {
  console.log('Running in LIVE mode - some tests will use real APIs');
} 