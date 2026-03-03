# Mobile Client Scaffolds

This repo includes native module scaffolds for both platforms aligned to backend contracts.

## iOS modules
- `AuthKit`
- `SignalKitBridge`
- `SocketTransport`
- `SyncEngine`
- `LocalStore`
- `PushManager`

## Android modules/packages
- `auth`
- `signal`
- `ws`
- `sync`
- `storage`
- `push`

Implemented concrete transport/bootstrap components:
- iOS: `URLSessionAuthService`, `FoundationWebSocketClient`, `APISyncEngineImpl`, `SignalSessionBootstrap`
- Android: `HttpAuthModule`, `OkHttpWsClient`, `ApiSyncWorker`, `SignalSessionBootstrap`

This repo now includes minimal full app shells for both platforms:
- Android: `MainActivity` UI flow with OTP auth, key upload, websocket send/receive, offline sync, logout.
- iOS: SwiftUI `SecureMsgDemoApp` with equivalent flow.

Crypto note:
- Android uses `libsignal-client` by default (with a safe fallback to `PlainSignalModule` when native loading is unavailable).
- iOS uses a lifecycle-complete placeholder bridge via `SignalBridgeFactory`; full `libsignal-client` bridge remains pending for production guarantees.
