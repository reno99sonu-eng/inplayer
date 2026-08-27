import '../../models/lyric_line.dart';

const int maxCovers = 5;
const int coverIntervalMin = 3;
const int coverIntervalMax = 60;
const int coverIntervalDefault = 12;
const int maxLyricLines = 300;
const int maxLyricLineLength = 200;

int normalizeCoverInterval(dynamic raw) {
  if (raw == null) return coverIntervalDefault;
  final n = raw is int ? raw : int.tryParse(raw.toString());
  if (n == null) return coverIntervalDefault;
  return n.clamp(coverIntervalMin, coverIntervalMax);
}

int coverIndexAt(double seconds, int coverCount, int intervalSeconds) {
  if (seconds < 0 || coverCount <= 1) return 0;
  final interval = normalizeCoverInterval(intervalSeconds);
  final count = coverCount.clamp(1, maxCovers);
  return (seconds ~/ interval) % count;
}

List<LyricLine> parseLyrics(String raw) {
  if (raw.trim().isEmpty) return [];

  final List<LyricLine> lines = [];
  final regex = RegExp(r'^\s*\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]\s*(.*)$');

  for (final rawLine in raw.split(RegExp(r'\r?\n'))) {
    if (lines.length >= maxLyricLines) break;

    final match = regex.firstMatch(rawLine);
    if (match != null) {
      final minutes = int.tryParse(match.group(1) ?? '0') ?? 0;
      final seconds = int.tryParse(match.group(2) ?? '0') ?? 0;
      final fractionRaw = match.group(3) ?? '';
      final fraction = fractionRaw.isNotEmpty
          ? (double.tryParse(fractionRaw) ?? 0.0) / (fractionRaw.length == 1 ? 10 : (fractionRaw.length == 2 ? 100 : 1000))
          : 0.0;
      final text = (match.group(4) ?? '').trim();
      if (text.isEmpty) continue;
      lines.add(LyricLine(
        time: minutes * 60.0 + seconds + fraction,
        text: text.length > maxLyricLineLength ? text.substring(0, maxLyricLineLength) : text,
      ));
      continue;
    }

    final text = rawLine.trim();
    if (text.isEmpty) continue;
    lines.add(LyricLine(
      time: 0.0,
      text: text.length > maxLyricLineLength ? text.substring(0, maxLyricLineLength) : text,
    ));
  }

  lines.sort((a, b) => a.time.compareTo(b.time));
  return lines;
}

int activeLyricIndex(List<LyricLine> lines, double seconds) {
  if (lines.isEmpty || seconds < 0) return -1;

  for (int i = lines.length - 1; i >= 0; i--) {
    if (seconds >= lines[i].time) {
      int first = i;
      while (first > 0 && lines[first - 1].time == lines[i].time) {
        first--;
      }
      return first;
    }
  }
  return -1;
}

double lyricLineProgress(
  List<LyricLine> lines,
  int index,
  double seconds, {
  double? durationSeconds,
}) {
  if (index < 0 || index >= lines.length) return 0.0;

  final thisTime = lines[index].time;
  final double nextTime;

  if (index + 1 < lines.length) {
    nextTime = lines[index + 1].time;
  } else if (durationSeconds != null && durationSeconds > thisTime) {
    nextTime = durationSeconds;
  } else {
    nextTime = thisTime + 4.0;
  }

  final span = nextTime - thisTime;
  if (span <= 0) return 1.0;

  final elapsed = seconds - thisTime;
  return (elapsed / span).clamp(0.0, 1.0);
}
