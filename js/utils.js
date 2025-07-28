// Utility functions for YAMU Account Management

// Security utilities for safe HTML handling
class Security {
    /**
     * Sanitize HTML content to prevent XSS attacks
     * @param {string} html - The HTML string to sanitize
     * @returns {string} - Sanitized HTML
     */
    static sanitizeHTML(html) {
        if (typeof html !== 'string') {
            return '';
        }
        
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }
    
    /**
     * Create safe HTML from template with data interpolation
     * @param {string} template - HTML template with {key} placeholders
     * @param {object} data - Data object with key-value pairs
     * @returns {string} - Safe HTML with sanitized interpolated values
     */
    static createSafeHTML(template, data = {}) {
        if (typeof template !== 'string') {
            return '';
        }
        
        let safe = template;
        Object.entries(data).forEach(([key, value]) => {
            const sanitized = this.sanitizeHTML(String(value || ''));
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            safe = safe.replace(regex, sanitized);
        });
        return safe;
    }
    
    /**
     * Validate and sanitize URL to prevent javascript: and data: URI attacks
     * @param {string} url - URL to validate
     * @returns {string|null} - Safe URL or null if invalid
     */
    static sanitizeURL(url) {
        if (typeof url !== 'string') {
            return null;
        }
        
        // Remove any potential malicious protocols
        const cleanUrl = url.trim().toLowerCase();
        if (cleanUrl.startsWith('javascript:') || 
            cleanUrl.startsWith('data:') || 
            cleanUrl.startsWith('vbscript:')) {
            return null;
        }
        
        try {
            // Validate URL format
            new URL(url);
            return url;
        } catch (e) {
            // If not a valid URL, check if it's a relative path
            if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
                return url;
            }
            return null;
        }
    }
}

// UI utilities for common operations
class Utils {
    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type: 'success', 'error', 'info', 'warning'
     * @param {number} duration - Duration in milliseconds (default: 3000)
     */
    static showToast(message, type = 'info', duration = 3000) {
        // Remove existing toasts
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => toast.remove());
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--bg-secondary, #f8f9fa);
            color: var(--text-primary, #333);
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 320px;
            border-left: 4px solid var(--primary-color, #007bff);
            font-size: 14px;
            line-height: 1.4;
            animation: slideInRight 0.3s ease-out;
        `;
        
        // Set type-specific colors
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        
        if (colors[type]) {
            toast.style.borderLeftColor = colors[type];
        }
        
        toast.textContent = Security.sanitizeHTML(message);
        document.body.appendChild(toast);
        
        // Add slide-in animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        // Auto-remove after duration
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
                if (style.parentNode) {
                    style.remove();
                }
            }, 300);
        }, duration);
    }
    
    /**
     * Safe DOM element creation with sanitized content
     * @param {string} tagName - HTML tag name
     * @param {object} attributes - Element attributes
     * @param {string} content - Text content (will be sanitized)
     * @returns {HTMLElement} - Created element
     */
    static createElement(tagName, attributes = {}, content = '') {
        const element = document.createElement(tagName);
        
        // Set attributes safely
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'href' || key === 'src') {
                const safeUrl = Security.sanitizeURL(value);
                if (safeUrl) {
                    element.setAttribute(key, safeUrl);
                }
            } else if (key === 'onclick' || key.startsWith('on')) {
                // Prevent inline event handlers for security
                console.warn('Inline event handlers not allowed for security. Use addEventListener instead.');
            } else {
                element.setAttribute(key, Security.sanitizeHTML(String(value)));
            }
        });
        
        // Set content safely
        if (content) {
            element.textContent = content;
        }
        
        return element;
    }
    
    /**
     * Detect if user is on mobile device
     * @returns {boolean} - True if mobile device detected
     */
    static isMobile() {
        return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    /**
     * Debounce function to limit rapid function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} - Debounced function
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Format timestamp to readable date string
     * @param {string|number|Date} timestamp - Timestamp to format
     * @returns {string} - Formatted date string
     */
    static formatDate(timestamp) {
        try {
            const date = new Date(timestamp);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return 'Invalid date';
        }
    }
}

// Export for use in other modules
window.Security = Security;
window.Utils = Utils;

console.log('YAMU utilities loaded');
