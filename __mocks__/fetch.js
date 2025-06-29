const fetchMock = {
  mockSuccessfulApiResponse: (data = []) => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: data,
      lastUpdated: new Date().toISOString()
    }),
    headers: new Map([
      ['content-type', 'application/json'],
      ['Access-Control-Allow-Origin', '*'],
      ['Access-Control-Allow-Methods', 'GET, POST, OPTIONS']
    ])
  }),
  
  mockApiError: (status = 500, message = 'Server Error') => ({
    ok: false,
    status: status,
    statusText: message,
    json: async () => ({
      success: false,
      error: message
    }),
    headers: new Map()
  }),
  
  mockNetworkError: () => {
    throw new Error('Network Error');
  },
  
  mockCORSFailure: () => ({
    ok: false,
    status: 403,
    json: async () => ({
      success: false,
      error: 'CORS policy violation'
    }),
    headers: new Map([
      ['content-type', 'application/json']
      // Missing CORS headers intentionally
    ])
  }),
  
  mockMalformedSignalData: () => ([
    {
      Ticker: 'AAPL',
      CompanyName: 'Apple Inc.',
      Decision: 'BUY',
      SellTarget: 150.00,
      Confidence: 85,
      RiskLevel: 'Medium',
      Summary: 'Good stock'
      // Missing some fields but valid
    },
    {
      // Missing Ticker - should be filtered out
      CompanyName: 'Microsoft Corporation',
      Decision: 'BUY',
      SellTarget: 280.00,
      Confidence: 90,
      RiskLevel: 'Low',
      Summary: 'Strong performance'
    },
    {
      Ticker: 'GOOGL',
      CompanyName: 'Alphabet Inc.',
      Decision: 'BUY',
      SellTarget: 'invalid_price', // Invalid price format
      Confidence: 150, // Invalid confidence range
      RiskLevel: 'Medium',
      Summary: 'Search dominance'
    },
    {
      Ticker: '', // Empty ticker
      CompanyName: null, // Null company name
      Decision: 'BUY',
      SellTarget: 100,
      Confidence: -50, // Negative confidence
      RiskLevel: 'InvalidLevel', // Invalid risk level
      Summary: undefined // Undefined summary
    },
    {
      Ticker: 'TSLA',
      CompanyName: '<script>alert("XSS")</script>',
      Decision: 'BUY',
      SellTarget: 200,
      Confidence: 75,
      RiskLevel: 'High',
      Summary: '<img src=x onerror=alert("XSS")>Electric vehicles'
    }
  ]),
  
  mockServerError: (status = 500, message = 'Internal Server Error') => ({
    ok: false,
    status: status,
    statusText: message,
    json: async () => ({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    }),
    headers: new Map([
      ['content-type', 'application/json']
    ])
  }),
  
  mockValidSignalData: () => ([
    {
      Ticker: 'AAPL',
      CompanyName: 'Apple Inc.',
      Decision: 'BUY',
      SellTarget: 150.00,
      CurrentPrice: 145.00,
      Confidence: 85,
      RiskLevel: 'Medium',
      Summary: 'Strong quarterly results with good growth prospects',
      Sector: 'Technology',
      Date: '2024-01-01',
      Timestamp: new Date().toISOString()
    },
    {
      Ticker: 'MSFT',
      CompanyName: 'Microsoft Corporation',
      Decision: 'BUY', 
      SellTarget: 280.00,
      CurrentPrice: 275.00,
      Confidence: 90,
      RiskLevel: 'Low',
      Summary: 'Cloud growth driving revenue',
      Sector: 'Technology',
      Date: '2024-01-01',
      Timestamp: new Date().toISOString()
    }
  ])
};

module.exports = fetchMock; 