# Secure E2EE Messaging App (Frontend-only)

Native mobile application UI for 1:1 encrypted messaging using the Signal protocol.

- This repo runs **without any backend/server**. All auth/chat data used in the UI is local/mock.
- Native mobile module skeletons live in `mobile/ios` and `mobile/android`.

## Features
- End-to-end encryption is performed on clients.
- Native clients include app-shell UI flows (Android + iOS) for OTP auth, key bootstrap, WS messaging, sync, and logout.
- Android now includes a real `libsignal-client` adapter path (with runtime fallback), while iOS still uses a placeholder `PlainSignal` bridge pending full native integration.

## Quick start
1. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run Metro bundler:
   ```bash
   npm start
   ```
4. Run iOS or Android:
   ```bash
   npm run ios
   # or
   npm run android
   ```
