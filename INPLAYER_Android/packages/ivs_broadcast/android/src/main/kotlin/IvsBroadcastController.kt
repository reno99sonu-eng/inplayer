package com.inplayer.ivsbroadcast

import android.os.Handler
import android.os.Looper
import android.content.Context
import android.view.SurfaceView
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import com.amazonaws.ivs.broadcast.AudioDevice
import com.amazonaws.ivs.broadcast.BroadcastException
import com.amazonaws.ivs.broadcast.BroadcastSession
import com.amazonaws.ivs.broadcast.Device
import com.amazonaws.ivs.broadcast.ImageDevice
import com.amazonaws.ivs.broadcast.ImagePreviewSurfaceView
import com.amazonaws.ivs.broadcast.ImagePreviewView
import com.amazonaws.ivs.broadcast.Presets

/**
 * Every single reference to the Amazon IVS broadcast SDK in this app lives in
 * this one class, and nothing else loads it.
 *
 * That is deliberate, not tidiness. The IVS broadcast AAR declares
 * minSdkVersion 28 while the app itself still ships to Android 7 and 8
 * phones, so the manifest merge is waived (see AndroidManifest.xml) and the
 * classes must never be *resolved* on an older device. Keeping them all
 * behind one class means the ART verifier only ever touches them the first
 * time this class is instantiated — which IvsBroadcastPlugin only does after
 * checking Build.VERSION.SDK_INT >= 28.
 *
 * Behaviourally this is a straight port of what app/live/page.tsx does in the
 * browser with amazon-ivs-web-broadcast:
 *
 *   web                                        here
 *   ─────────────────────────────────────────  ────────────────────────────────
 *   IVSBroadcastClient.create({                BroadcastSession(ctx, listener,
 *     streamConfig: STANDARD_LANDSCAPE,          Presets.Configuration
 *     ingestEndpoint })                          .STANDARD_LANDSCAPE, devices)
 *   getUserMedia({ video, audio })             Presets.Devices.FRONT_CAMERA(ctx)
 *   client.attachPreview(canvas)               see "the preview ladder" below
 *   client.startBroadcast(streamKey)           session.start(rtmpsUrl, streamKey)
 *   client.stopBroadcast()                     session.stop()
 *   audioTrack.enabled = false                 AudioDevice.setGain(0f)
 *   videoTrack.enabled = false                 mixer.unbind(camera)
 *
 * The same AWS IVS channel and the same ingestEndpoint + streamKey that
 * /api/live/ivs-create already returns are used unchanged — nothing on the
 * backend needed to move for this.
 */
internal class IvsBroadcastController(
    private val context: Context,
    private val emit: (Map<String, Any?>) -> Unit,
) {
    private companion object {
        /** How often the mounted preview is checked for signs of life. */
        const val PREVIEW_POLL_MS = 400L

        /** Drop to the next rung of the preview ladder after this long. */
        const val PREVIEW_TIER_1_AT_MS = 1_600L
        const val PREVIEW_TIER_2_AT_MS = 3_600L

        /** Stop trying and tell the UI the truth. */
        const val PREVIEW_GIVE_UP_AT_MS = 6_500L

        /** exchangeDevices callback that never arrives. */
        const val CAMERA_SWITCH_TIMEOUT_MS = 8_000L

        /** release() waiting on a stop() that never reports DISCONNECTED. */
        const val RELEASE_BACKSTOP_MS = 4_000L
    }

    private val main = Handler(Looper.getMainLooper())

    private var session: BroadcastSession? = null
    private var container: FrameLayout? = null

    private var cameraDevice: Device? = null
    private var micDevice: Device? = null

    /** Mixer slot the camera was bound to, remembered across a camera-off. */
    private var cameraSlot: String? = null

    /**
     * Runs once the session reports DISCONNECTED. release() blocks while a
     * stop() is still in flight, and blocking here means blocking the main
     * thread — i.e. an ANR — so the teardown waits for that callback instead,
     * with a timer as the backstop.
     */
    private var onDisconnected: (() -> Unit)? = null

    private var usingFrontCamera = true
    private var micMuted = false
    private var cameraEnabled = true

    val isFrontCamera: Boolean get() = usingFrontCamera
    val isMicMuted: Boolean get() = micMuted
    val isCameraEnabled: Boolean get() = cameraEnabled

    // ── the preview ladder ──────────────────────────────────────────────
    //
    // A camera preview embedded in Flutter is the single most device-specific
    // thing in this whole feature, and "renders black on some phones" is the
    // classic way it fails. Three things are done about that.
    //
    // 1. A preview is never reused. AWS is explicit that a detached preview
    //    "is destroyed, and cannot be used again — if you need to, please
    //    create a new one", so every mount builds a fresh view.
    //
    // 2. There is a ladder, not a single bet. The SDK offers three
    //    independent rendering paths, and if one is broken on a given OEM the
    //    next one usually isn't:
    //      tier 0  session.getPreviewView()          composited output, TextureView
    //      tier 1  camera.getPreviewTextureView()    raw camera, TextureView
    //      tier 2  camera.getPreviewSurfaceView()    raw camera, SurfaceView
    //    Tier 0 is first because it shows what is genuinely going out. Tier 2
    //    is last but is a completely different rendering path from the other
    //    two — SurfaceView instead of TextureView — which is what makes it a
    //    real fallback rather than a retry.
    //
    // 3. If none of them come up, the UI is told so plainly. The preview is a
    //    local convenience; the broadcast does not depend on it, and a person
    //    staring at a black rectangle must not be left thinking they are off
    //    air when they are not.

    private var previewView: View? = null
    private var previewTier = 0
    private var previewWatch: Runnable? = null
    private var previewStartedAt = 0L
    private var previewReported = false

    fun attachContainer(view: FrameLayout) {
        container = view
        restartPreview()
    }

    fun detachContainer(view: FrameLayout) {
        if (container !== view) return
        cancelPreviewWatch()
        dropPreview()
        container = null
    }

    /** Rebuilds the preview from the top of the ladder. */
    fun refreshPreview() {
        restartPreview()
    }

    private fun dropPreview() {
        val view = previewView ?: return
        previewView = null
        (view.parent as? ViewGroup)?.removeView(view)
    }

    private fun cancelPreviewWatch() {
        previewWatch?.let { main.removeCallbacks(it) }
        previewWatch = null
    }

    private fun restartPreview() {
        cancelPreviewWatch()
        previewTier = 0
        previewReported = false
        previewStartedAt = System.currentTimeMillis()
        mountPreview()
        schedulePreviewWatch()
    }

    private fun buildPreview(tier: Int): View? {
        val s = session ?: return null
        val camera = cameraDevice as? ImageDevice
        return try {
            when (tier) {
                0 -> s.getPreviewView()
                1 -> camera?.getPreviewTextureView()
                2 -> camera?.getPreviewSurfaceView()
                else -> null
            }
        } catch (e: Throwable) {
            emitError("preview", "tier $tier: $e", false)
            null
        }
    }

    private fun mountPreview() {
        val holder = container ?: return
        if (session == null) return

        dropPreview()
        val view = buildPreview(previewTier) ?: return

        try {
            holder.removeAllViews()
            view.layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            // Mirror the front camera the way a webcam preview does in a
            // browser, and don't mirror the back one.
            when (view) {
                is ImagePreviewView -> view.setMirrored(usingFrontCamera)
                is ImagePreviewSurfaceView -> view.setMirrored(usingFrontCamera)
            }
            holder.addView(view)
            previewView = view
            // Flutter sizes the platform view's root, not its children, and a
            // child added after that first layout can otherwise sit at 0x0
            // forever — which looks exactly like a broken camera.
            holder.requestLayout()
            holder.invalidate()
        } catch (e: Throwable) {
            emitError("preview", "mount tier $previewTier: $e", false)
        }
    }

    /**
     * A view is only counted as working once it has real bounds AND its
     * underlying surface exists. Bounds alone are not enough: a TextureView
     * lays out fine and still shows black when its SurfaceTexture never
     * arrives, which is the exact failure being defended against.
     */
    private fun previewLooksAlive(): Boolean {
        val view = previewView ?: return false
        if (!view.isAttachedToWindow) return false
        if (view.width <= 0 || view.height <= 0) return false
        return when (view) {
            is TextureView -> view.isAvailable
            is SurfaceView -> view.holder?.surface?.isValid == true
            else -> true
        }
    }

    private fun schedulePreviewWatch() {
        cancelPreviewWatch()
        val task = object : Runnable {
            override fun run() {
                if (session == null || container == null) {
                    previewWatch = null
                    return
                }
                if (previewLooksAlive()) {
                    reportPreview(true)
                    previewWatch = null
                    return
                }

                val elapsed = System.currentTimeMillis() - previewStartedAt
                val wantedTier = when {
                    elapsed >= PREVIEW_TIER_2_AT_MS -> 2
                    elapsed >= PREVIEW_TIER_1_AT_MS -> 1
                    else -> 0
                }
                if (wantedTier != previewTier) {
                    previewTier = wantedTier
                    mountPreview()
                } else if (previewView == null) {
                    // The container or the camera wasn't ready when we tried;
                    // try the same rung again rather than burning a fallback.
                    mountPreview()
                }

                if (elapsed >= PREVIEW_GIVE_UP_AT_MS) {
                    reportPreview(false)
                    previewWatch = null
                    return
                }
                main.postDelayed(this, PREVIEW_POLL_MS)
            }
        }
        previewWatch = task
        main.postDelayed(task, PREVIEW_POLL_MS)
    }

    private fun reportPreview(ready: Boolean) {
        if (previewReported) return
        previewReported = true
        send(mapOf("event" to "preview", "ready" to ready, "tier" to previewTier))
    }

    // ── broadcast lifecycle ─────────────────────────────────────────────

    /**
     * @param url       full RTMPS ingest URL, i.e. rtmps://<ingestEndpoint>:443/app/
     * @param streamKey the IVS stream key from /api/live/ivs-create
     * @param portrait  false = STANDARD_LANDSCAPE, the same 16:9 config the
     *                  website broadcasts with (and the shape the watch page
     *                  plays back in)
     */
    fun start(url: String, streamKey: String, portrait: Boolean, front: Boolean) {
        // Synchronous: a half-released session still holds the camera this
        // one is about to ask for.
        stop(immediate = true)

        usingFrontCamera = front
        micMuted = false
        cameraEnabled = true

        val configuration =
            if (portrait) Presets.Configuration.STANDARD_PORTRAIT
            else Presets.Configuration.STANDARD_LANDSCAPE

        val devices =
            if (front) Presets.Devices.FRONT_CAMERA(context)
            else Presets.Devices.BACK_CAMERA(context)

        val listener = object : BroadcastSession.Listener() {
            override fun onStateChanged(state: BroadcastSession.State) {
                send(mapOf("event" to "state", "state" to state.name))
                if (state == BroadcastSession.State.DISCONNECTED) {
                    val pending = onDisconnected
                    onDisconnected = null
                    // Lambda literal, not the value itself: Kotlin only
                    // SAM-converts a literal into a java.lang.Runnable.
                    if (pending != null) main.post { pending() }
                }
            }

            override fun onError(exception: BroadcastException) {
                emitError(
                    exception.source ?: "broadcast",
                    exception.detail ?: exception.toString(),
                    exception.isFatal,
                )
            }

            override fun onDeviceRemoved(descriptor: Device.Descriptor) {
                // Another app grabbing the camera mid-broadcast is a real
                // thing on Android, and silently going black is the worst
                // possible way to handle it.
                if (descriptor.type == Device.Descriptor.DeviceType.CAMERA) {
                    send(mapOf("event" to "deviceLost", "kind" to "camera"))
                } else if (descriptor.type == Device.Descriptor.DeviceType.MICROPHONE) {
                    send(mapOf("event" to "deviceLost", "kind" to "microphone"))
                }
            }
        }

        val s = BroadcastSession(context, listener, configuration, devices)
        session = s

        // Devices first, then start — the same order as the website
        // (addVideoInputDevice / addAudioInputDevice, then startBroadcast).
        s.awaitDeviceChanges {
            try {
                cacheDevices(s)
                restartPreview()
                s.start(url, streamKey)
            } catch (e: Throwable) {
                emitError("start", e.toString(), true)
            }
        }
    }

    private fun cacheDevices(s: BroadcastSession) {
        cameraDevice = null
        micDevice = null
        for (device in s.listAttachedDevices()) {
            when (device.descriptor.type) {
                Device.Descriptor.DeviceType.CAMERA -> cameraDevice = device
                Device.Descriptor.DeviceType.MICROPHONE -> micDevice = device
                else -> Unit
            }
        }
        cameraDevice?.let { cameraSlot = s.mixer.getDeviceBinding(it) }
        send(
            mapOf(
                "event" to "cameras",
                "positions" to cameraPositions(),
                "front" to usingFrontCamera,
            ),
        )
    }

    /**
     * Which physical camera positions this phone actually has. A tablet or a
     * cheap handset with only one camera should not be shown a flip button
     * that can't do anything.
     */
    private fun cameraPositions(): List<String> {
        return try {
            BroadcastSession.listAvailableDevices(context)
                .filter { it.type == Device.Descriptor.DeviceType.CAMERA }
                .map { it.position.name }
                .distinct()
        } catch (e: Throwable) {
            emptyList()
        }
    }

    /**
     * Ends the broadcast and gives the camera and microphone back.
     *
     * [immediate] releases on the spot instead of waiting for DISCONNECTED —
     * used only when a new session is about to be created and would otherwise
     * fight the old one for the camera. Everywhere else the deferred path is
     * correct, because release() blocks while stop() is still running.
     */
    fun stop(immediate: Boolean = false) {
        cancelPreviewWatch()
        dropPreview()
        container?.removeAllViews()

        val s = session ?: return
        session = null
        cameraDevice = null
        micDevice = null
        cameraSlot = null

        var released = false
        val release = {
            if (!released) {
                released = true
                try {
                    s.release()
                } catch (e: Throwable) {
                    emitError("release", e.toString(), false)
                }
            }
        }
        onDisconnected = release

        try {
            s.stop()
        } catch (e: Throwable) {
            // Already disconnected, or never connected. Nothing to salvage —
            // but release still has to run or the camera stays open, which is
            // the one outcome this whole screen exists to prevent.
        }

        if (immediate) {
            onDisconnected = null
            release()
            return
        }

        // Backstop in case DISCONNECTED never arrives.
        main.postDelayed({
            onDisconnected = null
            release()
        }, RELEASE_BACKSTOP_MS)
    }

    // ── in-broadcast controls (website parity) ──────────────────────────

    /** Website: `audioTrack.enabled = !audioTrack.enabled`. */
    fun setMicMuted(muted: Boolean): Boolean {
        val device = micDevice as? AudioDevice ?: return false
        return try {
            device.setGain(if (muted) 0f else 1f)
            micMuted = muted
            true
        } catch (e: Throwable) {
            emitError("mic", e.toString(), false)
            false
        }
    }

    /**
     * Website: `videoTrack.enabled = !videoTrack.enabled` — viewers get
     * black, the stream itself keeps running.
     *
     * Unbinding from the mixer slot is the equivalent that does NOT release
     * the camera hardware, so turning it back on is instant and can't fail
     * on a camera another app grabbed in the meantime.
     */
    fun setCameraEnabled(enabled: Boolean): Boolean {
        val s = session ?: return false
        val camera = cameraDevice ?: return false
        return try {
            if (enabled) {
                val slots = s.mixer.getSlots() ?: return false
                val slot = cameraSlot ?: slots.firstOrNull()?.name ?: return false
                s.mixer.bind(camera, slot)
            } else {
                cameraSlot = s.mixer.getDeviceBinding(camera) ?: cameraSlot
                s.mixer.unbind(camera)
            }
            cameraEnabled = enabled
            true
        } catch (e: Throwable) {
            emitError("camera", e.toString(), false)
            false
        }
    }

    /**
     * Not something the website has (a laptop has one webcam), but a phone
     * without a flip button is a live stream you can only point at yourself.
     *
     * Failure is non-fatal on purpose, and there is deliberately no
     * detach-then-attach fallback: a detach that isn't followed by a
     * successful attach leaves the broadcast with no camera at all, which is
     * far worse than a flip that simply didn't happen.
     */
    fun switchCamera(onDone: (Boolean) -> Unit) {
        val s = session ?: run { onDone(false); return }
        val current = cameraDevice ?: run { onDone(false); return }
        val wantFront = !usingFrontCamera
        val wantedPosition =
            if (wantFront) Device.Descriptor.Position.FRONT else Device.Descriptor.Position.BACK

        val next = try {
            BroadcastSession.listAvailableDevices(context).firstOrNull {
                it.type == Device.Descriptor.DeviceType.CAMERA && it.position == wantedPosition
            }
        } catch (e: Throwable) {
            emitError("switchCamera", e.toString(), false)
            null
        }

        if (next == null) {
            onDone(false)
            return
        }

        // exchangeDevices hands back through a callback that must fire
        // exactly once: it is wired straight to a Flutter MethodChannel
        // Result, and answering that twice crashes the engine while never
        // answering it hangs the Dart future forever.
        var answered = false
        fun answer(ok: Boolean) {
            if (answered) return
            answered = true
            main.post { onDone(ok) }
        }

        try {
            s.exchangeDevices(current, next) { device ->
                cameraDevice = device
                usingFrontCamera = wantFront
                cameraSlot = try {
                    s.mixer.getDeviceBinding(device)
                } catch (e: Throwable) {
                    cameraSlot
                }
                if (!cameraEnabled) setCameraEnabled(false)
                // Tiers 1 and 2 preview the camera device itself, so the old
                // view is now pointing at a device that no longer exists.
                // Rebuilding also re-applies mirroring for the new facing.
                main.post { restartPreview() }
                answer(true)
            }
            // Backstop for a callback that never arrives (a camera another
            // app has grabbed, for instance). The broadcast itself is
            // unaffected — only the flip silently didn't happen.
            main.postDelayed({ answer(false) }, CAMERA_SWITCH_TIMEOUT_MS)
        } catch (e: Throwable) {
            emitError("switchCamera", e.toString(), false)
            answer(false)
        }
    }

    /**
     * IVS callbacks arrive on its own threads; Flutter platform channels may
     * only be touched from the main thread, so everything funnels through
     * here rather than calling [emit] directly.
     */
    private fun send(payload: Map<String, Any?>) {
        main.post { emit(payload) }
    }

    private fun emitError(source: String, detail: String, fatal: Boolean) {
        send(
            mapOf(
                "event" to "error",
                "source" to source,
                "detail" to detail,
                "fatal" to fatal,
            ),
        )
    }
}
