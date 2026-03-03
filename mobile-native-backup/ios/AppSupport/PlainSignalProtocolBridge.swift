import Foundation

final class PlainSignalProtocolBridge: SignalProtocolBridge {
    private let defaults = UserDefaults.standard
    private var knownSessions: [Int64: Int] = [:]
    private var pendingOneTimePreKeys: [Int64: Int64] = [:]
    private var messageCounters: [Int64: Int] = [:]

    init() {
        knownSessions = decodeMapInt64Int(defaults.dictionary(forKey: Self.knownSessionsKey))
        pendingOneTimePreKeys = decodeMapInt64Int64(defaults.dictionary(forKey: Self.pendingPreKeysKey))
        messageCounters = decodeMapInt64Int(defaults.dictionary(forKey: Self.messageCountersKey))
    }

    func generateInitialBundle(oneTimePreKeyCount: Int) throws -> KeyBundleUpload {
        let registrationID = ensureRegistrationID()
        let identityPublicKey = ensureIdentityPublicKey()
        let identityKeyVersion = max(defaults.integer(forKey: Self.identityKeyVersionKey), 1)
        let signed = ensureSignedPreKey(forceRotate: false)
        let prekeys = try generateOneTimePreKeys(count: oneTimePreKeyCount)

        return KeyBundleUpload(
            registrationID: registrationID,
            identityPublicKey: identityPublicKey,
            identityKeyVersion: identityKeyVersion,
            signedPreKeyID: signed.id,
            signedPreKeyPublic: signed.publicKey,
            signedPreKeySignature: signed.signature,
            signedPreKeyExpiresAt: signed.expiresAt,
            oneTimePreKeys: prekeys
        )
    }

    func generateOneTimePreKeys(count: Int) throws -> [PreKeyPublic] {
        let safeCount = max(count, 1)
        let startID = max(defaults.integer(forKey: Self.nextPreKeyIDKey), 1)
        defaults.set(startID + safeCount, forKey: Self.nextPreKeyIDKey)

        return (0..<safeCount).map { offset in
            let preKeyID = Int64(startID + offset)
            return PreKeyPublic(
                preKeyID: preKeyID,
                preKeyPublic: "otpk-\(preKeyID)-\(UUID().uuidString)"
            )
        }
    }

    func rotateSignedPreKey() throws -> (signedPreKeyID: Int64, signedPreKeyPublic: String, signature: String, expiresAt: String) {
        let rotated = ensureSignedPreKey(forceRotate: true)
        return (
            rotated.id,
            rotated.publicKey,
            rotated.signature,
            rotated.expiresAt
        )
    }

    func initializeSession(peerUserID: Int64, bundle: PeerKeyBundle) throws {
        knownSessions[peerUserID] = max(bundle.identityKeyVersion, 1)
        pendingOneTimePreKeys[peerUserID] = bundle.oneTimePreKeyID
        persistSessionState()
    }

    func invalidateSession(peerUserID: Int64) {
        knownSessions.removeValue(forKey: peerUserID)
        pendingOneTimePreKeys.removeValue(forKey: peerUserID)
        messageCounters.removeValue(forKey: peerUserID)
        persistSessionState()
    }

    func hasSession(peerUserID: Int64) -> Bool {
        knownSessions[peerUserID] != nil
    }

    func encrypt(plaintext: Data, peerUserID: Int64) throws -> (ciphertextB64: String, header: [String: Any]) {
        guard let sessionVersion = knownSessions[peerUserID] else {
            throw APIClientError.invalidResponse
        }
        let ciphertextB64 = plaintext.base64EncodedString()
        let nextIndex = (messageCounters[peerUserID] ?? 0) + 1
        messageCounters[peerUserID] = nextIndex
        let reservedPreKeyID = pendingOneTimePreKeys.removeValue(forKey: peerUserID) ?? 0
        persistSessionState()

        let header: [String: Any] = [
            "session_version": sessionVersion,
            "sender_identity_pub_b64": ensureIdentityPublicKey(),
            "sender_ephemeral_pub_b64": "plain-ephemeral-\(UUID().uuidString)",
            "receiver_one_time_prekey_id": reservedPreKeyID,
            "ratchet_pub_b64": "plain-ratchet-\(UUID().uuidString)",
            "message_index": nextIndex
        ]
        return (ciphertextB64, header)
    }

    func decrypt(ciphertextB64: String, header: [String: Any], senderUserID: Int64) throws -> Data {
        knownSessions[senderUserID] = max(knownSessions[senderUserID] ?? 1, 1)
        persistSessionState()
        guard let decoded = Data(base64Encoded: ciphertextB64) else {
            throw APIClientError.invalidResponse
        }
        return decoded
    }

    private func ensureRegistrationID() -> Int {
        let existing = defaults.integer(forKey: Self.registrationIDKey)
        if existing > 0 {
            return existing
        }
        let generated = Int.random(in: 1..<16380)
        defaults.set(generated, forKey: Self.registrationIDKey)
        return generated
    }

    private func ensureIdentityPublicKey() -> String {
        if let existing = defaults.string(forKey: Self.identityPublicKeyKey), existing.isEmpty == false {
            return existing
        }
        let generated = "identity-\(UUID().uuidString)"
        defaults.set(generated, forKey: Self.identityPublicKeyKey)
        if defaults.integer(forKey: Self.identityKeyVersionKey) <= 0 {
            defaults.set(1, forKey: Self.identityKeyVersionKey)
        }
        return generated
    }

    private func ensureSignedPreKey(forceRotate: Bool) -> SignedPreKeyMaterial {
        let now = Date()
        let existingID = defaults.integer(forKey: Self.currentSignedPreKeyIDKey)
        let existingPublic = defaults.string(forKey: Self.currentSignedPreKeyPublicKey)
        let existingSignature = defaults.string(forKey: Self.currentSignedPreKeySignatureKey)
        let existingExpires = defaults.string(forKey: Self.currentSignedPreKeyExpiresAtKey)
        let validExpires = existingExpires.flatMap(isoFormatter.date(from:))
        let stillValid = forceRotate == false &&
            existingID > 0 &&
            (existingPublic?.isEmpty == false) &&
            (existingSignature?.isEmpty == false) &&
            ((validExpires?.timeIntervalSince(now) ?? 0) > 0)

        if stillValid, let existingPublic, let existingSignature, let existingExpires {
            return SignedPreKeyMaterial(
                id: Int64(existingID),
                publicKey: existingPublic,
                signature: existingSignature,
                expiresAt: existingExpires
            )
        }

        let nextID = max(defaults.integer(forKey: Self.nextSignedPreKeyIDKey), 1)
        let nextPublic = "spk-\(UUID().uuidString)"
        let nextSignature = "sig-\(UUID().uuidString)"
        let nextExpires = isoFormatter.string(from: now.addingTimeInterval(30 * 24 * 3600))
        defaults.set(nextID, forKey: Self.currentSignedPreKeyIDKey)
        defaults.set(nextPublic, forKey: Self.currentSignedPreKeyPublicKey)
        defaults.set(nextSignature, forKey: Self.currentSignedPreKeySignatureKey)
        defaults.set(nextExpires, forKey: Self.currentSignedPreKeyExpiresAtKey)
        defaults.set(nextID + 1, forKey: Self.nextSignedPreKeyIDKey)

        return SignedPreKeyMaterial(
            id: Int64(nextID),
            publicKey: nextPublic,
            signature: nextSignature,
            expiresAt: nextExpires
        )
    }

    private func persistSessionState() {
        defaults.set(encodeMapInt64Int(knownSessions), forKey: Self.knownSessionsKey)
        defaults.set(encodeMapInt64Int64(pendingOneTimePreKeys), forKey: Self.pendingPreKeysKey)
        defaults.set(encodeMapInt64Int(messageCounters), forKey: Self.messageCountersKey)
    }

    private func encodeMapInt64Int(_ map: [Int64: Int]) -> [String: Int] {
        Dictionary(uniqueKeysWithValues: map.map { (String($0.key), $0.value) })
    }

    private func decodeMapInt64Int(_ raw: [String: Any]?) -> [Int64: Int] {
        guard let raw else { return [:] }
        var output: [Int64: Int] = [:]
        for (key, value) in raw {
            guard let intKey = Int64(key) else { continue }
            if let number = value as? NSNumber {
                output[intKey] = number.intValue
            } else if let intValue = value as? Int {
                output[intKey] = intValue
            }
        }
        return output
    }

    private func encodeMapInt64Int64(_ map: [Int64: Int64]) -> [String: Int64] {
        Dictionary(uniqueKeysWithValues: map.map { (String($0.key), $0.value) })
    }

    private func decodeMapInt64Int64(_ raw: [String: Any]?) -> [Int64: Int64] {
        guard let raw else { return [:] }
        var output: [Int64: Int64] = [:]
        for (key, value) in raw {
            guard let intKey = Int64(key) else { continue }
            if let number = value as? NSNumber {
                output[intKey] = number.int64Value
            } else if let intValue = value as? Int64 {
                output[intKey] = intValue
            } else if let intValue = value as? Int {
                output[intKey] = Int64(intValue)
            }
        }
        return output
    }

    private let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private struct SignedPreKeyMaterial {
        let id: Int64
        let publicKey: String
        let signature: String
        let expiresAt: String
    }

    private static let registrationIDKey = "securemsg.signal.registration_id"
    private static let identityPublicKeyKey = "securemsg.signal.identity_public"
    private static let identityKeyVersionKey = "securemsg.signal.identity_version"
    private static let nextPreKeyIDKey = "securemsg.signal.next_prekey_id"
    private static let nextSignedPreKeyIDKey = "securemsg.signal.next_signed_prekey_id"
    private static let currentSignedPreKeyIDKey = "securemsg.signal.current_signed_prekey_id"
    private static let currentSignedPreKeyPublicKey = "securemsg.signal.current_signed_prekey_public"
    private static let currentSignedPreKeySignatureKey = "securemsg.signal.current_signed_prekey_signature"
    private static let currentSignedPreKeyExpiresAtKey = "securemsg.signal.current_signed_prekey_expires_at"
    private static let knownSessionsKey = "securemsg.signal.known_sessions"
    private static let pendingPreKeysKey = "securemsg.signal.pending_prekeys"
    private static let messageCountersKey = "securemsg.signal.message_counters"
}
