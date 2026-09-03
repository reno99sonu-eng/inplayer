import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
// PlatformViewHitTestBehavior lives in rendering, and widgets.dart does not
// re-export it.
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

/// Mirrors `BroadcastSession.State` in the Amazon IVS Android SDK.
enum IvsBroadcastState {
  /// No session, or one that never initialised.
  invalid,

  /// A session exists but is not sending anything.
  disconnected,

  /// Handshaking with the IVS ingest endpoint.
  connecting,

  /// Genuinely live — this is the only state that means viewers can see you.
  connected,

  /// The session hit an error it could not recover from.
  error,
}

/// Something the native broadcast session reported.
@immutable
sealed class IvsBroadcastEvent {
  const IvsBroadcastEvent();
}

/// The session moved to a new [IvsBroadcastState].
@immutable
class IvsStateEvent extends IvsBroadcastEvent {
  const IvsStateEvent(this.state);

  final IvsBroadcastState state;

  @override
  String toString() => 'IvsStateEvent($state)';
}

/// Whether the embedded camera preview actually came up on this device.
///
/// The native side climbs a ladder of three independent rendering paths
/// before giving up. [ready] false means all three failed on this phone —
/// the broadcast is unaffected, but the person should be told rather than
/// left staring at a black rectangle wondering if they are off air.
@immutable
class IvsPreviewEvent extends IvsBroadcastEvent {
  const IvsPreviewEvent({required this.ready, required this.tier});

  final bool ready;

  /// 0 = composited session preview, 1 = camera TextureView,
  /// 2 = camera SurfaceView. Useful only for diagnosing a device.
  final int tier;

  @override
  String toString() => 'IvsPreviewEvent(ready: $ready, tier: $tier)';
}

/// Which camera positions this phone actually has.
@immutable
class IvsCamerasEvent extends IvsBroadcastEvent {
  const IvsCamerasEvent({required this.positions, required this.front});

  /// e.g. `{'FRONT', 'BACK'}`. A single entry means there is nothing to
  /// flip to and the flip control should not be offered.
  final Set<String> positions;
  final bool front;

  bool get canSwitch => positions.length > 1;

  @override
  String toString() => 'IvsCamerasEvent($positions, front: $front)';
}

/// The camera or microphone was taken away mid-broadcast — usually another
/// app grabbing it. Going silently black is the worst way to handle this.
@immutable
class IvsDeviceLostEvent extends IvsBroadcastEvent {
  const IvsDeviceLostEvent(this.kind);

  /// 'camera' or 'microphone'.
  final String kind;

  @override
  String toString() => 'IvsDeviceLostEvent($kind)';
}

/// Something went wrong. [fatal] is the SDK's own judgement: a non-fatal
/// error is worth surfacing but the broadcast is still running.
@immutable
class IvsErrorEvent extends IvsBroadcastEvent {
  const IvsErrorEvent({
    required this.source,
    required this.detail,
    required this.fatal,
  });

  final String source;
  final String detail;
  final bool fatal;

  @override
  String toString() => 'IvsErrorEvent($source: $detail, fatal: $fatal)';
}

/// Native Amazon IVS broadcasting — the app-side equivalent of what
/// `app/live/page.tsx` does in the browser with `amazon-ivs-web-broadcast`.
///
/// Same AWS IVS channel, same `ingestEndpoint` + `streamKey` that
/// `POST /api/live/ivs-create` already returns. Nothing on the backend
/// changed to support this.
class IvsBroadcast {
  IvsBroadcast._();

  static const MethodChannel _method = MethodChannel('inplayer/ivs_broadcast');
  static const EventChannel _events = EventChannel(
    'inplayer/ivs_broadcast/events',
  );

  static Stream<IvsBroadcastEvent>? _stream;

  /// The standard IVS RTMPS ingest URL built from the endpoint the backend
  /// hands back — identical to the "Server" value an external encoder like
  /// OBS would be given.
  static String rtmpsUrl(String ingestEndpoint) =>
      'rtmps://$ingestEndpoint:443/app/';

  /// False on iOS/web and on Android below 9.0, where the IVS broadcast SDK
  /// cannot run. Callers must fall back to the stream-key flow rather than
  /// assuming this is true.
  static Future<bool> isSupported() async {
    if (defaultTargetPlatform != TargetPlatform.android) return false;
    try {
      return await _method.invokeMethod<bool>('isSupported') ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  /// State changes and errors from the live session.
  static Stream<IvsBroadcastEvent> get events {
    return _stream ??= _events
        .receiveBroadcastStream()
        .map<IvsBroadcastEvent?>(_parse)
        .where((e) => e != null)
        .cast<IvsBroadcastEvent>();
  }

  static IvsBroadcastEvent? _parse(dynamic raw) {
    if (raw is! Map) return null;
    switch (raw['event']) {
      case 'state':
        return IvsStateEvent(_stateFrom(raw['state']?.toString()));
      case 'preview':
        return IvsPreviewEvent(
          ready: raw['ready'] == true,
          tier: raw['tier'] is int ? raw['tier'] as int : 0,
        );
      case 'cameras':
        final positions = raw['positions'];
        return IvsCamerasEvent(
          positions: positions is List
              ? positions.map((p) => p.toString()).toSet()
              : const <String>{},
          front: raw['front'] == true,
        );
      case 'deviceLost':
        return IvsDeviceLostEvent(raw['kind']?.toString() ?? 'camera');
      case 'error':
        return IvsErrorEvent(
          source: raw['source']?.toString() ?? 'broadcast',
          detail: raw['detail']?.toString() ?? 'Unknown error',
          fatal: raw['fatal'] == true,
        );
      default:
        return null;
    }
  }

  static IvsBroadcastState _stateFrom(String? name) {
    switch (name) {
      case 'CONNECTED':
        return IvsBroadcastState.connected;
      case 'CONNECTING':
        return IvsBroadcastState.connecting;
      case 'DISCONNECTED':
        return IvsBroadcastState.disconnected;
      case 'ERROR':
        return IvsBroadcastState.error;
      default:
        return IvsBroadcastState.invalid;
    }
  }

  /// Opens the camera and microphone and starts pushing to IVS.
  ///
  /// Returns once the native session has been handed the credentials — NOT
  /// once it is live. Wait for [IvsBroadcastState.connected] on [events]
  /// before telling anyone they are on air.
  ///
  /// [portrait] false is the default on purpose: the website broadcasts with
  /// `STANDARD_LANDSCAPE`, and that 16:9 shape is what the watch page plays
  /// back.
  static Future<void> start({
    required String ingestEndpoint,
    required String streamKey,
    bool portrait = false,
    bool frontCamera = true,
  }) {
    return _method.invokeMethod<bool>('start', <String, dynamic>{
      'url': rtmpsUrl(ingestEndpoint),
      'streamKey': streamKey,
      'portrait': portrait,
      'frontCamera': frontCamera,
    });
  }

  /// Stops the broadcast and releases the camera and microphone.
  ///
  /// Safe to call when nothing is running, and safe to call twice — which
  /// matters, because it is the one thing that must happen on every exit
  /// path so the camera light never stays on with nothing being streamed.
  static Future<void> stop() async {
    try {
      await _method.invokeMethod<bool>('stop');
    } on PlatformException {
      // Nothing to stop, or already gone.
    } on MissingPluginException {
      // Plugin isn't there at all — there is no camera to release either.
    }
  }

  /// Website parity: `audioTrack.enabled = !audioTrack.enabled`.
  static Future<bool> setMicMuted(bool muted) async {
    try {
      return await _method.invokeMethod<bool>('setMicMuted', {'muted': muted}) ??
          false;
    } on PlatformException {
      return false;
    }
  }

  /// Website parity: `videoTrack.enabled = !videoTrack.enabled` — viewers
  /// see black, the stream keeps running.
  static Future<bool> setCameraEnabled(bool enabled) async {
    try {
      return await _method.invokeMethod<bool>('setCameraEnabled', {
            'enabled': enabled,
          }) ??
          false;
    } on PlatformException {
      return false;
    }
  }

  /// Flips between the front and back camera mid-broadcast. Returns false if
  /// the flip didn't happen; the stream carries on either way.
  static Future<bool> switchCamera() async {
    try {
      return await _method.invokeMethod<bool>('switchCamera') ?? false;
    } on PlatformException {
      return false;
    }
  }

  /// Rebuilds the camera preview from scratch, climbing the fallback ladder
  /// again from the top.
  ///
  /// Worth calling when the app returns to the foreground: Android can tear
  /// down a preview's underlying surface while you are away, and a view that
  /// comes back attached but dead looks identical to a broken camera.
  static Future<void> refreshPreview() async {
    try {
      await _method.invokeMethod<bool>('refreshPreview');
    } on PlatformException {
      // Nothing mounted to refresh.
    } on MissingPluginException {
      // Not an Android build.
    }
  }

  /// True while the front camera is the active one.
  static Future<bool> isFrontCamera() async {
    try {
      return await _method.invokeMethod<bool>('isFrontCamera') ?? true;
    } on PlatformException {
      return true;
    }
  }
}

/// The live camera preview — the composited frame that is actually going out,
/// which is what the website's `<canvas>` shows too (not a raw camera feed).
///
/// Renders black until a session exists, so it can be mounted before
/// [IvsBroadcast.start] and left mounted after [IvsBroadcast.stop].
class IvsPreview extends StatelessWidget {
  const IvsPreview({super.key});

  static const String _viewType = 'inplayer/ivs_preview';

  @override
  Widget build(BuildContext context) {
    if (defaultTargetPlatform != TargetPlatform.android) {
      return const ColoredBox(color: Color(0xFF000000));
    }
    // Hybrid composition rather than the default texture-layer path: the IVS
    // preview is a TextureView with its own SurfaceTexture, which is exactly
    // the case texture-layer views render as a blank or stale frame.
    return PlatformViewLink(
      viewType: _viewType,
      surfaceFactory: (context, controller) {
        return AndroidViewSurface(
          controller: controller as AndroidViewController,
          gestureRecognizers: const <Factory<OneSequenceGestureRecognizer>>{},
          hitTestBehavior: PlatformViewHitTestBehavior.opaque,
        );
      },
      onCreatePlatformView: (PlatformViewCreationParams params) {
        return PlatformViewsService.initExpensiveAndroidView(
          id: params.id,
          viewType: _viewType,
          layoutDirection: TextDirection.ltr,
          creationParamsCodec: const StandardMessageCodec(),
        )
          ..addOnPlatformViewCreatedListener(params.onPlatformViewCreated)
          ..create();
      },
    );
  }
}
