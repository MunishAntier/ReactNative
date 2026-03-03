package com.securemsg.ws

import com.securemsg.net.jsonObjectToMap
import com.securemsg.net.mapToJsonObject
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject

class OkHttpWsClient(
    private val baseUrl: String,
    private val httpClient: OkHttpClient = OkHttpClient()
) : WsClient {

    private var socket: WebSocket? = null
    override var onEvent: ((Map<String, Any>) -> Unit)? = null

    override fun connect(accessToken: String) {
        val request = Request.Builder()
            .url(buildWsUrl(accessToken))
            .build()
        socket = httpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                val json = runCatching { JSONObject(text) }.getOrNull() ?: return
                @Suppress("UNCHECKED_CAST")
                onEvent?.invoke(jsonObjectToMap(json) as Map<String, Any>)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                val payload = mapOf(
                    "type" to "error",
                    "message" to (t.message ?: "ws failure"),
                    "code" to response?.code
                )
                onEvent?.invoke(payload)
            }
        })
    }

    override fun disconnect() {
        socket?.close(1000, "client disconnect")
        socket = null
    }

    override fun send(event: Map<String, Any>) {
        val json = mapToJsonObject(event)
        socket?.send(json.toString())
    }

    private fun buildWsUrl(accessToken: String): String {
        val httpUrl = baseUrl.toHttpUrl()
        val wsScheme = if (httpUrl.isHttps) "wss" else "ws"
        return httpUrl.newBuilder()
            .scheme(wsScheme)
            .addPathSegments("v1/ws")
            .addQueryParameter("token", accessToken)
            .build()
            .toString()
    }
}
