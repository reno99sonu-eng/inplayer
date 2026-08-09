import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';
import '../models/video.dart';
import '../models/short.dart';
import '../models/trending_creator.dart';

final videoServiceProvider = Provider<VideoService>((ref) {
  return VideoService();
});

class VideoService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  /// Loads the real video feed from the InPlayer website backend.
  ///
  /// NOTE:
  /// The live website currently does not expose /api/videos as a
  /// general video-list endpoint, so we use the existing featured
  /// endpoint as the initial real video source.
  Future<List<Video>> getVideos() async {
    try {
      final response = await _dio.get(ApiConstants.featuredWeekly);

      if (response.statusCode != 200) {
        _logger.w(
          'getVideos returned HTTP ${response.statusCode}',
        );
        return [];
      }

      final data = response.data;

      if (data is! Map) {
        _logger.w('Unexpected /api/featured-weekly response format');
        return [];
      }

      final videosJson = data['videos'];

      if (videosJson is! List) {
        _logger.w('No videos array found in featured response');
        return [];
      }

      return videosJson
          .whereType<Map>()
          .map(
            (json) => Video.fromJson(
              Map<String, dynamic>.from(json),
            ),
          )
          .toList();
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching real InPlayer videos',
        error: e,
        stackTrace: stackTrace,
      );
      return [];
    }
  }

  /// Loads the real Featured Weekly videos.
  Future<List<Video>> getFeaturedWeekly() async {
    try {
      final response = await _dio.get(
        ApiConstants.featuredWeekly,
      );

      if (response.statusCode != 200) {
        _logger.w(
          'getFeaturedWeekly returned HTTP ${response.statusCode}',
        );
        return [];
      }

      final data = response.data;

      if (data is! Map) {
        return [];
      }

      final videosJson = data['videos'];

      if (videosJson is! List) {
        return [];
      }

      return videosJson
          .whereType<Map>()
          .map(
            (json) => Video.fromJson(
              Map<String, dynamic>.from(json),
            ),
          )
          .toList();
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching featured weekly videos',
        error: e,
        stackTrace: stackTrace,
      );
      return [];
    }
  }

  /// Loads the real Trending data.
  ///
  /// The live /api/trending endpoint returns creator/video information
  /// under its "creators" property rather than returning a bare List.
  Future<List<TrendingCreator>> getTrendingCreatorsData() async {
    try {
      final response = await _dio.get(
        ApiConstants.trending,
      );

      if (response.statusCode != 200) {
        _logger.w(
          'getTrendingCreatorsData returned HTTP ${response.statusCode}',
        );
        return [];
      }

      final data = response.data;

      if (data is! Map) {
        return [];
      }

      final creatorsJson = data['creators'];

      if (creatorsJson is! List) {
        return [];
      }

      return creatorsJson
          .whereType<Map>()
          .map(
            (json) => TrendingCreator.fromJson(
              Map<String, dynamic>.from(json),
            ),
          )
          .toList();
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching trending creators',
        error: e,
        stackTrace: stackTrace,
      );
      return [];
    }
  }

  Future<List<Video>> getTrendingVideos() async {
    try {
      final response = await _dio.get(
        ApiConstants.trending,
      );

      if (response.statusCode != 200) {
        _logger.w(
          'getTrendingVideos returned HTTP ${response.statusCode}',
        );
        return [];
      }

      final data = response.data;

      if (data is! Map) {
        return [];
      }

      final creatorsJson = data['creators'];

      if (creatorsJson is! List) {
        return [];
      }

      final videos = <Video>[];

      for (final creator in creatorsJson) {
        if (creator is! Map) {
          continue;
        }

        final creatorVideos = creator['videos'];

        if (creatorVideos is List) {
          for (final video in creatorVideos) {
            if (video is Map) {
              videos.add(
                Video.fromJson(
                  Map<String, dynamic>.from(video),
                ),
              );
            }
          }
        }
      }

      return videos;
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching trending videos',
        error: e,
        stackTrace: stackTrace,
      );
      return [];
    }
  }

  Future<Video?> getVideoById(String videoId) async {
    try {
      final response = await _dio.get(
        '${ApiConstants.videoDetail}/$videoId',
      );

      if (response.statusCode == 200 &&
          response.data is Map) {
        return Video.fromJson(
          Map<String, dynamic>.from(response.data),
        );
      }

      return null;
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching video by ID: $videoId',
        error: e,
        stackTrace: stackTrace,
      );
      return null;
    }
  }

  Future<String?> getPlaybackToken(String videoId) async {
    try {
      final response = await _dio.get(
        '${ApiConstants.videoPlaybackToken}/$videoId/playback-token',
      );

      if (response.statusCode == 200 &&
          response.data is Map) {
        return response.data['token'] as String?;
      }

      return null;
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching playback token for $videoId',
        error: e,
        stackTrace: stackTrace,
      );
      return null;
    }
  }

  /// Loads real Shorts from the existing InPlayer backend.
  ///
  /// There are intentionally NO sample/dummy Shorts here.
  Future<List<Short>> getShorts() async {
    try {
      final response = await _dio.get(
        ApiConstants.shorts,
      );

      if (response.statusCode != 200) {
        _logger.w(
          'getShorts returned HTTP ${response.statusCode}',
        );
        return [];
      }

      final data = response.data;

      List<dynamic> shortsJson;

      if (data is List) {
        shortsJson = data;
      } else if (data is Map && data['shorts'] is List) {
        shortsJson = data['shorts'] as List;
      } else {
        _logger.w(
          'Unexpected /api/shorts response format',
        );
        return [];
      }

      return shortsJson
          .whereType<Map>()
          .map(
            (json) => Short.fromJson(
              Map<String, dynamic>.from(json),
            ),
          )
          .toList();
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching real InPlayer Shorts',
        error: e,
        stackTrace: stackTrace,
      );
      return [];
    }
  }

  Future<List<Video>> searchVideos(String query) async {
    try {
      final response = await _dio.get(
        ApiConstants.search,
        queryParameters: {
          'q': query,
        },
      );

      if (response.statusCode != 200) {
        return [];
      }

      final data = response.data;

      List<dynamic> videosJson;

      if (data is List) {
        videosJson = data;
      } else if (data is Map && data['videos'] is List) {
        videosJson = data['videos'] as List;
      } else {
        return [];
      }

      return videosJson
          .whereType<Map>()
          .map(
            (json) => Video.fromJson(
              Map<String, dynamic>.from(json),
            ),
          )
          .toList();
    } catch (e, stackTrace) {
      _logger.e(
        'Error searching InPlayer videos',
        error: e,
        stackTrace: stackTrace,
      );
      return [];
    }
  }

  Future<List<Video>> getVideosByChannel(
    String channelId,
  ) async {
    try {
      final response = await _dio.get(
        ApiConstants.videos,
        queryParameters: {
          'channelId': channelId,
        },
      );

      if (response.statusCode != 200) {
        return [];
      }

      final data = response.data;

      List<dynamic> videosJson;

      if (data is List) {
        videosJson = data;
      } else if (data is Map && data['videos'] is List) {
        videosJson = data['videos'] as List;
      } else {
        return [];
      }

      return videosJson
          .whereType<Map>()
          .map(
            (json) => Video.fromJson(
              Map<String, dynamic>.from(json),
            ),
          )
          .toList();
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching channel videos',
        error: e,
        stackTrace: stackTrace,
      );
      return [];
    }
  }
}