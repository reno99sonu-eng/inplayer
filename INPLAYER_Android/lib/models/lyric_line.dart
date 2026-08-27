class LyricLine {
  final double time;
  final String text;

  const LyricLine({
    required this.time,
    required this.text,
  });

  double get seconds => time;

  factory LyricLine.fromJson(Map<String, dynamic> json) {
    return LyricLine(
      time: (json['time'] as num?)?.toDouble() ?? 0.0,
      text: json['text']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'time': time,
      'text': text,
    };
  }
}
