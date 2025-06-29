/**
 * Market Signal Dashboard - Main Application
 * Enhanced with error handling, performance monitoring, and better initialization
 */

// Runtime guard for performance API
if (typeof performance !== 'object' || typeof performance.now !== 'function') {
    console.warn('Browser performance API unavailable – falling back to Date.now');
    window.__perfNow = () => Date.now();   // fallback
} else {
    window.__perfNow = () => performance.now();
}

class MarketSignalApp {
    constructor() {
        this.isInitialized = false;
        this.isLoading = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.retryDelay = 2000;
        this.performanceMetrics = {};
        
        // Bind methods to preserve context
        this.init = this.init.bind(this);
        this.handleDataLoaded = this.handleDataLoaded.bind(this);
        this.handleDataError = this.handleDataError.bind(this);
        this.handleRetry = this.handleRetry.bind(this);
        this.handleServiceWorkerUpdate = this.handleServiceWorkerUpdate.bind(this);
    }
    
    /**
     * Initialize the application with enhanced error handling
     */
    async init() {
        try {
            console.log('Initializing Market Signal Dashboard...');
            
            // Start performance monitoring
            this.startPerformanceMonitoring();
            
            // Initialize service worker
            await this.initServiceWorker();
            
            // Initialize UI components
            this.initUI();
            
            // Initialize data handler
            this.initDataHandler();
            
            // Load initial data
            await this.loadInitialData();
            
            // Set up event listeners
            this.setupEventListeners();

            // Start auto-refresh timer
            this.autoRefreshInterval = this.setupAutoRefresh();
            
            // Mark as initialized
            this.isInitialized = true;
            
            console.log('Market Signal Dashboard initialized successfully');
            
            // Report performance metrics
            this.reportPerformanceMetrics();
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.handleInitializationError(error);
        }
    }
    
    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        // Guard against missing performance.now in older browsers or test envs
        if (!performance || typeof performance.now !== 'function') {
            console.warn('Native performance.now unavailable; using Date.now');
            this.performanceMetrics.startTime = Date.now();
        } else {
            this.performanceMetrics.startTime = __perfNow();
        }
        
        // Monitor memory usage if available
        if (performance.memory) {
            setInterval(() => {
                const memory = performance.memory;
                if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.8) {
                    console.warn('High memory usage detected');
                }
            }, 30000); // Check every 30 seconds
        }
    }
    
    /**
     * Report performance metrics
     */
    reportPerformanceMetrics() {
        const loadTime = __perfNow() - this.performanceMetrics.startTime;
        console.log(`App load time: ${loadTime.toFixed(2)}ms`);
        
        // Store metrics for debugging
        utils.storage.set('performance-metrics', {
            loadTime,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        });
    }
    
    /**
     * Initialize service worker with enhanced error handling
     */
    async initServiceWorker() {
        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.register('./sw.js', { type: 'module' });
                
                // Handle service worker updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.handleServiceWorkerUpdate();
                        }
                    });
                });
                
                // Handle service worker messages
                navigator.serviceWorker.addEventListener('message', (event) => {
                    this.handleServiceWorkerMessage(event);
                });
                
                console.log('Service Worker registered successfully');
            } else {
                console.warn('Service Worker not supported');
            }
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            // Continue without service worker
        }
    }
    
    /**
     * Handle service worker updates
     */
    handleServiceWorkerUpdate() {
        // Show update notification
        const updateNotification = document.createElement('div');
        updateNotification.className = 'update-notification';
        updateNotification.innerHTML = `
            <div class="update-content">
                <span>New version available</span>
                <button onclick="app.reloadApp()">Update</button>
                <button onclick="this.parentElement.parentElement.remove()">Dismiss</button>
            </div>
        `;
        
        // Add styles if not present
        if (!document.getElementById('update-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'update-notification-styles';
            style.textContent = `
                .update-notification {
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #3b82f6;
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    z-index: 10000;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }
                .update-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .update-content button {
                    background: white;
                    color: #3b82f6;
                    border: none;
                    padding: 4px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(updateNotification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (updateNotification.parentElement) {
                updateNotification.remove();
            }
        }, 10000);
    }
    
    /**
     * Handle service worker messages
     */
    handleServiceWorkerMessage(event) {
        const { type, data } = event.data;
        
        switch (type) {
            case 'DATA_UPDATED':
                console.log('Data updated via service worker');
                this.refreshData();
                break;
        }
    }
    
    /**
     * Reload app for service worker update
     */
    reloadApp() {
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
    }
    
    /**
     * Initialize UI components
     */
    initUI() {
        try {
            // Check if uiComponents is available
            if (typeof uiComponents === 'undefined') {
                throw new Error('uiComponents not loaded');
            }
            uiComponents.init();
            console.log('UI components initialized');
        } catch (error) {
            console.error('Failed to initialize UI components:', error);
            throw error;
        }
    }
    
    /**
     * Initialize data handler
     */
    initDataHandler() {
        try {
            // Check if dataHandler is available
            if (typeof dataHandler === 'undefined') {
                throw new Error('dataHandler not loaded');
            }
            // Data handler is already initialized as a global instance
            console.log('Data handler initialized');
        } catch (error) {
            console.error('Failed to initialize data handler:', error);
            throw error;
        }
    }
    
    /**
     * Load initial data with retry logic
     */
    async loadInitialData() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        
        // Ensure UI components are ready
        if (typeof uiComponents !== 'undefined') {
            uiComponents.handleDataLoading();
        }
        
        try {
            await dataHandler.fetchData();
            this.handleDataLoaded();
        } catch (error) {
            console.warn('Failed to load initial data, will try to use cached data:', error);
            // Try to load cached data instead of failing completely
            const cachedData = dataHandler.loadFromCache();
            if (cachedData && cachedData.length > 0) {
                dataHandler.data = cachedData;
                dataHandler.isDataFromCache = true;
                dataHandler.applyFilters();
                this.handleDataLoaded();
            } else {
                this.handleDataError(error);
            }
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * Handle successful data loading
     */
    handleDataLoaded() {
        // Pass the cache status to the UI handler
        if (typeof uiComponents !== 'undefined') {
            uiComponents.handleDataLoaded(dataHandler.isDataFromCache);
        }
        this.retryCount = 0;
    }
    
    /**
     * Handle data loading error with retry logic
     */
    handleDataError(error) {
        console.error('Data loading failed:', error);
        
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            console.log(`Retrying data load (${this.retryCount}/${this.maxRetries})...`);
            
            setTimeout(() => {
                this.handleRetry();
            }, this.retryDelay * this.retryCount);
        } else {
            // Show UI even if data fails to load
            if (typeof uiComponents !== 'undefined') {
                uiComponents.handleDataError(error);
            }
            console.error('Max retries reached, showing error state');
        }
    }
    
    /**
     * Handle retry attempt
     */
    async handleRetry() {
        try {
            await dataHandler.fetchData();
            this.handleDataLoaded();
        } catch (error) {
            this.handleDataError(error);
        }
    }
    
    /**
     * Set up auto-refresh functionality
     */
    setupAutoRefresh() {
        // Refresh data every 5 minutes if data is stale
        return setInterval(() => {
            if (dataHandler.isDataStale()) {
                console.log('Data is stale, refreshing...');
                this.refreshData();
            }
        }, 5 * 60 * 1000); // 5 minutes
    }
    
    /**
     * Refresh data manually
     */
    async refreshData() {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            uiComponents.showRefreshLoading();
            
            const success = await dataHandler.refreshData();
            
            if (success) {
                uiComponents.render();
                utils.showToast('Data refreshed successfully', 'success');
            } else {
                utils.showToast('Failed to refresh data', 'error');
            }
        } catch (error) {
            console.error('Refresh failed:', error);
            utils.showToast('Refresh failed', 'error');
        } finally {
            this.isLoading = false;
            uiComponents.hideRefreshLoading();
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshData();
            });
        }
        
        // Error banner close
        const errorClose = document.getElementById('error-close');
        if (errorClose) {
            errorClose.addEventListener('click', () => {
                uiComponents.hideError();
            });
        }
        
        // Handle online/offline events
        window.addEventListener('online', () => {
            console.log('Connection restored');
            utils.showToast('Connection restored', 'success');
            this.refreshData();
        });
        
        window.addEventListener('offline', () => {
            console.log('Connection lost');
            utils.showToast('Connection lost - using cached data', 'warning');
        });
        
        // Handle visibility change for background sync
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && dataHandler.isDataStale()) {
                console.log('App became visible, checking for stale data');
                this.refreshData();
            }
        });
        
        // Handle beforeunload for cleanup
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
        
        console.log('Event listeners set up');
    }
    
    /**
     * Handle initialization error
     */
    handleInitializationError(error) {
        console.error('Application initialization failed:', error);
        
        // Show error message to user
        const errorMessage = document.createElement('div');
        errorMessage.className = 'init-error';
        errorMessage.innerHTML = `
            <div class="error-content">
                <h2>Failed to load application</h2>
                <p>Please refresh the page or try again later.</p>
                <button onclick="window.location.reload()">Refresh Page</button>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .init-error {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            }
            .error-content {
                background: white;
                padding: 40px;
                border-radius: 12px;
                text-align: center;
                max-width: 400px;
            }
            .error-content button {
                background: #3b82f6;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                cursor: pointer;
                margin-top: 20px;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(errorMessage);
    }
    
    /**
     * Cleanup resources
     */
    cleanup() {
        // Clear any intervals or timeouts
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        // Store any necessary state
        utils.storage.set('app-state', {
            lastVisit: new Date().toISOString(),
            dataCount: dataHandler.data.length
        });
        
        console.log('Application cleanup completed');
    }
    
    /**
     * Get application status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            loading: this.isLoading,
            retryCount: this.retryCount,
            dataCount: dataHandler.data.length,
            lastUpdated: dataHandler.lastUpdated,
            dataStale: dataHandler.isDataStale()
        };
    }
    
    /**
     * Debug information
     */
    debug() {
        const status = this.getStatus();
        const memoryInfo = utils.perfTracker.getMemoryUsage();
        
        console.log('=== App Debug Info ===');
        console.log('Status:', status);
        console.log('Performance:', memoryInfo);
        console.log('User Agent:', navigator.userAgent);
        console.log('Online:', navigator.onLine);
        console.log('Service Worker:', 'serviceWorker' in navigator);
        console.log('=====================');
        
        return { status, memoryInfo };
    }
}

// Create global app instance
window.app = new MarketSignalApp();

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Add loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'app-loading';
    loadingIndicator.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <div class="loading-text">Loading Market Signal Dashboard...</div>
        </div>
    `;
    
    // Add loading styles
    const loadingStyle = document.createElement('style');
    loadingStyle.textContent = `
        #app-loading {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        }
        .loading-spinner {
            text-align: center;
        }
        .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid #f3f4f6;
            border-top: 4px solid #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        .loading-text {
            color: #6b7280;
            font-size: 16px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(loadingStyle);
    document.body.appendChild(loadingIndicator);
    
    // Initialize app
    app.init().then(() => {
        // Remove loading indicator
        const loadingEl = document.getElementById('app-loading');
        if (loadingEl) {
            loadingEl.remove();
        }
    }).catch((error) => {
        console.error('App initialization failed:', error);
        // Loading indicator will be replaced by error message
    });
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    utils.showToast('An unexpected error occurred', 'error');
});

// Handle global errors
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    utils.showToast('An error occurred', 'error');
});

console.log('Market Signal Dashboard app script loaded'); 