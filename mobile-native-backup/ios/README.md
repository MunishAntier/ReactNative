# iOS Native Modules (Swift)

Designed for a production app target using:
- Keychain/Secure Enclave for private key material
- `libsignal-client` bridge for key/session/ratchet operations
- WebSocket + REST transport
- SQLCipher-backed local persistence for ciphertext/session metadata

## Contracts
- `AuthKit`: OTP auth and token rotation
- `SignalKitBridge`: key generation/session init/encrypt/decrypt
- `SocketTransport`: WS event send/receive/reconnect
- `SyncEngine`: offline sync and receipt reconciliation
- `LocalStore`: encrypted storage interface
- `PushManager`: APNs token registration and wake events

## App shell
- `SecureMsgDemoApp` + SwiftUI `ContentView`
- OTP request/verify
- key bootstrap upload
- websocket send/receive/acks
- sync and logout
- `prekeys.low` handling uploads one-time prekeys batch
- `session.identity_changed` handling invalidates affected local session state

## Crypto integration status
`SignalBridgeFactory` currently returns `PlainSignalProtocolBridge` as the default implementation.
The placeholder bridge now persists stable identity/prekey/session metadata locally and supports key bundle/session lifecycle hooks required by backend contracts.
Replace the factory target with a real `libsignal-client` bridge for production cryptography.
