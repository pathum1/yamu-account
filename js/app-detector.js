// App Detection and Deep Linking for YAMU Account Management

class AppDetector {
    constructor() {
        this.setupEventListeners();
        this.appDetected = false;
        this.deepLinkTimeout = null;
    }

    setupEventListeners() {
        const tryAppBtn = document.getElementById('try-app-btn');
        const useWebBtn = document.getElementById('use-web-btn');

        if (tryAppBtn) {
            tryAppBtn.addEventListener('click', () => this.tryOpenApp());
        }

        if (useWebBtn) {
            useWebBtn.addEventListener('click', () => this.continueOnWeb());
        }
    }

    async tryOpenApp() {
        const statusDiv = document.getElementById('app-check-status');
        const tryAppBtn = document.getElementById('try-app-btn');
        
        // Show status message
        statusDiv.classList.remove('hidden');
        tryAppBtn.disabled = true;
        tryAppBtn.textContent = 'Opening app...';

        try {
            // Attempt to open the app with deep link
            await this.attemptDeepLink();
        } catch (error) {
            console.error('Failed to open app:', error);
            this.showAppNotDetected();
        }
    }

    async attemptDeepLink() {
        return new Promise((resolve, reject) => {
            // Create deep link URL for account management
            const deepLinkUrl = 'yamu://account/delete';
            
            // Try to open the deep link
            window.location.href = deepLinkUrl;
            
            // Set timeout to detect if app opened
            this.deepLinkTimeout = setTimeout(() => {
                this.showAppNotDetected();
                reject(new Error('App not detected'));
            }, 3000); // 3 second timeout

            // Listen for visibility change (app might have opened)
            const handleVisibilityChange = () => {
                if (document.hidden) {
                    // Page became hidden, likely app opened
                    clearTimeout(this.deepLinkTimeout);
                    this.appDetected = true;
                    document.removeEventListener('visibilitychange', handleVisibilityChange);
                    resolve();
                }
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);

            // Also try using the newer app link method
            if ('navigator' in window && 'share' in navigator) {
                // Modern browsers might handle app links better
                try {
                    window.open(deepLinkUrl, '_blank');
                } catch (e) {
                    // Ignore errors in app opening
                }
            }
        });
    }

    showAppNotDetected() {
        const statusDiv = document.getElementById('app-check-status');
        const tryAppBtn = document.getElementById('try-app-btn');
        
        // Clear timeout
        if (this.deepLinkTimeout) {
            clearTimeout(this.deepLinkTimeout);
        }

        // Update UI to show app not detected
        statusDiv.innerHTML = `
            <div class="error-message">
                <p>📱 YAMU app not detected</p>
                <p class="small">The app might not be installed or the link couldn't open it. You can continue with web-based account management below.</p>
            </div>
        `;

        // Reset button
        tryAppBtn.disabled = false;
        tryAppBtn.textContent = '📱 Try Again';

        // Show prominent web option
        this.highlightWebOption();
    }

    highlightWebOption() {
        const useWebBtn = document.getElementById('use-web-btn');
        if (useWebBtn) {
            useWebBtn.classList.remove('btn-secondary');
            useWebBtn.classList.add('btn-primary');
            useWebBtn.textContent = '🌐 Continue on Web (Recommended)';
        }
    }

    continueOnWeb() {
        console.log('User chose to continue on web');
        
        // Set flag that user has chosen web flow
        sessionStorage.setItem('yamuWebFlowChosen', 'true');
        
        // Hide app detection section
        const appDetectionSection = document.getElementById('app-detection');
        appDetectionSection.classList.add('hidden');

        // Check authentication state and show appropriate section
        if (auth.currentUser) {
            // User is already authenticated, show account options
            console.log('User already authenticated, showing account options');
            const accountOptions = document.getElementById('account-options');
            accountOptions.classList.remove('hidden');
        } else {
            // User not authenticated, show auth section
            console.log('User not authenticated, showing auth section');
            const authSection = document.getElementById('auth-section');
            authSection.classList.remove('hidden');
        }
    }

    // Check if device likely has the app based on user agent
    deviceLikelyHasApp() {
        const userAgent = navigator.userAgent;
        const isAndroid = /Android/i.test(userAgent);
        const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
        
        // Only show app detection on mobile devices
        return isAndroid || isIOS;
    }

    // Public method to trigger app detection flow
    startAppDetection() {
        // Skip app detection if returning from OAuth or web flow already chosen
        if (sessionStorage.getItem('yamuOAuthInProgress') || 
            sessionStorage.getItem('yamuWebFlowChosen')) {
            console.log('Skipping app detection - OAuth in progress or web flow chosen');
            this.continueOnWeb();
            return;
        }
        
        if (this.deviceLikelyHasApp()) {
            const appDetectionSection = document.getElementById('app-detection');
            const loadingSection = document.getElementById('loading');
            
            loadingSection.classList.add('hidden');
            appDetectionSection.classList.remove('hidden');
        } else {
            // Desktop or other device, skip app detection
            this.continueOnWeb();
        }
    }

    // Generate app store links for when app is not installed
    getAppStoreLinks() {
        const userAgent = navigator.userAgent;
        const isAndroid = /Android/i.test(userAgent);
        const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
        
        if (isAndroid) {
            return {
                platform: 'android',
                url: 'https://play.google.com/store/apps/details?id=com.yamu.app', // Replace with actual package name
                text: 'Download YAMU from Google Play'
            };
        } else if (isIOS) {
            return {
                platform: 'ios',
                url: 'https://apps.apple.com/app/yamu/id123456789', // Replace with actual App Store ID
                text: 'Download YAMU from App Store'
            };
        }
        
        return null;
    }

    // Show download option if app not installed
    showDownloadOption() {
        const appStoreLink = this.getAppStoreLinks();
        if (appStoreLink) {
            const statusDiv = document.getElementById('app-check-status');
            statusDiv.innerHTML += `
                <div class="download-option">
                    <a href="${appStoreLink.url}" target="_blank" class="btn btn-primary">
                        ${appStoreLink.text}
                    </a>
                </div>
            `;
        }
    }
}

// Initialize app detector when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.appDetector = new AppDetector();
});