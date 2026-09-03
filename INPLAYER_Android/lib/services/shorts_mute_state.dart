import 'package:flutter/foundation.dart';

/// Global mute state for the Raftaar feed.
///
/// Mirrors the website (`ShortsPageContent.tsx`), where `muted` is a single
/// piece of feed-level state — one boolean for the whole feed, NOT per
/// short — so the choice persists as the viewer swipes:
///
///     const [muted, setMuted] = useState(false);
///
/// Default is UNMUTED, matching the site's `useState(false)` paired with
/// `autoPlay="any"`: sound from the very first frame.
///
/// A short published with a soundtrack is a special case on the site —
/// `muted={muted || shortHasSoundtrack(short)}` force-mutes the camera
/// audio permanently, and the chosen track plays through a separate audio
/// element that follows this same global flag instead.
class ShortsMuteState {
  ShortsMuteState._();
  static final ShortsMuteState instance = ShortsMuteState._();

  final ValueNotifier<bool> muted = ValueNotifier<bool>(false);

  bool get isMuted => muted.value;

  void toggle() => muted.value = !muted.value;
}
