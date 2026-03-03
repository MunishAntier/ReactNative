import Foundation

struct DemoAppBootstrap {
    let authService: AuthService
    let wsClient: WebSocketClient
    let signalBootstrap: SignalSessionBootstrap
    let syncEngine: SyncEngine

    static func make(baseURL: URL, encryptedStore: EncryptedStore, tokenProvider: @escaping () async throws -> String, signalBridge: SignalProtocolBridge) -> DemoAppBootstrap {
        let config = BackendAPIConfiguration(baseURL: baseURL)
        return DemoAppBootstrap(
            authService: URLSessionAuthService(config: config),
            wsClient: FoundationWebSocketClient(baseURL: baseURL),
            signalBootstrap: SignalSessionBootstrap(bridge: signalBridge, config: config),
            syncEngine: APISyncEngineImpl(config: config, store: encryptedStore, accessTokenProvider: tokenProvider)
        )
    }
}
