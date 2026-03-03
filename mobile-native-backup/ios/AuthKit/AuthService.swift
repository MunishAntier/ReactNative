import Foundation

struct AuthTokens: Codable {
    let accessToken: String
    let accessExpiresAt: Date
    let refreshToken: String
    let refreshExpiresAt: Date
    let userID: Int64
    let deviceID: Int64
    let sessionID: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case accessExpiresAt = "access_expires_at"
        case refreshToken = "refresh_token"
        case refreshExpiresAt = "refresh_expires_at"
        case userID = "user_id"
        case deviceID = "device_id"
        case sessionID = "session_id"
    }
}

protocol AuthService {
    func startOTP(identifier: String, purpose: String) async throws
    func verifyOTP(identifier: String, otp: String, deviceUUID: String, platform: String, pushToken: String?) async throws -> AuthTokens
    func refresh(refreshToken: String) async throws -> AuthTokens
    func logout(accessToken: String) async throws
}
