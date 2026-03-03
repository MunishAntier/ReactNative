# Android Native Scaffolds (Kotlin)

Starter package interfaces for:
- OTP auth + token refresh
- Signal protocol bridge (`libsignal-client` integration point)
- WebSocket transport
- Sync worker (WorkManager)
- Encrypted local storage
- FCM push manager

This module now includes a runnable app shell:
- `com.securemsg.app.MainActivity`
- OTP request/verify flow
- key bootstrap upload
- websocket connect/send/receive/acks
- offline sync and logout
- on `prekeys.low`, uploads additional one-time prekeys without resetting identity keys
- auto-selects `libsignal-client` adapter when available, with runtime fallback to plain adapter if native loading fails

## Backend URL
`BuildConfig.BACKEND_BASE_URL` defaults to `http://10.0.2.2:8080/` for Android emulator.

## Crypto integration status
- `com.securemsg.signal.libsignal.LibsignalSignalModule` is the default adapter and uses real Signal protocol primitives (`SessionBuilder`/`SessionCipher`) via `org.signal:libsignal-client`.
- Persistent Signal store state is backed by SharedPreferences in `PersistentSignalProtocolStore` for install-local continuity.
- `com.securemsg.app.PlainSignalModule` remains as safety fallback for environments where native libsignal loading is unavailable.
