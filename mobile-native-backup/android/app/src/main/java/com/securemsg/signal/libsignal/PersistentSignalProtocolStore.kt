package com.securemsg.signal.libsignal

import android.content.Context
import android.util.Base64
import org.json.JSONObject
import org.signal.libsignal.protocol.IdentityKey
import org.signal.libsignal.protocol.IdentityKeyPair
import org.signal.libsignal.protocol.InvalidKeyIdException
import org.signal.libsignal.protocol.NoSessionException
import org.signal.libsignal.protocol.SignalProtocolAddress
import org.signal.libsignal.protocol.groups.state.SenderKeyRecord
import org.signal.libsignal.protocol.state.PreKeyRecord
import org.signal.libsignal.protocol.state.SessionRecord
import org.signal.libsignal.protocol.state.SignalProtocolStore
import org.signal.libsignal.protocol.state.SignedPreKeyRecord
import org.signal.libsignal.protocol.state.impl.InMemorySignalProtocolStore
import org.signal.libsignal.protocol.util.KeyHelper
import java.util.UUID

/**
 * SignalProtocolStore implementation backed by SharedPreferences.
 * This keeps identity/session/prekey state available across process restarts.
 */
class PersistentSignalProtocolStore(context: Context) : SignalProtocolStore {
    private val prefs =
        context.getSharedPreferences("securemsg_libsignal_store", Context.MODE_PRIVATE)

    private val identityKeyPair: IdentityKeyPair
    private val registrationId: Int
    private val delegate: InMemorySignalProtocolStore

    private val preKeys = readMap(KEY_PREKEYS)
    private val signedPreKeys = readMap(KEY_SIGNED_PREKEYS)
    private val sessions = readMap(KEY_SESSIONS)
    private val identities = readMap(KEY_IDENTITIES)
    private val senderKeys = readMap(KEY_SENDER_KEYS)

    init {
        val loaded = loadOrCreateLocalIdentity()
        identityKeyPair = loaded.first
        registrationId = loaded.second
        delegate = InMemorySignalProtocolStore(identityKeyPair, registrationId)
        bootstrapFromPrefs()
    }

    private fun bootstrapFromPrefs() {
        for ((idRaw, serialized) in preKeys) {
            val id = idRaw.toIntOrNull() ?: continue
            runCatching {
                delegate.storePreKey(id, PreKeyRecord(decode(serialized)))
            }
        }
        for ((idRaw, serialized) in signedPreKeys) {
            val id = idRaw.toIntOrNull() ?: continue
            runCatching {
                delegate.storeSignedPreKey(id, SignedPreKeyRecord(decode(serialized)))
            }
        }
        for ((addressKey, serialized) in sessions) {
            val address = addressFromKey(addressKey) ?: continue
            runCatching {
                delegate.storeSession(address, SessionRecord(decode(serialized)))
            }
        }
        for ((addressKey, serialized) in identities) {
            val address = addressFromKey(addressKey) ?: continue
            runCatching {
                delegate.saveIdentity(address, IdentityKey(decode(serialized)))
            }
        }
        for ((senderKey, serialized) in senderKeys) {
            val parsed = parseSenderKey(senderKey) ?: continue
            runCatching {
                delegate.storeSenderKey(
                    parsed.first,
                    parsed.second,
                    SenderKeyRecord(decode(serialized))
                )
            }
        }
    }

    private fun loadOrCreateLocalIdentity(): Pair<IdentityKeyPair, Int> {
        val existingIdentity = prefs.getString(KEY_LOCAL_IDENTITY, null)
        val existingRegistrationId = prefs.getInt(KEY_REGISTRATION_ID, 0)
        if (!existingIdentity.isNullOrBlank() && existingRegistrationId > 0) {
            runCatching {
                return IdentityKeyPair(decode(existingIdentity)) to existingRegistrationId
            }
        }
        val generatedPair = IdentityKeyPair.generate()
        val generatedRegistrationId = KeyHelper.generateRegistrationId(false)
        prefs.edit()
            .putString(KEY_LOCAL_IDENTITY, encode(generatedPair.serialize()))
            .putInt(KEY_REGISTRATION_ID, generatedRegistrationId)
            .apply()
        return generatedPair to generatedRegistrationId
    }

    override fun getIdentityKeyPair(): IdentityKeyPair = delegate.identityKeyPair

    override fun getLocalRegistrationId(): Int = delegate.localRegistrationId

    override fun saveIdentity(address: SignalProtocolAddress, identityKey: IdentityKey): Boolean {
        val replaced = delegate.saveIdentity(address, identityKey)
        identities[addressKey(address)] = encode(identityKey.serialize())
        persistMap(KEY_IDENTITIES, identities)
        return replaced
    }

    override fun isTrustedIdentity(
        address: SignalProtocolAddress,
        identityKey: IdentityKey,
        direction: org.signal.libsignal.protocol.state.IdentityKeyStore.Direction
    ): Boolean {
        return delegate.isTrustedIdentity(address, identityKey, direction)
    }

    override fun getIdentity(address: SignalProtocolAddress): IdentityKey? {
        return delegate.getIdentity(address)
    }

    @Throws(InvalidKeyIdException::class)
    override fun loadPreKey(preKeyId: Int): PreKeyRecord = delegate.loadPreKey(preKeyId)

    override fun storePreKey(preKeyId: Int, record: PreKeyRecord) {
        delegate.storePreKey(preKeyId, record)
        preKeys[preKeyId.toString()] = encode(record.serialize())
        persistMap(KEY_PREKEYS, preKeys)
    }

    override fun containsPreKey(preKeyId: Int): Boolean = delegate.containsPreKey(preKeyId)

    override fun removePreKey(preKeyId: Int) {
        delegate.removePreKey(preKeyId)
        preKeys.remove(preKeyId.toString())
        persistMap(KEY_PREKEYS, preKeys)
    }

    override fun loadSession(address: SignalProtocolAddress): SessionRecord = delegate.loadSession(address)

    @Throws(NoSessionException::class)
    override fun loadExistingSessions(addresses: MutableList<SignalProtocolAddress>): MutableList<SessionRecord> {
        return delegate.loadExistingSessions(addresses).toMutableList()
    }

    override fun getSubDeviceSessions(name: String): MutableList<Int> {
        return delegate.getSubDeviceSessions(name).toMutableList()
    }

    override fun storeSession(address: SignalProtocolAddress, record: SessionRecord) {
        delegate.storeSession(address, record)
        sessions[addressKey(address)] = encode(record.serialize())
        persistMap(KEY_SESSIONS, sessions)
    }

    override fun containsSession(address: SignalProtocolAddress): Boolean = delegate.containsSession(address)

    override fun deleteSession(address: SignalProtocolAddress) {
        delegate.deleteSession(address)
        sessions.remove(addressKey(address))
        persistMap(KEY_SESSIONS, sessions)
    }

    override fun deleteAllSessions(name: String) {
        delegate.deleteAllSessions(name)
        val prefix = "$name|"
        val keysToRemove = sessions.keys.filter { key -> key.startsWith(prefix) }
        for (key in keysToRemove) {
            sessions.remove(key)
        }
        persistMap(KEY_SESSIONS, sessions)
    }

    @Throws(InvalidKeyIdException::class)
    override fun loadSignedPreKey(signedPreKeyId: Int): SignedPreKeyRecord {
        return delegate.loadSignedPreKey(signedPreKeyId)
    }

    override fun loadSignedPreKeys(): MutableList<SignedPreKeyRecord> {
        return delegate.loadSignedPreKeys().toMutableList()
    }

    override fun storeSignedPreKey(signedPreKeyId: Int, record: SignedPreKeyRecord) {
        delegate.storeSignedPreKey(signedPreKeyId, record)
        signedPreKeys[signedPreKeyId.toString()] = encode(record.serialize())
        persistMap(KEY_SIGNED_PREKEYS, signedPreKeys)
    }

    override fun containsSignedPreKey(signedPreKeyId: Int): Boolean {
        return delegate.containsSignedPreKey(signedPreKeyId)
    }

    override fun removeSignedPreKey(signedPreKeyId: Int) {
        delegate.removeSignedPreKey(signedPreKeyId)
        signedPreKeys.remove(signedPreKeyId.toString())
        persistMap(KEY_SIGNED_PREKEYS, signedPreKeys)
    }

    override fun storeSenderKey(
        sender: SignalProtocolAddress,
        distributionId: UUID,
        record: SenderKeyRecord
    ) {
        delegate.storeSenderKey(sender, distributionId, record)
        senderKeys[senderKey(sender, distributionId)] = encode(record.serialize())
        persistMap(KEY_SENDER_KEYS, senderKeys)
    }

    override fun loadSenderKey(sender: SignalProtocolAddress, distributionId: UUID): SenderKeyRecord {
        return delegate.loadSenderKey(sender, distributionId)
    }

    private fun senderKey(sender: SignalProtocolAddress, distributionId: UUID): String {
        return "${addressKey(sender)}#$distributionId"
    }

    private fun parseSenderKey(raw: String): Pair<SignalProtocolAddress, UUID>? {
        val split = raw.lastIndexOf('#')
        if (split <= 0 || split >= raw.length - 1) {
            return null
        }
        val address = addressFromKey(raw.substring(0, split)) ?: return null
        val distributionId = runCatching { UUID.fromString(raw.substring(split + 1)) }.getOrNull()
            ?: return null
        return address to distributionId
    }

    private fun addressKey(address: SignalProtocolAddress): String {
        return "${address.name}|${address.deviceId}"
    }

    private fun addressFromKey(raw: String): SignalProtocolAddress? {
        val split = raw.lastIndexOf('|')
        if (split <= 0 || split >= raw.length - 1) {
            return null
        }
        val name = raw.substring(0, split)
        val deviceId = raw.substring(split + 1).toIntOrNull() ?: return null
        return runCatching { SignalProtocolAddress(name, deviceId) }.getOrNull()
    }

    private fun readMap(key: String): MutableMap<String, String> {
        val raw = prefs.getString(key, "{}").orEmpty()
        return runCatching {
            val json = JSONObject(raw)
            val map = linkedMapOf<String, String>()
            val keys = json.keys()
            while (keys.hasNext()) {
                val mapKey = keys.next()
                val value = json.optString(mapKey, "")
                if (value.isNotBlank()) {
                    map[mapKey] = value
                }
            }
            map
        }.getOrElse { linkedMapOf() }
    }

    private fun persistMap(key: String, map: Map<String, String>) {
        val json = JSONObject()
        for ((k, v) in map) {
            json.put(k, v)
        }
        prefs.edit().putString(key, json.toString()).apply()
    }

    private fun encode(raw: ByteArray): String {
        return Base64.encodeToString(raw, Base64.NO_WRAP)
    }

    private fun decode(raw: String): ByteArray {
        return Base64.decode(raw, Base64.NO_WRAP)
    }

    companion object {
        private const val KEY_LOCAL_IDENTITY = "local_identity_pair_b64"
        private const val KEY_REGISTRATION_ID = "registration_id"
        private const val KEY_PREKEYS = "prekeys_json"
        private const val KEY_SIGNED_PREKEYS = "signed_prekeys_json"
        private const val KEY_SESSIONS = "sessions_json"
        private const val KEY_IDENTITIES = "identities_json"
        private const val KEY_SENDER_KEYS = "sender_keys_json"
    }
}
