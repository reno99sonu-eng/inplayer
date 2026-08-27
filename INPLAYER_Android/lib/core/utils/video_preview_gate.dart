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

  /// Returns true if [cardId] is the currently active preview.
  bool isPreviewing(String cardId) => activeCardId.value == cardId;

  /// Requests the single preview slot for [cardId].
  /// Any previously playing card will immediately be deactivated.
  void requestActivePreview(String cardId) {
    if (activeCardId.value == cardId) return;
    activeCardId.value = cardId;
  }

  /// Releases the preview slot if [cardId] currently holds it.
  void releaseActivePreview(String cardId) {
    if (activeCardId.value != cardId) return;
    activeCardId.value = null;
  }
}
