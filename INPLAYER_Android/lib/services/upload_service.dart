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

  /// Starts an upload: creates the "processing" video record and asks Mux
  /// for a one-time direct-upload URL. Mirrors the website's own
  /// POST /api/upload/create exactly (see app/api/upload/create/route.ts)
  /// — same field names, same defaults, so the resulting video behaves
  /// identically whether it was uploaded from the website or this app.
  Future<CreateUploadResult> createUpload({
    required String title,
    String description = '',
    required String category,
    required String contentType, // 'video' | 'short'
    String spokenLanguage = 'auto',
    String visibility = 'public',
    bool madeForKids = false,
    bool ageRestricted = false,
    bool commentsEnabled = true,
    bool membersOnly = false,
    List<String> tags = const [],
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
          'madeForKids': madeForKids,
          'ageRestricted': ageRestricted,
          'commentsEnabled': commentsEnabled,
          'tags': tags,
          if (contentType == 'video') 'membersOnly': membersOnly,
        },
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
      return CreateUploadResult(
        success: false,
        error: "Couldn't start the upload. Check your connection and try again.",
      );
    }
  }

  /// Uploads the actual video file straight to Mux's one-time URL — a
  /// plain PUT of the raw file bytes, exactly what the website's own
  /// upload page does with a raw XHR (app/upload/page.tsx), NOT the TUS
  /// resumable protocol some Mux docs default to. Uses a bare Dio instance
  /// (no base URL, no Cognito auth interceptor) since this request goes
  /// straight to Mux's storage, not our own backend.
  Future<bool> uploadFile(
    String uploadUrl,
    String filePath, {
    void Function(double progress)? onProgress,
  }) async {
    try {
      final file = File(filePath);
      final length = await file.length();

      final response = await Dio().put(
        uploadUrl,
        data: file.openRead(),
        options: Options(
          headers: {Headers.contentLengthHeader: length},
        ),
        onSendProgress: (sent, total) {
          if (total > 0) onProgress?.call(sent / total);
        },
      );

      return response.statusCode != null &&
          response.statusCode! >= 200 &&
          response.statusCode! < 300;
    } catch (e) {
      _logger.e('Error uploading file to Mux: $e');
      return false;
    }
  }

  /// Polls the same status endpoint the website's own upload flow polls
  /// (GET /api/videos/{id}/status). Once Mux finishes transcoding —
  /// usually well under a minute — `status` flips from "processing" to
  /// "ready" (or "error" if the file failed to process).
  Future<VideoProcessingStatus?> getStatus(String videoId) async {
    try {
      final response = await _dio.get('${ApiConstants.videos}/$videoId/status');
      if (response.statusCode == 200 && response.data is Map) {
        return VideoProcessingStatus.fromJson(
          Map<String, dynamic>.from(response.data as Map),
        );
      }
      return null;
    } catch (e) {
      _logger.e('Error checking upload status: $e');
      return null;
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

class VideoProcessingStatus {
  final String status; // 'processing' | 'ready' | 'error' | 'not_found'
  final String? muxPlaybackId;
  final num duration;
  final String? thumbnailUrl;

  VideoProcessingStatus({
    required this.status,
    this.muxPlaybackId,
    this.duration = 0,
    this.thumbnailUrl,
  });

  factory VideoProcessingStatus.fromJson(Map<String, dynamic> json) {
    return VideoProcessingStatus(
      status: json['status']?.toString() ?? 'processing',
      muxPlaybackId: json['muxPlaybackId'] as String?,
      duration: json['duration'] as num? ?? 0,
      thumbnailUrl: json['thumbnailUrl'] as String?,
    );
  }
}
