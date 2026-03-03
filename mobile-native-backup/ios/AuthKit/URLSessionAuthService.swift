import Foundation

struct BackendAPIConfiguration {
    let baseURL: URL
    let session: URLSession

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }
}

enum APIClientError: LocalizedError {
    case invalidResponse
    case serverError(String)
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid server response"
        case .serverError(let message):
            return message
        case .unauthorized:
            return "Unauthorized"
        }
    }
}

final class URLSessionAuthService: AuthService {
    private let config: BackendAPIConfiguration

    init(config: BackendAPIConfiguration) {
        self.config = config
    }

    func startOTP(identifier: String, purpose: String = "login") async throws {
        let body = AuthStartRequest(identifier: identifier, purpose: purpose)
        _ = try await request(path: "/v1/auth/start", method: "POST", body: body, bearerToken: nil)
    }

    func verifyOTP(identifier: String, otp: String, deviceUUID: String, platform: String, pushToken: String?) async throws -> AuthTokens {
        let body = AuthVerifyRequest(
            identifier: identifier,
            otp: otp,
            deviceUUID: deviceUUID,
            platform: platform,
            pushToken: pushToken
        )
        let data = try await request(path: "/v1/auth/verify", method: "POST", body: body, bearerToken: nil)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(AuthTokens.self, from: data)
    }

    func refresh(refreshToken: String) async throws -> AuthTokens {
        let body = RefreshRequest(refreshToken: refreshToken)
        let data = try await request(path: "/v1/auth/refresh", method: "POST", body: body, bearerToken: nil)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(AuthTokens.self, from: data)
    }

    func logout(accessToken: String) async throws {
        _ = try await request(path: "/v1/auth/logout", method: "POST", body: EmptyBody(), bearerToken: accessToken)
    }

    private func request<T: Encodable>(path: String, method: String, body: T, bearerToken: String?) async throws -> Data {
        let normalizedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let url = config.baseURL.appendingPathComponent(normalizedPath)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let bearerToken {
            request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await config.session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            if httpResponse.statusCode == 401 {
                throw APIClientError.unauthorized
            }
            let apiError = try? JSONDecoder().decode(APIErrorBody.self, from: data)
            throw APIClientError.serverError(apiError?.error ?? "HTTP \(httpResponse.statusCode)")
        }
        return data
    }
}

private struct AuthStartRequest: Encodable {
    let identifier: String
    let purpose: String
}

private struct AuthVerifyRequest: Encodable {
    let identifier: String
    let otp: String
    let deviceUUID: String
    let platform: String
    let pushToken: String?

    enum CodingKeys: String, CodingKey {
        case identifier
        case otp
        case deviceUUID = "device_uuid"
        case platform
        case pushToken = "push_token"
    }
}

private struct RefreshRequest: Encodable {
    let refreshToken: String

    enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }
}

private struct EmptyBody: Encodable {}

private struct APIErrorBody: Codable {
    let error: String
}
