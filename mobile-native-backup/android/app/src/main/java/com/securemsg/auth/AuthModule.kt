package com.securemsg.auth

data class AuthTokens(
    val accessToken: String,
    val accessExpiresAt: String,
    val refreshToken: String,
    val refreshExpiresAt: String,
    val userId: Long,
    val deviceId: Long,
    val sessionId: String
)

interface AuthModule {
    suspend fun startOtp(identifier: String, purpose: String)
    suspend fun verifyOtp(identifier: String, otp: String, deviceUuid: String, platform: String, pushToken: String?): AuthTokens
    suspend fun refresh(refreshToken: String): AuthTokens
    suspend fun logout(accessToken: String)
}
