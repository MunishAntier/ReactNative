package com.securemsg.ws

interface WsClient {
    fun connect(accessToken: String)
    fun disconnect()
    fun send(event: Map<String, Any>)
    var onEvent: ((Map<String, Any>) -> Unit)?
}
