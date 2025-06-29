/**
 * Market Signal Dashboard - Utility Functions
 * Common helper functions used throughout the application
 */

// Enhanced error handling wrapper
function handleError(func, context = '') {
    return function(...args) {
        try {
            return func.apply(this, args);
        } catch (error) {
            console.error(`Error in ${context}:`, error);
            // Store error for debugging
            const errorInfo = {
                message: error.message || 'Unknown error',
                stack: error.stack,
                context,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent
            };
            
            try {
                const errors = storage.get('app-errors', []);
                errors.push(errorInfo);
                if (errors.length > 10) errors.splice(0, errors.length - 10);
                storage.set('app-errors', errors);
            } catch (storageError) {
                console.warn('Failed to store error:', storageError);
            }
            
            throw error;
        }
    };
}

// Format currency values with enhanced error handling
const formatCurrency = handleError(function(value, decimals = 2) {
    if (value === null || value === undefined || value === '') {
        return '--';
    }
    
    const num = parseFloat(value);
    if (isNaN(num)) {
        return '--';
    }
    
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
}, 'formatCurrency');

// Format percentage values with enhanced error handling
const formatPercentage = handleError(function(value, decimals = 1) {
    if (value === null || value === undefined || value === '') {
        return '--';
    }
    
    const num = parseFloat(value);
    if (isNaN(num)) {
        return '--';
    }
    
    return `${num > 0 ? '+' : ''}${num.toFixed(decimals)}%`;
}, 'formatPercentage');

// Format large numbers (market cap, etc.) with enhanced error handling
const formatLargeNumber = handleError(function(value) {
    if (value === null || value === undefined || value === '') {
        return '--';
    }
    
    const num = parseFloat(value);
    if (isNaN(num)) {
        return '--';
    }
    
    if (num >= 1e12) {
        return `$${(num / 1e12).toFixed(1)}T`;
    } else if (num >= 1e9) {
        return `$${(num / 1e9).toFixed(1)}B`;
    } else if (num >= 1e6) {
        return `$${(num / 1e6).toFixed(1)}M`;
    } else if (num >= 1e3) {
        return `$${(num / 1e3).toFixed(1)}K`;
    } else {
        return formatCurrency(num);
    }
}, 'formatLargeNumber');

// Format date strings with enhanced error handling and timezone support
const formatDate = handleError(function(dateString) {
    if (!dateString) return '--';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '--';
        
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        console.warn('Error formatting date:', error);
        return '--';
    }
}, 'formatDate');

// Format timestamp with enhanced error handling
const formatTimestamp = handleError(function(ts) {
    if (!ts) return '--';
    const d = new Date(ts);
    return isNaN(d) ? '--' : d.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}, 'formatTimestamp');

// Get relative time (e.g., "2 hours ago") with enhanced error handling
const getRelativeTime = handleError(function(timestamp) {
    if (!timestamp) return '--';
    
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '--';
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        
        return formatDate(timestamp);
    } catch (error) {
        console.warn('Error getting relative time:', error);
        return '--';
    }
}, 'getRelativeTime');

// Get confidence level class with validation
const getConfidenceClass = handleError(function(confidence) {
    const num = parseFloat(confidence);
    if (isNaN(num) || num < 0 || num > 100) return 'low';
    
    if (num >= 80) return 'high';
    if (num >= 60) return 'medium';
    return 'low';
}, 'getConfidenceClass');

// Get risk level class with validation
const getRiskClass = handleError(function(riskLevel) {
    if (!riskLevel) return 'medium';
    
    const level = riskLevel.toLowerCase();
    if (level === 'low') return 'low';
    if (level === 'high') return 'high';
    return 'medium';
}, 'getRiskClass');

// Enhanced debounce function for performance
function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const context = this;
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

// Enhanced throttle function for performance
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Deep clone object with error handling
const deepClone = handleError(function(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}, 'deepClone');

// Safe JSON parse with enhanced error handling
const safeJsonParse = handleError(function(str, defaultValue = null) {
    if (typeof str !== 'string') return defaultValue;
    try {
        return JSON.parse(str);
    } catch (error) {
        console.warn('JSON parse error:', error);
        return defaultValue;
    }
}, 'safeJsonParse');

// Enhanced localStorage operations with error handling
const storage = {
    get: handleError((key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(key);
            return item ? safeJsonParse(item, defaultValue) : defaultValue;
        } catch (error) {
            console.warn(`Failed to get localStorage item '${key}':`, error);
            return defaultValue;
        }
    }, 'storage.get'),
    
    set: handleError((key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn(`Failed to set localStorage item '${key}':`, error);
            return false;
        }
    }, 'storage.set'),
    
    remove: handleError((key) => {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn(`Failed to remove localStorage item '${key}':`, error);
            return false;
        }
    }, 'storage.remove'),
    
    clear: handleError(() => {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.warn('Failed to clear localStorage:', error);
            return false;
        }
    }, 'storage.clear')
};

// Enhanced copy to clipboard with fallback
const copyToClipboard = handleError(async function(text) {
    if (typeof text !== 'string') {
        throw new Error('Text must be a string');
    }
    
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback for non-secure contexts
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const result = document.execCommand('copy');
            document.body.removeChild(textArea);
            return result;
        }
    } catch (error) {
        console.warn('Failed to copy to clipboard:', error);
        return false;
    }
}, 'copyToClipboard');

// Enhanced toast notification with security
const showToast = handleError(function(message, type = 'info', duration = 3000) {
    try {
        // Remove existing toasts
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => toast.remove());
        
        // Create toast element with sanitized content
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-message">${escapeHtml(message)}</span>
                <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Add styles if not already present
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                .toast {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    padding: 12px 16px;
                    min-width: 300px;
                    max-width: 400px;
                    animation: slideIn 0.3s ease-out;
                }
                .toast-success { border-left: 4px solid #10b981; }
                .toast-error { border-left: 4px solid #ef4444; }
                .toast-warning { border-left: 4px solid #f59e0b; }
                .toast-info { border-left: 4px solid #3b82f6; }
                .toast-content {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .toast-close {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    color: #6b7280;
                    margin-left: 12px;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        // Auto-remove after duration
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, duration);
        
    } catch (error) {
        console.warn('Error showing toast:', error);
        // Fallback to alert
        alert(message);
    }
}, 'showToast');

// Enhanced email validation
const isValidEmail = handleError(function(email) {
    if (typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}, 'isValidEmail');

// Generate unique ID with enhanced randomness
const generateId = handleError(function() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}, 'generateId');

// Check if element is in viewport with error handling
const isInViewport = handleError(function(element) {
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}, 'isInViewport');

// Enhanced HTML escaping for security
const escapeHtml = handleError(function(text) {
    if (typeof text !== 'string') return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}, 'escapeHtml');

// Enhanced number formatting
const formatNumber = handleError(function(num, decimals = 2) {
    if (num === null || num === undefined || isNaN(num)) {
        return '--';
    }
    
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
}, 'formatNumber');

// Get today's date with timezone handling
const getTodayDate = handleError(function() {
    const now = new Date();
    // Use local timezone instead of hardcoded EST
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}, 'getTodayDate');

// Enhanced date parsing with validation
const getDateFromString = handleError(function(dateString) {
    if (!dateString) return null;
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return null;
        return date;
    } catch (error) {
        console.warn('Error parsing date:', error);
        return null;
    }
}, 'getDateFromString');

// Check if date is today with enhanced validation
const isToday = handleError(function(dateString) {
    if (!dateString) return false;
    
    const today = getTodayDate();
    return dateString === today;
}, 'isToday');

// Calculate days difference with validation
const getDaysDifference = handleError(function(date1, date2) {
    const d1 = getDateFromString(date1);
    const d2 = getDateFromString(date2);
    
    if (!d1 || !d2) return null;
    
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}, 'getDaysDifference');

// Enhanced data validation utilities
const validation = {
    // Validate required fields
    required: (value) => {
        return value !== null && value !== undefined && value !== '';
    },
    
    // Validate number range
    numberRange: (value, min, max) => {
        const num = parseFloat(value);
        return !isNaN(num) && num >= min && num <= max;
    },
    
    // Validate date format
    dateFormat: (dateString) => {
        if (!dateString) return false;
        const date = new Date(dateString);
        return !isNaN(date.getTime());
    },
    
    // Validate URL
    url: (url) => {
        if (typeof url !== 'string') return false;
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
};

// Performance monitoring utilities
const performance = {
    // Measure execution time
    measureTime: (name, fn) => {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        console.log(`${name} took ${(end - start).toFixed(2)}ms`);
        return result;
    },
    
    // Memory usage (if available)
    getMemoryUsage: () => {
        if (performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }
};

// Export all utilities
window.utils = {
    formatCurrency,
    formatPercentage,
    formatLargeNumber,
    formatDate,
    formatTimestamp,
    getRelativeTime,
    getConfidenceClass,
    getRiskClass,
    debounce,
    throttle,
    deepClone,
    safeJsonParse,
    storage,
    copyToClipboard,
    showToast,
    isValidEmail,
    generateId,
    isInViewport,
    escapeHtml,
    formatNumber,
    getTodayDate,
    getDateFromString,
    isToday,
    getDaysDifference,
    validation,
    performance,
    handleError
}; 