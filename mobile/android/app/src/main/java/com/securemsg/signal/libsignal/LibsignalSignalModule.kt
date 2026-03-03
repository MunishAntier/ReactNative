package com.securemsg.signal.libsignal

import android.content.Context
import android.util.Base64
import com.securemsg.signal.KeyBundleUpload
import com.securemsg.signal.PeerKeyBundle
import com.securemsg.signal.PreKeyPublic
import com.securemsg.signal.SignalModule
import org.signal.libsignal.protocol.IdentityKey
import org.signal.libsignal.protocol.SessionBuilder
import org.signal.libsignal.protocol.SessionCipher
import org.signal.libsignal.protocol.SignalProtocolAddress
import org.signal.libsignal.protocol.ecc.Curve
import org.signal.libsignal.protocol.ecc.ECPublicKey
import org.signal.libsignal.protocol.message.CiphertextMessage
import org.signal.libsignal.protocol.message.PreKeySignalMessage
import org.signal.libsignal.protocol.message.SignalMessage
import org.signal.libsignal.protocol.state.PreKeyBundle
import org.signal.libsignal.protocol.state.PreKeyRecord
import org.signal.libsignal.protocol.state.SignedPreKeyRecord
import java.time.Instant
import java.time.temporal.ChronoUnit
import kotlin.math.max

class LibsignalSignalModule(context: Context) : SignalModule {
    private val prefs =
        context.getSharedPreferences("securemsg_libsignal_meta", Context.MODE_PRIVATE)
    private val store = PersistentSignalProtocolStore(context)
    private val pendingOneTimePrekeys = linkedMapOf<Long, Long>()

    override fun generateInitialBundle(oneTimePreKeyCount: Int): KeyBundleUpload {
        val signed = ensureCurrentSignedPreKey(forceRotate = false)
        val oneTimePreKeys = generateOneTimePreKeys(oneTimePreKeyCount)
        return KeyBundleUpload(
            registrationId = store.localRegistrationId,
            identityPublicKey = localIdentityPublicKeyB64(),
            identityKeyVersion = max(prefs.getInt(KEY_IDENTITY_KEY_VERSION, 1), 1),
            signedPreKeyId = signed.id.toLong(),
            signedPreKeyPublic = encodeB64(signed.publicKey.serialize()),
            signedPreKeySignature = encodeB64(signed.signature),
            signedPreKeyExpiresAt = signed.expiresAt,
            oneTimePreKeys = oneTimePreKeys
        )
    }

    override fun generateOneTimePreKeys(count: Int): List<PreKeyPublic> {
        val safeCount = max(count, 1)
        val startID = max(prefs.getLong(KEY_NEXT_PREKEY_ID, 1L), 1L)
        val generated = ArrayList<PreKeyPublic>(safeCount)
        var cursor = startID
        repeat(safeCount) {
            val preKeyID = normalizePositiveInt(cursor)
            val pair = Curve.generateKeyPair()
            store.storePreKey(preKeyID, PreKeyRecord(preKeyID, pair))
            generated += PreKeyPublic(
                preKeyId = preKeyID.toLong(),
                preKeyPublic = encodeB64(pair.publicKey.serialize())
            )
            cursor = (preKeyID + 1).toLong()
        }
        prefs.edit().putLong(KEY_NEXT_PREKEY_ID, cursor).apply()
        return generated
    }

    override fun rotateSignedPreKey(): Triple<Long, String, String> {
        val signed = ensureCurrentSignedPreKey(forceRotate = true)
        return Triple(
            signed.id.toLong(),
            encodeB64(signed.publicKey.serialize()),
            encodeB64(signed.signature)
        )
    }

    override fun initializeSession(peerUserId: Long, bundle: PeerKeyBundle) {
        val address = peerAddress(peerUserId)
        val preKeyBundle = PreKeyBundle(
            normalizePositiveInt(bundle.registrationId.toLong()),
            address.deviceId,
            normalizePositiveInt(bundle.oneTimePreKeyId),
            decodePublicKey(bundle.oneTimePreKeyPublic),
            normalizePositiveInt(bundle.signedPreKeyId),
            decodePublicKey(bundle.signedPreKeyPublic),
            decodeB64(bundle.signedPreKeySignature),
            decodeIdentityKey(bundle.identityPublicKey)
        )
        SessionBuilder(store, address).process(preKeyBundle)
        pendingOneTimePrekeys[peerUserId] = bundle.oneTimePreKeyId
    }

    override fun invalidateSession(peerUserId: Long) {
        store.deleteSession(peerAddress(peerUserId))
        pendingOneTimePrekeys.remove(peerUserId)
    }

    override fun hasSession(peerUserId: Long): Boolean {
        return store.containsSession(peerAddress(peerUserId))
    }

    override fun encrypt(plaintext: ByteArray, peerUserId: Long): Pair<String, Map<String, Any>> {
        val address = peerAddress(peerUserId)
        val cipher = SessionCipher(store, address)
        val ciphertext = cipher.encrypt(plaintext)
        val rawCiphertext = ciphertext.serialize()
        val ciphertextB64 = encodeB64(rawCiphertext)
        val header = buildHeaderForCiphertext(peerUserId, cipher, ciphertext, rawCiphertext)
        return ciphertextB64 to header
    }

    override fun decrypt(
        ciphertextB64: String,
        header: Map<String, Any>,
        senderUserId: Long
    ): ByteArray {
        val address = peerAddress(senderUserId)
        val cipher = SessionCipher(store, address)
        val payload = decodeB64(ciphertextB64)
        val preKeyHint = header["receiver_one_time_prekey_id"].asLongSafe()
        val preferPreKey = preKeyHint > 0L || !store.containsSession(address)

        var lastError: Throwable? = null
        val attempts: List<() -> ByteArray> = if (preferPreKey) {
            listOf(
                { decryptAsPreKey(cipher, payload) },
                { decryptAsSignal(cipher, payload) }
            )
        } else {
            listOf(
                { decryptAsSignal(cipher, payload) },
                { decryptAsPreKey(cipher, payload) }
            )
        }

        for (attempt in attempts) {
            try {
                return attempt()
            } catch (err: Throwable) {
                lastError = err
            }
        }
        throw IllegalStateException("unable to decrypt incoming message", lastError)
    }

    private fun buildHeaderForCiphertext(
        peerUserId: Long,
        cipher: SessionCipher,
        ciphertext: CiphertextMessage,
        serializedCiphertext: ByteArray
    ): Map<String, Any> {
        val sessionVersion = runCatching { cipher.sessionVersion }.getOrDefault(1)
        var senderEphemeralPubB64 = ""
        var ratchetPubB64 = ""
        var messageIndex = 0
        var receiverOneTimePreKeyID = pendingOneTimePrekeys.remove(peerUserId) ?: 0L

        when (ciphertext.type) {
            CiphertextMessage.PREKEY_TYPE -> {
                val preKey = PreKeySignalMessage(serializedCiphertext)
                val whisper = preKey.whisperMessage
                senderEphemeralPubB64 = encodeB64(preKey.baseKey.serialize())
                ratchetPubB64 = encodeB64(whisper.senderRatchetKey.serialize())
                messageIndex = whisper.counter
                if (receiverOneTimePreKeyID == 0L) {
                    receiverOneTimePreKeyID = preKey.preKeyId.orElse(0).toLong()
                }
            }

            CiphertextMessage.WHISPER_TYPE -> {
                val signal = SignalMessage(serializedCiphertext)
                val ratchet = encodeB64(signal.senderRatchetKey.serialize())
                senderEphemeralPubB64 = ratchet
                ratchetPubB64 = ratchet
                messageIndex = signal.counter
            }
        }

        return mapOf(
            "session_version" to sessionVersion,
            "sender_identity_pub_b64" to localIdentityPublicKeyB64(),
            "sender_ephemeral_pub_b64" to senderEphemeralPubB64,
            "receiver_one_time_prekey_id" to receiverOneTimePreKeyID,
            "ratchet_pub_b64" to ratchetPubB64,
            "message_index" to messageIndex
        )
    }

    private fun decryptAsPreKey(cipher: SessionCipher, payload: ByteArray): ByteArray {
        val preKey = PreKeySignalMessage(payload)
        val plaintext = cipher.decrypt(preKey)
        val consumedPreKeyID = preKey.preKeyId.orElse(0)
        if (consumedPreKeyID > 0 && store.containsPreKey(consumedPreKeyID)) {
            store.removePreKey(consumedPreKeyID)
        }
        return plaintext
    }

    private fun decryptAsSignal(cipher: SessionCipher, payload: ByteArray): ByteArray {
        return cipher.decrypt(SignalMessage(payload))
    }

    private fun ensureCurrentSignedPreKey(forceRotate: Boolean): SignedPreKeyMaterial {
        val currentID = prefs.getInt(KEY_CURRENT_SIGNED_PREKEY_ID, 0)
        val currentExpiry = prefs.getString(KEY_CURRENT_SIGNED_PREKEY_EXPIRES_AT, null)
        val currentSignatureB64 = prefs.getString(KEY_CURRENT_SIGNED_PREKEY_SIGNATURE_B64, null)
        val stillValid = !forceRotate &&
            currentID > 0 &&
            !currentExpiry.isNullOrBlank() &&
            runCatching { Instant.parse(currentExpiry).isAfter(Instant.now()) }.getOrElse { false } &&
            store.containsSignedPreKey(currentID)

        if (stillValid) {
            val record = runCatching { store.loadSignedPreKey(currentID) }.getOrNull()
            val keyPair = runCatching { record?.keyPair }.getOrNull()
            val signature = currentSignatureB64?.let { runCatching { decodeB64(it) }.getOrNull() }
            if (record != null && keyPair != null && signature != null) {
                return SignedPreKeyMaterial(
                    id = currentID,
                    publicKey = keyPair.publicKey,
                    signature = signature,
                    expiresAt = currentExpiry
                )
            }
        }

        val nextID = max(prefs.getInt(KEY_NEXT_SIGNED_PREKEY_ID, 1), 1)
        val keyPair = Curve.generateKeyPair()
        val signature = Curve.calculateSignature(
            store.identityKeyPair.privateKey,
            keyPair.publicKey.serialize()
        )
        val record = SignedPreKeyRecord(nextID, System.currentTimeMillis(), keyPair, signature)
        store.storeSignedPreKey(nextID, record)

        val nextExpires = Instant.now().plus(30, ChronoUnit.DAYS).toString()
        prefs.edit()
            .putInt(KEY_CURRENT_SIGNED_PREKEY_ID, nextID)
            .putString(KEY_CURRENT_SIGNED_PREKEY_EXPIRES_AT, nextExpires)
            .putString(KEY_CURRENT_SIGNED_PREKEY_SIGNATURE_B64, encodeB64(signature))
            .putInt(KEY_NEXT_SIGNED_PREKEY_ID, nextID + 1)
            .apply()

        return SignedPreKeyMaterial(
            id = nextID,
            publicKey = keyPair.publicKey,
            signature = signature,
            expiresAt = nextExpires
        )
    }

    private fun decodePublicKey(valueB64: String): ECPublicKey {
        return Curve.decodePoint(decodeB64(valueB64), 0)
    }

    private fun decodeIdentityKey(valueB64: String): IdentityKey {
        return IdentityKey(decodeB64(valueB64), 0)
    }

    private fun localIdentityPublicKeyB64(): String {
        return encodeB64(store.identityKeyPair.publicKey.serialize())
    }

    private fun peerAddress(peerUserId: Long): SignalProtocolAddress {
        return SignalProtocolAddress("user-$peerUserId", 1)
    }

    private fun normalizePositiveInt(value: Long): Int {
        val normalized = if (value <= 0L) 1L else value
        val bounded = if (normalized > Int.MAX_VALUE.toLong()) 1L else normalized
        return bounded.toInt()
    }

    private fun encodeB64(raw: ByteArray): String {
        return Base64.encodeToString(raw, Base64.NO_WRAP)
    }

    private fun decodeB64(raw: String): ByteArray {
        return Base64.decode(raw, Base64.NO_WRAP)
    }

    private fun Any?.asLongSafe(): Long {
        return when (this) {
            is Number -> this.toLong()
            is String -> this.toLongOrNull() ?: 0L
            else -> 0L
        }
    }

    private data class SignedPreKeyMaterial(
        val id: Int,
        val publicKey: ECPublicKey,
        val signature: ByteArray,
        val expiresAt: String
    )

    companion object {
        private const val KEY_IDENTITY_KEY_VERSION = "identity_key_version"
        private const val KEY_NEXT_PREKEY_ID = "next_prekey_id"
        private const val KEY_NEXT_SIGNED_PREKEY_ID = "next_signed_prekey_id"
        private const val KEY_CURRENT_SIGNED_PREKEY_ID = "current_signed_prekey_id"
        private const val KEY_CURRENT_SIGNED_PREKEY_EXPIRES_AT = "current_signed_prekey_expires_at"
        private const val KEY_CURRENT_SIGNED_PREKEY_SIGNATURE_B64 =
            "current_signed_prekey_signature_b64"
    }
}
