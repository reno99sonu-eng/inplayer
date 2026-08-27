import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

import '../core/network/dio_client.dart';
import '../core/config/app_config.dart';
import '../core/constants/api_constants.dart';

final downloadServiceProvider = Provider<DownloadService>((ref) {
  return DownloadService();
});

/// Result of a prepare-download call — mirrors the real
/// POST /api/videos/{videoId}/prepare-download response shape
/// (app/api/videos/[videoId]/prepare-download/route.ts).
class PrepareDownloadResult {
  /// 'preparing' | 'ready' | 'unauthenticated' | 'unavailable' | 'error'.
  final String status;
  final String? error;
  const PrepareDownloadResult({required this.status, this.error});
}

/// Result of a status poll, reading the two download-related fields off
/// the same GET /api/videos/{videoId}/status endpoint the upload flow
/// already polls (upload_service.dart's checkStatus) — this route already
/// returns downloadStatus/downloadRenditions, no separate endpoint needed.
class DownloadStatusResult {
  /// 'unavailable' | 'preparing' | 'ready' | 'errored'.
  final String downloadStatus;

  /// Map of ready quality -> Mux static-rendition filename, e.g.
  /// {'1080p': '1080p.mp4', '720p': '720p.mp4', '480p': '480p.mp4'}, or
  /// {'audio-only': 'audio.m4a'} for a music track.
  final Map<String, String> renditions;

  const DownloadStatusResult({required this.downloadStatus, required this.renditions});
}

/// Wraps the real download backend that already exists on the website
/// (built there, never wired into any website UI — app/downloads/page.tsx
/// says outright "this will be part of the InPlayer app when it
/// launches"). Three real endpoints, used exactly as they are:
///   POST /api/videos/{id}/prepare-download  — idempotent "make sure a
///        downloadable MP4 exists" kick-off (most videos already have one
///        requested at upload time; this backfills older ones and
///        self-heals a stuck request).
///   GET  /api/videos/{id}/status            — already used by the upload
///        flow; also carries downloadStatus/downloadRenditions.
///   GET  /api/videos/{id}/download?quality= — the actual file bytes,
///        streamed through the InPlayer domain (not stream.mux.com
///        directly) with a real Content-Disposition filename.
///   POST /api/downloads {action}            — best-effort activity log;
///        see DownloadsStore for why this app never depends on it.
class DownloadService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  Future<PrepareDownloadResult> prepareDownload(String videoId) async {
    try {
      final response = await _dio.post('${ApiConstants.videos}/$videoId/prepare-download');

      if (response.statusCode == 401) {
        return const PrepareDownloadResult(status: 'unauthenticated');
      }
      if (response.statusCode == 400 || response.statusCode == 404 || response.statusCode == 409) {
        final msg = (response.data is Map) ? (response.data as Map)['error']?.toString() : null;
        return PrepareDownloadResult(status: 'unavailable', error: msg);
      }
      if (response.statusCode != 200 || response.data is! Map) {
        return const PrepareDownloadResult(status: 'error');
      }

      final status = (response.data as Map)['status']?.toString() ?? 'preparing';
      return PrepareDownloadResult(status: status);
    } catch (e, stackTrace) {
      _logger.e('prepareDownload failed for $videoId', error: e, stackTrace: stackTrace);
      return const PrepareDownloadResult(status: 'error');
    }
  }

  Future<DownloadStatusResult> checkDownloadStatus(String videoId) async {
    try {
      final response = await _dio.get('${ApiConstants.videos}/$videoId/status');

      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final renditionsRaw = data['downloadRenditions'];
        final renditions = renditionsRaw is Map
            ? renditionsRaw.map((k, v) => MapEntry(k.toString(), v.toString()))
            : <String, String>{};
        return DownloadStatusResult(
          downloadStatus: data['downloadStatus']?.toString() ?? 'unavailable',
          renditions: renditions,
        );
      }
      return const DownloadStatusResult(downloadStatus: 'unavailable', renditions: {});
    } catch (e, stackTrace) {
      _logger.e('checkDownloadStatus failed for $videoId', error: e, stackTrace: stackTrace);
      return const DownloadStatusResult(downloadStatus: 'unavailable', renditions: {});
    }
  }

  /// Full URL DownloadManager hands to Dio's download() — same base URL +
  /// auth interceptor every other request in the app already goes through
  /// (DioClient), so this needs no separate auth handling of its own.
  String buildDownloadUrl(String videoId, String quality) {
    return '${AppConfig.apiBaseUrl}${ApiConstants.videos}/$videoId/download?quality=$quality';
  }

  /// Fire-and-forget activity-log ping. The backing `InPlayer-Downloads`
  /// table doesn't exist in AWS yet as of this writing (see the route's
  /// own comment) — until it's created this silently no-ops server-side
  /// (still returns 200), which is exactly why nothing in this app waits
  /// on or trusts this call for anything the offline library actually
  /// needs.
  Future<void> recordDownload(String videoId, String quality) async {
    try {
      await _dio.post(
        '/api/downloads',
        data: {'videoId': videoId, 'quality': quality, 'action': 'record'},
      );
    } catch (e) {
      _logger.d('recordDownload ping failed (non-fatal) for $videoId: $e');
    }
  }

  Future<void> removeDownloadRecord(String videoId) async {
    try {
      await _dio.post(
        '/api/downloads',
        data: {'videoId': videoId, 'action': 'remove'},
      );
    } catch (e) {
      _logger.d('removeDownloadRecord ping failed (non-fatal) for $videoId: $e');
    }
  }
}
