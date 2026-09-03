package com.inplayer.ivsbroadcast

import android.content.Context
import android.view.View
import android.widget.FrameLayout
import io.flutter.plugin.common.StandardMessageCodec
import io.flutter.plugin.platform.PlatformView
import io.flutter.plugin.platform.PlatformViewFactory

// The camera-preview half of the plugin. Same package as IvsBroadcastPlugin,
// which lives one directory down under com/inplayer/ivsbroadcast/ purely
// because the Flutter tool checks for it there by literal path; everything in
// src/main/kotlin compiles together regardless of folder, so splitting the
// two costs nothing and keeps each file about one thing.

/** Lets the preview PlatformView find whatever session is (or will be) live. */
interface PreviewHost {
    fun attachPreviewContainer(view: FrameLayout)
    fun detachPreviewContainer(view: FrameLayout)
}

internal class PreviewFactory(private val host: PreviewHost) :
    PlatformViewFactory(StandardMessageCodec.INSTANCE) {
    override fun create(context: Context, viewId: Int, args: Any?): PlatformView =
        IvsPreviewPlatformView(context, host)
}

/**
 * An empty black frame that the IVS composited preview (an ImagePreviewView,
 * which is a TextureView) gets dropped into once a session exists. Kept
 * deliberately dumb — it knows nothing about IVS, so it costs nothing on a
 * device that can't broadcast, and it can be created and destroyed by
 * Flutter at any point in the broadcast lifecycle without ordering bugs.
 */
internal class IvsPreviewPlatformView(context: Context, private val host: PreviewHost) :
    PlatformView {

    private val container = FrameLayout(context).apply {
        setBackgroundColor(android.graphics.Color.BLACK)
    }

    init {
        host.attachPreviewContainer(container)
    }

    override fun getView(): View = container

    override fun dispose() {
        host.detachPreviewContainer(container)
        container.removeAllViews()
    }
}
