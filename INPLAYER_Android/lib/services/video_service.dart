import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';
import '../models/video.dart';
import '../models/short.dart';
import '../models/trending_creator.dart';
import '../models/video_suggestion.dart';

final videoServiceProvider = Provider<VideoService>((ref) {
  return VideoService();
});

class VideoService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  static List<Video>? _cachedVideos;
  static DateTime? _videosCacheTime;

  static List<Video>? _cachedFeatured;
  static DateTime? _featuredCacheTime;

  /// The audience cookie is part of the server response contract. Clear both
  /// in-memory shelves whenever a viewer changes 18+/Kids mode so existing
  /// cached cards cannot briefly bypass the newly selected filter.
  static void clearAudienceCaches() {
    _cachedVideos = null;
    _videosCacheTime = null;
    _cachedFeatured = null;
    _featuredCacheTime = null;
  }

  /// Loads the real video feed from the InPlayer website backend with instant in-memory caching.
  Future<List<Video>> getVideos({bool forceRefresh = false}) async {
    if (!forceRefresh &&
        _cachedVideos != null &&
        _videosCacheTime != null &&
        DateTime.now().difference(_videosCacheTime!).inSeconds < 45) {
      return _cachedVideos!;
    }

    try {
      final response = await _dio.get(ApiConstants.videos);

      if (response.statusCode != 200) {
        _logger.w('getVideos returned HTTP ${response.statusCode}');
        return _cachedVideos ?? [];
      }

      final data = response.data;
      if (data is! Map) {
        return _cachedVideos ?? [];
      }

      final videosJson = data['videos'];
      if (videosJson is! List) {
        return _cachedVideos ?? [];
      }

      final result = videosJson
          .whereType<Map>()
          .map((json) => Video.fromJson(Map<String, dynamic>.from(json)))
          .toList();

      _cachedVideos = result;
      _videosCacheTime = DateTime.now();
      return result;
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching real InPlayer videos',
        error: e,
        stackTrace: stackTrace,
      );
      return _cachedVideos ?? [];
    }
  }

  /// Loads the real Featured Weekly videos with instant in-memory caching.
  Future<List<Video>> getFeaturedWeekly({bool forceRefresh = false}) async {
    if (!forceRefresh &&
        _cachedFeatured != null &&
        _featuredCacheTime != null &&
        DateTime.now().difference(_featuredCacheTime!).inSeconds < 45) {
      return _cachedFeatured!;
    }

    try {
      final response = await _dio.get(ApiConstants.featuredWeekly);

      if (response.statusCode != 200) {
        return _cachedFeatured ?? [];
      }

      final data = response.data;
      if (data is! Map) {
        return _cachedFeatured ?? [];
      }

      final videosJson = data['videos'];
      if (videosJson is! List) {
        return _cachedFeatured ?? [];
      }

      final result = videosJson
          .whereType<Map>()
          .map((json) => Video.fromJson(Map<String, dynamic>.from(json)))
          .where((v) => !v.isMusic)
          .toList();

      _cachedFeatured = result;
      _featuredCacheTime = DateTime.now();
      return result;
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching featured weekly videos',
        error: e,
        stackTrace: stackTrace,
      );
      return _cachedFeatured ?? [];
    }
  }

  /// Loads the real Trending data.
  ///
  /// The live /api/trending endpoint returns creator/video information
  /// under its "creators" property rather than returning a bare List.
  Future<List<TrendingCreator>> getTrendingCreatorsData() async {
    try {
      final response = await _dio.get(ApiConstants.trending);

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
            (json) => TrendingCreator.fromJson(Map<String, dynamic>.from(json)),
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
      final response = await _dio.get(ApiConstants.trending);

      if (response.statusCode != 200) {
        _logger.w('getTrendingVideos returned HTTP ${response.statusCode}');
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
              videos.add(Video.fromJson(Map<String, dynamic>.from(video)));
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
      final response = await _dio.get('${ApiConstants.videoDetail}/$videoId');

      if (response.statusCode == 200 && response.data is Map) {
        return Video.fromJson(Map<String, dynamic>.from(response.data));
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

      if (response.statusCode == 200 && response.data is Map) {
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
  ///
  /// NOTE: the website has no standalone `/api/shorts` REST endpoint —
  /// app/shorts/page.tsx renders Shorts server-side by filtering the same
  /// video list down to `contentType === "short"`. We reuse `/api/videos`
  /// here and apply that identical filter client-side so the app reads
  /// from real data instead of a route that doesn't exist (which is why
  /// Raftaar/Shorts always came back empty before).
  Future<List<Short>> getShorts() async {
    try {
      final response = await _dio.get(ApiConstants.videos);

      if (response.statusCode != 200) {
        _logger.w('getShorts returned HTTP ${response.statusCode}');
        return [];
      }

      final data = response.data;

      if (data is! Map || data['videos'] is! List) {
        _logger.w('Unexpected /api/videos response format for shorts');
        return [];
      }

      final videosJson = data['videos'] as List;

      return videosJson
          .whereType<Map>()
          .map((json) => Map<String, dynamic>.from(json))
          .where((json) => json['contentType'] == 'short')
          .map((json) => Short.fromJson(json))
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

  /// NOTE: the website has no `/api/search` endpoint — its navbar search
  /// box calls `/api/videos/suggest` for lightweight autocomplete
  /// (videoId/title/thumbnail only, see app/api/videos/suggest/route.ts),
  /// not full video cards. To keep returning full `Video` objects (so the
  /// existing search results grid/VideoCard keeps working unchanged), this
  /// reuses `/api/videos` and filters by title client-side instead of
  /// calling a route that returns 404.
  Future<List<Video>> searchVideos(String query) async {
    try {
      final response = await _dio.get(ApiConstants.videos);

      if (response.statusCode != 200) {
        return [];
      }

      final data = response.data;

      if (data is! Map || data['videos'] is! List) {
        return [];
      }

      final lowerQuery = query.toLowerCase();

      return (data['videos'] as List)
          .whereType<Map>()
          .map((json) => Map<String, dynamic>.from(json))
          .where(
            (json) => (json['title']?.toString().toLowerCase() ?? '').contains(
              lowerQuery,
            ),
          )
          .map((json) => Video.fromJson(json))
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

  /// Live search-as-you-type suggestions — GET /api/videos/suggest?q=
  /// (app/api/videos/suggest/route.ts), a real, separate, lightweight
  /// endpoint already audience-filtered server-side. Returns up to 8
  /// title-matched results carrying only videoId/title/thumbnail/
  /// contentType — the typeahead dropdown in search_page.dart, not the
  /// full results grid (which stays on searchVideos() above, unchanged).
  Future<List<VideoSuggestion>> getSuggestions(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return [];

    try {
      final response = await _dio.get(
        ApiConstants.videoSuggest,
        queryParameters: {'q': trimmed},
      );

      if (response.statusCode != 200) {
        return [];
      }

      final data = response.data;
      if (data is! Map || data['suggestions'] is! List) {
        return [];
      }

      return (data['suggestions'] as List)
          .whereType<Map>()
          .map(
            (json) => VideoSuggestion.fromJson(Map<String, dynamic>.from(json)),
          )
          .toList();
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching search suggestions for "$trimmed"',
        error: e,
        stackTrace: stackTrace,
      );
      return [];
    }
  }

  /// The signed-in user's own uploads (Creator Studio / "My Videos").
  /// GET /api/my-videos (app/api/my-videos/route.ts) — every video where
  /// uploaderId matches the caller, any status/visibility (unlike the
  /// public feed, this includes the owner's own drafts/private videos).
  Future<List<Video>> getMyVideos() async {
    try {
      final response = await _dio.get(ApiConstants.myVideos);

      if (response.statusCode != 200 || response.data is! Map) {
        return [];
      }

      final videosJson = (response.data as Map)['videos'];
      if (videosJson is! List) return [];

      return videosJson
          .whereType<Map>()
          .map((json) => Video.fromJson(Map<String, dynamic>.from(json)))
          .toList();
    } catch (e, stackTrace) {
      _logger.e('Error fetching my videos', error: e, stackTrace: stackTrace);
      return [];
    }
  }

  /// Videos the signed-in user has liked (Profile -> Liked Videos).
  /// GET /api/likes/my-likes (app/api/likes/my-likes/route.ts) returns
  /// full video records (each with an extra `likedAt`), not just IDs.
  Future<List<Video>> getLikedVideos() async {
    try {
      final response = await _dio.get(ApiConstants.myLikes);

      if (response.statusCode != 200 || response.data is! Map) {
        return [];
      }

      final videosJson = (response.data as Map)['videos'];
      if (videosJson is! List) return [];

      return videosJson
          .whereType<Map>()
          .map((json) => Video.fromJson(Map<String, dynamic>.from(json)))
          .toList();
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching liked videos',
        error: e,
        stackTrace: stackTrace,
      );
      return [];
    }
  }

  Future<List<Video>> getVideosByChannel(String channelId) async {
    try {
      final response = await _dio.get(
        ApiConstants.videos,
        queryParameters: {'channelId': channelId},
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
          .map((json) => Video.fromJson(Map<String, dynamic>.from(json)))
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

  /// Updates a video owned by the signed-in user (PATCH /api/my-videos/:videoId).
  Future<bool> updateMyVideo(String videoId, Map<String, dynamic> data) async {
    try {
      final response = await _dio.patch(
        '${ApiConstants.myVideos}/$videoId',
        data: data,
      );
      return response.statusCode == 200;
    } catch (e, stackTrace) {
      _logger.e(
        'Error updating video $videoId',
        error: e,
        stackTrace: stackTrace,
      );
      return false;
    }
  }

  /// Deletes a video owned by the signed-in user (DELETE /api/my-videos/:videoId).
  Future<bool> deleteMyVideo(String videoId) async {
    try {
      final response = await _dio.delete('${ApiConstants.myVideos}/$videoId');
      return response.statusCode == 200;
    } catch (e, stackTrace) {
      _logger.e(
        'Error deleting video $videoId',
        error: e,
        stackTrace: stackTrace,
      );
      return false;
    }
  }

  /// Updates the user's channel bio (POST /api/profile/settings with action: 'update_bio').
  Future<bool> updateBio(String bio) async {
    try {
      final response = await _dio.post(
        ApiConstants.profileSettings,
        data: {'action': 'update_bio', 'description': bio},
      );
      return response.statusCode == 200;
    } catch (e, stackTrace) {
      _logger.e('Error updating channel bio', error: e, stackTrace: stackTrace);
      return false;
    }
  }

  /// Fetches channel analytics from GET /api/analytics/channel or /api/my-videos/analytics.
  Future<Map<String, dynamic>?> getChannelAnalytics() async {
    try {
      final response = await _dio.get('/api/my-videos/analytics');
      if (response.statusCode == 200 && response.data is Map) {
        return Map<String, dynamic>.from(response.data as Map);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// GET /api/my-videos — the signed-in creator's own uploads, any status
  /// (processing/ready/etc). Returned raw rather than through Video.fromJson:
  /// that model pre-formats `views` as a display string ("12 views") and has
  /// no `status` field, both of which the Analytics and Storage settings
  /// pages need untouched. Backs those two real, previously-static pages.
  Future<List<Map<String, dynamic>>> getMyVideoStatsRaw() async {
    try {
      final response = await _dio.get(ApiConstants.myVideos);
      final data = response.data;
      List<dynamic> raw;
      if (data is List) {
        raw = data;
      } else if (data is Map && data['videos'] is List) {
        raw = data['videos'] as List;
      } else {
        return [];
      }
      return raw
          .whereType<Map>()
          .map((m) => Map<String, dynamic>.from(m))
          .toList();
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching my-videos stats',
        error: e,
        stackTrace: stackTrace,
      );
      return [];
    }
  }
}
