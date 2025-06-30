/**
 * Market Signal Dashboard - Data Handler
 * Manages API calls, data processing, filtering, and state management
 */

class DataHandler {
    constructor() {
        this.data = [];
        this.filteredData = [];
        this.currentDate = utils.getTodayDate();
        this.filters = {
            confidence: 0,
            riskLevel: '',
            sector: '',
            sortBy: 'newest'
        };
        this.sectors = new Set();
        this.isLoading = false;
        this.lastUpdated = null;
        this.isDataFromCache = false; // Track if current data is from cache
        
        // Load saved filters from localStorage
        this.loadFilters();
    }
    
    /**
     * Load saved filters from localStorage
     */
    loadFilters() {
        const savedFilters = utils.storage.get('market-signal-filters', {});
        this.filters = { ...this.filters, ...savedFilters };
    }
    
    /**
     * Save filters to localStorage
     */
    saveFilters() {
        utils.storage.set('market-signal-filters', this.filters);
    }
    
    /**
     * Validate API response data structure
     */
    validateApiResponse(response) {
        if (!response || typeof response !== 'object') {
            throw new Error('Invalid API response format');
        }
        
        if (!response.success) {
            throw new Error(response.error || 'API request failed');
        }
        
        if (!Array.isArray(response.data)) {
            throw new Error('API response missing data array');
        }
        
        return true;
    }
    
    /**
     * Validate individual signal data
     */
    validateSignalData(signal) {
        const requiredFields = ['Ticker', 'CompanyName', 'Decision', 'SellTarget', 'Confidence', 'RiskLevel', 'Summary'];
        const missingFields = requiredFields.filter(field => !signal.hasOwnProperty(field) || signal[field] === null || signal[field] === undefined);
        
        if (missingFields.length > 0) {
            console.warn(`Signal ${signal.Ticker || 'unknown'} missing fields: ${missingFields.join(', ')}`);
            return false;
        }
        
        // Validate data types
        if (typeof signal.Ticker !== 'string' || signal.Ticker.trim() === '') {
            console.warn(`Invalid ticker for signal: ${signal.Ticker}`);
            return false;
        }
        
        if (typeof signal.Confidence !== 'number' || isNaN(signal.Confidence) || signal.Confidence < 0 || signal.Confidence > 100) {
            console.warn(`Invalid confidence value for ${signal.Ticker}: ${signal.Confidence}`);
            return false;
        }
        
        return true;
    }
    
    /**
     * Fetch data from Google Apps Script API
     */
    async fetchData() {
        this.isLoading = true;
        this.isDataFromCache = false; // Reset cache flag
        
        try {
            // CORS/Proxy configuration  – set USE_PROXY = true to enable proxy later if needed
            const USE_PROXY   = false;
            const PROXY_PREFIX = 'https://corsproxy.io/?'; // or switch to another proxy
            const BASE_API_URL = 'https://script.google.com/macros/s/AKfycbxjC5rcbSwKzeXgFG2LU4hgkrVYGcufvyP301v7wat6t_55y2wxyudn6qmiT3j1O48/exec';
            
            // Final URL: direct or proxied
            const url = USE_PROXY ? `${PROXY_PREFIX}${BASE_API_URL}` : BASE_API_URL;
            
            // Perform fetch – omit custom headers to keep request "simple" and avoid pre-flight
            const response = await fetch(url, {
                method: 'GET',
                mode: 'cors'
            });
            
            // Check if the data was served from the service worker cache
            this.isDataFromCache = response.headers.has('X-Served-From-Cache');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Validate API response
            this.validateApiResponse(result);
            
            // Validate and filter data
            const validData = result.data.filter(signal => this.validateSignalData(signal));
            
            if (validData.length === 0) {
                console.warn('No valid signals found in API response');
                // Return empty array instead of throwing error
                this.data = [];
            } else {
                this.data = validData;
            }
            
            this.lastUpdated = result.lastUpdated || new Date().toISOString();
            
            // Extract unique sectors
            this.extractSectors();
            
            // Apply current filters
            this.applyFilters();
            
            return this.data;
            
        } catch (error) {
            console.error('Failed to fetch data:', error);
            // Instead of re-throwing immediately, try to provide fallback data
            this.data = [];
            this.filteredData = [];
            this.lastUpdated = null;
            throw error;
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * Load data from cache
     */
    loadFromCache() {
        try {
            const cached = utils.storage.get('cached-signal-data');
            if (cached && cached.data && cached.timestamp) {
                // Check if cache is not too old (24 hours)
                const cacheAge = Date.now() - new Date(cached.timestamp).getTime();
                if (cacheAge < 24 * 60 * 60 * 1000) {
                    return cached.data;
                }
            }
        } catch (error) {
            console.warn('Failed to load from cache:', error);
        }
        return null;
    }
    
    /**
     * Save data to cache
     */
    saveToCache(data) {
        try {
            utils.storage.set('cached-signal-data', {
                data: data,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.warn('Failed to save to cache:', error);
        }
    }
    
    /**
     * Extract unique sectors from data
     */
    extractSectors() {
        this.sectors.clear();
        this.data.forEach(signal => {
            if (signal.Sector && signal.Sector.trim()) {
                this.sectors.add(signal.Sector.trim());
            }
        });
    }
    
    /**
     * Get signals for a specific date
     */
    getSignalsForDate(date) {
        // Normalize input date (e.g., "today" or full ISO string) to "YYYY-MM-DD"
        if (!date || date === 'today') {
            date = utils.getTodayDate();
        }

        // Guard against invalid data array
        if (!Array.isArray(this.data) || this.data.length === 0) return [];

        return this.data.filter(signal => {
            if (!signal || !signal.Date) return false;

            // Extract only the date portion if an ISO timestamp is provided (e.g., "2025-06-29T04:00:00.000Z")
            let signalDate = signal.Date;

            if (typeof signalDate === 'string') {
                signalDate = signalDate.split('T')[0];
            } else if (signalDate instanceof Date) {
                signalDate = signalDate.toISOString().split('T')[0];
            }

            return signalDate === date;
        });
    }
    
    /**
     * Get available dates (last 30 days)
     */
    getAvailableDates() {
        const dates = [...new Set(this.data.map(signal => signal.Date))];
        return dates.sort((a, b) => new Date(b) - new Date(a)).slice(0, 30);
    }
    
    /**
     * Update filters and reapply
     */
    updateFilters(newFilters) {
        // Validate filter values
        if (newFilters.confidence !== undefined) {
            const confidence = parseInt(newFilters.confidence);
            if (isNaN(confidence) || confidence < 0 || confidence > 100) {
                console.warn('Invalid confidence filter value:', newFilters.confidence);
                return;
            }
        }
        
        if (newFilters.riskLevel !== undefined && newFilters.riskLevel !== '') {
            const validRiskLevels = ['Low', 'Medium', 'High'];
            if (!validRiskLevels.includes(newFilters.riskLevel)) {
                console.warn('Invalid risk level filter:', newFilters.riskLevel);
                return;
            }
        }
        
        if (newFilters.sortBy !== undefined) {
            const validSortOptions = ['newest', 'confidence', 'upside'];
            if (!validSortOptions.includes(newFilters.sortBy)) {
                console.warn('Invalid sort option:', newFilters.sortBy);
                return;
            }
        }
        
        this.filters = { ...this.filters, ...newFilters };
        this.saveFilters();
        this.applyFilters();
    }
    
    /**
     * Clear all filters
     */
    clearFilters() {
        this.filters = {
            confidence: 0,
            riskLevel: '',
            sector: '',
            sortBy: 'newest'
        };
        this.saveFilters();
        this.applyFilters();
    }
    
    /**
     * Apply current filters to data
     */
    applyFilters() {
        let filtered = this.getSignalsForDate(this.currentDate);
        
        // Apply confidence filter
        if (this.filters.confidence > 0) {
            filtered = filtered.filter(signal => {
                const confidence = parseFloat(signal.Confidence);
                return !isNaN(confidence) && confidence >= this.filters.confidence;
            });
        }
        
        // Apply risk level filter
        if (this.filters.riskLevel) {
            filtered = filtered.filter(signal => 
                signal.RiskLevel && signal.RiskLevel.toLowerCase() === this.filters.riskLevel.toLowerCase()
            );
        }
        
        // Apply sector filter
        if (this.filters.sector) {
            filtered = filtered.filter(signal => 
                signal.Sector && signal.Sector.trim() === this.filters.sector
            );
        }
        
        // Apply sorting
        filtered = this.sortData(filtered, this.filters.sortBy);
        
        this.filteredData = filtered;
        return this.filteredData;
    }
    
    /**
     * Sort data by specified criteria
     */
    sortData(data, sortBy) {
        const sorted = [...data];
        
        switch (sortBy) {
            case 'confidence':
                sorted.sort((a, b) => {
                    const aConf = parseFloat(a.Confidence) || 0;
                    const bConf = parseFloat(b.Confidence) || 0;
                    return bConf - aConf;
                });
                break;
                
            case 'upside':
                sorted.sort((a, b) => {
                    const aUpside = parseFloat(a.Upside) || 0;
                    const bUpside = parseFloat(b.Upside) || 0;
                    return bUpside - aUpside;
                });
                break;
                
            case 'newest':
            default:
                sorted.sort((a, b) => {
                    const aTime = new Date(a.Timestamp || a.Date);
                    const bTime = new Date(b.Timestamp || b.Date);
                    return bTime - aTime;
                });
                break;
        }
        
        return sorted;
    }
    
    /**
     * Change current date
     */
    changeDate(date) {
        // Strip time component if ISO string provided (e.g., 2025-06-28T00:00:00.000Z)
        if (typeof date === 'string' && date.includes('T')) {
            date = date.split('T')[0];
        }

        // Validate date format
        if (date && date !== 'today') {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date)) {
                console.warn('Invalid date format:', date);
                return;
            }
        }

        this.currentDate = date;
        this.applyFilters();
    }
    
    /**
     * Get market sentiment for current date
     */
    getMarketSentiment() {
        const todaySignals = this.getSignalsForDate(this.currentDate);
        if (todaySignals.length === 0) return null;
        
        // Get sentiment from first signal (same for all signals on same date)
        const firstSignal = todaySignals[0];
        
        return {
            marketMood: firstSignal.MarketMood || '--',
            volatilityLevel: firstSignal.VolatilityLevel || '--',
            sentimentSummary: firstSignal.SentimentSummary || '--'
        };
    }
    
    /**
     * Get past triggers for a specific ticker
     */
    getPastTriggers(ticker, currentDate, limit = 3) {
        if (!ticker || !currentDate) return [];
        
        // Get all signals for this ticker from different dates
        const allSignals = this.data.filter(signal => 
            signal.Ticker === ticker && signal.Date !== currentDate
        );
        
        // Sort by date (newest first) and take the most recent ones
        const sortedSignals = allSignals.sort((a, b) => {
            const dateA = new Date(a.Date);
            const dateB = new Date(b.Date);
            return dateB - dateA;
        });
        
        return sortedSignals.slice(0, limit);
    }
    
    /**
     * Generate copy packet for a signal
     */
    generateCopyPacket(signal) {
        // Validate signal before generating packet
        if (!this.validateSignalData(signal)) {
            throw new Error('Invalid signal data for copy packet generation');
        }
        
        // Get past triggers for this ticker
        const pastTriggers = this.getPastTriggers(signal.Ticker, signal.Date);
        
        let packet = `BUY SIGNAL REVIEW PACK
======================

TICKER: ${signal.Ticker || '--'}
COMPANY: ${signal.CompanyName || signal.Ticker || '--'}
TIMESTAMP: ${utils.formatTimestamp(signal.Timestamp) || '--'}

SIGNAL SUMMARY:
"${signal.Summary || 'No summary available'}"

PRICE TARGETS:
Current Price: ${utils.formatCurrency(signal.CurrentPrice)}
Sell Target: ${utils.formatCurrency(signal.SellTarget)}
Upside: ${utils.formatPercentage(signal.Upside)}
Target Horizon: ${signal.TargetHorizon || '--'}

TECHNICAL ANALYSIS:
RSI: ${signal.RSI || '--'}
Volume Spike: ${signal.VolumeSpike || '--'}
MACD: ${signal.MACD || '--'}
Gap Status: ${signal.GapStatus || '--'}
MA50: ${utils.formatCurrency(signal.MA50)}
MA200: ${utils.formatCurrency(signal.MA200)}

FUNDAMENTALS:
Market Cap: ${utils.formatLargeNumber(signal.MarketCap)}
P/E Ratio: ${signal.PERatio || '--'}
Revenue Growth: ${utils.formatPercentage(signal.RevenueGrowth)}
Profit Margin: ${utils.formatPercentage(signal.ProfitMargin)}
Sector: ${signal.Sector || '--'}
Debt/Equity: ${signal.DebtToEquity || '--'}
ROE: ${utils.formatPercentage(signal.ROE)}

MACRO SENTIMENT:
Market Mood: ${signal.MarketMood || '--'}
Volatility: ${signal.VolatilityLevel || '--'}
Summary: ${signal.SentimentSummary || '--'}

CONFIDENCE: ${signal.Confidence || '--'}%
RISK LEVEL: ${signal.RiskLevel || '--'}

PAST TRIGGERS:`;

        // Add past triggers if any exist
        if (pastTriggers.length > 0) {
            pastTriggers.forEach(trigger => {
                packet += `\n• ${utils.formatDate(trigger.Date)} — ${trigger.Summary || 'Signal generated'}`;
            });
        } else {
            packet += `\n• ${utils.formatDate(signal.Date)} — ${signal.Summary || 'Signal generated'}`;
        }

        return packet;
    }
    
    /**
     * Get signal statistics
     */
    getSignalStats() {
        const todaySignals = this.getSignalsForDate(this.currentDate);
        
        return {
            totalSignals: todaySignals.length,
            averageConfidence: this.calculateAverageConfidence(todaySignals),
            averageUpside: this.calculateAverageUpside(todaySignals),
            riskDistribution: this.calculateRiskDistribution(todaySignals),
            sectorDistribution: this.calculateSectorDistribution(todaySignals)
        };
    }
    
    /**
     * Calculate average confidence
     */
    calculateAverageConfidence(signals) {
        if (signals.length === 0) return 0;
        
        const total = signals.reduce((sum, signal) => {
            const confidence = parseFloat(signal.Confidence);
            return sum + (isNaN(confidence) ? 0 : confidence);
        }, 0);
        
        return Math.round(total / signals.length);
    }
    
    /**
     * Calculate average upside
     */
    calculateAverageUpside(signals) {
        if (signals.length === 0) return 0;
        
        const total = signals.reduce((sum, signal) => {
            const upside = parseFloat(signal.Upside);
            return sum + (isNaN(upside) ? 0 : upside);
        }, 0);
        
        return Math.round(total / signals.length * 10) / 10;
    }
    
    /**
     * Calculate risk distribution
     */
    calculateRiskDistribution(signals) {
        const distribution = { Low: 0, Medium: 0, High: 0 };
        
        signals.forEach(signal => {
            const risk = signal.RiskLevel;
            if (risk && distribution.hasOwnProperty(risk)) {
                distribution[risk]++;
            } else {
                distribution.Medium++; // Default to medium
            }
        });
        
        return distribution;
    }
    
    /**
     * Calculate sector distribution
     */
    calculateSectorDistribution(signals) {
        const distribution = {};
        
        signals.forEach(signal => {
            const sector = signal.Sector || 'Unknown';
            distribution[sector] = (distribution[sector] || 0) + 1;
        });
        
        return distribution;
    }
    
    /**
     * Get unique sectors
     */
    getSectors() {
        return Array.from(this.sectors).sort();
    }
    
    /**
     * Check if data is stale (older than 24 hours)
     */
    isDataStale() {
        if (!this.lastUpdated) return true;
        
        const lastUpdate = new Date(this.lastUpdated);
        const now = new Date();
        const hoursDiff = (now - lastUpdate) / (1000 * 60 * 60);
        
        return hoursDiff > 24;
    }
    
    /**
     * Get data freshness status
     */
    getDataStatus() {
        if (this.isLoading) {
            return { status: 'loading', message: 'Loading data...' };
        }
        
        if (this.data.length === 0) {
            return { status: 'empty', message: 'No data available' };
        }
        
        if (this.isDataFromCache) {
            return { 
                status: 'cached', 
                message: '⚠️ Displaying cached data — check connection',
                isCached: true
            };
        }
        
        if (this.isDataStale()) {
            return { 
                status: 'stale', 
                message: 'Data may be outdated. Last updated: ' + utils.getRelativeTime(this.lastUpdated)
            };
        }
        
        return { 
            status: 'fresh', 
            message: 'Last updated: ' + utils.getRelativeTime(this.lastUpdated)
        };
    }
    
    /**
     * Refresh data
     */
    async refreshData() {
        try {
            // Save current data to cache before refresh
            if (this.data.length > 0 && !this.isDataFromCache) {
                this.saveToCache(this.data);
            }
            
            await this.fetchData();
            return true;
        } catch (error) {
            console.error('Failed to refresh data:', error);
            return false;
        }
    }
    
    /**
     * Get signal by ticker
     */
    getSignalByTicker(ticker) {
        return this.data.find(signal => signal.Ticker === ticker);
    }
    
    /**
     * Search signals by text
     */
    searchSignals(query) {
        if (!query || query.trim() === '') {
            return this.filteredData;
        }
        
        const searchTerm = query.toLowerCase().trim();
        
        return this.filteredData.filter(signal => {
            return (
                (signal.Ticker && signal.Ticker.toLowerCase().includes(searchTerm)) ||
                (signal.CompanyName && signal.CompanyName.toLowerCase().includes(searchTerm)) ||
                (signal.Sector && signal.Sector.toLowerCase().includes(searchTerm)) ||
                (signal.Summary && signal.Summary.toLowerCase().includes(searchTerm))
            );
        });
    }
}

// Create global instance
window.dataHandler = new DataHandler(); 