# Firebase Configuration for Mobile Google Sign-In

## Critical Setup Required

### 1. Firebase Console - Authentication Settings

**Go to**: Firebase Console → Your Project → Authentication → Settings → Authorized domains

**Add these domains**:
- `yamu-app-1.firebaseapp.com` (your Firebase hosting domain)
- Your production domain (e.g., `account.yamu.app`)
- For local testing: `localhost` and your local IP addresses

### 2. Google Cloud Console - OAuth Consent Screen

**Go to**: Google Cloud Console → APIs & Services → OAuth consent screen

**Configure**:
- **Application name**: "YAMU Account Management"
- **Authorized domains**: Add your domain(s)
- **Scopes**: email, profile, openid

### 3. OAuth 2.0 Client IDs

**Go to**: Google Cloud Console → APIs & Services → Credentials

**Web application client**:
- **Authorized JavaScript origins**: 
  - `https://yamu-app-1.firebaseapp.com`
  - `https://your-domain.com`
  - `http://localhost:3000` (for development)
- **Authorized redirect URIs**:
  - `https://yamu-app-1.firebaseapp.com/__/auth/handler`
  - `https://your-domain.com/__/auth/handler`

## Mobile-Specific Considerations

### Android Deep Links (if applicable)
- Add your package name to Firebase Console → Project Settings → General → Your apps
- Configure SHA certificate fingerprints for release builds

### iOS URL Schemes (if applicable)  
- Add your bundle ID to Firebase Console
- Configure custom URL schemes in iOS app

## Testing the Fix

### Desktop Testing
1. Open the website in Chrome/Firefox on desktop
2. Click "Sign in with Google" 
3. Should open popup window for authentication
4. Verify successful sign-in

### Mobile Testing
1. Open the website in mobile browser (Chrome on Android/Safari on iOS)
2. Click "Sign in with Google"
3. Should show "Redirecting to Google Sign-In..." message
4. Should redirect to Google OAuth page
5. After authentication, should return to your site with user signed in
6. Check browser console for any error messages

## Troubleshooting

### Common Issues
1. **"unauthorized_domain" error**: Domain not added to authorized domains list
2. **"redirect_uri_mismatch" error**: Redirect URI not configured in Google Cloud Console
3. **Infinite loading**: Check browser console for redirect result handling errors
4. **Network errors**: Verify Firebase project configuration and API keys

### Debug Steps
1. Open browser developer tools
2. Check Console tab for error messages
3. Check Network tab for failed requests
4. Verify sessionStorage has correct OAuth flags
5. Test on different browsers/devices

## Security Notes

- Never expose your Firebase config in public repositories
- Use environment variables for sensitive configuration
- Regularly review authorized domains list
- Monitor authentication logs for suspicious activity
- Implement rate limiting if needed

## Files Modified

The following files were updated to fix the mobile Google Sign-In issue:

1. **auth.js**: Fixed redirect flow race conditions and added proper error handling
2. **utils.js**: Added security utilities and toast notifications
3. **main.js**: Improved global error handling
4. **firebase-config.js**: No changes needed (configuration is correct)

The main issues were in the JavaScript redirect handling logic, not the Firebase configuration itself.