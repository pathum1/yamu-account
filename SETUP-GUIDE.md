# YAMU Account Management Setup Guide

## Quick Setup Checklist

### 1. Repository Setup ✅
- [x] Create GitHub repository named `yamu-account`
- [x] Upload all portal files
- [x] Enable GitHub Pages in Settings

### 2. Firebase Configuration (CRITICAL)

#### Add GitHub Pages Domain to Firebase
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `yamu-app-1`
3. Go to **Authentication** → **Settings** → **Authorized domains**
4. Add your GitHub Pages domain: `pathum1.github.io`
5. Click **Add domain**

#### Verify Web App Configuration
1. In Firebase Console → **Project Settings** → **General**
2. Under "Your apps" section, ensure Web app exists
3. If not, click "Add app" → Web → Configure

### 3. Fix Google Sign-In Issues

#### Common Google Sign-In Problems:

**Problem**: "unauthorized_domain" error
**Solution**: Add `pathum1.github.io` to Firebase authorized domains (see above)

**Problem**: "popup-blocked" error
**Solution**: Portal automatically uses redirect on mobile devices

**Problem**: "cancelled-popup-request" error
**Solution**: Improved error handling - users can try again

#### Test Google Sign-In:
1. Open browser dev tools (F12)
2. Navigate to your portal
3. Click "Sign in with Google"
4. Check console for any errors

### 4. Test Email/Password Authentication

#### Verify Email/Password is Enabled:
1. Firebase Console → **Authentication** → **Sign-in method**
2. Ensure "Email/Password" is **Enabled**
3. If disabled, click to enable it

#### Test Email Sign-In:
1. Use existing YAMU account credentials
2. Or create test account via your Flutter app first
3. Try signing in through the portal

### 5. Update Google Play Console

1. Go to **Play Console** → **App content** → **Data safety**
2. Find **Data deletion** section
3. Update URL to: `https://pathum1.github.io/yamu-account/`
4. Save and submit for review

## Troubleshooting Authentication

### Google Sign-In Not Working

#### Check Firebase Configuration:
```javascript
// In browser console, check if Firebase is loaded:
console.log(window.firebase);
console.log(window.auth);
console.log(window.googleProvider);
```

#### Check Domain Authorization:
1. Open browser dev tools
2. Try to sign in
3. Look for error: `auth/unauthorized-domain`
4. If found, add your domain to Firebase authorized domains

#### Test on Different Browsers:
- Chrome/Chromium ✅
- Firefox ✅
- Safari ✅ (may need popup unblocking)
- Edge ✅

### Email/Password Sign-In Not Working

#### Verify User Exists:
1. Firebase Console → **Authentication** → **Users**
2. Check if the email exists in the user list
3. If not, user needs to create account via your Flutter app first

#### Common Error Messages:
- `auth/user-not-found`: User doesn't exist - create account in app first
- `auth/wrong-password`: Incorrect password
- `auth/invalid-email`: Email format is invalid
- `auth/too-many-requests`: Too many failed attempts - wait and try again

### Network Issues

#### CORS Problems:
- Should not occur with Firebase, but check browser console
- Ensure all requests are to `*.firebase.com` domains

#### Firestore Connection:
```javascript
// Test Firestore connection in browser console:
firebase.firestore().collection('users').limit(1).get()
  .then(() => console.log('Firestore connected'))
  .catch(err => console.error('Firestore error:', err));
```

## Testing Your Portal

### 1. Authentication Flow Testing

**Test Google Sign-In:**
1. Visit your portal: `https://pathum1.github.io/yamu-account/`
2. Click "Sign in with Google"
3. Complete Google OAuth flow
4. Verify you're signed in and see account options

**Test Email Sign-In:**
1. Click "Use Email/Password Instead"
2. Enter your YAMU account credentials
3. Click "Sign In"
4. Verify you're signed in and see account options

### 2. Data Export Testing

1. Sign in successfully
2. Click "Export Data"
3. Confirm in dialog
4. Wait for export to complete
5. Verify JSON file downloads with your data

### 3. Account Deletion Testing (BE CAREFUL!)

⚠️ **WARNING**: This permanently deletes your account!

1. Sign in with a TEST account only
2. Click "Delete Account"
3. Type "delete my account" exactly
4. Verify account and data are removed

### 4. Mobile Testing

**Test App Detection:**
1. Open portal on mobile device with YAMU app installed
2. Should offer "Open in YAMU App" option
3. Clicking should attempt to open app
4. If app doesn't open, should offer web alternative

**Test without App:**
1. Open portal on device without YAMU app
2. Should skip app detection or show download option
3. Should proceed directly to web authentication

## Performance Optimization

### 1. Enable Compression
GitHub Pages automatically compresses files, but you can:
- Minify CSS/JS files for production
- Optimize images (logo should be <100KB)

### 2. Monitor Usage
- Check GitHub Pages usage in repository Insights
- Monitor Firebase Auth usage in Firebase Console
- Track conversion rates (sign-ins to deletions)

## Security Considerations

### 1. Firebase Security Rules
Ensure your Firestore rules allow users to read/write their own data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // Add similar rules for other collections
  }
}
```

### 2. Rate Limiting
Firebase provides built-in rate limiting, but monitor for abuse:
- Authentication: 100 requests/second per IP
- Firestore: 10,000 requests/second per database

## Getting Help

### Common Issues:
1. **Google Sign-In fails** → Check authorized domains in Firebase
2. **Email sign-in fails** → Verify user exists and email/password is enabled
3. **Data export fails** → Check Firestore security rules
4. **Account deletion fails** → Check user permissions and batch limits

### Debug Information:
Always include when asking for help:
- Browser and version
- Error messages from browser console
- Firebase project ID confirmation
- Steps to reproduce the issue

### Support Contacts:
- Technical issues: Check browser console for errors
- Firebase issues: [Firebase Support](https://firebase.google.com/support/)
- GitHub Pages: [GitHub Support](https://support.github.com/)

## Success Metrics

Track these metrics to ensure the portal is working:
- Authentication success rate >95%
- Data export completion rate >90%
- Account deletion completion rate >90%
- Mobile app detection accuracy >80%
- Google Play compliance score: 100%

Your portal should now provide a complete, compliant solution for Google Play's account deletion requirements while supporting all your app's authentication methods!