import Foundation

struct StoredCipherMessage {
    let id: Int64
    let conversationID: Int64
    let senderID: Int64
    let receiverID: Int64
    let ciphertextB64: String
    let headerJSON: String
    let createdAt: Date
}

final class InMemoryEncryptedStore: EncryptedStore {
    private var messages: [StoredCipherMessage] = []
    private var syncDate: Date?
    private let lock = NSLock()

    func saveCiphertextMessage(id: Int64, conversationID: Int64, senderID: Int64, receiverID: Int64, ciphertextB64: String, headerJSON: String, createdAt: Date) throws {
        lock.lock()
        defer { lock.unlock() }
        guard messages.contains(where: { $0.id == id }) == false else {
            return
        }
        messages.append(
            StoredCipherMessage(
                id: id,
                conversationID: conversationID,
                senderID: senderID,
                receiverID: receiverID,
                ciphertextB64: ciphertextB64,
                headerJSON: headerJSON,
                createdAt: createdAt
            )
        )
    }

    func lastSyncTimestamp() throws -> Date? {
        lock.lock()
        defer { lock.unlock() }
        return syncDate
    }

    func setLastSyncTimestamp(_ date: Date) throws {
        lock.lock()
        defer { lock.unlock() }
        syncDate = date
    }

    func allMessages() -> [StoredCipherMessage] {
        lock.lock()
        defer { lock.unlock() }
        return messages
    }
}
