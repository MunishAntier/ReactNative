package com.securemsg.app

import android.content.Context
import com.securemsg.signal.SignalModule
import com.securemsg.signal.libsignal.LibsignalSignalModule

data class SignalModuleSelection(
    val module: SignalModule,
    val implementation: String
)

object SignalModuleFactory {
    fun create(context: Context): SignalModuleSelection {
        return try {
            SignalModuleSelection(
                module = LibsignalSignalModule(context),
                implementation = "libsignal-client"
            )
        } catch (err: Throwable) {
            SignalModuleSelection(
                module = PlainSignalModule(context),
                implementation = "plain-fallback (${err::class.java.simpleName})"
            )
        }
    }
}
