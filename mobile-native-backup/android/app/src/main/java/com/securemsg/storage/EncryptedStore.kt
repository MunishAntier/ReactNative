package com.securemsg.storage

interface EncryptedStore {
    suspend fun saveCiphertextMessage(
        id: Long,
        conversationId: Long,
        senderId: Long,
        receiverId: Long,
        ciphertextB64: String,
        headerJson: String,
        createdAt: String
    )

    suspend fun getLastSyncTimestamp(): String?
    suspend fun setLastSyncTimestamp(isoTimestamp: String)
}
