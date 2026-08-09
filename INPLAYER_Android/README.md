# INPLAYER Android App

A fully-featured Flutter Android application that replicates the INPLAYER mobile website experience.

## Features Implemented

### Core Features
- ✅ Authentication system with AWS Cognito (Sign In, Sign Up, Email Verification)
- ✅ Home screen with video feed and recommendations
- ✅ Video player with HLS streaming support (Mux integration)
- ✅ Shorts (Raftaar) feature with vertical video support
- ✅ Search functionality
- ✅ Channel pages and profiles
- ✅ Subscriptions management
- ✅ User profile with settings
- ✅ Upload interface (placeholder for video/short uploads)
- ✅ Creator Studio dashboard
- ✅ Messages interface
- ✅ Settings and preferences
- ✅ Bottom navigation with mobile-first design

### Technical Architecture
- **State Management**: Flutter Riverpod
- **Routing**: GoRouter with authentication guards
- **Networking**: Dio with interceptors for auth tokens
- **Authentication**: AWS Amplify Cognito
- **Video Player**: Video Player with HLS support
- **Image Caching**: Cached Network Image
- **Secure Storage**: Flutter Secure Storage for tokens

## Project Structure

```
lib/
├── core/
│   ├── config/          # App configuration
│   ├── constants/       # API constants
│   ├── network/         # Dio client setup
│   ├── router/          # App routing
│   ├── storage/         # Local storage helpers
│   ├── theme/           # App theming
│   └── utils/           # Utility functions
├── features/
│   ├── auth/            # Authentication flow
│   ├── home/            # Home feed and recommendations
│   ├── shorts/          # Shorts (Raftaar) feature
│   ├── watch/           # Video player and watch page
│   ├── search/          # Search functionality
│   ├── channel/         # Channel pages
│   ├── subscriptions/   # Subscriptions management
│   ├── profile/         # User profile
│   ├── upload/          # Upload interface
│   ├── creator_studio/  # Creator dashboard
│   ├── messages/        # Messaging system
│   └── settings/        # App settings
├── models/              # Data models
├── providers/           # Riverpod providers
├── repositories/        # Data repositories
├── services/            # API services
└── shared/              # Shared widgets and utilities
```

## Setup Instructions

### Prerequisites
- Flutter SDK (3.12.2 or higher)
- Dart SDK
- Android Studio / VS Code with Flutter extensions
- AWS Cognito User Pool configured

### Configuration

1. **Update AWS Cognito Configuration**
   Edit `lib/core/config/app_config.dart`:
   ```dart
   static const String cognitoUserPoolId = 'your-user-pool-id';
   static const String cognitoUserPoolClientId = 'your-client-id';
   static const String cognitoRegion = 'your-region';
   ```

2. **Update API Base URL**
   Edit `lib/core/config/app_config.dart`:
   ```dart
   static const String apiBaseUrl = 'https://your-api-url.com';
   ```

3. **Install Dependencies**
   ```bash
   flutter pub get
   ```

4. **Run the App**
   ```bash
   flutter run
   ```

## Features Overview

### Authentication
- Email/password sign in and sign up
- Email verification flow
- Password reset functionality
- Secure token storage
- Session management

### Home Feed
- Video grid with thumbnails
- Video cards with metadata (views, duration, creator)
- Horizontal/vertical view toggle
- Pull-to-refresh support
- Infinite scroll (to be implemented)

### Video Player
- HLS streaming support via Mux
- Play/pause controls
- Full-screen support
- Video info display
- Subscribe button integration

### Shorts (Raftaar)
- Vertical video format (9:16)
- Swipe-based navigation (to be implemented)
- Soundtrack support
- Short-specific metadata

### Search
- Real-time search
- Video and channel search
- Search history (to be implemented)

### Channels
- Channel profile pages
- Subscribe/unsubscribe functionality
- Channel video listings
- Subscriber counts

### Profile
- User profile display
- Edit profile (to be implemented)
- My videos, liked videos, playlists
- Watch history
- Settings access

### Creator Studio
- Dashboard with analytics
- Video management
- Comment moderation
- Revenue tracking (to be implemented)
- Admin panel integration

## API Integration

The app is designed to work with the existing INPLAYER backend:

- **Authentication**: AWS Cognito
- **Videos**: DynamoDB with Mux streaming
- **Subscriptions**: Backend API
- **Search**: Backend search API
- **Upload**: Backend upload endpoints

## Admin Panel Integration

The app includes routes and placeholders for admin panel integration:
- `/creator-studio` - Creator dashboard
- Admin panel link in settings
- Admin-only features and routes

## TODO / Future Enhancements

### High Priority
- [ ] Implement actual video upload functionality
- [ ] Add pull-to-refresh on home feed
- [ ] Implement swipe navigation for shorts
- [ ] Add video download feature
- [ ] Implement push notifications
- [ ] Add comment section to watch page

### Medium Priority
- [ ] Implement watch history tracking
- [ ] Add playlist creation and management
- [ ] Implement video recommendations
- [ ] Add offline mode support
- [ ] Implement video quality selection
- [ ] Add captions/subtitles support

### Low Priority
- [ ] Add picture-in-picture mode
- [ ] Implement video sharing
- [ ] Add report video functionality
- [ ] Implement video chapters
- [ ] Add mini player for background playback

## Testing

To test the app:

1. Run unit tests:
   ```bash
   flutter test
   ```

2. Run integration tests:
   ```bash
   flutter test integration_test/
   ```

## Building for Production

### Android
```bash
flutter build apk --release
```

### App Bundle (Play Store)
```bash
flutter build appbundle --release
```

## Troubleshooting

### Build Issues
- Ensure Flutter SDK is up to date
- Run `flutter clean` and `flutter pub get`
- Check Android SDK versions

### Authentication Issues
- Verify AWS Cognito configuration
- Check network connectivity
- Ensure user pool is active

### Video Playback Issues
- Verify Mux playback IDs are valid
- Check network connectivity
- Ensure video player dependencies are installed

## Contributing

This is the INPLAYER Android app repository. All changes should be made in the `InPlayer_Android` folder only. Do not modify files in the parent `InPlayer` folder.

## License

Proprietary - INPLAYER