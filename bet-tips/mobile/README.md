# Bet Tips — Mobile

Expo React Native app for end users.

## Phase 1 scope

- Sign up with Sportsbet username + one-time invite code
- Tokens persisted in `expo-secure-store` (iOS Keychain / Android Keystore)
- Auto refresh of access tokens; user stays logged in
- Placeholder home screen (camera + editor land in Phase 2)

## Setup

```bash
cd bet-tips/mobile
npm install
# edit app.json > expo.extra.apiUrl to point at the deployed API Gateway URL
npm start
# then press i / a / w for iOS simulator, Android, or web
```

## Notes

- Target Expo SDK 51.
- When you add native modules for Phase 2 (camera, ffmpeg, media picker),
  you will need to move to a development build (`npx expo prebuild` + EAS build).
