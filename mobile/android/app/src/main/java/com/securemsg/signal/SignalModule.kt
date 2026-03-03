package com.securemsg.signal

data class PreKeyPublic(val preKeyId: Long, val preKeyPublic: String)

data class KeyBundleUpload(
    val registrationId: Int,
    val identityPublicKey: String,
    val identityKeyVersion: Int,
    val signedPreKeyId: Long,
    val signedPreKeyPublic: String,
    val signedPreKeySignature: String,
    val signedPreKeyExpiresAt: String,
    val oneTimePreKeys: List<PreKeyPublic>
)

interface SignalModule {
    fun generateInitialBundle(oneTimePreKeyCount: Int = 100): KeyBundleUpload
    fun generateOneTimePreKeys(count: Int = 100): List<PreKeyPublic>
    fun rotateSignedPreKey(): Triple<Long, String, String>
    fun initializeSession(peerUserId: Long, bundle: PeerKeyBundle)
    fun invalidateSession(peerUserId: Long)
    fun hasSession(peerUserId: Long): Boolean
    fun encrypt(plaintext: ByteArray, peerUserId: Long): Pair<String, Map<String, Any>>
    fun decrypt(ciphertextB64: String, header: Map<String, Any>, senderUserId: Long): ByteArray
}
