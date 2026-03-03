package com.securemsg.app

import android.content.Context
import com.securemsg.auth.AuthTokens

class SessionStore(context: Context) {
    private val prefs = context.getSharedPreferences("securemsg_session", Context.MODE_PRIVATE)

    fun save(tokens: AuthTokens) {
        prefs.edit()
            .putString("access_token", tokens.accessToken)
            .putString("refresh_token", tokens.refreshToken)
            .putLong("user_id", tokens.userId)
            .putLong("device_id", tokens.deviceId)
            .putString("session_id", tokens.sessionId)
            .apply()
    }

    fun accessToken(): String? = prefs.getString("access_token", null)
    fun refreshToken(): String? = prefs.getString("refresh_token", null)
    fun userId(): Long = prefs.getLong("user_id", 0)
    fun deviceId(): Long = prefs.getLong("device_id", 0)
    fun sessionId(): String? = prefs.getString("session_id", null)

    fun requireAccessToken(): String {
        return accessToken() ?: error("not authenticated")
    }

    fun isAuthenticated(): Boolean = !accessToken().isNullOrBlank() && userId() > 0

    fun clear() {
        prefs.edit().clear().apply()
    }
}
