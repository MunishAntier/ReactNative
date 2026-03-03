import Foundation

protocol SyncEngine {
    func syncSince(_ since: Date) async throws
    func markRead(messageID: Int64) async throws
}
