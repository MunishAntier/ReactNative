package com.securemsg.signal

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

data class PeerKeyBundle(
    val userId: Long,
    val deviceId: Long,
    val registrationId: Int,
    val identityPublicKey: String,
    val identityKeyVersion: Int,
    val signedPreKeyId: Long,
    val signedPreKeyPublic: String,
    val signedPreKeySignature: String,
    val oneTimePreKeyId: Long,
    val oneTimePreKeyPublic: String
)

class SignalSessionBootstrap(
    private val baseUrl: String,
    private val httpClient: OkHttpClient = OkHttpClient()
) {

    suspend fun uploadInitialBundle(accessToken: String, bundle: KeyBundleUpload) {
        val body = JSONObject()
            .put("registration_id", bundle.registrationId)
            .put("identity_public_key", bundle.identityPublicKey)
            .put("identity_key_version", bundle.identityKeyVersion)
            .put("signed_prekey_id", bundle.signedPreKeyId)
            .put("signed_prekey_public", bundle.signedPreKeyPublic)
            .put("signed_prekey_signature", bundle.signedPreKeySignature)
            .put("signed_prekey_expires_at", bundle.signedPreKeyExpiresAt)
            .put("one_time_prekeys", JSONArray(bundle.oneTimePreKeys.map { prekey ->
                JSONObject()
                    .put("prekey_id", prekey.preKeyId)
                    .put("prekey_public", prekey.preKeyPublic)
            }))

        executeJson(path = "v1/keys/upload", method = "POST", body = body, accessToken = accessToken)
    }

    suspend fun uploadOneTimePreKeys(accessToken: String, oneTimePreKeys: List<PreKeyPublic>) {
        val body = JSONObject().put(
            "one_time_prekeys",
            JSONArray(oneTimePreKeys.map { prekey ->
                JSONObject()
                    .put("prekey_id", prekey.preKeyId)
                    .put("prekey_public", prekey.preKeyPublic)
            })
        )
        executeJson(
            path = "v1/keys/one-time-prekeys/upload",
            method = "POST",
            body = body,
            accessToken = accessToken
        )
    }

    suspend fun rotateSignedPreKey(
        accessToken: String,
        signedPreKeyId: Long,
        signedPreKeyPublic: String,
        signedPreKeySignature: String,
        signedPreKeyExpiresAt: String
    ) {
        val body = JSONObject()
            .put("signed_prekey_id", signedPreKeyId)
            .put("signed_prekey_public", signedPreKeyPublic)
            .put("signed_prekey_signature", signedPreKeySignature)
            .put("signed_prekey_expires_at", signedPreKeyExpiresAt)

        executeJson(path = "v1/keys/signed-prekey/rotate", method = "POST", body = body, accessToken = accessToken)
    }

    suspend fun fetchPeerBundle(accessToken: String, userId: Long): PeerKeyBundle {
        val payload = executeJson(path = "v1/keys/$userId", method = "GET", body = null, accessToken = accessToken)
        return PeerKeyBundle(
            userId = payload.getLong("user_id"),
            deviceId = payload.getLong("device_id"),
            registrationId = payload.optInt("registration_id", 1),
            identityPublicKey = payload.getString("identity_public_key"),
            identityKeyVersion = payload.getInt("identity_key_version"),
            signedPreKeyId = payload.getLong("signed_prekey_id"),
            signedPreKeyPublic = payload.getString("signed_prekey_public"),
            signedPreKeySignature = payload.getString("signed_prekey_signature"),
            oneTimePreKeyId = payload.getLong("one_time_prekey_id"),
            oneTimePreKeyPublic = payload.getString("one_time_prekey_public")
        )
    }

    private suspend fun executeJson(
        path: String,
        method: String,
        body: JSONObject?,
        accessToken: String
    ): JSONObject = withContext(Dispatchers.IO) {
        val url = baseUrl.toHttpUrl().newBuilder().addPathSegments(path.trimStart('/')).build()
        val requestBuilder = Request.Builder().url(url)
        if (accessToken.isNotBlank()) {
            requestBuilder.header("Authorization", "Bearer $accessToken")
        }

        when (method) {
            "GET" -> requestBuilder.get()
            else -> {
                val mediaType = "application/json".toMediaType()
                val requestBody = (body?.toString() ?: "{}").toRequestBody(mediaType)
                requestBuilder.method(method, requestBody)
                requestBuilder.header("Content-Type", "application/json")
            }
        }

        httpClient.newCall(requestBuilder.build()).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException("HTTP ${response.code}: $text")
            }
            if (text.isBlank()) JSONObject() else JSONObject(text)
        }
    }
}
