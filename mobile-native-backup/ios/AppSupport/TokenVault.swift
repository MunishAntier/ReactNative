import Foundation

final class TokenVault {
    private let accessKey = "securemsg.access"
    private let refreshKey = "securemsg.refresh"
    private let userIDKey = "securemsg.user"
    private let defaults = UserDefaults.standard

    func save(_ tokens: AuthTokens) {
        defaults.set(tokens.accessToken, forKey: accessKey)
        defaults.set(tokens.refreshToken, forKey: refreshKey)
        defaults.set(tokens.userID, forKey: userIDKey)
    }

    func accessToken() -> String? {
        defaults.string(forKey: accessKey)
    }

    func refreshToken() -> String? {
        defaults.string(forKey: refreshKey)
    }

    func userID() -> Int64 {
        Int64(defaults.integer(forKey: userIDKey))
    }

    func isAuthenticated() -> Bool {
        (accessToken()?.isEmpty == false) && userID() > 0
    }

    func clear() {
        defaults.removeObject(forKey: accessKey)
        defaults.removeObject(forKey: refreshKey)
        defaults.removeObject(forKey: userIDKey)
    }
}
