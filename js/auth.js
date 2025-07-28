// Authentication module for YAMU Account Management

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isHandlingRedirect = false;
        this.authReady = false;
        
        // Mobile browser page lifecycle handling
        this.handlePageVisibility();
        
        this.setupAuthStateListener();
        this.setupEventListeners();
    }

    handlePageVisibility() {
        if (this.isMobile()) {
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && this.getOAuthFlag('yamuOAuthInProgress')) {
                    // Page became visible again - may be returning from OAuth
                    console.log('Page became visible during OAuth flow, checking for redirect result');
                    setTimeout(() => {
                        if (!this.currentUser && !this.isHandlingRedirect) {
                            console.log('Triggering redirect result handling after page visibility change');
                            this.handleRedirectResult();
                        }
                    }, 1000);
                }
            });

            // Handle page focus events (additional mobile browser support)
            window.addEventListener('focus', () => {
                if (this.getOAuthFlag('yamuOAuthInProgress')) {
                    console.log('Window focused during OAuth flow');
                    setTimeout(() => {
                        if (!this.currentUser && !this.isHandlingRedirect) {
                            this.handleRedirectResult();
                        }
                    }, 500);
                }
            });

            // Handle app resume on mobile (for PWA-like behavior)
            document.addEventListener('resume', () => {
                if (this.getOAuthFlag('yamuOAuthInProgress')) {
                    console.log('App resumed during OAuth flow');
                    this.handleRedirectResult();
                }
            });
        }
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
        
        try {
            // Wait for Firebase to be fully ready
            await this.waitForFirebaseReady();
            
            // Shorter timeout for mobile (8 seconds) with immediate popup fallback
            const timeout = this.isMobile() ? 8000 : 30000;
            let nullResultCount = 0;
            let attempts = 0;
            const maxAttempts = this.isMobile() ? 4 : 15; // Limit attempts on mobile
            
            console.log(`Starting redirect result handling (mobile: ${this.isMobile()}, timeout: ${timeout}ms, maxAttempts: ${maxAttempts})`);
            
            // Use Promise.race to ensure getRedirectResult never hangs indefinitely
            const checkRedirectWithTimeout = async () => {
                return Promise.race([
                    auth.getRedirectResult(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('getRedirectResult timeout')), 3000)
                    )
                ]);
            };
            
            const startTime = Date.now();
            
            while (attempts < maxAttempts && Date.now() - startTime < timeout) {
                attempts++;
                
                try {
                    console.log(`Redirect check attempt ${attempts}/${maxAttempts} (elapsed: ${Math.round((Date.now() - startTime)/1000)}s)`);
                    const result = await checkRedirectWithTimeout();
                    
                    if (result && result.user) {
                        console.log('User signed in via redirect:', result.user.email);
                        this.clearOAuthFlags();
                        return; // Success - exit
                    }
                    
                    // CRITICAL: Detect when getRedirectResult consistently returns null
                    if (result === null) {
                        nullResultCount++;
                        console.log(`getRedirectResult returned null (count: ${nullResultCount})`);
                        
                        // If we get 3 consecutive null results and we're on mobile using redirect method
                        if (nullResultCount >= 3 && this.isMobile() && this.getOAuthFlag('yamuAuthMethod') === 'redirect') {
                            console.log('Third-party storage likely blocked - falling back to popup');
                            this.clearOAuthFlags();
                            await this.fallbackToPopup('Browser privacy settings require popup sign-in');
                            return;
                        }
                    }
                    
                } catch (timeoutError) {
                    console.log(`getRedirectResult timed out on attempt ${attempts}`);
                    
                    // On mobile, immediate popup fallback after 2 timeouts
                    if (this.isMobile() && attempts >= 2) {
                        console.log('Mobile redirect consistently timing out - falling back to popup');
                        this.clearOAuthFlags();
                        await this.fallbackToPopup('Sign-in is taking too long, switching to popup method');
                        return;
                    }
                }
                
                // Check if OAuth is still valid
                const oauthInProgress = this.getOAuthFlag('yamuOAuthInProgress');
                const oauthTimestamp = this.getOAuthFlag('yamuOAuthTimestamp');
                
                if (!oauthInProgress) {
                    console.log('No OAuth in progress, exiting redirect handling');
                    break;
                }
                
                // Check if OAuth has expired (reduced to 3 minutes for mobile)
                if (oauthTimestamp) {
                    const timestamp = parseInt(oauthTimestamp);
                    const age = Date.now() - timestamp;
                    const maxAge = this.isMobile() ? 180000 : 300000; // 3 min mobile, 5 min desktop
                    
                    if (age > maxAge) {
                        console.log('OAuth redirect expired (age: ' + Math.round(age/1000) + 's)');
                        if (this.isMobile()) {
                            this.clearOAuthFlags();
                            await this.fallbackToPopup('Session expired, trying popup method');
                            return;
                        } else {
                            this.handleMobileAuthTimeout();
                            break;
                        }
                    }
                }
                
                // Shorter wait between attempts on mobile
                const waitTime = this.isMobile() ? 1500 : 2000;
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            
            // Handle final timeout or max attempts - immediate popup fallback on mobile
            if (this.getOAuthFlag('yamuOAuthInProgress')) {
                console.log(`Redirect handling completed without success (attempts: ${attempts}, elapsed: ${Math.round((Date.now() - startTime)/1000)}s)`);
                
                if (this.isMobile()) {
                    console.log('Mobile redirect failed - attempting final popup fallback');
                    this.clearOAuthFlags();
                    await this.fallbackToPopup('Unable to complete redirect sign-in, using popup method');
                } else {
                    this.handleMobileAuthTimeout();
                }
            }
            
        } catch (error) {
            console.error('Redirect sign-in error:', error);
            
            // Immediate popup fallback on mobile for any errors
            if (this.isMobile()) {
                console.log('Redirect error on mobile - attempting popup fallback');
                this.clearOAuthFlags();
                await this.fallbackToPopup('Sign-in error, trying popup method');
            } else {
                this.showMobileAuthError(error);
            }
        } finally {
            this.isHandlingRedirect = false;
        }
    }

    // SOLUTION 4: Mobile-specific timeout handling
    handleMobileAuthTimeout() {
        this.clearOAuthFlags();
        
        const message = this.isMobile() 
            ? `Sign-in timed out. This can happen on mobile browsers. Please try:\n• Using email/password sign-in instead\n• Refreshing the page and trying again\n• Checking your internet connection`
            : 'Sign-in timed out. Please try again.';
            
        this.showError(message);
        
        // Show email auth as fallback for mobile
        if (this.isMobile()) {
            setTimeout(() => this.suggestEmailAuth(), 2000);
        }
    }

    // Mobile-specific error handling
    showMobileAuthError(error) {
        this.clearOAuthFlags();
        const errorMessage = this.getErrorMessage(error);
        this.showError(errorMessage);
        
        // For mobile, always suggest email fallback on auth errors
        if (this.isMobile()) {
            setTimeout(() => this.suggestEmailAuth(), 3000);
        }
    }

    // Suggest email authentication as fallback
    suggestEmailAuth() {
        if (this.isMobile() && window.Utils) {
            Utils.showToast('Consider using email sign-in for better mobile experience', 'info', 5000);
        }
        
        // Auto-switch to email auth method if available
        const googleAuth = document.getElementById('google-auth-section');
        const emailAuth = document.getElementById('email-auth-section');
        const toggleBtn = document.getElementById('toggle-auth-method');
        
        if (googleAuth && emailAuth && toggleBtn && googleAuth.classList.contains('visible')) {
            this.toggleAuthMethod(); // Switch to email/password
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
            
            if (this.isMobile()) {
                // HYBRID MOBILE AUTHENTICATION
                console.log('Starting hybrid mobile authentication');
                
                // Test if third-party storage is accessible
                const canUseRedirect = await this.testThirdPartyStorage();
                console.log(`Third-party storage accessible: ${canUseRedirect}`);
                
                if (canUseRedirect) {
                    // Try redirect first (better UX when it works)
                    console.log('Using redirect for mobile (third-party storage available)');
                    await this.tryMobileRedirect();
                } else {
                    // Third-party storage blocked - use popup directly
                    console.log('Third-party storage blocked - using popup for mobile');
                    await this.fallbackToPopup('Your browser\'s privacy settings require popup sign-in');
                }
            } else {
                // Desktop - use popup as before
                console.log('Using popup for desktop Google sign-in');
                const result = await auth.signInWithPopup(googleProvider);
                console.log('User signed in with Google:', result.user.email);
                this.hideError();
            }
            
        } catch (error) {
            console.error('Google sign-in error:', error);
            this.clearOAuthFlags();
            this.showError(this.getErrorMessage(error));
        } finally {
            // Only hide loading if not doing mobile redirect
            if (!this.isMobile() || this.getOAuthFlag('yamuOAuthInProgress') !== 'true') {
                this.hideLoading();
            }
        }
    }

    // Try mobile redirect authentication
    async tryMobileRedirect() {
        this.clearOAuthFlags();
        this.setOAuthFlag('yamuOAuthInProgress', 'true');
        this.setOAuthFlag('yamuPreOAuthSection', 'auth');
        this.setOAuthFlag('yamuOAuthTimestamp', Date.now().toString());
        this.setOAuthFlag('yamuAuthMethod', 'redirect'); // Track method used
        
        this.showMobileRedirectStatus();
        
        try {
            await auth.signInWithRedirect(googleProvider);
        } catch (redirectError) {
            console.error('Mobile redirect failed:', redirectError);
            this.clearOAuthFlags();
            
            // Fallback to popup if redirect fails
            await this.fallbackToPopup('Redirect failed, trying popup sign-in');
        }
    }

    // Fallback to popup authentication with user messaging
    async fallbackToPopup(reason = 'Switching to popup sign-in') {
        console.log('Falling back to popup authentication:', reason);
        this.clearOAuthFlags();
        this.setOAuthFlag('yamuAuthMethod', 'popup'); // Track method used
        
        // Show user-friendly message about popup
        this.showLoading(`${reason}...`);
        
        try {
            // Small delay to show the message
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const result = await auth.signInWithPopup(googleProvider);
            console.log('User signed in via popup fallback:', result.user.email);
            this.hideError();
            
            // Show success message
            if (window.Utils) {
                Utils.showToast('Successfully signed in!', 'success', 2000);
            }
        } catch (popupError) {
            console.error('Popup fallback failed:', popupError);
            
            if (popupError.code === 'auth/popup-blocked') {
                this.showError('Pop-up was blocked. Please allow pop-ups for this site and try again, or use email sign-in instead.');
            } else if (popupError.code === 'auth/popup-closed-by-user') {
                this.showError('Sign-in was cancelled. Please try again.');
            } else {
                this.showError(this.getErrorMessage(popupError));
            }
            
            // Suggest email auth as final fallback
            setTimeout(() => this.suggestEmailAuth(), 2000);
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
        // Multiple detection methods for reliability
        const userAgentMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const smallScreen = window.innerWidth <= 768 || window.innerHeight <= 768;
        const mobileViewport = window.devicePixelRatio > 1;
        
        return userAgentMobile || (touchDevice && (smallScreen || mobileViewport));
    }

    // Test if third-party storage is accessible (mobile browsers often block this)
    async testThirdPartyStorage() {
        try {
            // Try to detect if third-party storage/cookies are blocked
            // This is a common issue on mobile browsers with privacy restrictions
            const testKey = 'yamu_3p_test';
            const testValue = Date.now().toString();
            
            // Test sessionStorage access
            sessionStorage.setItem(testKey, testValue);
            const retrieved = sessionStorage.getItem(testKey);
            sessionStorage.removeItem(testKey);
            
            if (retrieved !== testValue) {
                return false;
            }
            
            // Additional test: check if we can access Firebase's cross-origin iframe
            // This is what actually gets blocked on mobile browsers
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = 'https://yamu-app-1.firebaseapp.com/__/auth/iframe';
            
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    document.body.removeChild(iframe);
                    resolve(false); // Assume blocked if timeout
                }, 1000);
                
                iframe.onload = () => {
                    clearTimeout(timeout);
                    document.body.removeChild(iframe);
                    resolve(true);
                };
                
                iframe.onerror = () => {
                    clearTimeout(timeout);
                    document.body.removeChild(iframe);
                    resolve(false);
                };
                
                document.body.appendChild(iframe);
            });
            
        } catch (error) {
            console.warn('Third-party storage test failed:', error);
            return false;
        }
    }

    // Firebase ready check to prevent race conditions
    async waitForFirebaseReady() {
        const maxWait = 5000; // 5 seconds max wait
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            if (auth && typeof auth.getRedirectResult === 'function') {
                // Additional mobile check - ensure auth state is stable
                if (this.isMobile()) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        throw new Error('Firebase not ready after timeout');
    }

    // Enhanced storage for mobile reliability
    setOAuthFlag(key, value) {
        try {
            sessionStorage.setItem(key, value);
            // Fallback to localStorage on mobile for reliability
            if (this.isMobile()) {
                localStorage.setItem(`yamu_temp_${key}`, value);
            }
        } catch (e) {
            console.warn('Storage not available:', e);
        }
    }

    getOAuthFlag(key) {
        try {
            let value = sessionStorage.getItem(key);
            // Mobile fallback check
            if (!value && this.isMobile()) {
                value = localStorage.getItem(`yamu_temp_${key}`);
            }
            return value;
        } catch (e) {
            return null;
        }
    }

    clearOAuthFlags() {
        const flags = ['yamuOAuthInProgress', 'yamuOAuthTimestamp', 'yamuPreOAuthSection'];
        flags.forEach(flag => {
            try {
                sessionStorage.removeItem(flag);
                if (this.isMobile()) {
                    localStorage.removeItem(`yamu_temp_${flag}`);
                }
            } catch (e) {
                console.warn('Failed to clear flag:', flag);
            }
        });
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
            this.clearOAuthFlags();
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
            const oauthInProgress = this.getOAuthFlag('yamuOAuthInProgress');
            const preOAuthSection = this.getOAuthFlag('yamuPreOAuthSection');
            
            if (oauthInProgress) {
                // User is returning from OAuth but auth not complete yet
                // Show loading with appropriate message
                this.showLoading('Completing sign-in...');
                
                // CRITICAL FIX: Add hard timeout to prevent infinite "Completing sign-in" hang
                // This ensures the UI never stays stuck even if redirect handling fails
                const maxCompletionTime = this.isMobile() ? 12000 : 20000; // 12s mobile, 20s desktop
                
                setTimeout(() => {
                    // If still showing "Completing sign-in" after timeout, force fallback
                    if (this.getOAuthFlag('yamuOAuthInProgress') && 
                        loadingSection.querySelector('p')?.textContent?.includes('Completing sign-in')) {
                        
                        console.warn('Hard timeout reached for "Completing sign-in" - forcing fallback');
                        this.clearOAuthFlags();
                        
                        if (this.isMobile()) {
                            // Mobile: Try popup as final fallback
                            this.fallbackToPopup('Sign-in taking too long, switching to popup');
                        } else {
                            // Desktop: Show auth section with error
                            this.hideLoading();
                            authSection.classList.remove('hidden');
                            this.showError('Sign-in timed out. Please try again.');
                        }
                    }
                }, maxCompletionTime);
                
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
                    <p>Completing sign-in...</p>
                    <p class="small" style="color: var(--text-secondary); margin-top: 8px;">
                        Checking browser compatibility...
                    </p>
                    <div class="mobile-auth-info" style="margin-top: 16px; padding: 12px; background: var(--bg-secondary, #f8f9fa); border-radius: 6px;">
                        <p class="tiny" style="font-size: 11px; color: var(--text-secondary); margin: 0;">
                            <strong>Note:</strong> If this takes longer than 10 seconds, your browser's privacy settings may be blocking third-party storage. We'll automatically switch to popup sign-in.
                        </p>
                    </div>
                    <div class="mobile-auth-help" style="margin-top: 16px;">
                        <p class="tiny" style="font-size: 12px; color: var(--text-secondary);">
                            Having trouble?
                        </p>
                        <button id="mobile-auth-retry" class="btn btn-secondary" style="margin: 8px 4px; padding: 6px 12px; font-size: 12px;">
                            Try Again
                        </button>
                        <button id="mobile-auth-email" class="btn btn-link" style="margin: 8px 4px; font-size: 12px;">
                            Use Email Instead
                        </button>
                    </div>
                </div>
            `;
            
            // Add event listeners for mobile retry options
            this.setupMobileRetryHandlers();
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

    setupMobileRetryHandlers() {
        // Use setTimeout to ensure DOM elements are ready
        setTimeout(() => {
            const retryBtn = document.getElementById('mobile-auth-retry');
            const emailBtn = document.getElementById('mobile-auth-email');
            
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    console.log('User clicked retry on mobile auth');
                    this.clearOAuthFlags();
                    if (window.Utils) {
                        Utils.showToast('Restarting sign-in process...', 'info', 2000);
                    }
                    setTimeout(() => location.reload(), 500);
                });
            }
            
            if (emailBtn) {
                emailBtn.addEventListener('click', () => {
                    console.log('User clicked email fallback on mobile auth');
                    this.clearOAuthFlags();
                    this.hideLoading();
                    this.suggestEmailAuth();
                    
                    // Show auth section with email method
                    const authSection = document.getElementById('auth-section');
                    if (authSection) {
                        authSection.classList.remove('hidden');
                        this.toggleAuthMethod(); // Switch to email if on Google method
                    }
                });
            }
        }, 100);
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