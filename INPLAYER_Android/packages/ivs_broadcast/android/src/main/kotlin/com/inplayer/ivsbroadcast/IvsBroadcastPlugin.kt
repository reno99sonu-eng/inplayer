package com.inplayer.ivsbroadcast

import android.content.Context
import android.os.Build
import android.widget.FrameLayout
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * Flutter entry point for native Amazon IVS broadcasting.
 *
 * NOTE ON THE FILE LAYOUT: Kotlin does not care where a file sits relative to
 * its package, but the Flutter tool does — it literally checks for
 * `android/src/main/kotlin/<androidPackage as a path>/<pluginClass>.kt` and
 * refuses to run `pub get` without it. So this one class lives in the nested
 * directory the tool insists on, and the preview plumbing it uses sits beside
 * it in the flat `kotlin/` folder (same package, same compilation unit).
 *
 * This class contains NO reference to any IVS type — see the long note in
 * IvsBroadcastController for why that separation is load-bearing rather than
 * stylistic. Everything here is plain Android + Flutter embedding API, so it
 * loads and runs safely on an Android 7 phone that can never broadcast; on
 * those, `isSupported` answers false and the Dart side keeps the old
 * stream-key / external-encoder path.
 */
class IvsBroadcastPlugin :
    FlutterPlugin,
    MethodChannel.MethodCallHandler,
    EventChannel.StreamHandler,
    PreviewHost {

    private companion object {
        const val METHOD_CHANNEL = "inplayer/ivs_broadcast"
        const val EVENT_CHANNEL = "inplayer/ivs_broadcast/events"
        const val PREVIEW_VIEW_TYPE = "inplayer/ivs_preview"

        /** The IVS broadcast SDK's own floor: Android 9.0. */
        const val MIN_BROADCAST_SDK = Build.VERSION_CODES.P
    }

    private var methodChannel: MethodChannel? = null
    private var eventChannel: EventChannel? = null
    private var sink: EventChannel.EventSink? = null
    private var appContext: Context? = null

    private var controller: IvsBroadcastController? = null

    /**
     * The preview PlatformView can be built before a broadcast is ever
     * started (the Go Live screen shows the frame while the form is still
     * being filled in), so a container that arrives early is held here and
     * handed to the controller the moment one exists.
     */
    private var container: FrameLayout? = null

    private val supported: Boolean
        get() = Build.VERSION.SDK_INT >= MIN_BROADCAST_SDK

    // ── FlutterPlugin ───────────────────────────────────────────────────

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        appContext = binding.applicationContext

        methodChannel = MethodChannel(binding.binaryMessenger, METHOD_CHANNEL).apply {
            setMethodCallHandler(this@IvsBroadcastPlugin)
        }
        eventChannel = EventChannel(binding.binaryMessenger, EVENT_CHANNEL).apply {
            setStreamHandler(this@IvsBroadcastPlugin)
        }
        binding.platformViewRegistry.registerViewFactory(
            PREVIEW_VIEW_TYPE,
            PreviewFactory(this),
        )
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        // A live broadcast must not outlive the engine — that is exactly the
        // "camera light stays on with nothing being streamed" case the
        // website's watchdog exists to prevent. Nothing is going to deliver a
        // DISCONNECTED callback to a dying engine, so this one releases now.
        controller?.stop(true)
        controller = null
        methodChannel?.setMethodCallHandler(null)
        methodChannel = null
        eventChannel?.setStreamHandler(null)
        eventChannel = null
        sink = null
        appContext = null
    }

    // ── EventChannel ────────────────────────────────────────────────────

    override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
        sink = events
    }

    override fun onCancel(arguments: Any?) {
        sink = null
    }

    // ── MethodChannel ───────────────────────────────────────────────────

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "isSupported" -> result.success(supported)

            "start" -> {
                if (!supported) {
                    result.error(
                        "unsupported",
                        "Broadcasting from the app needs Android 9 or newer.",
                        null,
                    )
                    return
                }
                val url = call.argument<String>("url")
                val streamKey = call.argument<String>("streamKey")
                if (url.isNullOrBlank() || streamKey.isNullOrBlank()) {
                    result.error("bad_args", "url and streamKey are required.", null)
                    return
                }
                val portrait = call.argument<Boolean>("portrait") ?: false
                val front = call.argument<Boolean>("frontCamera") ?: true
                try {
                    val ctrl = ensureController()
                    if (ctrl == null) {
                        result.error("no_context", "Plugin is not attached.", null)
                        return
                    }
                    ctrl.start(url, streamKey, portrait, front)
                    result.success(true)
                } catch (e: Throwable) {
                    stopBroadcast()
                    result.error("start_failed", e.toString(), null)
                }
            }

            "stop" -> {
                stopBroadcast()
                result.success(true)
            }

            "setMicMuted" -> {
                val muted = call.argument<Boolean>("muted") ?: false
                result.success(controller?.setMicMuted(muted) ?: false)
            }

            "setCameraEnabled" -> {
                val enabled = call.argument<Boolean>("enabled") ?: true
                result.success(controller?.setCameraEnabled(enabled) ?: false)
            }

            "switchCamera" -> {
                val ctrl = controller
                if (ctrl == null) {
                    result.success(false)
                } else {
                    ctrl.switchCamera { ok -> result.success(ok) }
                }
            }

            "isFrontCamera" -> result.success(controller?.isFrontCamera ?: true)

            // Rebuild the camera preview from the top of the fallback ladder.
            // Called when the app comes back to the foreground, where Android
            // may well have torn the preview's surface down behind our back.
            "refreshPreview" -> {
                controller?.refreshPreview()
                result.success(true)
            }

            else -> result.notImplemented()
        }
    }

    // ── PreviewHost ─────────────────────────────────────────────────────

    override fun attachPreviewContainer(view: FrameLayout) {
        container = view
        controller?.attachContainer(view)
    }

    override fun detachPreviewContainer(view: FrameLayout) {
        controller?.detachContainer(view)
        if (container === view) container = null
    }

    // ── internals ───────────────────────────────────────────────────────

    private fun ensureController(): IvsBroadcastController? {
        controller?.let { return it }
        val ctx = appContext ?: return null
        if (!supported) return null
        val created = IvsBroadcastController(ctx) { payload -> emit(payload) }
        controller = created
        container?.let { created.attachContainer(it) }
        return created
    }

    /**
     * Ends any live session but deliberately KEEPS the controller instance.
     *
     * Tearing the controller down here and building a fresh one on the next
     * start would mean two objects racing for the same camera while the old
     * session is still releasing. Reusing it means the next start() tears its
     * own predecessor down synchronously first, which is the only ordering
     * that can't drop a broadcast on the floor.
     */
    private fun stopBroadcast() {
        val ctrl = controller ?: return
        try {
            ctrl.stop()
        } catch (e: Throwable) {
            emit(
                mapOf(
                    "event" to "error",
                    "source" to "stop",
                    "detail" to e.toString(),
                    "fatal" to false,
                ),
            )
        }
    }

    private fun emit(payload: Map<String, Any?>) {
        sink?.success(payload)
    }
}
