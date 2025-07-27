// Authentication module for YAMU Account Management

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.setupAuthStateListener();
        this.setupEventListeners();
    }

    setupAuthStateListener() {
        auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            this.updateUI(user);
        });

        // Handle redirect result for mobile Google Sign-In
        auth.getRedirectResult().then((result) => {
            if (result.user) {
                console.log('User signed in via redirect:', result.user.email);
                this.ensureUserProfile(result.user).catch(console.error);
            }
        }).catch((error) => {
            console.error('Redirect sign-in error:', error);
            this.showError(this.getErrorMessage(error));
        });
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
            
            // Use redirect instead of popup for better compatibility
            if (this.isMobile()) {
                await auth.signInWithRedirect(googleProvider);
                // Handle result after redirect
                return;
            } else {
                const result = await auth.signInWithPopup(googleProvider);
                const user = result.user;
                
                console.log('User signed in with Google:', user.email);
                this.hideError();
                
                // Check if user exists in Firestore, if not create profile
                await this.ensureUserProfile(user);
            }
            
        } catch (error) {
            console.error('Google sign-in error:', error);
            this.showError(this.getErrorMessage(error));
        } finally {
            this.hideLoading();
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

            modalTitle.textContent = '🚪 Sign Out';
            modalMessage.innerHTML = `
                <p>Are you sure you want to sign out?</p>
                <p class="small">You'll need to sign in again to access account management options.</p>
            `;

            modalConfirm.textContent = 'Sign Out';
            modalConfirm.classList.remove('hidden');
            modal.classList.remove('hidden');

            // Handle confirmation
            const handleConfirm = async () => {
                modalConfirm.removeEventListener('click', handleConfirm);
                modalCancel.removeEventListener('click', handleCancel);
                modal.classList.add('hidden');
                
                await this.signOut();
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
            // Fallback - sign out directly
            await this.signOut();
        }
    }

    async signOut() {
        try {
            this.showLoading('Signing out...');
            
            // Clear any cached data FIRST
            this.currentUser = null;
            
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
            // User is signed in
            authSection.classList.add('hidden');
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
            // User is not signed in - hide all user-specific content
            accountOptions.classList.add('hidden');
            
            // Hide data summary section
            if (dataSummary) {
                dataSummary.classList.add('hidden');
            }
            
            // Clear user info
            this.clearUserInfo();
            
            // Show app detection first, then auth if needed
            if (!appDetectionSection.classList.contains('hidden')) {
                // App detection is already shown, show auth
                authSection.classList.remove('hidden');
            } else {
                // Show app detection first
                appDetectionSection.classList.remove('hidden');
            }
        }
    }

    showLoading(message = 'Loading...') {
        const loadingSection = document.getElementById('loading');
        const loadingText = loadingSection.querySelector('p');
        if (loadingText) {
            loadingText.textContent = message;
        }
        loadingSection.classList.remove('hidden');
    }

    hideLoading() {
        const loadingSection = document.getElementById('loading');
        loadingSection.classList.add('hidden');
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
        switch (error.code) {
            // Google Sign-In errors
            case 'auth/popup-blocked':
                return 'Pop-up was blocked. Please allow pop-ups and try again.';
            case 'auth/popup-closed-by-user':
                return 'Sign-in was cancelled. Please try again.';
            case 'auth/cancelled-popup-request':
                return 'Sign-in was cancelled. Please try again.';
            
            // Email/Password errors
            case 'auth/user-not-found':
                return 'No account found with this email address.';
            case 'auth/wrong-password':
                return 'Incorrect password. Please try again.';
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/user-disabled':
                return 'This account has been disabled. Please contact support.';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Please wait a moment and try again.';
            case 'auth/weak-password':
                return 'Password is too weak. Please choose a stronger password.';
            case 'auth/email-already-in-use':
                return 'An account with this email already exists.';
            case 'auth/invalid-credential':
                return 'Invalid credentials. Please check your email and password.';
            
            // Network errors
            case 'auth/network-request-failed':
                return 'Network error. Please check your connection and try again.';
            case 'auth/timeout':
                return 'Request timed out. Please try again.';
            
            // General errors
            case 'auth/internal-error':
                return 'An internal error occurred. Please try again later.';
            case 'auth/unauthorized-domain':
                return 'This domain is not authorized for authentication.';
            
            default:
                console.log('Unhandled auth error:', error.code, error.message);
                return error.message || 'Authentication failed. Please try again.';
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
