/**
 * Market Signal Dashboard - UI Components
 * Handles rendering and interactions for UI components
 */

class UIComponents {
    constructor() {
        this.components = {};
        this.eventListeners = {};
        this.virtualScroll = {
            enabled: false,
            itemHeight: 320, // Increased from 300 to better match actual card height
            visibleItems: 10,
            startIndex: 0,
            endIndex: 0,
            actualItemHeight: null // Will be calculated dynamically
        };
    }
    
    /**
     * Initialize all UI components
     */
    init() {
        this.initFilterPanel();
        this.initDateNavigation();
        this.initCopyModal();
        this.initErrorBanner();
        this.initLoadingScreen();
        this.initVirtualScroll();
    }
    
    /**
     * Initialize virtual scrolling for performance
     */
    initVirtualScroll() {
        // Check if dataHandler exists and has data
        if (typeof dataHandler !== 'undefined' && dataHandler.data) {
            // Enable virtual scrolling for datasets larger than 50 items
            this.virtualScroll.enabled = dataHandler.data.length > 50;
            
            if (this.virtualScroll.enabled) {
                this.setupVirtualScroll();
            }
        } else {
            // Default to disabled until data is loaded
            this.virtualScroll.enabled = false;
        }
    }
    
    /**
     * Setup virtual scrolling
     */
    setupVirtualScroll() {
        const container = document.getElementById('signals-container');
        if (!container) return;
        
        // Calculate actual item height after first render
        this.calculateActualItemHeight();
        
        // Add scroll event listener for virtual scrolling
        this.boundUpdateVirtualScroll = this.updateVirtualScroll.bind(this);
        container.addEventListener('scroll', utils.throttle(this.boundUpdateVirtualScroll, 16)); // ~60fps

        // Add resize listener to handle viewport changes
        this.boundOnResize = utils.debounce(() => {
            this.calculateActualItemHeight();
            this.updateVirtualScroll();
        }, 200);
        window.addEventListener('resize', this.boundOnResize);
        
        // Calculate initial visible range
        this.updateVirtualScroll();
    }
    
    /**
     * Calculate actual item height from rendered cards
     */
    calculateActualItemHeight() {
        const container = document.getElementById('signals-container');
        if (!container) return;
        
        // Look for existing cards to measure
        const existingCard = container.querySelector('.signal-card');
        if (existingCard) {
            const height = existingCard.offsetHeight + 16; // Add margin
            this.virtualScroll.actualItemHeight = height;
            console.log(`Calculated actual item height: ${height}px`);
        }
    }
    
    /**
     * Get current item height (actual or estimated)
     */
    getCurrentItemHeight() {
        return this.virtualScroll.actualItemHeight || this.virtualScroll.itemHeight;
    }
    
    /**
     * Update virtual scroll range
     */
    updateVirtualScroll() {
        const container = document.getElementById('signals-container');
        if (!container || !this.virtualScroll.enabled) return;
        
        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        const itemHeight = this.getCurrentItemHeight();
        
        // Calculate visible range
        this.virtualScroll.startIndex = Math.floor(scrollTop / itemHeight);
        this.virtualScroll.endIndex = Math.min(
            this.virtualScroll.startIndex + Math.ceil(containerHeight / itemHeight) + 2,
            dataHandler.filteredData.length
        );
        
        // Render only visible items
        this.renderVisibleSignals();
    }
    
    /**
     * Render only visible signals for virtual scrolling
     */
    renderVisibleSignals() {
        if (!this.virtualScroll.enabled) {
            this.renderAllSignals();
            return;
        }
        
        const container = document.getElementById('signals-container');
        const emptyState = document.getElementById('empty-state');
        const signals = dataHandler.filteredData;
        
        // Clear container
        container.innerHTML = '';
        
        if (signals.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        
        const itemHeight = this.getCurrentItemHeight();
        
        // Add spacer for virtual scrolling
        const spacerTop = document.createElement('div');
        spacerTop.style.height = `${this.virtualScroll.startIndex * itemHeight}px`;
        container.appendChild(spacerTop);
        
        // Render visible signals
        for (let i = this.virtualScroll.startIndex; i < this.virtualScroll.endIndex; i++) {
            if (signals[i]) {
                const card = this.createSignalCard(signals[i]);
                container.appendChild(card);
                
                // Measure first card for accurate height calculation
                if (i === this.virtualScroll.startIndex && !this.virtualScroll.actualItemHeight) {
                    // Wait for next frame to measure
                    requestAnimationFrame(() => {
                        this.calculateActualItemHeight();
                    });
                }
            }
        }
        
        // Add bottom spacer
        const spacerBottom = document.createElement('div');
        spacerBottom.style.height = `${(signals.length - this.virtualScroll.endIndex) * itemHeight}px`;
        container.appendChild(spacerBottom);
    }
    
    /**
     * Initialize filter panel
     */
    initFilterPanel() {
        const filterToggle = document.getElementById('filter-toggle');
        const filterPanel = document.getElementById('filter-panel');
        const confidenceFilter = document.getElementById('confidence-filter');
        const confidenceValue = document.getElementById('confidence-value');
        const riskFilter = document.getElementById('risk-filter');
        const sectorFilter = document.getElementById('sector-filter');
        const sortSelect = document.getElementById('sort-select');
        const clearFiltersBtn = document.getElementById('clear-filters');
        const applyFiltersBtn = document.getElementById('apply-filters');
        
        // Toggle filter panel
        filterToggle.addEventListener('click', () => {
            filterPanel.classList.toggle('hidden');
        });
        
        // Update confidence value display
        confidenceFilter.addEventListener('input', (e) => {
            confidenceValue.textContent = `${e.target.value}%`;
        });
        
        // Apply filters
        applyFiltersBtn.addEventListener('click', () => {
            try {
                const filters = {
                    confidence: parseInt(confidenceFilter.value),
                    riskLevel: riskFilter.value,
                    sector: sectorFilter.value,
                    sortBy: sortSelect.value
                };
                
                dataHandler.updateFilters(filters);
                this.renderSignals();
                filterPanel.classList.add('hidden');
                utils.showToast('Filters applied successfully', 'success');
            } catch (error) {
                console.error('Error applying filters:', error);
                utils.showToast('Error applying filters', 'error');
            }
        });
        
        // Clear filters
        clearFiltersBtn.addEventListener('click', () => {
            try {
                dataHandler.clearFilters();
                this.resetFilterControls();
                this.renderSignals();
                utils.showToast('Filters cleared', 'info');
            } catch (error) {
                console.error('Error clearing filters:', error);
                utils.showToast('Error clearing filters', 'error');
            }
        });
        
        // Store references
        this.components.filterPanel = {
            element: filterPanel,
            confidenceFilter,
            confidenceValue,
            riskFilter,
            sectorFilter,
            sortSelect
        };
    }
    
    /**
     * Reset filter controls to default values
     */
    resetFilterControls() {
        const { confidenceFilter, confidenceValue, riskFilter, sectorFilter, sortSelect } = this.components.filterPanel;
        
        confidenceFilter.value = 0;
        confidenceValue.textContent = '0%';
        riskFilter.value = '';
        sectorFilter.value = '';
        sortSelect.value = 'newest';
    }
    
    /**
     * Update filter controls with current values
     */
    updateFilterControls() {
        const { confidenceFilter, confidenceValue, riskFilter, sectorFilter, sortSelect } = this.components.filterPanel;
        const filters = dataHandler.filters;
        
        confidenceFilter.value = filters.confidence;
        confidenceValue.textContent = `${filters.confidence}%`;
        riskFilter.value = filters.riskLevel;
        sectorFilter.value = filters.sector;
        sortSelect.value = filters.sortBy;
    }
    
    /**
     * Initialize date navigation
     */
    initDateNavigation() {
        const dateSelect = document.getElementById('date-select');
        
        dateSelect.addEventListener('change', (e) => {
            try {
                const selectedDate = e.target.value;
                dataHandler.changeDate(selectedDate);
                this.renderSignals();
                this.updateSentimentBar();
                utils.showToast(`Switched to ${selectedDate === 'today' ? 'today' : utils.formatDate(selectedDate)}`, 'info');
            } catch (error) {
                console.error('Error changing date:', error);
                utils.showToast('Error changing date', 'error');
            }
        });
        
        this.components.dateSelect = dateSelect;
    }
    
    /**
     * Update date navigation options
     */
    updateDateNavigation() {
        const dateSelect = this.components.dateSelect;
        const availableDates = dataHandler.getAvailableDates();
        
        // Clear existing options
        dateSelect.innerHTML = '';
        
        // Add today option
        const todayOption = document.createElement('option');
        todayOption.value = 'today';
        todayOption.textContent = 'Today';
        dateSelect.appendChild(todayOption);
        
        // Add available dates
        availableDates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            option.textContent = utils.formatDate(date);
            dateSelect.appendChild(option);
        });
        
        // Set current date
        dateSelect.value = dataHandler.currentDate === utils.getTodayDate() ? 'today' : dataHandler.currentDate;
    }
    
    /**
     * Initialize copy modal
     */
    initCopyModal() {
        const modal = document.getElementById('copy-modal');
        const modalClose = document.getElementById('modal-close');
        const modalCancel = document.getElementById('modal-cancel');
        const copyButton = document.getElementById('copy-button');
        const copyText = document.getElementById('copy-text');
        
        // Close modal
        const closeModal = () => {
            modal.classList.add('hidden');
        };
        
        modalClose.addEventListener('click', closeModal);
        modalCancel.addEventListener('click', closeModal);
        
        // Close on overlay click
        modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
        
        // Copy to clipboard
        copyButton.addEventListener('click', async () => {
            try {
                const text = copyText.value;
                const success = await utils.copyToClipboard(text);
                
                if (success) {
                    utils.showToast('Copied to clipboard!', 'success');
                    closeModal();
                } else {
                    utils.showToast('Failed to copy to clipboard', 'error');
                }
            } catch (error) {
                console.error('Error copying to clipboard:', error);
                utils.showToast('Error copying to clipboard', 'error');
            }
        });
        
        // Store references
        this.components.copyModal = {
            element: modal,
            copyText
        };
    }
    
    /**
     * Show copy modal with signal data
     */
    showCopyModal(signal) {
        try {
            const { copyText } = this.components.copyModal;
            const packet = dataHandler.generateCopyPacket(signal);
            
            copyText.value = packet;
            this.components.copyModal.element.classList.remove('hidden');
            copyText.focus();
            copyText.select();
        } catch (error) {
            console.error('Error showing copy modal:', error);
            utils.showToast('Error generating copy packet', 'error');
        }
    }
    
    /**
     * Initialize error banner
     */
    initErrorBanner() {
        const errorBanner = document.getElementById('error-banner');
        const errorClose = document.getElementById('error-close');
        const errorMessage = document.getElementById('error-message');
        
        errorClose.addEventListener('click', () => {
            errorBanner.classList.add('hidden');
        });
        
        this.components.errorBanner = {
            element: errorBanner,
            message: errorMessage
        };
    }
    
    /**
     * Show error banner
     */
    showError(message) {
        const { element, message: messageEl } = this.components.errorBanner;
        messageEl.textContent = message;
        element.classList.remove('hidden');
    }
    
    /**
     * Hide error banner
     */
    hideError() {
        this.components.errorBanner.element.classList.add('hidden');
    }
    
    /**
     * Initialize loading screen
     */
    initLoadingScreen() {
        this.components.loadingScreen = document.getElementById('loading-screen');
    }
    
    /**
     * Show loading screen
     */
    showLoading() {
        this.components.loadingScreen.classList.remove('hidden');
    }
    
    /**
     * Hide loading screen
     */
    hideLoading() {
        this.components.loadingScreen.classList.add('hidden');
    }
    
    /**
     * Render signal cards
     */
    renderSignals() {
        // Check if virtual scrolling should be enabled
        if (dataHandler.filteredData.length > 50 && !this.virtualScroll.enabled) {
            this.virtualScroll.enabled = true;
            this.setupVirtualScroll();
        } else if (dataHandler.filteredData.length <= 50 && this.virtualScroll.enabled) {
            this.virtualScroll.enabled = false;
        }
        
        if (this.virtualScroll.enabled) {
            this.renderVisibleSignals();
        } else {
            this.renderAllSignals();
        }
    }
    
    /**
     * Render all signals (for smaller datasets)
     */
    renderAllSignals() {
        const container = document.getElementById('signals-container');
        const emptyState = document.getElementById('empty-state');
        const signals = dataHandler.filteredData;
        
        // Clear container
        container.innerHTML = '';
        
        if (signals.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        
        // Render each signal
        signals.forEach(signal => {
            try {
                const card = this.createSignalCard(signal);
                container.appendChild(card);
            } catch (error) {
                console.error('Error rendering signal card:', error);
                // Continue rendering other cards
            }
        });
    }
    
    /**
     * Create signal card element
     */
    createSignalCard(signal) {
        try {
            const card = document.createElement('div');
            card.className = 'signal-card';
            
            const confidenceClass = utils.getConfidenceClass(signal.Confidence);
            const riskClass = utils.getRiskClass(signal.RiskLevel);
            
            // Sanitize data to prevent XSS
            const safeTicker = utils.escapeHtml(signal.Ticker || '');
            const safeCompanyName = utils.escapeHtml(signal.CompanyName || signal.Ticker || '');
            const safeSummary = utils.escapeHtml(signal.Summary || 'No summary available');
            
            card.innerHTML = `
                <div class="signal-header">
                    <div class="signal-title">
                        <div class="signal-ticker">${safeTicker}</div>
                        <div class="signal-company">${safeCompanyName}</div>
                    </div>
                    <div class="signal-meta">
                        <div class="signal-confidence">
                            <div class="confidence-bar">
                                <div class="confidence-fill ${confidenceClass}" style="width: ${signal.Confidence || 0}%"></div>
                            </div>
                            <span class="confidence-text">${signal.Confidence || '--'}%</span>
                        </div>
                        <div class="risk-badge ${riskClass}">${signal.RiskLevel || 'Medium'}</div>
                    </div>
                </div>
                
                <div class="signal-summary">${safeSummary}</div>
                
                <div class="signal-details">
                    <div class="detail-group">
                        <div class="detail-label">Current Price</div>
                        <div class="detail-value">${utils.formatCurrency(signal.CurrentPrice)}</div>
                    </div>
                    <div class="detail-group">
                        <div class="detail-label">Sell Target</div>
                        <div class="detail-value">${utils.formatCurrency(signal.SellTarget)}</div>
                    </div>
                    <div class="detail-group">
                        <div class="detail-label">Upside</div>
                        <div class="detail-value ${parseFloat(signal.Upside) > 0 ? 'positive' : ''}">${utils.formatPercentage(signal.Upside)}</div>
                    </div>
                    <div class="detail-group">
                        <div class="detail-label">RSI</div>
                        <div class="detail-value">${signal.RSI || '--'}</div>
                    </div>
                    <div class="detail-group">
                        <div class="detail-label">Volume Spike</div>
                        <div class="detail-value">${signal.VolumeSpike || '--'}</div>
                    </div>
                    <div class="detail-group">
                        <div class="detail-label">Sector</div>
                        <div class="detail-value">${signal.Sector || '--'}</div>
                    </div>
                </div>
                
                <div class="expandable-section">
                    <div class="expandable-header" onclick="uiComponents.toggleExpandable(this)">
                        <span class="expandable-title">Technical Analysis & Fundamentals</span>
                        <svg class="expandable-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6,9 12,15 18,9"></polyline>
                        </svg>
                    </div>
                    <div class="expandable-content">
                        <div class="expandable-grid">
                            <div class="detail-group">
                                <div class="detail-label">MACD</div>
                                <div class="detail-value">${signal.MACD || '--'}</div>
                            </div>
                            <div class="detail-group">
                                <div class="detail-label">Gap Status</div>
                                <div class="detail-value">${signal.GapStatus || '--'}</div>
                            </div>
                            <div class="detail-group">
                                <div class="detail-label">MA50</div>
                                <div class="detail-value">${utils.formatCurrency(signal.MA50)}</div>
                            </div>
                            <div class="detail-group">
                                <div class="detail-label">MA200</div>
                                <div class="detail-value">${utils.formatCurrency(signal.MA200)}</div>
                            </div>
                            <div class="detail-group">
                                <div class="detail-label">Market Cap</div>
                                <div class="detail-value">${utils.formatLargeNumber(signal.MarketCap)}</div>
                            </div>
                            <div class="detail-group">
                                <div class="detail-label">P/E Ratio</div>
                                <div class="detail-value">${signal.PERatio || '--'}</div>
                            </div>
                            <div class="detail-group">
                                <div class="detail-label">Revenue Growth</div>
                                <div class="detail-value ${parseFloat(signal.RevenueGrowth) > 0 ? 'positive' : ''}">${utils.formatPercentage(signal.RevenueGrowth)}</div>
                            </div>
                            <div class="detail-group">
                                <div class="detail-label">Profit Margin</div>
                                <div class="detail-value ${parseFloat(signal.ProfitMargin) > 0 ? 'positive' : ''}">${utils.formatPercentage(signal.ProfitMargin)}</div>
                            </div>
                            <div class="detail-group">
                                <div class="detail-label">ROE</div>
                                <div class="detail-value ${parseFloat(signal.ROE) > 0 ? 'positive' : ''}">${utils.formatPercentage(signal.ROE)}</div>
                            </div>
                            <div class="detail-group">
                                <div class="detail-label">Debt/Equity</div>
                                <div class="detail-value">${signal.DebtToEquity || '--'}</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="signal-actions">
                    <button class="btn-primary" onclick="uiComponents.showCopyModal(${JSON.stringify(signal).replace(/"/g, '&quot;')})">
                        📋 Copy for Deep Review
                    </button>
                </div>
            `;
            
            return card;
        } catch (error) {
            console.error('Error creating signal card:', error);
            // Return a fallback card
            const fallbackCard = document.createElement('div');
            fallbackCard.className = 'signal-card';
            fallbackCard.innerHTML = `
                <div class="signal-header">
                    <div class="signal-title">
                        <div class="signal-ticker">Error</div>
                        <div class="signal-company">Failed to load signal</div>
                    </div>
                </div>
                <div class="signal-summary">This signal could not be loaded due to an error.</div>
            `;
            return fallbackCard;
        }
    }
    
    /**
     * Toggle expandable sections
     */
    toggleExpandable(header) {
        try {
            const content = header.nextElementSibling;
            const icon = header.querySelector('.expandable-icon');
            
            content.classList.toggle('expanded');
            icon.classList.toggle('expanded');
        } catch (error) {
            console.error('Error toggling expandable section:', error);
        }
    }
    
    /**
     * Update sentiment bar
     */
    updateSentimentBar() {
        try {
            const sentiment = dataHandler.getMarketSentiment();
            const marketMoodEl = document.getElementById('market-mood');
            const volatilityLevelEl = document.getElementById('volatility-level');
            const sentimentSummaryEl = document.getElementById('sentiment-summary');
            
            if (sentiment) {
                marketMoodEl.textContent = sentiment.marketMood;
                volatilityLevelEl.textContent = sentiment.volatilityLevel;
                sentimentSummaryEl.textContent = sentiment.sentimentSummary;
            } else {
                marketMoodEl.textContent = '--';
                volatilityLevelEl.textContent = '--';
                sentimentSummaryEl.textContent = '--';
            }
        } catch (error) {
            console.error('Error updating sentiment bar:', error);
        }
    }
    
    /**
     * Update header statistics
     */
    updateHeaderStats() {
        try {
            const signalCountEl = document.getElementById('signal-count');
            const lastUpdatedEl = document.getElementById('last-updated');
            const stats = dataHandler.getSignalStats();
            const dataStatus = dataHandler.getDataStatus();
            
            signalCountEl.textContent = `🧠 ${stats.totalSignals} Signals Today`;
            lastUpdatedEl.textContent = dataStatus.message;
            
            // Add warning class if data is stale or cached
            if (dataStatus.status === 'stale') {
                lastUpdatedEl.style.color = '#f59e0b';
            } else if (dataStatus.status === 'cached') {
                lastUpdatedEl.style.color = '#dc2626';
                lastUpdatedEl.style.fontWeight = '500';
            } else {
                lastUpdatedEl.style.color = '';
                lastUpdatedEl.style.fontWeight = '';
            }
        } catch (error) {
            console.error('Error updating header stats:', error);
        }
    }
    
    /**
     * Update sector filter options
     */
    updateSectorFilter() {
        try {
            const sectorFilter = this.components.filterPanel.sectorFilter;
            const sectors = dataHandler.getSectors();
            
            // Clear existing options except "All Sectors"
            sectorFilter.innerHTML = '<option value="">All Sectors</option>';
            
            // Add sector options
            sectors.forEach(sector => {
                const option = document.createElement('option');
                option.value = sector;
                option.textContent = sector;
                sectorFilter.appendChild(option);
            });
        } catch (error) {
            console.error('Error updating sector filter:', error);
        }
    }
    
    /**
     * Render complete UI
     */
    render() {
        try {
            this.updateDateNavigation();
            this.updateFilterControls();
            this.updateSectorFilter();
            this.updateSentimentBar();
            this.updateHeaderStats();
            this.renderSignals();
        } catch (error) {
            console.error('Error rendering UI:', error);
            this.showError('Error rendering dashboard');
        }
    }
    
    /**
     * Handle data loading states
     */
    handleDataLoading() {
        this.showLoading();
    }
    
    /**
     * Handle data loaded successfully
     */
    handleDataLoaded(isFromCache) {
        this.hideLoading();
        this.updateHeaderStats();
        this.updateSentimentBar();
        this.updateSectorFilter();
        this.updateDateNavigation();
        this.renderSignals();
        if (isFromCache) {
            utils.showToast('Using cached data. Network unavailable.', 'warning');
        }
    }
    
    /**
     * Handle data loading error
     */
    handleDataError(error) {
        this.hideLoading();
        this.showError(error.message || 'Failed to load data');
        
        // Show cached data if available
        if (dataHandler.data.length > 0) {
            this.render();
        }
    }

    /**
     * Show refresh loading state
     */
    showRefreshLoading() {
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.classList.add('loading');
        }
    }

    /**
     * Hide refresh loading state
     */
    hideRefreshLoading() {
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.classList.remove('loading');
        }
    }
}

// Create global instance
window.uiComponents = new UIComponents(); 