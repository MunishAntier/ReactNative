package com.securemsg.signal.bridge

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.securemsg.signal.PeerKeyBundle
import com.securemsg.signal.libsignal.LibsignalSignalModule

class SignalBridgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val signal: LibsignalSignalModule by lazy {
        LibsignalSignalModule(reactApplicationContext)
    }

    override fun getName(): String = "SignalBridge"

    @ReactMethod
    fun generateInitialBundle(oneTimePreKeyCount: Int, promise: Promise) {
        try {
            val bundle = signal.generateInitialBundle(oneTimePreKeyCount)
            val result = Arguments.createMap().apply {
                putInt("registration_id", bundle.registrationId)
                putString("identity_public_key", bundle.identityPublicKey)
                putInt("identity_key_version", bundle.identityKeyVersion)
                putDouble("signed_prekey_id", bundle.signedPreKeyId.toDouble())
                putString("signed_prekey_public", bundle.signedPreKeyPublic)
                putString("signed_prekey_signature", bundle.signedPreKeySignature)
                putString("signed_prekey_expires_at", bundle.signedPreKeyExpiresAt)
                val prekeys = Arguments.createArray()
                for (pk in bundle.oneTimePreKeys) {
                    val pkMap = Arguments.createMap().apply {
                        putDouble("prekey_id", pk.preKeyId.toDouble())
                        putString("prekey_public", pk.preKeyPublic)
                    }
                    prekeys.pushMap(pkMap)
                }
                putArray("one_time_prekeys", prekeys)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("SIGNAL_ERROR", "generateInitialBundle failed: ${e.message}", e)
        }
    }

    @ReactMethod
    fun generateOneTimePreKeys(count: Int, promise: Promise) {
        try {
            val keys = signal.generateOneTimePreKeys(count)
            val result = Arguments.createArray()
            for (pk in keys) {
                val pkMap = Arguments.createMap().apply {
                    putDouble("prekey_id", pk.preKeyId.toDouble())
                    putString("prekey_public", pk.preKeyPublic)
                }
                result.pushMap(pkMap)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("SIGNAL_ERROR", "generateOneTimePreKeys failed: ${e.message}", e)
        }
    }

    @ReactMethod
    fun rotateSignedPreKey(promise: Promise) {
        try {
            val (id, publicKey, signature) = signal.rotateSignedPreKey()
            val result = Arguments.createMap().apply {
                putDouble("signed_prekey_id", id.toDouble())
                putString("signed_prekey_public", publicKey)
                putString("signed_prekey_signature", signature)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("SIGNAL_ERROR", "rotateSignedPreKey failed: ${e.message}", e)
        }
    }

    @ReactMethod
    fun initializeSession(peerUserId: Double, bundleMap: ReadableMap, promise: Promise) {
        try {
            val bundle = PeerKeyBundle(
                userId = peerUserId.toLong(),
                deviceId = bundleMap.getDouble("device_id").toLong(),
                registrationId = bundleMap.getInt("registration_id"),
                identityPublicKey = bundleMap.getString("identity_public_key")!!,
                identityKeyVersion = bundleMap.getInt("identity_key_version"),
                signedPreKeyId = bundleMap.getDouble("signed_prekey_id").toLong(),
                signedPreKeyPublic = bundleMap.getString("signed_prekey_public")!!,
                signedPreKeySignature = bundleMap.getString("signed_prekey_signature")!!,
                oneTimePreKeyId = bundleMap.getDouble("one_time_prekey_id").toLong(),
                oneTimePreKeyPublic = bundleMap.getString("one_time_prekey_public")!!
            )
            signal.initializeSession(peerUserId.toLong(), bundle)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SIGNAL_ERROR", "initializeSession failed: ${e.message}", e)
        }
    }

    @ReactMethod
    fun hasSession(peerUserId: Double, promise: Promise) {
        try {
            promise.resolve(signal.hasSession(peerUserId.toLong()))
        } catch (e: Exception) {
            promise.reject("SIGNAL_ERROR", "hasSession failed: ${e.message}", e)
        }
    }

    @ReactMethod
    fun encrypt(plaintext: String, peerUserId: Double, promise: Promise) {
        try {
            val (ciphertextB64, header) = signal.encrypt(
                plaintext.toByteArray(Charsets.UTF_8),
                peerUserId.toLong()
            )
            val headerMap = Arguments.createMap().apply {
                for ((key, value) in header) {
                    when (value) {
                        is Int -> putInt(key, value)
                        is Long -> putDouble(key, value.toDouble())
                        is String -> putString(key, value)
                        is Boolean -> putBoolean(key, value)
                        is Double -> putDouble(key, value)
                        else -> putString(key, value.toString())
                    }
                }
            }
            val result = Arguments.createMap().apply {
                putString("ciphertext_b64", ciphertextB64)
                putMap("header", headerMap)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("SIGNAL_ERROR", "encrypt failed: ${e.message}", e)
        }
    }

    @ReactMethod
    fun decrypt(ciphertextB64: String, headerMap: ReadableMap, senderUserId: Double, promise: Promise) {
        try {
            val header = mutableMapOf<String, Any>()
            val iterator = headerMap.keySetIterator()
            while (iterator.hasNextKey()) {
                val key = iterator.nextKey()
                when (headerMap.getType(key).name) {
                    "Number" -> header[key] = headerMap.getDouble(key)
                    "String" -> header[key] = headerMap.getString(key)!!
                    "Boolean" -> header[key] = headerMap.getBoolean(key)
                    else -> {}
                }
            }
            val plaintext = signal.decrypt(ciphertextB64, header, senderUserId.toLong())
            promise.resolve(String(plaintext, Charsets.UTF_8))
        } catch (e: Exception) {
            promise.reject("SIGNAL_ERROR", "decrypt failed: ${e.message}", e)
        }
    }

    @ReactMethod
    fun invalidateSession(peerUserId: Double, promise: Promise) {
        try {
            signal.invalidateSession(peerUserId.toLong())
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SIGNAL_ERROR", "invalidateSession failed: ${e.message}", e)
        }
    }
}
