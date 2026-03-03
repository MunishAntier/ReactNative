import Foundation

protocol PushManager {
    func registerForPushNotifications() async throws -> String
    func handleIncomingPush(payload: [AnyHashable: Any])
}
