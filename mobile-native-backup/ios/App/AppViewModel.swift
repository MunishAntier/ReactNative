import Foundation

@MainActor
final class AppViewModel: ObservableObject {
    @Published var identifier = ""
    @Published var otp = ""
    @Published var receiverUserIDText = ""
    @Published var messageText = ""
    @Published var status = "Not authenticated"
    @Published var logs: [String] = []
    @Published var isAuthenticated = false

    private let authService: AuthService
    private let wsClient: WebSocketClient
    private let syncEngine: SyncEngine
    private let signalBootstrap: SignalSessionBootstrap
    private let signalBridge: SignalProtocolBridge
    private let store: InMemoryEncryptedStore
    private let tokenVault: TokenVault

    init(baseURL: URL) {
        self.tokenVault = TokenVault()
        self.store = InMemoryEncryptedStore()
        let bridgeSelection = SignalBridgeFactory.make()
        self.signalBridge = bridgeSelection.bridge
        self.logs = ["Signal bridge: \(bridgeSelection.implementation)"]

        let config = BackendAPIConfiguration(baseURL: baseURL)
        self.authService = URLSessionAuthService(config: config)
        self.wsClient = FoundationWebSocketClient(baseURL: baseURL)
        self.signalBootstrap = SignalSessionBootstrap(bridge: signalBridge, config: config)
        self.syncEngine = APISyncEngineImpl(config: config, store: store) { [weak tokenVault] in
            guard let token = tokenVault?.accessToken(), token.isEmpty == false else {
                throw APIClientError.unauthorized
            }
            return token
        }

        self.wsClient.onEvent = { [weak self] event in
            Task { @MainActor in
                await self?.handleWebSocket(event: event)
            }
        }

        if tokenVault.isAuthenticated(), let token = tokenVault.accessToken() {
            status = "Authenticated user=\(tokenVault.userID())"
            isAuthenticated = true
            wsClient.connect(accessToken: token)
        }
    }

    func requestOTP() async {
        do {
            try await authService.startOTP(identifier: identifier, purpose: "login")
            appendLog("OTP requested for \(identifier)")
        } catch {
            appendLog("OTP request failed: \(error.localizedDescription)")
        }
    }

    func verifyOTPAndLogin() async {
        do {
            let tokens = try await authService.verifyOTP(
                identifier: identifier,
                otp: otp,
                deviceUUID: "ios-\(UUID().uuidString)",
                platform: "ios",
                pushToken: nil
            )
            tokenVault.save(tokens)
            try await signalBootstrap.uploadInitialBundle(accessToken: tokens.accessToken)
            wsClient.connect(accessToken: tokens.accessToken)

            isAuthenticated = true
            status = "Authenticated user=\(tokens.userID)"
            appendLog("Login success user=\(tokens.userID)")
        } catch {
            appendLog("Login failed: \(error.localizedDescription)")
        }
    }

    func sendMessage() async {
        guard let receiverID = Int64(receiverUserIDText), receiverID > 0 else {
            appendLog("Invalid receiver user id")
            return
        }
        guard let token = tokenVault.accessToken(), token.isEmpty == false else {
            appendLog("Not authenticated")
            return
        }
        do {
            if signalBridge.hasSession(peerUserID: receiverID) == false {
                let bundle = try await signalBootstrap.fetchPeerBundle(userID: receiverID, accessToken: token)
                try signalBridge.initializeSession(peerUserID: receiverID, bundle: bundle)
                appendLog("Session created with receiver=\(receiverID)")
            }

            let encrypted = try signalBridge.encrypt(plaintext: Data(messageText.utf8), peerUserID: receiverID)
            let event: [String: Any] = [
                "type": "message.send",
                "client_message_id": UUID().uuidString,
                "receiver_user_id": receiverID,
                "ciphertext_b64": encrypted.ciphertextB64,
                "header": encrypted.header,
                "sent_at_client": ISO8601DateFormatter().string(from: Date())
            ]
            try wsClient.send(event: event)
            appendLog("Sent message to \(receiverID)")
            messageText = ""
        } catch {
            appendLog("Send failed: \(error.localizedDescription)")
        }
    }

    func syncNow() async {
        do {
            let since = (try store.lastSyncTimestamp()) ?? Date(timeIntervalSince1970: 0)
            try await syncEngine.syncSince(since)
            appendLog("Synced messages. local_count=\(store.allMessages().count)")
        } catch {
            appendLog("Sync failed: \(error.localizedDescription)")
        }
    }

    func logout() async {
        guard let token = tokenVault.accessToken(), token.isEmpty == false else {
            return
        }
        _ = try? await authService.logout(accessToken: token)
        wsClient.disconnect()
        tokenVault.clear()
        isAuthenticated = false
        status = "Not authenticated"
        appendLog("Logged out")
    }

    private func handleWebSocket(event: [String: Any]) async {
        let type = event["type"] as? String ?? "unknown"
        switch type {
        case "message.new":
            let senderID = asInt64(event["sender_user_id"])
            let messageID = asInt64(event["server_message_id"])
            let conversationID = asInt64(event["conversation_id"])
            let ciphertext = event["ciphertext_b64"] as? String ?? ""
            let header = event["header"] as? [String: Any] ?? [:]

            let decrypted: String
            if let data = try? signalBridge.decrypt(ciphertextB64: ciphertext, header: header, senderUserID: senderID),
               let text = String(data: data, encoding: .utf8) {
                decrypted = text
            } else {
                decrypted = "<decrypt failed>"
            }

            let headerData = try? JSONSerialization.data(withJSONObject: header)
            let headerJSON = headerData.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
            try? store.saveCiphertextMessage(
                id: messageID,
                conversationID: conversationID,
                senderID: senderID,
                receiverID: tokenVault.userID(),
                ciphertextB64: ciphertext,
                headerJSON: headerJSON,
                createdAt: Date()
            )

            appendLog("message.new from=\(senderID) text=\(decrypted)")
            try? wsClient.send(event: ["type": "message.ack.delivered", "server_message_id": messageID])
            try? wsClient.send(event: ["type": "message.ack.read", "server_message_id": messageID])

        case "message.status":
            appendLog("message.status \(event)")

        case "prekeys.low":
            do {
                let morePrekeys = try signalBridge.generateOneTimePreKeys(count: 100)
                guard let token = tokenVault.accessToken(), token.isEmpty == false else {
                    appendLog("prekeys.low ignored: not authenticated")
                    return
                }
                try await signalBootstrap.uploadOneTimePreKeys(accessToken: token, oneTimePreKeys: morePrekeys)
                appendLog("prekeys.low handled: uploaded \(morePrekeys.count)")
            } catch {
                appendLog("prekeys.low upload failed: \(error.localizedDescription)")
            }

        case "session.identity_changed":
            let changedUserID = asInt64(event["changed_user_id"])
            if changedUserID > 0 {
                signalBridge.invalidateSession(peerUserID: changedUserID)
            }
            appendLog("session.identity_changed \(event)")

        default:
            appendLog("ws \(event)")
        }
    }

    private func asInt64(_ value: Any?) -> Int64 {
        switch value {
        case let v as Int64:
            return v
        case let v as Int:
            return Int64(v)
        case let v as Double:
            return Int64(v)
        case let v as String:
            return Int64(v) ?? 0
        default:
            return 0
        }
    }

    private func appendLog(_ line: String) {
        logs.append(line)
    }
}
