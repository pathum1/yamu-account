// Firebase Configuration for YAMU Account Management
// This configuration matches the web config from the YAMU Flutter app

const firebaseConfig = {
    apiKey: "AIzaSyCrcUGAAVtGnCBrrp7znulON4khHj4Gg6c",
    authDomain: "yamu-app-1.firebaseapp.com",
    projectId: "yamu-app-1",
    storageBucket: "yamu-app-1.firebasestorage.app",
    messagingSenderId: "748824442231",
    appId: "1:748824442231:web:1ad2488555c50cc67b9d72",
    measurementId: "G-8WD2EVSG6N"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get Firebase services
const auth = firebase.auth();
const firestore = firebase.firestore();

// Configure Google Sign-In
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

// Configure auth settings for better mobile compatibility
auth.useDeviceLanguage();

// Set auth persistence with mobile fallback
const setPersistence = async () => {
    try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        console.log('Auth persistence set to LOCAL');
    } catch (error) {
        console.warn('Auth persistence error (mobile fallback):', error);
        // Continue without persistence on mobile if needed
    }
};

// Mobile-specific initialization
if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    // Add mobile-specific Firebase optimizations
    console.log('Mobile device detected - applying mobile auth optimizations');
    
    // Additional mobile-specific settings
    auth.settings.appVerificationDisabledForTesting = false; // Ensure proper verification
}

setPersistence();

// Export for use in other modules
window.firebaseConfig = firebaseConfig;
window.auth = auth;
window.firestore = firestore;
window.googleProvider = googleProvider;

console.log('Firebase initialized for YAMU Account Management');
