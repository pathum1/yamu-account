// Utility functions for YAMU Account Management

class Utils {
    // Format date to readable string
    static formatDate(date, options = {}) {
        if (!date) return 'Unknown';
        
        const dateObj = date instanceof Date ? date : new Date(date);
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            ...options
        };
        
        return dateObj.toLocaleDateString('en-US', defaultOptions);
    }

    // Format datetime to readable string
    static formatDateTime(date, options = {}) {
        if (!date) return 'Unknown';
        
        const dateObj = date instanceof Date ? date : new Date(date);
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            ...options
        };
        
        return dateObj.toLocaleDateString('en-US', defaultOptions);
    }

    // Debounce function
    static debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(this, args);
        };
    }

    // Throttle function
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Validate email format
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Show toast notification (if needed)
    static showToast(message, type = 'info', duration = 3000) {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Style the toast
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 16px',
            borderRadius: '8px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '10000',
            opacity: '0',
            transform: 'translateY(-20px)',
            transition: 'all 0.3s ease',
            maxWidth: '300px',
            wordWrap: 'break-word'
        });

        // Set background color based on type
        const colors = {
            info: '#007AFF',
            success: '#34C759',
            warning: '#FF9500',
            error: '#FF3B30'
        };
        toast.style.backgroundColor = colors[type] || colors.info;

        // Add to DOM
        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);

        // Remove after duration
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    // Copy text to clipboard
    static async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                const success = document.execCommand('copy');
                textArea.remove();
                return success;
            }
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            return false;
        }
    }

    // Detect device type
    static getDeviceType() {
        const userAgent = navigator.userAgent;
        
        if (/Android/i.test(userAgent)) {
            return 'android';
        }
        
        if (/iPhone|iPad|iPod/i.test(userAgent)) {
            return 'ios';
        }
        
        if (/Windows/i.test(userAgent)) {
            return 'windows';
        }
        
        if (/Mac/i.test(userAgent)) {
            return 'mac';
        }
        
        return 'unknown';
    }

    // Check if device is mobile
    static isMobile() {
        const deviceType = Utils.getDeviceType();
        return deviceType === 'android' || deviceType === 'ios';
    }

    // Generate random ID
    static generateId(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Format file size
    static formatFileSize(bytes) {
        if (!bytes) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Sanitize filename for download
    static sanitizeFilename(filename) {
        return filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
    }

    // Parse query parameters from URL
    static getQueryParams() {
        const params = {};
        const queryString = window.location.search.substring(1);
        const pairs = queryString.split('&');
        
        for (let pair of pairs) {
            const [key, value] = pair.split('=');
            if (key) {
                params[decodeURIComponent(key)] = decodeURIComponent(value || '');
            }
        }
        
        return params;
    }

    // Update URL without page reload
    static updateURL(params) {
        const url = new URL(window.location);
        
        Object.entries(params).forEach(([key, value]) => {
            if (value) {
                url.searchParams.set(key, value);
            } else {
                url.searchParams.delete(key);
            }
        });
        
        window.history.replaceState({}, '', url);
    }

    // Retry async function with exponential backoff
    static async retry(asyncFunction, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await asyncFunction();
            } catch (error) {
                lastError = error;
                
                if (attempt < maxRetries - 1) {
                    const delay = baseDelay * Math.pow(2, attempt);
                    console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError;
    }

    // Deep clone object
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }
        
        if (obj instanceof Array) {
            return obj.map(item => Utils.deepClone(item));
        }
        
        const clonedObj = {};
        Object.keys(obj).forEach(key => {
            clonedObj[key] = Utils.deepClone(obj[key]);
        });
        
        return clonedObj;
    }

    // Check if object is empty
    static isEmpty(obj) {
        if (!obj) return true;
        if (Array.isArray(obj)) return obj.length === 0;
        if (typeof obj === 'object') return Object.keys(obj).length === 0;
        return false;
    }

    // Capitalize first letter
    static capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    // Truncate string with ellipsis
    static truncate(str, maxLength = 100, suffix = '...') {
        if (!str || str.length <= maxLength) return str;
        return str.substring(0, maxLength - suffix.length) + suffix;
    }

    // Log with timestamp
    static log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [YAMU Account Mgmt]`;
        
        switch (level) {
            case 'error':
                console.error(prefix, message);
                break;
            case 'warn':
                console.warn(prefix, message);
                break;
            case 'info':
            default:
                console.log(prefix, message);
                break;
        }
    }
}

// Make Utils available globally
window.Utils = Utils;