package com.securemsg.push

interface PushService {
    suspend fun registerPushToken(): String
    fun handleIncomingPush(payload: Map<String, String>)
}
