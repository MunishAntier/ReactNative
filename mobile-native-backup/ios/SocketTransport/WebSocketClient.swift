import Foundation

protocol WebSocketClient {
    func connect(accessToken: String)
    func disconnect()
    func send(event: [String: Any]) throws
    var onEvent: (([String: Any]) -> Void)? { get set }
}
