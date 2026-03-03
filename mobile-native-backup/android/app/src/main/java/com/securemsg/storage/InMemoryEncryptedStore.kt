package com.securemsg.storage

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

data class StoredCipherMessage(
    val id: Long,
    val conversationId: Long,
    val senderId: Long,
    val receiverId: Long,
    val ciphertextB64: String,
    val headerJson: String,
    val createdAt: String
)

class InMemoryEncryptedStore : EncryptedStore {
    private val mutex = Mutex()
    private val messages = mutableListOf<StoredCipherMessage>()
    private var lastSync: String? = null

    override suspend fun saveCiphertextMessage(
        id: Long,
        conversationId: Long,
        senderId: Long,
        receiverId: Long,
        ciphertextB64: String,
        headerJson: String,
        createdAt: String
    ) {
        mutex.withLock {
            if (messages.any { it.id == id }) {
                return
            }
            messages += StoredCipherMessage(
                id = id,
                conversationId = conversationId,
                senderId = senderId,
                receiverId = receiverId,
                ciphertextB64 = ciphertextB64,
                headerJson = headerJson,
                createdAt = createdAt
            )
        }
    }

    override suspend fun getLastSyncTimestamp(): String? {
        return mutex.withLock { lastSync }
    }

    override suspend fun setLastSyncTimestamp(isoTimestamp: String) {
        mutex.withLock {
            lastSync = isoTimestamp
        }
    }

    suspend fun allMessages(): List<StoredCipherMessage> {
        return mutex.withLock { messages.toList() }
    }
}
