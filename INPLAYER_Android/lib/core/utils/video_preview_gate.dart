import 'package:flutter/foundation.dart';

/// App-wide singleton gate for Feed Video Previews.
///
/// Ensures only ONE feed card can play a muted preview at any given time,
/// avoiding CPU saturation, network congestion, and player memory spikes.
/// Directly mirrors the architecture of pp/components/videoPreviewGate.ts.
class VideoPreviewGate {
  VideoPreviewGate._();
  static final VideoPreviewGate instance = VideoPreviewGate._();

  final ValueNotifier<String?> activeCardId = ValueNotifier<String?>(null);
  DateTime _lastActivation = DateTime.fromMillisecondsSinceEpoch(0);

  /// Number of full-screen players currently asking for feed previews to
  /// stay off. A counter rather than a bool so overlapping owners (the
  /// Raftaar feed and the watch page, say) can each suspend and release
  /// without one of them switching previews back on while the other is
  /// still playing.
  int _suspendCount = 0;

  /// True while any full-screen player has previews suspended.
  bool get isSuspended => _suspendCount > 0;

  /// Turns feed previews off and tears down whichever one is live.
  ///
  /// Why this exists: a feed card preview is a second, independent
  /// hardware video decoder. Android devices support only a small number
  /// of concurrent AVC decoder instances, and on several chipsets
  /// (MediaTek's c2.mtk.avc.decoder among them) pushing past what the
  /// device is comfortable with does not fail cleanly — it hands back
  /// corrupted output buffers, which is what painted green blocky
  /// garbage over Raftaar shorts, alongside stalled playback and, at the
  /// extreme, the app being killed outright.
  ///
  /// The gate already guarantees only ONE card previews at a time, but it
  /// had no idea a full-screen player existed, so opening Raftaar left a
  /// muted 360p feed preview decoding underneath it. Suspending here is
  /// what keeps the count at one decoder instead of two.
  void suspend() {
    _suspendCount++;
    // Clearing this notifies every VideoCard listener, and any card that
    // was previewing disposes its controller in response.
    activeCardId.value = null;
  }

  /// Releases one suspension. Previews stay off until every owner has
  /// released.
  void resume() {
    if (_suspendCount > 0) _suspendCount--;
  }

  /// Returns true if [cardId] is the currently active preview.
  bool isPreviewing(String cardId) => activeCardId.value == cardId;

  /// Requests the single preview slot for [cardId].
  /// A cooldown prevents rapid contention between multiple visible cards.
  void requestActivePreview(String cardId) {
    // Hard stop while a full-screen player owns the decoder. VideoCard
    // re-checks visibility on a 2s timer, so without this the feed would
    // simply re-acquire a preview a couple of seconds after suspend()
    // cleared it.
    if (isSuspended) return;
    if (cardId.trim().isEmpty || activeCardId.value == cardId) return;

    final now = DateTime.now();
    if (activeCardId.value != null) {
      final cooldownMs = now.difference(_lastActivation).inMilliseconds;
      if (cooldownMs < 800) {
        return;
      }
    }

    activeCardId.value = cardId;
    _lastActivation = now;
  }

  /// Releases the preview slot if [cardId] currently holds it.
  void releaseActivePreview(String cardId) {
    if (activeCardId.value != cardId) return;
    activeCardId.value = null;
  }
}
