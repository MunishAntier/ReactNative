package com.securemsg.app

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import com.securemsg.auth.AuthTokens
import com.securemsg.demo.DemoBootstrap
import com.securemsg.signal.SignalModule
import com.securemsg.storage.InMemoryEncryptedStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

class MainActivity : ComponentActivity() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private lateinit var bootstrap: DemoBootstrap
    private lateinit var signalModule: SignalModule
    private lateinit var sessionStore: SessionStore
    private lateinit var encryptedStore: InMemoryEncryptedStore

    private lateinit var titleView: TextView
    private lateinit var identifierInput: EditText
    private lateinit var otpInput: EditText
    private lateinit var receiverInput: EditText
    private lateinit var messageInput: EditText
    private lateinit var logView: TextView

    private lateinit var requestOtpBtn: Button
    private lateinit var verifyOtpBtn: Button
    private lateinit var sendBtn: Button
    private lateinit var syncBtn: Button
    private lateinit var logoutBtn: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(com.securemsg.R.layout.activity_main)

        bindViews()

        sessionStore = SessionStore(this)
        encryptedStore = InMemoryEncryptedStore()
        val signalSelection = SignalModuleFactory.create(this)
        signalModule = signalSelection.module
        appendLog("Signal module: ${signalSelection.implementation}")
        bootstrap = DemoBootstrap.create(
            baseUrl = BuildConfig.BACKEND_BASE_URL,
            encryptedStore = encryptedStore,
            accessTokenProvider = { sessionStore.requireAccessToken() }
        )

        bootstrap.wsClient.onEvent = { event ->
            scope.launch {
                handleWsEvent(event)
            }
        }

        requestOtpBtn.setOnClickListener { requestOtp() }
        verifyOtpBtn.setOnClickListener { verifyOtpAndLogin() }
        sendBtn.setOnClickListener { sendMessage() }
        syncBtn.setOnClickListener { syncMessages() }
        logoutBtn.setOnClickListener { logout() }

        if (sessionStore.isAuthenticated()) {
            appendLog("Session restored for user=${sessionStore.userId()}")
            connectWebSocket()
            updateAuthState()
        } else {
            updateAuthState()
        }
    }

    override fun onDestroy() {
        bootstrap.wsClient.disconnect()
        super.onDestroy()
    }

    private fun bindViews() {
        titleView = findViewById(com.securemsg.R.id.titleView)
        identifierInput = findViewById(com.securemsg.R.id.identifierInput)
        otpInput = findViewById(com.securemsg.R.id.otpInput)
        receiverInput = findViewById(com.securemsg.R.id.receiverInput)
        messageInput = findViewById(com.securemsg.R.id.messageInput)
        logView = findViewById(com.securemsg.R.id.logView)

        requestOtpBtn = findViewById(com.securemsg.R.id.requestOtpBtn)
        verifyOtpBtn = findViewById(com.securemsg.R.id.verifyOtpBtn)
        sendBtn = findViewById(com.securemsg.R.id.sendBtn)
        syncBtn = findViewById(com.securemsg.R.id.syncBtn)
        logoutBtn = findViewById(com.securemsg.R.id.logoutBtn)
    }

    private fun requestOtp() {
        val identifier = identifierInput.text.toString().trim()
        if (identifier.isBlank()) {
            toast("Enter email/phone")
            return
        }
        scope.launch {
            try {
                bootstrap.authModule.startOtp(identifier = identifier, purpose = "login")
                appendLog("OTP requested for $identifier")
                toast("OTP requested. Check server response/dev_otp.")
            } catch (err: Exception) {
                appendLog("OTP request failed: ${err.message}")
                toast(err.message ?: "OTP request failed")
            }
        }
    }

    private fun verifyOtpAndLogin() {
        val identifier = identifierInput.text.toString().trim()
        val otp = otpInput.text.toString().trim()
        if (identifier.isBlank() || otp.isBlank()) {
            toast("Enter identifier and OTP")
            return
        }

        scope.launch {
            try {
                val tokens = bootstrap.authModule.verifyOtp(
                    identifier = identifier,
                    otp = otp,
                    deviceUuid = "android-${UUID.randomUUID()}",
                    platform = "android",
                    pushToken = null
                )
                initializeSession(tokens)
                appendLog("Login success user=${tokens.userId} device=${tokens.deviceId}")
                toast("Authenticated")
            } catch (err: Exception) {
                appendLog("Login failed: ${err.message}")
                toast(err.message ?: "Login failed")
            } finally {
                updateAuthState()
            }
        }
    }

    private suspend fun initializeSession(tokens: AuthTokens) {
        sessionStore.save(tokens)

        val bundle = signalModule.generateInitialBundle(oneTimePreKeyCount = 100)
        bootstrap.signalBootstrap.uploadInitialBundle(tokens.accessToken, bundle)
        appendLog("Uploaded initial key bundle")

        connectWebSocket()
    }

    private fun connectWebSocket() {
        val token = sessionStore.accessToken() ?: return
        bootstrap.wsClient.connect(token)
        appendLog("WebSocket connected")
    }

    private fun sendMessage() {
        val receiverUserId = receiverInput.text.toString().trim().toLongOrNull()
        if (receiverUserId == null || receiverUserId <= 0) {
            toast("Enter a valid receiver id")
            return
        }
        val plaintext = messageInput.text.toString().trim()
        if (plaintext.isBlank()) {
            toast("Enter message")
            return
        }
        if (!sessionStore.isAuthenticated()) {
            toast("Login first")
            return
        }

        scope.launch {
            try {
                if (!signalModule.hasSession(receiverUserId)) {
                    val bundle = bootstrap.signalBootstrap.fetchPeerBundle(sessionStore.requireAccessToken(), receiverUserId)
                    signalModule.initializeSession(receiverUserId, bundle)
                    appendLog("Session created with receiver=$receiverUserId")
                }
                val (ciphertextB64, header) = signalModule.encrypt(plaintext.toByteArray(), receiverUserId)
                val payload = mapOf(
                    "type" to "message.send",
                    "client_message_id" to UUID.randomUUID().toString(),
                    "receiver_user_id" to receiverUserId,
                    "ciphertext_b64" to ciphertextB64,
                    "header" to header,
                    "sent_at_client" to Instant.now().toString()
                )
                bootstrap.wsClient.send(payload)
                appendLog("Sent message -> receiver=$receiverUserId")
                messageInput.setText("")
            } catch (err: Exception) {
                appendLog("Send failed: ${err.message}")
                toast(err.message ?: "Send failed")
            }
        }
    }

    private fun syncMessages() {
        if (!sessionStore.isAuthenticated()) {
            toast("Login first")
            return
        }
        scope.launch {
            try {
                val since = encryptedStore.getLastSyncTimestamp() ?: Instant.EPOCH.toString()
                bootstrap.syncWorker.syncSince(since)
                val all = encryptedStore.allMessages()
                appendLog("Synced ${all.size} stored ciphertext messages")
            } catch (err: Exception) {
                appendLog("Sync failed: ${err.message}")
                toast(err.message ?: "Sync failed")
            }
        }
    }

    private fun logout() {
        if (!sessionStore.isAuthenticated()) {
            return
        }
        scope.launch {
            try {
                bootstrap.authModule.logout(sessionStore.requireAccessToken())
            } catch (_: Exception) {
            }
            bootstrap.wsClient.disconnect()
            sessionStore.clear()
            appendLog("Logged out")
            updateAuthState()
        }
    }

    private suspend fun handleWsEvent(event: Map<String, Any>) {
        val eventType = event["type"]?.toString() ?: "unknown"
        when (eventType) {
            "message.new" -> {
                val ciphertext = event["ciphertext_b64"]?.toString().orEmpty()
                val senderId = event["sender_user_id"].toLongSafe()
                val messageId = event["server_message_id"].toLongSafe()
                val conversationId = event["conversation_id"].toLongSafe()
                val header = event["header"] as? Map<String, Any> ?: emptyMap()

                val decrypted = runCatching {
                    val bytes = signalModule.decrypt(ciphertext, header, senderId)
                    String(bytes)
                }.getOrElse { "<decrypt failed>" }

                encryptedStore.saveCiphertextMessage(
                    id = messageId,
                    conversationId = conversationId,
                    senderId = senderId,
                    receiverId = sessionStore.userId(),
                    ciphertextB64 = ciphertext,
                    headerJson = JSONObject(header).toString(),
                    createdAt = Instant.now().toString()
                )
                appendLog("message.new from=$senderId text=$decrypted")

                bootstrap.wsClient.send(mapOf("type" to "message.ack.delivered", "server_message_id" to messageId))
                bootstrap.wsClient.send(mapOf("type" to "message.ack.read", "server_message_id" to messageId))
            }

            "message.status" -> {
                appendLog("message.status $event")
            }

            "prekeys.low" -> {
                appendLog("prekeys.low -> upload more prekeys")
                val refreshed = signalModule.generateOneTimePreKeys(count = 100)
                try {
                    bootstrap.signalBootstrap.uploadOneTimePreKeys(sessionStore.requireAccessToken(), refreshed)
                } catch (err: Exception) {
                    appendLog("prekeys upload failed: ${err.message}")
                }
            }

            "session.identity_changed" -> {
                val changedPeerID = event["changed_user_id"].toLongSafe()
                if (changedPeerID > 0) {
                    signalModule.invalidateSession(changedPeerID)
                }
                appendLog("identity changed: $event")
            }

            else -> appendLog("ws event: $event")
        }
    }

    private fun updateAuthState() {
        val authenticated = sessionStore.isAuthenticated()
        titleView.text = if (authenticated) {
            "Secure Messaging (user=${sessionStore.userId()})"
        } else {
            "Secure Messaging"
        }
        sendBtn.isEnabled = authenticated
        syncBtn.isEnabled = authenticated
        logoutBtn.isEnabled = authenticated
        verifyOtpBtn.isEnabled = true
        requestOtpBtn.isEnabled = true
    }

    private fun appendLog(line: String) {
        logView.append("$line\n")
    }

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    private fun Any?.toLongSafe(): Long {
        return when (this) {
            is Number -> this.toLong()
            is String -> this.toLongOrNull() ?: 0L
            else -> 0L
        }
    }
}
