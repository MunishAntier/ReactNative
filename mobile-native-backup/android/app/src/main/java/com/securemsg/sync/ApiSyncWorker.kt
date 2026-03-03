package com.securemsg.sync

import com.securemsg.storage.EncryptedStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class ApiSyncWorker(
    private val baseUrl: String,
    private val httpClient: OkHttpClient,
    private val accessTokenProvider: suspend () -> String,
    private val store: EncryptedStore
) : SyncWorker {

    override suspend fun syncSince(isoTimestamp: String) {
        val token = accessTokenProvider()
        val url = baseUrl.toHttpUrl().newBuilder()
            .addPathSegments("v1/messages/sync")
            .addQueryParameter("since", isoTimestamp)
            .addQueryParameter("limit", "100")
            .build()

        val request = Request.Builder()
            .url(url)
            .get()
            .header("Authorization", "Bearer $token")
            .build()

        val payload = withContext(Dispatchers.IO) {
            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    throw IllegalStateException("sync failed with HTTP ${response.code}")
                }
                response.body?.string().orEmpty()
            }
        }

        if (payload.isBlank()) return
        val root = JSONObject(payload)
        val items = root.optJSONArray("items") ?: return

        var latestTimestamp: String? = null
        for (index in 0 until items.length()) {
            val item = items.getJSONObject(index)
            val header = item.optJSONObject("header") ?: JSONObject()
            store.saveCiphertextMessage(
                id = item.getLong("id"),
                conversationId = item.getLong("conversation_id"),
                senderId = item.getLong("sender_id"),
                receiverId = item.getLong("receiver_id"),
                ciphertextB64 = item.getString("ciphertext_b64"),
                headerJson = header.toString(),
                createdAt = item.getString("created_at")
            )
            latestTimestamp = item.optString("created_at", latestTimestamp)
        }
        if (!latestTimestamp.isNullOrBlank()) {
            store.setLastSyncTimestamp(latestTimestamp)
        }
    }

    override suspend fun markRead(messageId: Long) {
        val token = accessTokenProvider()
        val requestBody = "{}".toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url(baseUrl.toHttpUrl().newBuilder().addPathSegments("v1/messages/$messageId/read").build())
            .post(requestBody)
            .header("Authorization", "Bearer $token")
            .header("Content-Type", "application/json")
            .build()

        withContext(Dispatchers.IO) {
            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    throw IllegalStateException("markRead failed with HTTP ${response.code}")
                }
            }
        }
    }
}
