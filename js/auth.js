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
    }

    setupEventListeners() {
        const googleSignInBtn = document.getElementById('google-signin-btn');
        if (googleSignInBtn) {
            googleSignInBtn.addEventListener('click', () => this.signInWithGoogle());
        }
    }

    async signInWithGoogle() {
        try {
            this.showLoading('Signing in...');
            
            const result = await auth.signInWithPopup(googleProvider);
            const user = result.user;
            
            console.log('User signed in:', user.email);
            this.hideError();
            
            // Check if user exists in Firestore, if not create profile
            await this.ensureUserProfile(user);
            
        } catch (error) {
            console.error('Sign-in error:', error);
            this.showError(this.getErrorMessage(error));
        } finally {
            this.hideLoading();
        }
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

    async signOut() {
        try {
            await auth.signOut();
            console.log('User signed out');
        } catch (error) {
            console.error('Sign-out error:', error);
            this.showError('Failed to sign out. Please try again.');
        }
    }

    updateUI(user) {
        const loadingSection = document.getElementById('loading');
        const appDetectionSection = document.getElementById('app-detection');
        const authSection = document.getElementById('auth-section');
        const accountOptions = document.getElementById('account-options');
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

            // Load user data summary
            if (window.accountManager) {
                window.accountManager.loadUserDataSummary();
            }
        } else {
            // User is not signed in
            accountOptions.classList.add('hidden');
            
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
            case 'auth/popup-blocked':
                return 'Pop-up was blocked. Please allow pop-ups and try again.';
            case 'auth/popup-closed-by-user':
                return 'Sign-in was cancelled. Please try again.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your connection and try again.';
            case 'auth/too-many-requests':
                return 'Too many attempts. Please wait a moment and try again.';
            default:
                return 'Sign-in failed. Please try again.';
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