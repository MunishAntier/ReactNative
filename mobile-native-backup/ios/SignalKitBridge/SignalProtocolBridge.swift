import Foundation

struct PreKeyPublic: Codable {
    let preKeyID: Int64
    let preKeyPublic: String

    enum CodingKeys: String, CodingKey {
        case preKeyID = "prekey_id"
        case preKeyPublic = "prekey_public"
    }
}

struct KeyBundleUpload: Codable {
    let registrationID: Int
    let identityPublicKey: String
    let identityKeyVersion: Int
    let signedPreKeyID: Int64
    let signedPreKeyPublic: String
    let signedPreKeySignature: String
    let signedPreKeyExpiresAt: String
    let oneTimePreKeys: [PreKeyPublic]

    enum CodingKeys: String, CodingKey {
        case registrationID = "registration_id"
        case identityPublicKey = "identity_public_key"
        case identityKeyVersion = "identity_key_version"
        case signedPreKeyID = "signed_prekey_id"
        case signedPreKeyPublic = "signed_prekey_public"
        case signedPreKeySignature = "signed_prekey_signature"
        case signedPreKeyExpiresAt = "signed_prekey_expires_at"
        case oneTimePreKeys = "one_time_prekeys"
    }
}

protocol SignalProtocolBridge {
    func generateInitialBundle(oneTimePreKeyCount: Int) throws -> KeyBundleUpload
    func generateOneTimePreKeys(count: Int) throws -> [PreKeyPublic]
    func rotateSignedPreKey() throws -> (signedPreKeyID: Int64, signedPreKeyPublic: String, signature: String, expiresAt: String)
    func initializeSession(peerUserID: Int64, bundle: PeerKeyBundle) throws
    func invalidateSession(peerUserID: Int64)
    func hasSession(peerUserID: Int64) -> Bool
    func encrypt(plaintext: Data, peerUserID: Int64) throws -> (ciphertextB64: String, header: [String: Any])
    func decrypt(ciphertextB64: String, header: [String: Any], senderUserID: Int64) throws -> Data
}
