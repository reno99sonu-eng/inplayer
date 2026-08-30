// ignore_for_file: use_null_aware_elements
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';

final uploadServiceProvider = Provider<UploadService>((ref) {
  return UploadService();
});

class UploadService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  /// Per-request timeout override for the upload endpoints.
  ///
  /// DioClient's shared defaults are 30s connect / 30s receive, which are
  /// fine for ordinary reads but far too tight here. /api/upload/create does
  /// real work before it can answer — verify auth, write the video record,
  /// then round-trip to Mux to mint a one-time direct-upload URL — and it
  /// may be answering from a cold serverless start. The POST body also
  /// carries the base64 thumbnail, which on mobile upstream can eat most of
  /// those 30s before the server has even begun.
  ///
  /// When the 30s ran out Dio threw, and the catch below reported it as a
  /// connection problem — which is how a perfectly good connection produced
  /// "network error" on upload. The cover upload has the same shape (a real
  /// file going up, then S3/CDN work), so it gets the same treatment.
  static final _uploadOptions = Options(
    sendTimeout: const Duration(minutes: 5),
    receiveTimeout: const Duration(minutes: 3),
  );

  /// Turns a thrown request error into something a person can act on.
  ///
  /// Every failure here used to collapse into the same "Check your
  /// connection and try again." line no matter what actually went wrong, so
  /// a timeout, a rejected file, an expired session and a genuinely offline
  /// phone were indistinguishable — both for the person uploading and for
  /// anyone trying to debug it afterwards.
  String _describeError(Object e) {
    if (e is DioException) {
      switch (e.type) {
        case DioExceptionType.connectionTimeout:
          return 'Could not reach the server — the connection timed out. '
              'Check your internet and try again.';
        case DioExceptionType.sendTimeout:
          return 'The upload timed out while sending. That usually means a '
              'slow connection or a very large file — try again on Wi-Fi.';
        case DioExceptionType.receiveTimeout:
          return 'The server took too long to respond. Your upload may still '
              'be processing — check My Videos before retrying.';
        case DioExceptionType.connectionError:
          return 'No internet connection.';
        case DioExceptionType.badCertificate:
          return 'Could not establish a secure connection to the server.';
        case DioExceptionType.cancel:
          return 'Upload cancelled.';
        case DioExceptionType.badResponse:
          final code = e.response?.statusCode;
          final serverMessage =
              e.response?.data is Map ? e.response?.data['error'] as String? : null;
          if (serverMessage != null && serverMessage.isNotEmpty) return serverMessage;
          if (code == 401 || code == 403) {
            return 'You are signed out. Sign in again and retry the upload.';
          }
          if (code == 413) {
            return 'That file is too large to upload. Try a smaller thumbnail '
                'or a smaller file.';
          }
          return 'The server rejected the upload${code != null ? ' (error $code)' : ''}.';
        // Deliberately a default rather than one more named case.
        //
        // Dio keeps adding exception types — `transformTimeout` is the
        // newest, and naming every one exhaustively means this switch turns
        // into a compile error on the next package bump, for no benefit:
        // the remaining types are all "something went wrong in the client",
        // and e.message / e.type.name already say which. Covers
        // DioExceptionType.unknown and transformTimeout today.
        default:
          return 'Upload failed: ${e.message ?? e.type.name}.';
      }
    }
    return 'Upload failed. Please try again.';
  }

  /// Starts an upload: creates the "processing" video record and asks Mux
  /// for a one-time direct-upload URL.
  Future<CreateUploadResult> createUpload({
    required String title,
    String description = '',
    required String category,
    required String contentType, // 'video' | 'short' | 'music'
    String spokenLanguage = 'auto',
    String visibility = 'public',
    String audience = 'everyone',
    bool madeForKids = false,
    bool ageRestricted = false,
    bool commentsEnabled = true,
    bool membersOnly = false,
    List<String> tags = const [],
    String? thumbnailDataUrl,
    List<String> covers = const [],
    int coverIntervalSeconds = 12,
    List<Map<String, dynamic>> lyrics = const [],
    String? genre,
    String? audioSha256,
    bool declaredOwnership = false,
    /// Already-serialized `shortSettings` map (soundtrack + clip length +
    /// Look filter) — see ShortSettings.toJson(). Null omits the key
    /// entirely, which is what the server treats as "nothing was picked".
    Map<String, dynamic>? shortSettings,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.uploadCreate,
        data: {
          'title': title,
          'description': description,
          'category': category,
          'contentType': contentType,
          'spokenLanguage': spokenLanguage,
          'visibility': visibility,
          // Website sends both the raw audience choice and the two derived
          // flags (see app/upload/page.tsx's audienceFlags() call) — the
          // audience string itself was missing here, a real gap found in
          // the Round 24 parity audit since VideoMetadataFields.tsx treats
          // `audience` as the source of truth server-side.
          'audience': audience,
          'madeForKids': madeForKids,
          'ageRestricted': ageRestricted,
          'commentsEnabled': commentsEnabled,
          'tags': tags,
          // Website gates this for everything except Shorts (contentType
          // !== "short"), i.e. video AND music. This used to be video-only
          // here, so a music upload could never be set members-only.
          if (contentType == 'video' || contentType == 'music') 'membersOnly': membersOnly,
          if (thumbnailDataUrl != null && thumbnailDataUrl.isNotEmpty)
            'thumbnailDataUrl': thumbnailDataUrl,
          if (contentType == 'music') ...{
            'covers': covers,
            'coverIntervalSeconds': coverIntervalSeconds,
            'lyrics': lyrics,
            // Real user consent now (see upload_page.dart's ownership
            // checkbox) — this used to be hardcoded `true` regardless of
            // whether the uploader actually owned the recording.
            'declaredOwnership': declaredOwnership,
            'genre': genre ?? 'Other',
            if (audioSha256 != null && audioSha256.isNotEmpty) 'audioSha256': audioSha256,
          },
          // Kept under the `shortSettings` name for video AND short
          // deliberately, matching the server: renaming it would mean
          // migrating every already-published Short's stored data and every
          // reader of it, for a purely cosmetic win.
          if (shortSettings != null) 'shortSettings': shortSettings,
        },
        options: _uploadOptions,
      );

      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        return CreateUploadResult(
          success: true,
          uploadUrl: data['uploadUrl'] as String?,
          videoId: data['videoId'] as String?,
        );
      }

      final error =
          (response.data is Map ? response.data['error'] : null) as String?;
      return CreateUploadResult(
        success: false,
        error: error ?? "Couldn't start the upload. Please try again.",
      );
    } catch (e) {
      _logger.e('Error creating upload: $e');
      return CreateUploadResult(success: false, error: _describeError(e));
    }
  }

  /// Uploads cover art to /api/music/cover and returns the public CDN/S3 URL
  Future<String?> uploadCoverArt(String filePath) async {
    try {
      final fileName = filePath.split(Platform.pathSeparator).last;
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(filePath, filename: fileName),
      });

      final response = await _dio.post(
        '/api/music/cover',
        data: formData,
        options: _uploadOptions,
      );

      if (response.statusCode == 200 && response.data is Map) {
        return response.data['url'] as String?;
      }
      return null;
    } catch (e) {
      _logger.e('Error uploading cover image: $e');
      return null;
    }
  }

  /// Uploads the actual video file straight to Mux's one-time URL
  Future<bool> uploadFile(
    String uploadUrl,
    String filePath, {
    void Function(double progress)? onProgress,
  }) async {
    try {
      final file = File(filePath);
      final length = await file.length();

      // A bare Dio on purpose: this PUT goes straight to Mux's one-time URL,
      // not to our own API, so it must NOT pick up DioClient's baseUrl or
      // its interceptor (which would attach the user's Cognito token to a
      // third-party host).
      //
      // sendTimeout is the one that matters here — this is the whole video
      // file going up. Dio's default of "no timeout" would in principle be
      // fine, but an explicit generous ceiling means a genuinely wedged
      // socket eventually fails with a real error instead of hanging the
      // upload screen forever with a progress bar that never moves.
      final response = await Dio().put(
        uploadUrl,
        data: file.openRead(),
        options: Options(
          headers: {Headers.contentLengthHeader: length},
          sendTimeout: const Duration(hours: 2),
          receiveTimeout: const Duration(minutes: 5),
          // Accept any status so a rejection comes back as a response we can
          // log the body of, rather than an opaque thrown exception.
          validateStatus: (_) => true,
        ),
        onSendProgress: (sent, total) {
          if (total > 0) onProgress?.call(sent / total);
        },
      );

      final ok = response.statusCode == 200 || response.statusCode == 201;
      if (!ok) {
        _logger.e(
          'Mux rejected the upload: HTTP ${response.statusCode} — ${response.data}',
        );
      }
      return ok;
    } catch (e) {
      _logger.e('Error uploading file to Mux: ${_describeError(e)} ($e)');
      return false;
    }
  }

  /// Sets a video's thumbnail to one of the Mux frame URLs offered by the
  /// post-upload picker.
  ///
  /// PATCH /api/my-videos/{videoId} with `{thumbnailUrl}` — the same call
  /// the website's UploadThumbnailStep makes. Returns false rather than
  /// throwing: by the time this runs the video is already published and
  /// Mux's automatically-chosen thumbnail is already live, so a failure
  /// here costs a nicer still image, not the upload.
  Future<bool> setThumbnail(String videoId, String thumbnailUrl) async {
    try {
      final response = await _dio.patch(
        '/api/my-videos/$videoId',
        data: {'thumbnailUrl': thumbnailUrl},
      );
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Failed to save chosen thumbnail: ${_describeError(e)} ($e)');
      return false;
    }
  }

  /// Polls the processing status of an upload
  Future<UploadStatusResult> checkStatus(String videoId) async {
    try {
      final response = await _dio.get('${ApiConstants.videos}/$videoId/status');

      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final status = (data['status'] as String?) ?? 'processing';
        return UploadStatusResult(
          status: status,
          isReady: status == 'ready',
          isErrored: status == 'errored',
          playbackId: data['muxPlaybackId'] as String?,
          error: data['error'] as String?,
        );
      }

      return UploadStatusResult(status: 'unknown');
    } catch (e) {
      _logger.e('Error checking upload status: $e');
      return UploadStatusResult(status: 'unknown');
    }
  }
}

class CreateUploadResult {
  final bool success;
  final String? uploadUrl;
  final String? videoId;
  final String? error;

  CreateUploadResult({
    required this.success,
    this.uploadUrl,
    this.videoId,
    this.error,
  });
}

class UploadStatusResult {
  final String status;
  final bool isReady;
  final bool isErrored;
  final String? playbackId;
  final String? error;

  UploadStatusResult({
    required this.status,
    this.isReady = false,
    this.isErrored = false,
    this.playbackId,
    this.error,
  });
}
