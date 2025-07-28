// Authentication module for YAMU Account Management

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isHandlingRedirect = false;
        this.authReady = false;
        this.setupAuthStateListener();
        this.setupEventListeners();
    }

    setupAuthStateListener() {
        // Single auth state listener to prevent conflicts
        auth.onAuthStateChanged(async (user) => {
            console.log('Auth state changed:', user ? user.email : 'null');
            this.currentUser = user;
            this.authReady = true;
            
            // Handle redirect result after auth state is ready
            if (!this.isHandlingRedirect) {
                this.handleRedirectResult();
            }
            
            if (user) {
                // Clear OAuth flow flag on successful auth
                sessionStorage.removeItem('yamuOAuthInProgress');
                
                // Ensure user profile exists
                try {
                    await this.ensureUserProfile(user);
                } catch (error) {
                    console.error('Error ensuring user profile:', error);
                }
            }
            
            this.updateUI(user);
        });
    }

    async handleRedirectResult() {
        if (this.isHandlingRedirect) {
            return; // Prevent multiple simultaneous calls
        }
        
        this.isHandlingRedirect = true;
        const maxRetries = 3;
        let retryCount = 0;
        
        try {
            while (retryCount < maxRetries) {
                const result = await auth.getRedirectResult();
                
                if (result && result.user) {
                    console.log('User signed in via redirect:', result.user.email);
                    // Clear all OAuth tracking flags on successful auth
                    sessionStorage.removeItem('yamuOAuthInProgress');
                    sessionStorage.removeItem('yamuOAuthTimestamp');
                    sessionStorage.removeItem('yamuPreOAuthSection');
                    // The onAuthStateChanged will handle the UI update
                    return; // Success - exit
                }
                
                const oauthTimestamp = sessionStorage.getItem('yamuOAuthTimestamp');
                if (sessionStorage.getItem('yamuOAuthInProgress') && oauthTimestamp) {
                    // Check if OAuth is stale (older than 5 minutes)
                    const timestamp = parseInt(oauthTimestamp);
                    const now = Date.now();
                    
                    if (now - timestamp > 300000) { // 5 minutes timeout
                        console.log('OAuth redirect expired, clearing flags and showing error');
                        sessionStorage.removeItem('yamuOAuthInProgress');
                        sessionStorage.removeItem('yamuOAuthTimestamp');
                        sessionStorage.removeItem('yamuPreOAuthSection');
                        this.showError('Sign-in took too long and expired. Please try again.');
                        break;
                    }
                    
                    // Wait and retry with exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Max 5 seconds
                    console.log(`OAuth in progress, retry ${retryCount + 1}/${maxRetries} in ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    retryCount++;
                } else {
                    // No OAuth in progress, nothing to handle
                    break;
                }
            }
            
            // If we've exhausted retries and still have OAuth in progress, show error
            if (retryCount >= maxRetries && sessionStorage.getItem('yamuOAuthInProgress')) {
                console.log('OAuth redirect handling exhausted retries, clearing flags');
                sessionStorage.removeItem('yamuOAuthInProgress');
                sessionStorage.removeItem('yamuOAuthTimestamp');
                sessionStorage.removeItem('yamuPreOAuthSection');
                this.showError('Sign-in process failed. Please try again.');
            }
            
        } catch (error) {
            console.error('Redirect sign-in error:', error);
            // Clear all OAuth flags on error
            sessionStorage.removeItem('yamuOAuthInProgress');
            sessionStorage.removeItem('yamuOAuthTimestamp');
            sessionStorage.removeItem('yamuPreOAuthSection');
            this.showError(this.getErrorMessage(error));
        } finally {
            this.isHandlingRedirect = false;
        }
    }

    setupEventListeners() {
        const googleSignInBtn = document.getElementById('google-signin-btn');
        const emailSignInBtn = document.getElementById('email-signin-btn');
        const toggleAuthBtn = document.getElementById('toggle-auth-method');
        const emailSignInForm = document.getElementById('email-signin-form');
        const logoutBtn = document.getElementById('logout-btn');

        if (googleSignInBtn) {
            googleSignInBtn.addEventListener('click', () => this.signInWithGoogle());
        }

        if (emailSignInBtn) {
            emailSignInBtn.addEventListener('click', () => this.signInWithEmail());
        }

        if (toggleAuthBtn) {
            toggleAuthBtn.addEventListener('click', () => this.toggleAuthMethod());
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleSignOut());
        }

        if (emailSignInForm) {
            emailSignInForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.signInWithEmail();
            });
        }

        // Handle Enter key in password field
        const passwordField = document.getElementById('password');
        if (passwordField) {
            passwordField.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.signInWithEmail();
                }
            });
        }
    }

    async signInWithGoogle() {
        try {
            this.showLoading('Signing in with Google...');
            this.hideError();
            
            // Use redirect for mobile, popup for desktop
            if (this.isMobile()) {
                // On mobile, redirect to Google
                console.log('Using redirect for mobile Google sign-in');
                
                // Clear any existing flags first to prevent conflicts
                sessionStorage.removeItem('yamuOAuthInProgress');
                sessionStorage.removeItem('yamuPreOAuthSection');
                sessionStorage.removeItem('yamuOAuthTimestamp');
                
                // Set flag AFTER clearing with timestamp for expiration tracking
                sessionStorage.setItem('yamuOAuthInProgress', 'true');
                sessionStorage.setItem('yamuPreOAuthSection', 'auth'); // Remember we were in auth
                sessionStorage.setItem('yamuOAuthTimestamp', Date.now().toString());
                
                // Show mobile-specific loading message
                this.showMobileRedirectStatus();
                
                // Add error handling for redirect
                try {
                    await auth.signInWithRedirect(googleProvider);
                } catch (redirectError) {
                    console.error('Redirect failed:', redirectError);
                    sessionStorage.removeItem('yamuOAuthInProgress');
                    sessionStorage.removeItem('yamuOAuthTimestamp');
                    throw new Error('Failed to redirect to Google: ' + redirectError.message);
                }
                // The page will redirect - no need to handle result here
                return;
            } else {
                // On desktop, use popup
                console.log('Using popup for desktop Google sign-in');
                const result = await auth.signInWithPopup(googleProvider);
                const user = result.user;
                
                console.log('User signed in with Google:', user.email);
                this.hideError();
                
                // User profile will be ensured by auth state listener
            }
            
        } catch (error) {
            console.error('Google sign-in error:', error);
            // Clear OAuth flags on any error
            sessionStorage.removeItem('yamuOAuthInProgress');
            sessionStorage.removeItem('yamuOAuthTimestamp');
            this.showError(this.getErrorMessage(error));
        } finally {
            // Only hide loading if not doing mobile redirect
            if (!this.isMobile() || sessionStorage.getItem('yamuOAuthInProgress') !== 'true') {
                this.hideLoading();
            }
        }
    }

    async signInWithEmail() {
        try {
            const email = document.getElementById('email')?.value?.trim();
            const password = document.getElementById('password')?.value;

            if (!email || !password) {
                this.showError('Please enter both email and password.');
                return;
            }

            if (!this.isValidEmail(email)) {
                this.showError('Please enter a valid email address.');
                return;
            }

            this.showLoading('Signing in...');
            
            const result = await auth.signInWithEmailAndPassword(email, password);
            const user = result.user;
            
            console.log('User signed in with email:', user.email);
            this.hideError();
            
            // Check if user exists in Firestore, if not create profile
            await this.ensureUserProfile(user);
            
        } catch (error) {
            console.error('Email sign-in error:', error);
            this.showError(this.getErrorMessage(error));
        } finally {
            this.hideLoading();
        }
    }

    toggleAuthMethod() {
        const googleAuth = document.getElementById('google-auth-section');
        const emailAuth = document.getElementById('email-auth-section');
        const toggleBtn = document.getElementById('toggle-auth-method');

        if (googleAuth && emailAuth && toggleBtn) {
            if (googleAuth.classList.contains('hidden')) {
                // Show Google, hide email
                googleAuth.classList.remove('hidden');
                emailAuth.classList.add('hidden');
                toggleBtn.textContent = 'Use Email/Password Instead';
            } else {
                // Show email, hide Google
                googleAuth.classList.add('hidden');
                emailAuth.classList.remove('hidden');
                toggleBtn.textContent = 'Use Google Sign-In Instead';
            }
        }
    }

    isMobile() {
        return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    async ensureUserProfile(user) {
        try {
            const userDoc = await firestore.collection('users').doc(user.uid).get();
            
            if (!userDoc.exists) {
                // Create basic user profile if it doesn't exist
                const userProfile = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || 'YAMU User',
                    photoUrl: user.photoURL || null,
                    phoneNumber: '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await firestore.collection('users').doc(user.uid).set(userProfile);
                console.log('User profile created for:', user.email);
            }
        } catch (error) {
            console.error('Error ensuring user profile:', error);
            // Don't block the flow if profile creation fails
        }
    }

    async handleSignOut() {
        try {
            const modal = document.getElementById('modal');
            const modalTitle = document.getElementById('modal-title');
            const modalMessage = document.getElementById('modal-message');
            const modalConfirm = document.getElementById('modal-confirm');
            const modalCancel = document.getElementById('modal-cancel');

            if (!modal || !modalTitle || !modalMessage || !modalConfirm || !modalCancel) {
                console.error('Modal elements not found, signing out directly');
                await this.signOut();
                return;
            }

            modalTitle.textContent = '🚪 Sign Out';
            modalMessage.innerHTML = Security.createSafeHTML(`
                <p>Are you sure you want to sign out?</p>
                <p class="small">You'll need to sign in again to access account management options.</p>
            `);

            modalConfirm.textContent = 'Sign Out';
            modalConfirm.classList.remove('hidden');
            modal.classList.remove('hidden');

            // Handle confirmation with cleanup
            const handleConfirm = async () => {
                try {
                    modalConfirm.removeEventListener('click', handleConfirm);
                    modalCancel.removeEventListener('click', handleCancel);
                    modal.classList.add('hidden');
                    
                    await this.signOut();
                } catch (error) {
                    console.error('Error during sign out confirmation:', error);
                    this.showError('Failed to sign out. Please try again.');
                }
            };

            const handleCancel = () => {
                modalConfirm.removeEventListener('click', handleConfirm);
                modalCancel.removeEventListener('click', handleCancel);
                modal.classList.add('hidden');
            };

            modalConfirm.addEventListener('click', handleConfirm);
            modalCancel.addEventListener('click', handleCancel);

        } catch (error) {
            console.error('Sign out dialog error:', error);
            this.showError('Error showing sign out dialog. Signing out directly...');
            // Fallback - sign out directly
            await this.signOut();
        }
    }

    async signOut() {
        try {
            this.showLoading('Signing out...');
            
            // Clear any cached data FIRST
            this.currentUser = null;
            
            // Clear OAuth flow flags and timestamp
            sessionStorage.removeItem('yamuOAuthInProgress');
            sessionStorage.removeItem('yamuPreOAuthSection');
            sessionStorage.removeItem('yamuOAuthTimestamp');
            sessionStorage.removeItem('yamuWebFlowChosen');
            
            // Immediately hide user-specific sections and clear data
            const accountOptions = document.getElementById('account-options');
            const dataSummary = document.getElementById('data-summary');
            
            if (accountOptions) {
                accountOptions.classList.add('hidden');
            }
            if (dataSummary) {
                dataSummary.classList.add('hidden');
            }
            
            // Clear user info immediately
            this.clearUserInfo();
            
            // Clear form fields
            this.clearFormFields();
            
            // Sign out from Firebase
            await auth.signOut();
            
            console.log('User signed out successfully');
            
            // Hide loading and show success message briefly
            this.hideLoading();
            Utils.showToast('Signed out successfully', 'success', 2000);
            
        } catch (error) {
            console.error('Sign-out error:', error);
            this.hideLoading();
            this.showError('Failed to sign out. Please try again.');
        }
    }

    clearFormFields() {
        const emailField = document.getElementById('email');
        const passwordField = document.getElementById('password');
        
        if (emailField) emailField.value = '';
        if (passwordField) passwordField.value = '';
    }

    updateUserInfo(user) {
        // Add user email info below the name
        const userInfo = document.querySelector('.user-info');
        if (userInfo && user) {
            // Remove existing user email if present
            const existingEmail = userInfo.querySelector('.user-email');
            if (existingEmail) {
                existingEmail.remove();
            }

            // Add user email
            const emailElement = document.createElement('p');
            emailElement.className = 'user-email';
            emailElement.style.fontSize = '14px';
            emailElement.style.color = 'var(--text-secondary)';
            emailElement.style.margin = '4px 0 16px 0';
            emailElement.textContent = user.email;
            
            const nameElement = userInfo.querySelector('h2');
            if (nameElement) {
                nameElement.insertAdjacentElement('afterend', emailElement);
            }
        }
    }

    clearUserInfo() {
        // Clear user name display
        const userNameSpan = document.getElementById('user-name');
        if (userNameSpan) {
            userNameSpan.textContent = '';
        }

        // Remove user email
        const existingEmail = document.querySelector('.user-email');
        if (existingEmail) {
            existingEmail.remove();
        }

        // Clear data summary content
        const summaryContent = document.getElementById('summary-content');
        if (summaryContent) {
            summaryContent.innerHTML = '';
        }
    }

    updateUI(user) {
        const loadingSection = document.getElementById('loading');
        const appDetectionSection = document.getElementById('app-detection');
        const authSection = document.getElementById('auth-section');
        const accountOptions = document.getElementById('account-options');
        const dataSummary = document.getElementById('data-summary');
        const userNameSpan = document.getElementById('user-name');

        // Hide loading
        loadingSection.classList.add('hidden');

        if (user) {
            // User is signed in - hide all other sections
            appDetectionSection.classList.add('hidden');
            authSection.classList.add('hidden');
            if (dataSummary) {
                dataSummary.classList.add('hidden');
            }
            
            // Show account options
            accountOptions.classList.remove('hidden');
            
            if (userNameSpan) {
                userNameSpan.textContent = user.displayName || user.email;
            }

            // Update user info display
            this.updateUserInfo(user);

            // Load user data summary
            if (window.accountManager) {
                window.accountManager.loadUserDataSummary();
            }
        } else {
            // User is not signed in - hide user-specific content
            accountOptions.classList.add('hidden');
            
            // Hide data summary section
            if (dataSummary) {
                dataSummary.classList.add('hidden');
            }
            
            // Clear user info
            this.clearUserInfo();
            
            // Check if user is returning from OAuth redirect
            const oauthInProgress = sessionStorage.getItem('yamuOAuthInProgress');
            const preOAuthSection = sessionStorage.getItem('yamuPreOAuthSection');
            
            if (oauthInProgress) {
                // User is returning from OAuth but auth not complete yet
                // Show loading with appropriate message
                this.showLoading('Completing sign-in...');
                return;
            }
            
            // Determine which section to show based on context
            if (preOAuthSection === 'auth' || 
                appDetectionSection.classList.contains('hidden') || 
                document.getElementById('use-web-btn')?.textContent?.includes('Recommended')) {
                // Show auth section - user was already past app detection
                appDetectionSection.classList.add('hidden');
                authSection.classList.remove('hidden');
            } else {
                // Show app detection first (mobile devices only)
                if (this.isMobile()) {
                    appDetectionSection.classList.remove('hidden');
                    authSection.classList.add('hidden');
                } else {
                    // Desktop - skip app detection
                    appDetectionSection.classList.add('hidden');
                    authSection.classList.remove('hidden');
                }
            }
        }
    }

    showLoading(message = 'Loading...') {
        const loadingSection = document.getElementById('loading');
        const loadingText = loadingSection.querySelector('p');
        if (loadingText) {
            loadingText.textContent = message;
        }
        
        // Hide other sections while loading
        const appDetectionSection = document.getElementById('app-detection');
        const authSection = document.getElementById('auth-section');
        const accountOptions = document.getElementById('account-options');
        
        appDetectionSection.classList.add('hidden');
        authSection.classList.add('hidden');
        accountOptions.classList.add('hidden');
        
        loadingSection.classList.remove('hidden');
    }

    hideLoading() {
        const loadingSection = document.getElementById('loading');
        loadingSection.classList.add('hidden');
    }

    showMobileRedirectStatus() {
        const loadingSection = document.getElementById('loading');
        const loadingText = loadingSection.querySelector('p');
        
        if (loadingText) {
            loadingText.innerHTML = `
                <div class="mobile-redirect-status">
                    <div class="spinner"></div>
                    <p>Redirecting to Google Sign-In...</p>
                    <p class="small" style="color: var(--text-secondary); margin-top: 8px;">
                        You'll be brought back to YAMU after signing in
                    </p>
                    <div class="redirect-help" style="margin-top: 16px;">
                        <p class="tiny" style="font-size: 12px; color: var(--text-secondary);">
                            Taking too long? 
                            <button class="btn-link" onclick="location.reload()" 
                                    style="color: var(--primary-color); text-decoration: underline; background: none; border: none; cursor: pointer;">
                                Try again
                            </button>
                        </p>
                    </div>
                </div>
            `;
        }
        
        // Ensure loading section is visible
        loadingSection.classList.remove('hidden');
        
        // Hide other sections while redirecting
        const appDetectionSection = document.getElementById('app-detection');
        const authSection = document.getElementById('auth-section');
        const accountOptions = document.getElementById('account-options');
        
        if (appDetectionSection) appDetectionSection.classList.add('hidden');
        if (authSection) authSection.classList.add('hidden');
        if (accountOptions) accountOptions.classList.add('hidden');
    }

    showError(message) {
        const errorDiv = document.getElementById('auth-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
        }
    }

    hideError() {
        const errorDiv = document.getElementById('auth-error');
        if (errorDiv) {
            errorDiv.classList.add('hidden');
        }
    }

    getErrorMessage(error) {
        // Add mobile-specific context to error messages
        const isMobile = this.isMobile();
        
        switch (error.code) {
            // Google Sign-In errors
            case 'auth/popup-blocked':
                return isMobile 
                    ? 'Sign-in was blocked. Please try again or use a different browser.'
                    : 'Pop-up was blocked. Please allow pop-ups and try again.';
            case 'auth/popup-closed-by-user':
                return 'Sign-in was cancelled. Please try again.';
            case 'auth/cancelled-popup-request':
                return 'Sign-in was cancelled. Please try again.';
            case 'auth/redirect-cancelled-by-user':
                return 'Sign-in was cancelled. You can try again or use email/password instead.';
            case 'auth/redirect-operation-pending':
                return 'Another sign-in attempt is in progress. Please wait a moment.';
            
            // Email/Password errors
            case 'auth/user-not-found':
                return 'No account found with this email address. Please check your email or create an account.';
            case 'auth/wrong-password':
                return 'Incorrect password. Please try again or reset your password.';
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/user-disabled':
                return 'This account has been disabled. Please contact support for assistance.';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Please wait a few minutes and try again.';
            case 'auth/weak-password':
                return 'Password is too weak. Please choose a stronger password (at least 6 characters).';
            case 'auth/email-already-in-use':
                return 'An account with this email already exists. Please sign in instead.';
            case 'auth/invalid-credential':
                return 'Invalid credentials. Please check your email and password.';
            
            // Network errors  
            case 'auth/network-request-failed':
                return isMobile
                    ? 'Network error. Please check your mobile connection and try again.'
                    : 'Network error. Please check your internet connection and try again.';
            case 'auth/timeout':
                return 'Request timed out. Please check your connection and try again.';
            
            // General errors
            case 'auth/internal-error':
                return 'An internal error occurred. Please try again in a few moments.';
            case 'auth/unauthorized-domain':
                return 'This website is not authorized for sign-in. Please contact support.';
            
            // Mobile-specific errors
            case 'auth/credential-already-in-use':
                return 'This Google account is already linked to another user. Please try a different account.';
            case 'auth/account-exists-with-different-credential':
                return 'An account already exists with this email using a different sign-in method.';
            
            default:
                console.log('Unhandled auth error:', error.code, error.message);
                const defaultMessage = error.message || 'Authentication failed. Please try again.';
                
                // Add helpful context for mobile users
                if (isMobile && defaultMessage.includes('redirect')) {
                    return `${defaultMessage} If this persists, try using email/password sign-in instead.`;
                }
                
                return defaultMessage;
        }
    }

    // Public method to check if user is authenticated
    isAuthenticated() {
        return this.currentUser !== null;
    }

    // Public method to get current user
    getCurrentUser() {
        return this.currentUser;
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});
