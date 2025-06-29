/**
 * Market Signal Dashboard - Google Apps Script Backend
 * Handles data synchronization between Project 1 (source) and Project 2 (destination)
 */

// Sheet IDs
const SOURCE_SHEET_ID = '1ua0vi3gkuA2sTLrMZpPCqXlwdgpv_68VQ5rq-n_-zSc';
const WEBSITE_SHEET_ID = '1t8DsP38rtuKgIPXh98QvxPOyPjc3wV14tHYPTK31Fuc';

// Tab names
const SOURCE_TABS = {
  FINAL_SIGNALS: 'FinalSignals',
  TECHNICAL: 'TechnicalAnalysis',
  FUNDAMENTALS: 'Fundamentals',
  SENTIMENT: 'MarketSentiment',
  COMPANY_NAMES: 'BuySignals_Working'
};

const DESTINATION_TABS = {
  ARCHIVE: 'SignalArchive_web',
  ERRORS: 'SyncErrors_web'
};

/**
 * Main sync function - called daily at 12:30 PM
 */
function syncData_web() {
  try {
    console.log('Starting daily data sync...');
    
    // Get current date for processing
    const today = new Date();
    const dateString = Utilities.formatDate(today, 'America/New_York', 'yyyy-MM-dd');
    
    // Fetch data from all source tabs
    const finalSignals = getFinalSignals();
    const technicalData = getTechnicalData();
    const fundamentals = getFundamentals();
    const marketSentiment = getMarketSentiment();
    const companyNames = getCompanyNameMap();
    
    console.log(`Fetched data: ${finalSignals.length} signals, ${technicalData.length} technical records, ${fundamentals.length} fundamental records`);
    
    // Validate data before merging
    if (!validateData(finalSignals, technicalData, fundamentals, marketSentiment)) {
      throw new Error('Data validation failed - missing required fields or invalid data');
    }
    
    // Merge data into enriched rows
    const enrichedData = mergeSignalData(finalSignals, technicalData, fundamentals, marketSentiment, companyNames);
    
    // Validate enriched data
    if (!validateEnrichedData(enrichedData)) {
      throw new Error('Enriched data validation failed');
    }
    
    // Additional validation for critical fields
    const validatedData = enrichedData.filter(row => {
      // Validate prices
      if (row.CurrentPrice && (isNaN(row.CurrentPrice) || row.CurrentPrice <= 0)) {
        console.warn(`Invalid current price for ${row.Ticker}: ${row.CurrentPrice}`);
        return false;
      }
      if (row.SellTarget && (isNaN(row.SellTarget) || row.SellTarget <= 0)) {
        console.warn(`Invalid sell target for ${row.Ticker}: ${row.SellTarget}`);
        return false;
      }
      
      // Validate confidence
      if (row.Confidence && (isNaN(row.Confidence) || row.Confidence < 0 || row.Confidence > 100)) {
        console.warn(`Invalid confidence for ${row.Ticker}: ${row.Confidence}`);
        return false;
      }
      
      // Validate timestamp
      if (row.Timestamp && !(row.Timestamp instanceof Date) && isNaN(new Date(row.Timestamp).getTime())) {
        console.warn(`Invalid timestamp for ${row.Ticker}: ${row.Timestamp}`);
        return false;
      }
      
      return true;
    });
    
    if (validatedData.length === 0) {
      throw new Error('No valid signals after validation');
    }
    
    console.log(`Validated ${validatedData.length} signals out of ${enrichedData.length} total`);
    
    // Save to archive
    saveToArchive(validatedData, dateString);
    
    // Clean old data (keep 30 days)
    cleanOldArchiveData();
    
    console.log(`Sync completed successfully. Processed ${validatedData.length} signals.`);
    
  } catch (error) {
    console.error('Sync failed:', error);
    logSyncError(error);
    throw error; // Re-throw to ensure proper error handling
  }
}

/**
 * Validate source data before processing
 */
function validateData(finalSignals, technicalData, fundamentals, marketSentiment) {
  // Validate final signals
  if (!Array.isArray(finalSignals) || finalSignals.length === 0) {
    console.warn('No final signals found');
    return false;
  }
  
  // Check for required fields in first signal
  const firstSignal = finalSignals[0];
  const requiredSignalFields = ['ticker', 'decision', 'sellTarget', 'confidence', 'riskLevel', 'summary'];
  for (const field of requiredSignalFields) {
    if (!firstSignal.hasOwnProperty(field)) {
      console.error(`Missing required field in signals: ${field}`);
      return false;
    }
  }
  
  // Validate market sentiment
  if (!marketSentiment || !marketSentiment.marketMood) {
    console.warn('Market sentiment data missing or incomplete');
  }
  
  return true;
}

/**
 * Validate enriched data before saving
 */
function validateEnrichedData(enrichedData) {
  if (!Array.isArray(enrichedData) || enrichedData.length === 0) {
    console.error('No enriched data to save');
    return false;
  }
  
  const requiredFields = ['ticker', 'companyName', 'decision', 'sellTarget', 'confidence', 'riskLevel', 'summary', 'currentPrice'];
  const firstRow = enrichedData[0];
  
  for (const field of requiredFields) {
    if (!firstRow.hasOwnProperty(field)) {
      console.error(`Missing required field in enriched data: ${field}`);
      return false;
    }
  }
  
  return true;
}

/**
 * Fetch final signals from source sheet
 */
function getFinalSignals() {
  const sheet = SpreadsheetApp.openById(SOURCE_SHEET_ID).getSheetByName(SOURCE_TABS.FINAL_SIGNALS);
  if (!sheet) {
    throw new Error(`Source tab not found: ${SOURCE_TABS.FINAL_SIGNALS}`);
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  // Map column indices with exact names from specification
  const cols = {
    timestamp: headers.indexOf('Timestamp'),
    ticker: headers.indexOf('Ticker'),
    decision: headers.indexOf('Decision'),
    sellTarget: headers.indexOf('Sell_Target'), // Fixed: exact column name
    targetHorizon: headers.indexOf('Target_Horizon'),
    confidence: headers.indexOf('Confidence'),
    riskLevel: headers.indexOf('Risk_Level'), // Fixed: exact column name
    summary: headers.indexOf('Summary'),
    macroMood: headers.indexOf('Macro_Mood'),
    techScore: headers.indexOf('Tech_Score')
  };
  
  // Validate column mappings
  const missingColumns = Object.entries(cols).filter(([key, index]) => index === -1);
  if (missingColumns.length > 0) {
    console.warn(`Missing columns in FinalSignals_Archive: ${missingColumns.map(([key]) => key).join(', ')}`);
  }
  
  return rows.map(row => ({
    timestamp: row[cols.timestamp],
    ticker: row[cols.ticker],
    decision: row[cols.decision],
    sellTarget: row[cols.sellTarget],
    targetHorizon: row[cols.targetHorizon],
    confidence: row[cols.confidence],
    riskLevel: row[cols.riskLevel],
    summary: row[cols.summary],
    macroMood: row[cols.macroMood],
    techScore: row[cols.techScore]
  })).filter(signal => signal.ticker && signal.decision === 'BUY');
}

/**
 * Fetch technical analysis data
 */
function getTechnicalData() {
  const sheet = SpreadsheetApp.openById(SOURCE_SHEET_ID).getSheetByName(SOURCE_TABS.TECHNICAL);
  if (!sheet) {
    throw new Error(`Source tab not found: ${SOURCE_TABS.TECHNICAL}`);
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  const cols = {
    ticker: headers.indexOf('Ticker'),
    currentPrice: headers.indexOf('Current Price'),
    week52High: headers.indexOf('52W High'),
    week52Low: headers.indexOf('52W Low'),
    rsi: headers.indexOf('RSI'),
    volumeSpike: headers.indexOf('Volume Spike'),
    macd: headers.indexOf('MACD'),
    gapStatus: headers.indexOf('Gap Status'),
    ma50: headers.indexOf('MA50'),
    ma200: headers.indexOf('MA200'),
    atr: headers.indexOf('ATR'),
    technicalScore: headers.indexOf('Technical Score'),
    timestamp: headers.indexOf('Timestamp')
  };
  
  return rows.map(row => ({
    ticker: row[cols.ticker],
    currentPrice: row[cols.currentPrice],
    week52High: row[cols.week52High],
    week52Low: row[cols.week52Low],
    rsi: row[cols.rsi],
    volumeSpike: row[cols.volumeSpike],
    macd: row[cols.macd],
    gapStatus: row[cols.gapStatus],
    ma50: row[cols.ma50],
    ma200: row[cols.ma200],
    atr: row[cols.atr],
    technicalScore: row[cols.technicalScore],
    timestamp: row[cols.timestamp]
  })).filter(tech => tech.ticker);
}

/**
 * Fetch fundamentals data
 */
function getFundamentals() {
  const sheet = SpreadsheetApp.openById(SOURCE_SHEET_ID).getSheetByName(SOURCE_TABS.FUNDAMENTALS);
  if (!sheet) {
    throw new Error(`Source tab not found: ${SOURCE_TABS.FUNDAMENTALS}`);
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  const cols = {
    ticker: headers.indexOf('Ticker'),
    marketCap: headers.indexOf('Market Cap'),
    peRatio: headers.indexOf('P/E Ratio'),
    revenueGrowth: headers.indexOf('Revenue Growth'),
    profitMargin: headers.indexOf('Profit Margin'),
    roe: headers.indexOf('ROE'),
    epsGrowth: headers.indexOf('EPS Growth'),
    debtToEquity: headers.indexOf('Debt to Equity'),
    peg: headers.indexOf('PEG'),
    evEbitda: headers.indexOf('EV/EBITDA'),
    fcfShare: headers.indexOf('FCF/Share TTM'),
    sector: headers.indexOf('Sector'),
    industry: headers.indexOf('Industry'),
    currentRatio: headers.indexOf('Current Ratio')
  };
  
  return rows.map(row => ({
    ticker: row[cols.ticker],
    marketCap: row[cols.marketCap],
    peRatio: row[cols.peRatio],
    revenueGrowth: row[cols.revenueGrowth],
    profitMargin: row[cols.profitMargin],
    roe: row[cols.roe],
    epsGrowth: row[cols.epsGrowth],
    debtToEquity: row[cols.debtToEquity],
    peg: row[cols.peg],
    evEbitda: row[cols.evEbitda],
    fcfShare: row[cols.fcfShare],
    sector: row[cols.sector],
    industry: row[cols.industry],
    currentRatio: row[cols.currentRatio]
  })).filter(fund => fund.ticker);
}

/**
 * Fetch market sentiment data
 */
function getMarketSentiment() {
  const sheet = SpreadsheetApp.openById(SOURCE_SHEET_ID).getSheetByName(SOURCE_TABS.SENTIMENT);
  if (!sheet) {
    throw new Error(`Source tab not found: ${SOURCE_TABS.SENTIMENT}`);
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  const cols = {
    marketMood: headers.indexOf('market_mood'),
    macroStrength: headers.indexOf('macro_strength'),
    volatilityLevel: headers.indexOf('volatility_level'),
    summary: headers.indexOf('summary'),
    date: headers.indexOf('date')
  };
  
  // Get the most recent sentiment data
  const latestSentiment = rows[rows.length - 1];
  
  return {
    marketMood: latestSentiment[cols.marketMood],
    macroStrength: latestSentiment[cols.macroStrength],
    volatilityLevel: latestSentiment[cols.volatilityLevel],
    summary: latestSentiment[cols.summary],
    date: latestSentiment[cols.date]
  };
}

/**
 * Fetch company name mappings
 */
function getCompanyNameMap() {
  const sheet = SpreadsheetApp.openById(SOURCE_SHEET_ID).getSheetByName(SOURCE_TABS.COMPANY_NAMES);
  if (!sheet) {
    throw new Error(`Source tab not found: ${SOURCE_TABS.COMPANY_NAMES}`);
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  const tickerCol = headers.indexOf('Ticker');
  const nameCol = headers.indexOf('COMPANY_NAME');
  
  const nameMap = {};
  rows.forEach(row => {
    if (row[tickerCol] && row[nameCol]) {
      nameMap[row[tickerCol]] = row[nameCol];
    }
  });
  
  return nameMap;
}

/**
 * Merge all data sources into enriched signal rows
 */
function mergeSignalData(finalSignals, technicalData, fundamentals, marketSentiment, companyNames) {
  const enrichedData = [];
  
  // Remove duplicates - keep latest signal per ticker
  const uniqueSignals = removeDuplicateTickers(finalSignals);
  
  // Create lookup maps for faster merging
  const techMap = {};
  technicalData.forEach(tech => {
    techMap[tech.ticker] = tech;
  });
  
  const fundMap = {};
  fundamentals.forEach(fund => {
    fundMap[fund.ticker] = fund;
  });
  
  // Process each signal
  uniqueSignals.forEach(signal => {
    const ticker = signal.ticker;
    const tech = techMap[ticker] || {};
    const fund = fundMap[ticker] || {};
    const companyName = companyNames[ticker] || ticker;
    
    // Calculate upside percentage
    let upside = null;
    if (tech.currentPrice && signal.sellTarget) {
      upside = ((signal.sellTarget - tech.currentPrice) / tech.currentPrice * 100).toFixed(1);
    }
    
    // Create enriched row with exact column names from specification
    const enrichedRow = {
      // Date for frontend compatibility
      Date: dateString,
      
      // Signal data
      Timestamp: signal.timestamp,
      Ticker: ticker,
      CompanyName: companyName,
      Decision: signal.decision,
      SellTarget: signal.sellTarget,
      TargetHorizon: signal.targetHorizon,
      Confidence: signal.confidence,
      RiskLevel: signal.riskLevel,
      Summary: signal.summary,
      MacroMood: signal.macroMood,
      TechScore: signal.techScore,
      
      // Technical data
      CurrentPrice: tech.currentPrice,
      Week52High: tech.week52High,
      Week52Low: tech.week52Low,
      RSI: tech.rsi,
      VolumeSpike: tech.volumeSpike,
      MACD: tech.macd,
      GapStatus: tech.gapStatus,
      MA50: tech.ma50,
      MA200: tech.ma200,
      ATR: tech.atr,
      TechnicalScore: tech.technicalScore,
      
      // Fundamental data
      MarketCap: fund.marketCap,
      PERatio: fund.peRatio,
      RevenueGrowth: fund.revenueGrowth,
      ProfitMargin: fund.profitMargin,
      ROE: fund.roe,
      EPSGrowth: fund.epsGrowth,
      DebtToEquity: fund.debtToEquity,
      PEG: fund.peg,
      EVEbitda: fund.evEbitda,
      FCFShare: fund.fcfShare,
      Sector: fund.sector,
      Industry: fund.industry,
      CurrentRatio: fund.currentRatio,
      
      // Calculated fields
      Upside: upside,
      
      // Market sentiment (same for all signals today)
      MarketMood: marketSentiment.marketMood,
      MacroStrength: marketSentiment.macroStrength,
      VolatilityLevel: marketSentiment.volatilityLevel,
      SentimentSummary: marketSentiment.summary,
      SentimentDate: marketSentiment.date
    };
    
    enrichedData.push(enrichedRow);
  });
  
  return enrichedData;
}

/**
 * Remove duplicate tickers, keeping the latest signal based on timestamp
 */
function removeDuplicateTickers(signals) {
  const tickerMap = {};
  const removedTickers = [];
  
  signals.forEach(signal => {
    const ticker = signal.ticker;
    const timestamp = new Date(signal.timestamp);
    
    if (!tickerMap[ticker] || new Date(tickerMap[ticker].timestamp) < timestamp) {
      // If we're replacing an existing ticker, add it to removed list
      if (tickerMap[ticker]) {
        removedTickers.push(ticker);
      }
      tickerMap[ticker] = signal;
    } else {
      // This signal is older, add to removed list
      removedTickers.push(ticker);
    }
  });
  
  const uniqueSignals = Object.values(tickerMap);
  const duplicatesRemoved = signals.length - uniqueSignals.length;
  
  if (duplicatesRemoved > 0) {
    console.log(`Removed duplicate ticker(s): ${removedTickers.join(', ')}`);
  }
  
  return uniqueSignals;
}

/**
 * Save enriched data to archive tab
 */
function saveToArchive(enrichedData, dateString) {
  const ss = SpreadsheetApp.openById(WEBSITE_SHEET_ID);
  let archiveSheet = ss.getSheetByName(DESTINATION_TABS.ARCHIVE);
  
  // Create archive sheet if it doesn't exist
  if (!archiveSheet) {
    archiveSheet = ss.insertSheet(DESTINATION_TABS.ARCHIVE);
    const headers = [
      'Date', 'Timestamp', 'Ticker', 'CompanyName', 'Decision', 'SellTarget', 'TargetHorizon',
      'Confidence', 'RiskLevel', 'Summary', 'MacroMood', 'TechScore', 'CurrentPrice',
      'Week52High', 'Week52Low', 'RSI', 'VolumeSpike', 'MACD', 'GapStatus', 'MA50', 'MA200',
      'ATR', 'TechnicalScore', 'MarketCap', 'PERatio', 'RevenueGrowth', 'ProfitMargin',
      'ROE', 'EPSGrowth', 'DebtToEquity', 'PEG', 'EVEbitda', 'FCFShare', 'Sector',
      'Industry', 'CurrentRatio', 'Upside', 'MarketMood', 'MacroStrength', 'VolatilityLevel',
      'SentimentSummary', 'SentimentDate'
    ];
    archiveSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  
  // Prepare data for writing
  const rowsToAdd = enrichedData.map(row => [
    row.Date,
    row.Timestamp,
    row.Ticker,
    row.CompanyName,
    row.Decision,
    row.SellTarget,
    row.TargetHorizon,
    row.Confidence,
    row.RiskLevel,
    row.Summary,
    row.MacroMood,
    row.TechScore,
    row.CurrentPrice,
    row.Week52High,
    row.Week52Low,
    row.RSI,
    row.VolumeSpike,
    row.MACD,
    row.GapStatus,
    row.MA50,
    row.MA200,
    row.ATR,
    row.TechnicalScore,
    row.MarketCap,
    row.PERatio,
    row.RevenueGrowth,
    row.ProfitMargin,
    row.ROE,
    row.EPSGrowth,
    row.DebtToEquity,
    row.PEG,
    row.EVEbitda,
    row.FCFShare,
    row.Sector,
    row.Industry,
    row.CurrentRatio,
    row.Upside,
    row.MarketMood,
    row.MacroStrength,
    row.VolatilityLevel,
    row.SentimentSummary,
    row.SentimentDate
  ]);
  
  // Add data to archive
  if (rowsToAdd.length > 0) {
    const lastRow = archiveSheet.getLastRow();
    archiveSheet.getRange(lastRow + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
  }
}

/**
 * Clean old archive data (keep only 30 days)
 */
function cleanOldArchiveData() {
  const ss = SpreadsheetApp.openById(WEBSITE_SHEET_ID);
  const archiveSheet = ss.getSheetByName(DESTINATION_TABS.ARCHIVE);
  
  if (!archiveSheet) return;
  
  const data = archiveSheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  // Find date column
  const dateCol = headers.indexOf('Date');
  if (dateCol === -1) return;
  
  // Calculate cutoff date (30 days ago)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoffString = Utilities.formatDate(cutoffDate, 'America/New_York', 'yyyy-MM-dd');
  
  // Find rows to delete (older than 30 days)
  const rowsToDelete = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const rowDate = rows[i][dateCol];
    if (rowDate && rowDate < cutoffString) {
      rowsToDelete.push(i + 2); // +2 because we have headers and 0-based index
    }
  }
  
  // Delete old rows (from bottom to top to maintain indices)
  rowsToDelete.forEach(rowIndex => {
    archiveSheet.deleteRow(rowIndex);
  });
  
  console.log(`Cleaned ${rowsToDelete.length} old rows from archive`);
}

/**
 * Log sync errors to error tab
 */
function logSyncError(error) {
  const ss = SpreadsheetApp.openById(WEBSITE_SHEET_ID);
  let errorSheet = ss.getSheetByName(DESTINATION_TABS.ERRORS);
  
  // Create error sheet if it doesn't exist
  if (!errorSheet) {
    errorSheet = ss.insertSheet(DESTINATION_TABS.ERRORS);
    errorSheet.getRange(1, 1, 1, 3).setValues([['Timestamp', 'Error', 'Details']]);
  }
  
  const timestamp = new Date();
  const errorMessage = error.message || 'Unknown error';
  const errorDetails = error.stack || error.toString();
  
  errorSheet.appendRow([timestamp, errorMessage, errorDetails]);
}

/**
 * Web API endpoint for frontend to fetch data
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(WEBSITE_SHEET_ID);
    const archiveSheet = ss.getSheetByName(DESTINATION_TABS.ARCHIVE);
    
    if (!archiveSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        error: 'Archive data not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = archiveSheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // Convert to JSON format
    const jsonData = rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
    
    // Add CORS headers for web access
    const response = ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: jsonData,
      lastUpdated: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    return response;
    
  } catch (error) {
    console.error('API error:', error);
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Failed to fetch data',
      details: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Manual trigger function for testing
 */
function testSync() {
  console.log('Running test sync...');
  syncData_web();
}

/**
 * Setup daily trigger (run once)
 */
function setupDailyTrigger() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncData_web') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new daily trigger at 12:30 PM
  ScriptApp.newTrigger('syncData_web')
    .timeBased()
    .everyDays(1)
    .atHour(12)
    .nearMinute(30)
    .create();
  
  console.log('Daily trigger set for 12:30 PM');
}





 