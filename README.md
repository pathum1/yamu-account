# YAMU Account Management Portal

A GitHub Pages hosted solution for YAMU app account management, providing Google Play compliance for account deletion requirements.

## Features

- **🔐 Secure Authentication**: Google OAuth integration matching the main YAMU app
- **📱 Smart App Detection**: Automatically detects if YAMU app is installed and offers deep linking
- **📊 Complete Data Export**: GDPR-compliant data export in JSON format
- **🗑️ Account Deletion**: Comprehensive account and data deletion matching app functionality
- **🌐 Web-based Access**: No app installation required for account management
- **📋 Data Summary**: Overview of user's YAMU data before export/deletion

## Live Demo

The portal is live at: `https://pathum1.github.io/yamu-account/`

## Google Play Compliance

This portal meets Google Play's account deletion requirements by providing:

1. ✅ **Outside-app deletion option**: Users can delete accounts without the app installed
2. ✅ **Complete data deletion**: All user data is permanently removed from all collections
3. ✅ **User-friendly interface**: Clear, accessible account management options
4. ✅ **Data export before deletion**: GDPR-compliant data portability

## Setup Instructions

### 1. Repository Setup

1. Create a new GitHub repository named `yamu-account` (or use existing repository)
2. Copy all files from this directory to the new repository
3. Enable GitHub Pages in repository settings:
   - Go to Settings → Pages
   - Source: Deploy from a branch
   - Branch: main / root
   - Save

### 2. Firebase Configuration

The portal uses your existing Firebase project (`yamu-app-1`). No additional setup required as it uses the web configuration already defined in your Flutter app.

### 3. App Store Integration

Update the Google Play Console with your account deletion URL:
- **Account deletion URL**: `https://pathum1.github.io/yamu-account/`
- **Data safety form**: Complete with this URL as the deletion option

### 4. Deep Linking (Optional Enhancement)

To enable deep linking from web to app, add this route handler to your Flutter app:

```dart
// In GitHubLinksService or similar
if (link.path.startsWith('/account/delete')) {
  // Navigate to account deletion screen in app
  NavigationService.navigatorKey.currentState?.pushNamed('/account-deletion');
}
```

## File Structure

```
yamu-account/
├── index.html              # Main account management interface
├── privacy.html            # Privacy policy page
├── css/
│   └── styles.css          # YAMU-branded styling
├── js/
│   ├── firebase-config.js  # Firebase web configuration
│   ├── auth.js            # Google authentication
│   ├── account-manager.js  # Data export/deletion logic
│   ├── app-detector.js     # App detection and deep linking
│   ├── utils.js           # Utility functions
│   └── main.js            # Application initialization
├── images/
│   └── yamu-logo.png      # YAMU logo (add your logo here)
└── README.md              # This file
```

## How It Works

### 1. App Detection Flow
```
User visits portal → Check if mobile device → Try deep link to app → 
If app opens: User uses app for deletion
If app doesn't open: Continue with web-based deletion
```

### 2. Authentication Flow
```
Web portal → Google Sign-In → Verify against Firebase Auth → 
Load user data summary → Present export/delete options
```

### 3. Data Export Process
```
User clicks Export → Fetch data from all Firestore collections → 
Sanitize Firestore Timestamps → Generate JSON file → Download
```

### 4. Account Deletion Process
```
User clicks Delete → Confirmation dialog → Type confirmation → 
Remove from trips → Handle owned trips → Delete all user data → 
Delete Firebase Auth account → Success confirmation
```

## Security Features

- **Firebase Authentication**: Uses same Google OAuth as the main app
- **No Data Storage**: Portal doesn't store any user data locally
- **HTTPS Only**: All communication encrypted
- **Confirmation Required**: Account deletion requires typed confirmation
- **Rate Limiting**: Firebase provides built-in rate limiting

## GDPR Compliance

- **Right to Access**: Complete data export functionality
- **Right to Portability**: Data provided in machine-readable JSON format
- **Right to Erasure**: Complete account and data deletion
- **Right to Rectification**: Users directed to main app for data updates
- **Transparency**: Clear privacy policy explaining all data processing

## Customization

### Branding
- Update `images/yamu-logo.png` with your actual logo
- Modify CSS variables in `styles.css` for color scheme
- Update contact information in privacy policy

### Firebase Project
- Update `js/firebase-config.js` if using different Firebase project
- Ensure Firestore security rules allow authenticated users to read/delete their own data

### App Store Links
- Update app store URLs in `app-detector.js` with your actual app store links
- Customize package names and App Store IDs

## Testing

### Local Testing
1. Serve files locally: `python -m http.server 8000`
2. Access at `http://localhost:8000`
3. Test authentication, export, and deletion flows

### Production Testing
1. Deploy to GitHub Pages
2. Test on multiple devices and browsers
3. Verify Firebase connections work
4. Test deep linking on mobile devices

## Browser Support

- **Chrome/Chromium**: Full support
- **Firefox**: Full support
- **Safari**: Full support
- **Edge**: Full support
- **Mobile browsers**: Optimized for mobile experience

## Troubleshooting

### Common Issues

1. **Firebase Connection Error**
   - Verify Firebase config in `firebase-config.js`
   - Check Firebase console for project status
   - Ensure web app is enabled in Firebase project

2. **Authentication Issues**
   - Verify OAuth configuration in Firebase console
   - Check authorized domains include your GitHub Pages domain
   - Ensure popup blockers are disabled

3. **Deep Linking Not Working**
   - Verify app handles `yamu://account/delete` scheme
   - Test on actual device, not emulator
   - Check app is installed and updated

4. **Data Export/Deletion Fails**
   - Check Firestore security rules
   - Verify user has proper permissions
   - Check browser console for detailed errors

## Monitoring

Monitor the portal's effectiveness through:
- GitHub Pages analytics
- Firebase Analytics (if enabled)
- User feedback through support channels
- Google Play Console data safety metrics

## Support

For issues with this portal:
- Technical issues: Check browser console for errors
- Firebase issues: Verify project configuration
- Feature requests: Update the portal code as needed

This portal provides a complete, compliant solution for Google Play's account deletion requirements while maintaining excellent user experience across all scenarios.
