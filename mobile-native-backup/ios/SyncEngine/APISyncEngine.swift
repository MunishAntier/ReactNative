import Foundation

final class APISyncEngineImpl: SyncEngine {
    private let config: BackendAPIConfiguration
    private let store: EncryptedStore
    private let accessTokenProvider: () async throws -> String

    init(
        config: BackendAPIConfiguration,
        store: EncryptedStore,
        accessTokenProvider: @escaping () async throws -> String
    ) {
        self.config = config
        self.store = store
        self.accessTokenProvider = accessTokenProvider
    }

    func syncSince(_ since: Date) async throws {
        let token = try await accessTokenProvider()
        var components = URLComponents(url: config.baseURL.appendingPathComponent("v1/messages/sync"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "since", value: ISO8601DateFormatter().string(from: since)),
            URLQueryItem(name: "limit", value: "100")
        ]
        guard let url = components?.url else {
            throw APIClientError.invalidResponse
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await config.session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw APIClientError.invalidResponse
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let payload = try decoder.decode(SyncResponse.self, from: data)
        for item in payload.items {
            let headerData = try JSONEncoder().encode(item.header)
            let headerJSON = String(data: headerData, encoding: .utf8) ?? "{}"
            try store.saveCiphertextMessage(
                id: item.id,
                conversationID: item.conversationID,
                senderID: item.senderID,
                receiverID: item.receiverID,
                ciphertextB64: item.ciphertextB64,
                headerJSON: headerJSON,
                createdAt: item.createdAt
            )
        }
        if let last = payload.items.last?.createdAt {
            try store.setLastSyncTimestamp(last)
        }
    }

    func markRead(messageID: Int64) async throws {
        let token = try await accessTokenProvider()
        let url = config.baseURL.appendingPathComponent("v1/messages/\(messageID)/read")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = Data("{}".utf8)

        let (_, response) = try await config.session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw APIClientError.invalidResponse
        }
    }
}

private struct SyncResponse: Codable {
    let items: [SyncMessageItem]
}

private struct SyncMessageItem: Codable {
    let id: Int64
    let conversationID: Int64
    let senderID: Int64
    let receiverID: Int64
    let clientMessageID: String
    let ciphertextB64: String
    let header: [String: JSONValue]
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case conversationID = "conversation_id"
        case senderID = "sender_id"
        case receiverID = "receiver_id"
        case clientMessageID = "client_message_id"
        case ciphertextB64 = "ciphertext_b64"
        case header
        case createdAt = "created_at"
    }
}

private enum JSONValue: Codable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode(Int.self) {
            self = .int(value)
        } else if let value = try? container.decode(Double.self) {
            self = .double(value)
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value):
            try container.encode(value)
        case .int(let value):
            try container.encode(value)
        case .double(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        case .object(let value):
            try container.encode(value)
        case .array(let value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }
}
