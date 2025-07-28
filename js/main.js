// Main application logic for YAMU Account Management

class YAMUAccountManagement {
    constructor() {
        this.initializeApp();
        this.setupModalEventListeners();
    }

    initializeApp() {
        // Let AuthManager handle all auth state changes and UI transitions
        // Main app only handles modal setup and global error handling
        console.log('YAMU Account Management main app initialized');
        
        // Start app detection flow only if not returning from OAuth
        if (!sessionStorage.getItem('yamuOAuthInProgress')) {
            this.startAppDetectionFlow();
        }
    }

    startAppDetectionFlow() {
        // Start the app detection flow only if auth manager hasn't taken control
        setTimeout(() => {
            // Only start app detection if auth manager hasn't shown a section yet
            const visibleSections = document.querySelectorAll('.section:not(.hidden)');
            
            if (visibleSections.length === 0) {
                if (window.appDetector) {
                    window.appDetector.startAppDetection();
                } else {
                    // Fallback if app detector not loaded
                    this.showAuthSection();
                }
            }
        }, 50); // Shorter delay, let auth manager take precedence
    }

    showAuthSection() {
        const loadingSection = document.getElementById('loading');
        const authSection = document.getElementById('auth-section');
        
        loadingSection.classList.add('hidden');
        authSection.classList.remove('hidden');
    }

    showAccountOptions() {
        const loadingSection = document.getElementById('loading');
        const appDetectionSection = document.getElementById('app-detection');
        const authSection = document.getElementById('auth-section');
        const accountOptions = document.getElementById('account-options');
        
        loadingSection.classList.add('hidden');
        appDetectionSection.classList.add('hidden');
        authSection.classList.add('hidden');
        accountOptions.classList.remove('hidden');
    }

    setupModalEventListeners() {
        const modal = document.getElementById('modal');
        const modalClose = document.getElementById('modal-close');
        const modalCancel = document.getElementById('modal-cancel');

        // Close modal when clicking the X or Cancel button
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }

        if (modalCancel) {
            modalCancel.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }

        // Close modal when clicking outside of it
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.add('hidden');
            }
        });

        // Handle escape key to close modal
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
            }
        });
    }

    // Public method to handle errors globally
    handleError(error, context = '') {
        console.error(`Error in ${context}:`, error);
        
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalMessage = document.getElementById('modal-message');
        const modalConfirm = document.getElementById('modal-confirm');

        modalTitle.textContent = 'Error';
        modalMessage.innerHTML = `
            <div class="error-message">
                <p>An error occurred: ${error.message || error}</p>
                ${context ? `<p class="small">Context: ${context}</p>` : ''}
            </div>
        `;
        modalConfirm.classList.add('hidden');
        modal.classList.remove('hidden');
    }

    // Public method to show loading state
    showGlobalLoading(message = 'Loading...') {
        const loadingSection = document.getElementById('loading');
        const loadingText = loadingSection.querySelector('p');
        
        if (loadingText) {
            loadingText.textContent = message;
        }
        
        // Hide other sections
        document.getElementById('app-detection').classList.add('hidden');
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('account-options').classList.add('hidden');
        
        // Show loading
        loadingSection.classList.remove('hidden');
    }

    // Public method to hide loading state
    hideGlobalLoading() {
        const loadingSection = document.getElementById('loading');
        loadingSection.classList.add('hidden');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Add global error handler
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
        if (window.yamuApp) {
            window.yamuApp.handleError(event.error, 'Global');
        }
    });

    // Add unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        if (window.yamuApp) {
            window.yamuApp.handleError(event.reason, 'Promise');
        }
    });

    // Initialize the main application
    window.yamuApp = new YAMUAccountManagement();
    
    console.log('YAMU Account Management initialized');
});
