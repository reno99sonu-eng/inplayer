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

  /// Returns true if [cardId] is the currently active preview.
  bool isPreviewing(String cardId) => activeCardId.value == cardId;

  /// Requests the single preview slot for [cardId].
  /// A small cooldown prevents the feed from rapidly handshaking between many
  /// visible cards while the previous card is still tearing down its player.
  void requestActivePreview(String cardId) {
    if (cardId.trim().isEmpty || activeCardId.value == cardId) return;

    final now = DateTime.now();
    if (activeCardId.value != null) {
      final cooldownMs = now.difference(_lastActivation).inMilliseconds;
      if (cooldownMs < 250) {
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
    _lastActivation = DateTime.fromMillisecondsSinceEpoch(0);
  }
}
