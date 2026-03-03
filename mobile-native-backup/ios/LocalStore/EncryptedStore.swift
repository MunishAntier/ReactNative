import Foundation

protocol EncryptedStore {
    func saveCiphertextMessage(id: Int64, conversationID: Int64, senderID: Int64, receiverID: Int64, ciphertextB64: String, headerJSON: String, createdAt: Date) throws
    func lastSyncTimestamp() throws -> Date?
    func setLastSyncTimestamp(_ date: Date) throws
}
