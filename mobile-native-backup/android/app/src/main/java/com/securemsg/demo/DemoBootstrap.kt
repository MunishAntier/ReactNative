package com.securemsg.demo

import com.securemsg.auth.AuthModule
import com.securemsg.auth.HttpAuthModule
import com.securemsg.signal.SignalSessionBootstrap
import com.securemsg.storage.EncryptedStore
import com.securemsg.sync.ApiSyncWorker
import com.securemsg.sync.SyncWorker
import com.securemsg.ws.OkHttpWsClient
import com.securemsg.ws.WsClient
import okhttp3.OkHttpClient

class DemoBootstrap private constructor(
    val authModule: AuthModule,
    val wsClient: WsClient,
    val syncWorker: SyncWorker,
    val signalBootstrap: SignalSessionBootstrap
) {
    companion object {
        fun create(
            baseUrl: String,
            encryptedStore: EncryptedStore,
            accessTokenProvider: suspend () -> String
        ): DemoBootstrap {
            val httpClient = OkHttpClient()
            return DemoBootstrap(
                authModule = HttpAuthModule(baseUrl = baseUrl, httpClient = httpClient),
                wsClient = OkHttpWsClient(baseUrl = baseUrl, httpClient = httpClient),
                syncWorker = ApiSyncWorker(
                    baseUrl = baseUrl,
                    httpClient = httpClient,
                    accessTokenProvider = accessTokenProvider,
                    store = encryptedStore
                ),
                signalBootstrap = SignalSessionBootstrap(baseUrl = baseUrl, httpClient = httpClient)
            )
        }
    }
}
