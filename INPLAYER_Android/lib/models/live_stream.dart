/// Response shape of POST /api/live/ivs-create (app/api/live/ivs-create/
/// route.ts) — real AWS IVS channel credentials, returned once, the moment
/// a broadcast is created. `playbackUrl` is the HLS URL viewers (including
/// the broadcaster's own optional preview) can play; `ingestEndpoint` +
/// `streamKey` are what an RTMP(S) encoder needs to actually push video.
class LiveCreateResult {
  final bool success;
  final String? error;
  final String? videoId;
  final String? ingestEndpoint;
  final String? streamKey;
  final String? playbackUrl;
  final String? channelArn;

  LiveCreateResult({
    required this.success,
    this.error,
    this.videoId,
    this.ingestEndpoint,
    this.streamKey,
    this.playbackUrl,
    this.channelArn,
  });

  /// `rtmps://<ingestEndpoint>:443/app/` — the standard IVS RTMPS ingest URL
  /// format. Any RTMP-capable broadcaster app (OBS Studio, Streamlabs,
  /// Larix, etc.) accepts this as its "Server" field, with [streamKey] as
  /// the separate "Stream Key" field.
  String? get rtmpsServerUrl =>
      ingestEndpoint == null ? null : 'rtmps://$ingestEndpoint:443/app/';

  factory LiveCreateResult.fromJson(Map<String, dynamic> json) {
    return LiveCreateResult(
      success: true,
      videoId: json['videoId']?.toString(),
      ingestEndpoint: json['ingestEndpoint']?.toString(),
      streamKey: json['streamKey']?.toString(),
      playbackUrl: json['playbackUrl']?.toString(),
      channelArn: json['channelArn']?.toString(),
    );
  }
}
