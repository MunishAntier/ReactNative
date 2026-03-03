package com.securemsg.auth

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.json.JSONObject

class HttpAuthModule(
    private val baseUrl: String,
    private val httpClient: OkHttpClient = OkHttpClient()
) : AuthModule {

    override suspend fun startOtp(identifier: String, purpose: String) {
        val body = JSONObject()
            .put("identifier", identifier)
            .put("purpose", purpose)
        executeJson(path = "v1/auth/start", method = "POST", body = body)
    }

    override suspend fun verifyOtp(
        identifier: String,
        otp: String,
        deviceUuid: String,
        platform: String,
        pushToken: String?
    ): AuthTokens {
        val body = JSONObject()
            .put("identifier", identifier)
            .put("otp", otp)
            .put("device_uuid", deviceUuid)
            .put("platform", platform)
            .put("push_token", pushToken)

        val json = executeJson(path = "v1/auth/verify", method = "POST", body = body)
        return parseAuthTokens(json)
    }

    override suspend fun refresh(refreshToken: String): AuthTokens {
        val body = JSONObject().put("refresh_token", refreshToken)
        val json = executeJson(path = "v1/auth/refresh", method = "POST", body = body)
        return parseAuthTokens(json)
    }

    override suspend fun logout(accessToken: String) {
        executeJson(
            path = "v1/auth/logout",
            method = "POST",
            body = JSONObject(),
            bearerToken = accessToken
        )
    }

    private suspend fun executeJson(
        path: String,
        method: String,
        body: JSONObject? = null,
        bearerToken: String? = null
    ): JSONObject = withContext(Dispatchers.IO) {
        val mediaType = "application/json".toMediaType()
        val requestBody = (body?.toString() ?: "{}").toRequestBody(mediaType)

        val requestBuilder = Request.Builder()
            .url(buildUrl(path))
            .method(method, requestBody)
            .header("Content-Type", "application/json")

        if (!bearerToken.isNullOrBlank()) {
            requestBuilder.header("Authorization", "Bearer $bearerToken")
        }

        httpClient.newCall(requestBuilder.build()).execute().use { response ->
            val payload = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val msg = runCatching { JSONObject(payload).optString("error") }.getOrNull()
                throw IllegalStateException(msg ?: "HTTP ${response.code}")
            }
            if (payload.isBlank()) {
                JSONObject()
            } else {
                JSONObject(payload)
            }
        }
    }

    private fun buildUrl(path: String) = baseUrl.toHttpUrl()
        .newBuilder()
        .addPathSegments(path.trimStart('/'))
        .build()

    private fun parseAuthTokens(json: JSONObject): AuthTokens {
        return AuthTokens(
            accessToken = json.getString("access_token"),
            accessExpiresAt = json.getString("access_expires_at"),
            refreshToken = json.getString("refresh_token"),
            refreshExpiresAt = json.getString("refresh_expires_at"),
            userId = json.getLong("user_id"),
            deviceId = json.getLong("device_id"),
            sessionId = json.getString("session_id")
        )
    }
}
