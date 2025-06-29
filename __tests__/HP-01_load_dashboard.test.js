const fetchMock = require('../__mocks__/fetch.js');

// Load the app module which creates window.app
require('../js/app.js');

describe('HP-01: Load Dashboard', () => {
  let app;
  
  beforeEach(() => {
    // Reset DOM state
    document.body.innerHTML = `
      <div id="loading-screen" class="hidden"></div>
      <div id="error-banner" class="hidden"></div>
      <div id="signals-container"></div>
    `;
    
    // Create fresh app instance using the class from window
    const { MarketSignalApp } = window;
    app = new MarketSignalApp();
    
    // Mock fetch globally
    global.fetch = jest.fn();
  });

  test('should initialize successfully with valid data', async () => {
    expect.assertions(4);
    
    // Mock successful API response
    global.fetch.mockResolvedValue(
      fetchMock.mockSuccessfulApiResponse(fetchMock.mockValidSignalData())
    );

    await app.init();
    
    expect(app.isInitialized).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(document.getElementById('loading-screen').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('error-banner').classList.contains('hidden')).toBe(true);
  });

  test('should handle initialization errors gracefully', async () => {
    expect.assertions(3);
    
    // Mock network error
    global.fetch.mockRejectedValue(new Error('Network Error'));

    try {
      await app.init();
    } catch (error) {
      // Expected to handle error gracefully
    }
    
    expect(app.isInitialized).toBe(false);
    expect(document.getElementById('loading-screen').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('error-banner').classList.contains('hidden')).toBe(false);
  });

  test('should set up performance monitoring', async () => {
    expect.assertions(2);
    
    global.fetch.mockResolvedValue(
      fetchMock.mockSuccessfulApiResponse([])
    );

    await app.init();
    
    expect(app.performanceMetrics.startTime).toBeDefined();
    expect(typeof app.performanceMetrics.startTime).toBe('number');
  });

  test('should handle empty data response', async () => {
    expect.assertions(3);
    
    global.fetch.mockResolvedValue(
      fetchMock.mockSuccessfulApiResponse([])
    );

    await app.init();
    
    expect(app.isInitialized).toBe(true);
    expect(document.getElementById('signals-container').children.length).toBe(0);
    expect(document.getElementById('empty-state').classList.contains('hidden')).toBe(false);
  });

  test('should retry on failure up to maxRetries', async () => {
    expect.assertions(2);
    
    global.fetch
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValue(fetchMock.mockSuccessfulApiResponse([]));

    await app.init();
    
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(app.isInitialized).toBe(true);
  });

  if (process.env.RUN_LIVE === '1') {
    test('should connect to live Google Sheets API', async () => {
      expect.assertions(1);
      
      // Remove fetch mock for live test
      global.fetch = originalFetch;
      
      const response = await fetch(process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxjC5rcbSwKzeXgFG2LU4hgkrVYGcufvyP301v7wat6t_55y2wxyudn6qmiT3j1O48/exec');
      
      expect(response.ok).toBe(true);
    }, 15000);
  }
}); 