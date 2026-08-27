import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:path_provider/path_provider.dart';

import '../core/network/dio_client.dart';
import '../core/utils/downloads_store.dart';
import '../models/downloaded_item.dart';
import '../models/video.dart';
import 'download_service.dart';

enum DownloadTaskStatus { downloading, failed }

/// One in-flight download's live progress — never persisted; once it
/// finishes it becomes a DownloadedItem in [DownloadManager.completed]
/// instead.
class DownloadTask {
  final String videoId;
  final String quality;
  final CancelToken cancelToken;
  double progress;
  int receivedBytes;
  int totalBytes;
  DownloadTaskStatus status;

  DownloadTask({
    required this.videoId,
    required this.quality,
    required this.cancelToken,
    this.progress = 0,
    this.receivedBytes = 0,
    this.totalBytes = 0,
    this.status = DownloadTaskStatus.downloading,
  });
}

/// Owns every offline download in the app — the one place that talks to
/// Dio's file-download API, the local file system, and DownloadsStore.
/// Exposed as a single shared ChangeNotifierProvider so the watch page's
/// Download button and the drawer's Downloads screen always agree on what
/// is downloading/downloaded, even if only one of them is on screen.
///
/// Deliberately built on dio.download() (dio is already a dependency —
/// this needed no new native plugin) rather than a background-download
/// package: it's a real, resumable-within-the-app-session, progress-
/// tracked download, but it runs in the foreground and won't survive the
/// app being killed mid-download. A true background downloader (e.g.
/// flutter_downloader, which wraps Android's WorkManager) is a real next
/// step, just not one addable blind in an environment with no compiler to
/// verify a new native plugin actually builds.
class DownloadManager extends ChangeNotifier {
  final _logger = Logger();
  final DownloadService _service = DownloadService();

  final Map<String, DownloadTask> _active = {};
  List<DownloadedItem> _completed = [];
  bool _loaded = false;

  Map<String, DownloadTask> get active => Map.unmodifiable(_active);
  List<DownloadedItem> get completed => List.unmodifiable(_completed);
  bool get loaded => _loaded;

  int get totalBytes => _completed.fold(0, (sum, item) => sum + item.fileSizeBytes);

  DownloadTask? taskFor(String videoId) => _active[videoId];
  bool isDownloaded(String videoId) => _completed.any((item) => item.videoId == videoId);

  /// Loads the manifest and drops any entry whose file no longer exists on
  /// disk (cleared app storage, OS cleanup, etc.) so the list never shows
  /// a "download" that can't actually play — the same self-heal pattern
  /// already used elsewhere in this app (e.g. the upload status poll).
  Future<void> loadPersisted() async {
    final stored = await DownloadsStore.getAll();
    final valid = <DownloadedItem>[];
    for (final item in stored) {
      try {
        if (await File(item.filePath).exists()) {
          valid.add(item);
        } else {
          await DownloadsStore.remove(item.videoId);
        }
      } catch (_) {
        // Unreadable path — treat like a missing file.
      }
    }
    _completed = valid;
    _loaded = true;
    notifyListeners();
  }

  Future<Directory> _downloadsDir() async {
    final docsDir = await getApplicationDocumentsDirectory();
    final dir = Directory('${docsDir.path}/downloads');
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  /// Downloads [video] at [quality] (one of the keys in the renditions map
  /// the caller already fetched via DownloadService.checkDownloadStatus)
  /// and [fileName] (that key's real Mux filename, e.g. "1080p.mp4" —
  /// its extension decides whether this is saved as .mp4 or .m4a).
  /// Throws on failure/cancellation so the caller can show its own error —
  /// this never swallows an error silently the way the fire-and-forget
  /// activity-log calls do.
  Future<void> download({
    required Video video,
    required String quality,
    required String fileName,
  }) async {
    if (_active.containsKey(video.videoId)) return;

    final ext = fileName.contains('.') ? fileName.split('.').last : (video.isMusic ? 'm4a' : 'mp4');
    final dir = await _downloadsDir();
    final savePath = '${dir.path}/${video.videoId}_$quality.$ext';

    final cancelToken = CancelToken();
    final task = DownloadTask(videoId: video.videoId, quality: quality, cancelToken: cancelToken);
    _active[video.videoId] = task;
    notifyListeners();

    final url = _service.buildDownloadUrl(video.videoId, quality);

    try {
      await DioClient().dio.download(
        url,
        savePath,
        cancelToken: cancelToken,
        onReceiveProgress: (received, total) {
          task.receivedBytes = received;
          if (total > 0) {
            task.totalBytes = total;
            task.progress = received / total;
          }
          notifyListeners();
        },
      );

      final file = File(savePath);
      final size = await file.exists() ? await file.length() : 0;

      final item = DownloadedItem(
        videoId: video.videoId,
        title: video.title,
        thumbnailUrl: video.thumbnail,
        uploaderName: video.creator,
        isMusic: video.isMusic,
        quality: quality,
        filePath: savePath,
        fileSizeBytes: size,
        downloadedAt: DateTime.now().toIso8601String(),
      );

      await DownloadsStore.upsert(item);
      _completed.removeWhere((d) => d.videoId == video.videoId);
      _completed.insert(0, item);
      _active.remove(video.videoId);
      notifyListeners();

      unawaited(_service.recordDownload(video.videoId, quality));
    } catch (e, stackTrace) {
      _active.remove(video.videoId);
      notifyListeners();

      // Never leave a partial file behind — it would otherwise look like a
      // real, playable download next time the manifest is loaded.
      try {
        final partial = File(savePath);
        if (await partial.exists()) await partial.delete();
      } catch (_) {}

      if (e is DioException && e.type == DioExceptionType.cancel) {
        _logger.i('Download cancelled for ${video.videoId}');
        return; // Cancellation isn't an error — nothing for the caller to show.
      }

      _logger.e('Download failed for ${video.videoId}', error: e, stackTrace: stackTrace);
      rethrow;
    }
  }

  void cancelDownload(String videoId) {
    _active[videoId]?.cancelToken.cancel('Cancelled by user');
  }

  Future<void> delete(String videoId) async {
    DownloadedItem? item;
    for (final d in _completed) {
      if (d.videoId == videoId) {
        item = d;
        break;
      }
    }
    if (item == null) return;

    try {
      final file = File(item.filePath);
      if (await file.exists()) await file.delete();
    } catch (e) {
      _logger.w('Could not delete local file for $videoId: $e');
    }

    _completed.removeWhere((d) => d.videoId == videoId);
    await DownloadsStore.remove(videoId);
    notifyListeners();

    unawaited(_service.removeDownloadRecord(videoId));
  }
}

final downloadManagerProvider = ChangeNotifierProvider<DownloadManager>((ref) {
  final manager = DownloadManager();
  unawaited(manager.loadPersisted());
  return manager;
});
