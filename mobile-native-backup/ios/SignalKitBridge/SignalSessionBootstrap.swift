import Foundation

struct PeerKeyBundle: Codable {
    let userID: Int64
    let deviceID: Int64
    let registrationID: Int
    let identityPublicKey: String
    let identityKeyVersion: Int
    let signedPreKeyID: Int64
    let signedPreKeyPublic: String
    let signedPreKeySignature: String
    let oneTimePreKeyID: Int64
    let oneTimePreKeyPublic: String

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case deviceID = "device_id"
        case registrationID = "registration_id"
        case identityPublicKey = "identity_public_key"
        case identityKeyVersion = "identity_key_version"
        case signedPreKeyID = "signed_prekey_id"
        case signedPreKeyPublic = "signed_prekey_public"
        case signedPreKeySignature = "signed_prekey_signature"
        case oneTimePreKeyID = "one_time_prekey_id"
        case oneTimePreKeyPublic = "one_time_prekey_public"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        userID = try container.decode(Int64.self, forKey: .userID)
        deviceID = try container.decode(Int64.self, forKey: .deviceID)
        registrationID = try container.decodeIfPresent(Int.self, forKey: .registrationID) ?? 1
        identityPublicKey = try container.decode(String.self, forKey: .identityPublicKey)
        identityKeyVersion = try container.decode(Int.self, forKey: .identityKeyVersion)
        signedPreKeyID = try container.decode(Int64.self, forKey: .signedPreKeyID)
        signedPreKeyPublic = try container.decode(String.self, forKey: .signedPreKeyPublic)
        signedPreKeySignature = try container.decode(String.self, forKey: .signedPreKeySignature)
        oneTimePreKeyID = try container.decode(Int64.self, forKey: .oneTimePreKeyID)
        oneTimePreKeyPublic = try container.decode(String.self, forKey: .oneTimePreKeyPublic)
    }
}

final class SignalSessionBootstrap {
    private let bridge: SignalProtocolBridge
    private let config: BackendAPIConfiguration

    init(bridge: SignalProtocolBridge, config: BackendAPIConfiguration) {
        self.bridge = bridge
        self.config = config
    }

    func uploadInitialBundle(accessToken: String) async throws {
        let bundle = try bridge.generateInitialBundle(oneTimePreKeyCount: 100)
        try await post(path: "v1/keys/upload", body: bundle, accessToken: accessToken)
    }

    func uploadOneTimePreKeys(accessToken: String, oneTimePreKeys: [PreKeyPublic]) async throws {
        let body = UploadOneTimePreKeysRequest(oneTimePreKeys: oneTimePreKeys)
        try await post(path: "v1/keys/one-time-prekeys/upload", body: body, accessToken: accessToken)
    }

    func rotateSignedPreKey(accessToken: String) async throws {
        let rotated = try bridge.rotateSignedPreKey()
        let body = SignedPreKeyRotateRequest(
            signedPreKeyID: rotated.signedPreKeyID,
            signedPreKeyPublic: rotated.signedPreKeyPublic,
            signedPreKeySignature: rotated.signature,
            signedPreKeyExpiresAt: rotated.expiresAt
        )
        try await post(path: "v1/keys/signed-prekey/rotate", body: body, accessToken: accessToken)
    }

    func fetchPeerBundle(userID: Int64, accessToken: String) async throws -> PeerKeyBundle {
        let url = config.baseURL.appendingPathComponent("v1/keys/\(userID)")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await config.session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw APIClientError.invalidResponse
        }
        return try JSONDecoder().decode(PeerKeyBundle.self, from: data)
    }

    private func post<T: Encodable>(path: String, body: T, accessToken: String) async throws {
        let url = config.baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(body)

        let (_, response) = try await config.session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw APIClientError.invalidResponse
        }
    }
}

private struct SignedPreKeyRotateRequest: Encodable {
    let signedPreKeyID: Int64
    let signedPreKeyPublic: String
    let signedPreKeySignature: String
    let signedPreKeyExpiresAt: String

    enum CodingKeys: String, CodingKey {
        case signedPreKeyID = "signed_prekey_id"
        case signedPreKeyPublic = "signed_prekey_public"
        case signedPreKeySignature = "signed_prekey_signature"
        case signedPreKeyExpiresAt = "signed_prekey_expires_at"
    }
}

private struct UploadOneTimePreKeysRequest: Encodable {
    let oneTimePreKeys: [PreKeyPublic]

    enum CodingKeys: String, CodingKey {
        case oneTimePreKeys = "one_time_prekeys"
    }
}
