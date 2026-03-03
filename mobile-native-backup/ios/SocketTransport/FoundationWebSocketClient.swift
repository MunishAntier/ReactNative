import Foundation

final class FoundationWebSocketClient: NSObject, WebSocketClient {
    private let baseURL: URL
    private let session: URLSession
    private var task: URLSessionWebSocketTask?

    var onEvent: (([String: Any]) -> Void)?

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func connect(accessToken: String) {
        let wsURL = websocketURL(accessToken: accessToken)
        let task = session.webSocketTask(with: wsURL)
        self.task = task
        task.resume()
        receiveLoop()
    }

    func disconnect() {
        task?.cancel(with: .normalClosure, reason: nil)
        task = nil
    }

    func send(event: [String: Any]) throws {
        guard let task else {
            throw APIClientError.invalidResponse
        }
        let data = try JSONSerialization.data(withJSONObject: event)
        guard let json = String(data: data, encoding: .utf8) else {
            throw APIClientError.invalidResponse
        }
        task.send(.string(json)) { error in
            if let error {
                print("WebSocket send failed: \(error)")
            }
        }
    }

    private func receiveLoop() {
        task?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let error):
                print("WebSocket receive failed: \(error)")
            case .success(let message):
                switch message {
                case .string(let text):
                    self.forwardJSON(text: text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.forwardJSON(text: text)
                    }
                @unknown default:
                    break
                }
                self.receiveLoop()
            }
        }
    }

    private func forwardJSON(text: String) {
        guard let data = text.data(using: .utf8) else {
            return
        }
        guard let object = try? JSONSerialization.jsonObject(with: data),
              let event = object as? [String: Any] else {
            return
        }
        onEvent?(event)
    }

    private func websocketURL(accessToken: String) -> URL {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) ?? URLComponents()
        if components.scheme == "https" {
            components.scheme = "wss"
        } else {
            components.scheme = "ws"
        }
        let path = components.path.hasSuffix("/") ? components.path : components.path + "/"
        components.path = path + "v1/ws"
        components.queryItems = [URLQueryItem(name: "token", value: accessToken)]
        return components.url ?? baseURL
    }
}
