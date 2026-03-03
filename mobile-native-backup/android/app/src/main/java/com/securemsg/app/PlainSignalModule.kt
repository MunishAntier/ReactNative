package com.securemsg.app

import android.content.Context
import com.securemsg.signal.KeyBundleUpload
import com.securemsg.signal.PeerKeyBundle
import com.securemsg.signal.PreKeyPublic
import com.securemsg.signal.SignalModule
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.Base64
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.max
import kotlin.random.Random

class PlainSignalModule(context: Context) : SignalModule {
    private val prefs = context.getSharedPreferences("securemsg_signal_state", Context.MODE_PRIVATE)
    private val knownSessions = ConcurrentHashMap<Long, Int>()
    private val pendingOneTimePrekeys = ConcurrentHashMap<Long, Long>()
    private val messageCounters = ConcurrentHashMap<Long, Int>()

    override fun generateInitialBundle(oneTimePreKeyCount: Int): KeyBundleUpload {
        val registrationID = ensureRegistrationID()
        val identityPublicKey = ensureIdentityPublicKey()
        val identityVersion = max(prefs.getInt(KEY_IDENTITY_VERSION, 1), 1)
        val signedPreKey = ensureSignedPreKey()
        val prekeys = generateOneTimePreKeys(oneTimePreKeyCount)

        return KeyBundleUpload(
            registrationId = registrationID,
            identityPublicKey = identityPublicKey,
            identityKeyVersion = identityVersion,
            signedPreKeyId = signedPreKey.id,
            signedPreKeyPublic = signedPreKey.publicKey,
            signedPreKeySignature = signedPreKey.signature,
            signedPreKeyExpiresAt = signedPreKey.expiresAt,
            oneTimePreKeys = prekeys
        )
    }

    override fun generateOneTimePreKeys(count: Int): List<PreKeyPublic> {
        val safeCount = max(count, 1)
        val startID = prefs.getLong(KEY_NEXT_PREKEY_ID, 1L)
        val generated = (0 until safeCount).map { offset ->
            val preKeyID = startID + offset
            PreKeyPublic(
                preKeyId = preKeyID,
                preKeyPublic = "otpk-$preKeyID-${UUID.randomUUID()}"
            )
        }
        prefs.edit().putLong(KEY_NEXT_PREKEY_ID, startID + safeCount).apply()
        return generated
    }

    override fun rotateSignedPreKey(): Triple<Long, String, String> {
        val nextID = max(prefs.getLong(KEY_SIGNED_PREKEY_ID, 0L) + 1, 1L)
        val nextPublic = "spk-${UUID.randomUUID()}"
        val nextSignature = "sig-${UUID.randomUUID()}"
        val expires = Instant.now().plus(30, ChronoUnit.DAYS).toString()
        prefs.edit()
            .putLong(KEY_SIGNED_PREKEY_ID, nextID)
            .putString(KEY_SIGNED_PREKEY_PUBLIC, nextPublic)
            .putString(KEY_SIGNED_PREKEY_SIGNATURE, nextSignature)
            .putString(KEY_SIGNED_PREKEY_EXPIRES_AT, expires)
            .apply()
        return Triple(nextID, nextPublic, nextSignature)
    }

    override fun initializeSession(peerUserId: Long, bundle: PeerKeyBundle) {
        knownSessions[peerUserId] = max(bundle.identityKeyVersion, 1)
        pendingOneTimePrekeys[peerUserId] = bundle.oneTimePreKeyId
    }

    override fun invalidateSession(peerUserId: Long) {
        knownSessions.remove(peerUserId)
        pendingOneTimePrekeys.remove(peerUserId)
        messageCounters.remove(peerUserId)
    }

    override fun hasSession(peerUserId: Long): Boolean = knownSessions.containsKey(peerUserId)

    override fun encrypt(plaintext: ByteArray, peerUserId: Long): Pair<String, Map<String, Any>> {
        val sessionVersion = knownSessions[peerUserId]
            ?: throw IllegalStateException("missing session with peer user=$peerUserId")
        val ciphertext = Base64.getEncoder().encodeToString(plaintext)
        val messageIndex = messageCounters.compute(peerUserId) { _, current -> (current ?: 0) + 1 } ?: 1
        val firstPreKeyID = pendingOneTimePrekeys.remove(peerUserId) ?: 0L

        val header = mapOf(
            "session_version" to sessionVersion,
            "sender_identity_pub_b64" to ensureIdentityPublicKey(),
            "sender_ephemeral_pub_b64" to "plain-ephemeral-${UUID.randomUUID()}",
            "receiver_one_time_prekey_id" to firstPreKeyID,
            "ratchet_pub_b64" to "plain-ratchet-${UUID.randomUUID()}",
            "message_index" to messageIndex
        )
        return ciphertext to header
    }

    override fun decrypt(ciphertextB64: String, header: Map<String, Any>, senderUserId: Long): ByteArray {
        knownSessions.putIfAbsent(senderUserId, 1)
        return Base64.getDecoder().decode(ciphertextB64)
    }

    private fun ensureRegistrationID(): Int {
        val existing = prefs.getInt(KEY_REGISTRATION_ID, 0)
        if (existing > 0) {
            return existing
        }
        val generated = Random.nextInt(1, 16380)
        prefs.edit().putInt(KEY_REGISTRATION_ID, generated).apply()
        return generated
    }

    private fun ensureIdentityPublicKey(): String {
        val existing = prefs.getString(KEY_IDENTITY_PUBLIC, null)
        if (!existing.isNullOrBlank()) {
            return existing
        }
        val generated = "identity-${UUID.randomUUID()}"
        prefs.edit()
            .putString(KEY_IDENTITY_PUBLIC, generated)
            .putInt(KEY_IDENTITY_VERSION, 1)
            .apply()
        return generated
    }

    private fun ensureSignedPreKey(): SignedPreKeyState {
        val now = Instant.now()
        val id = prefs.getLong(KEY_SIGNED_PREKEY_ID, 0L)
        val public = prefs.getString(KEY_SIGNED_PREKEY_PUBLIC, null)
        val signature = prefs.getString(KEY_SIGNED_PREKEY_SIGNATURE, null)
        val expiresAt = prefs.getString(KEY_SIGNED_PREKEY_EXPIRES_AT, null)
        val stillValid = !public.isNullOrBlank() && !signature.isNullOrBlank() && !expiresAt.isNullOrBlank() &&
            runCatching { Instant.parse(expiresAt).isAfter(now) }.getOrElse { false }
        if (id > 0 && stillValid) {
            return SignedPreKeyState(id, public!!, signature!!, expiresAt!!)
        }

        val nextID = max(id + 1, 1L)
        val nextPublic = "spk-${UUID.randomUUID()}"
        val nextSignature = "sig-${UUID.randomUUID()}"
        val nextExpires = now.plus(30, ChronoUnit.DAYS).toString()
        prefs.edit()
            .putLong(KEY_SIGNED_PREKEY_ID, nextID)
            .putString(KEY_SIGNED_PREKEY_PUBLIC, nextPublic)
            .putString(KEY_SIGNED_PREKEY_SIGNATURE, nextSignature)
            .putString(KEY_SIGNED_PREKEY_EXPIRES_AT, nextExpires)
            .apply()
        return SignedPreKeyState(nextID, nextPublic, nextSignature, nextExpires)
    }

    private data class SignedPreKeyState(
        val id: Long,
        val publicKey: String,
        val signature: String,
        val expiresAt: String
    )

    companion object {
        private const val KEY_REGISTRATION_ID = "registration_id"
        private const val KEY_IDENTITY_PUBLIC = "identity_public_key"
        private const val KEY_IDENTITY_VERSION = "identity_key_version"
        private const val KEY_SIGNED_PREKEY_ID = "signed_prekey_id"
        private const val KEY_SIGNED_PREKEY_PUBLIC = "signed_prekey_public"
        private const val KEY_SIGNED_PREKEY_SIGNATURE = "signed_prekey_signature"
        private const val KEY_SIGNED_PREKEY_EXPIRES_AT = "signed_prekey_expires_at"
        private const val KEY_NEXT_PREKEY_ID = "next_prekey_id"
    }
}
