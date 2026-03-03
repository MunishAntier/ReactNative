package com.securemsg.sync

interface SyncWorker {
    suspend fun syncSince(isoTimestamp: String)
    suspend fun markRead(messageId: Long)
}
