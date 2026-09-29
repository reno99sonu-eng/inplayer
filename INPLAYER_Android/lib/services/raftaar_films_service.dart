import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

import '../core/constants/api_constants.dart';
import '../core/network/dio_client.dart';
import '../models/film_series.dart';
import '../models/film_episode.dart';
import '../models/film_creator_application.dart';

final raftaarFilmsServiceProvider = Provider<RaftaarFilmsService>((ref) {
  return RaftaarFilmsService();
});

class SeriesDetailResult {
  final FilmSeries series;
  final List<FilmEpisode> episodes;

  SeriesDetailResult({required this.series, required this.episodes});
}

class RaftaarFilmsService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  /// Fetch published series with optional genre or search filters
  Future<List<FilmSeries>> getSeries({String? genre, String? search}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (genre != null && genre.isNotEmpty && genre != 'All') {
        queryParams['genre'] = genre;
      }
      if (search != null && search.isNotEmpty) {
        queryParams['search'] = search;
      }

      final response = await _dio.get(
        ApiConstants.raftaarFilmsSeries,
        queryParameters: queryParams,
      );

      if (response.statusCode == 200 && response.data != null) {
        final List<dynamic> seriesList = response.data['series'] ?? [];
        return seriesList.map((item) => FilmSeries.fromJson(item)).toList();
      }
      return [];
    } catch (e) {
      _logger.e('Error fetching Raftaar Film series: $e');
      return [];
    }
  }

  /// Fetch single series by ID with its episodes
  Future<SeriesDetailResult?> getSeriesDetail(String seriesId) async {
    try {
      final response = await _dio.get('${ApiConstants.raftaarFilmsSeries}/$seriesId');
      if (response.statusCode == 200 && response.data != null) {
        final seriesData = response.data['series'];
        final episodesData = response.data['episodes'] as List<dynamic>? ?? [];

        if (seriesData != null) {
          final series = FilmSeries.fromJson(seriesData);
          final episodes = episodesData.map((ep) => FilmEpisode.fromJson(ep)).toList();
          // Sort episodes by episodeNumber
          episodes.sort((a, b) => a.episodeNumber.compareTo(b.episodeNumber));
          return SeriesDetailResult(series: series, episodes: episodes);
        }
      }
      return null;
    } catch (e) {
      _logger.e('Error fetching series detail for $seriesId: $e');
      return null;
    }
  }

  /// Fetch trending series
  Future<List<FilmSeries>> getTrendingSeries({int limit = 10}) async {
    try {
      final response = await _dio.get(
        ApiConstants.raftaarFilmsTrending,
        queryParameters: {'limit': limit},
      );

      if (response.statusCode == 200 && response.data != null) {
        final List<dynamic> list = response.data['series'] ?? [];
        return list.map((item) => FilmSeries.fromJson(item)).toList();
      }
      return [];
    } catch (e) {
      _logger.e('Error fetching trending series: $e');
      return [];
    }
  }

  /// Fetch genres with counts
  Future<List<Map<String, dynamic>>> getGenres() async {
    try {
      final response = await _dio.get(ApiConstants.raftaarFilmsGenres);
      if (response.statusCode == 200 && response.data != null) {
        final List<dynamic> list = response.data['genres'] ?? [];
        return list.map((e) => Map<String, dynamic>.from(e)).toList();
      }
      return [];
    } catch (e) {
      _logger.e('Error fetching film genres: $e');
      return [];
    }
  }

  /// Check subscription to series
  Future<bool> isSubscribed(String seriesId) async {
    try {
      final response = await _dio.get('${ApiConstants.raftaarFilmsSeries}/$seriesId/subscribe');
      if (response.statusCode == 200 && response.data != null) {
        return response.data['subscribed'] == true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /// Toggle subscription
  Future<bool> toggleSubscribe(String seriesId, bool subscribe) async {
    try {
      final response = await _dio.post(
        '${ApiConstants.raftaarFilmsSeries}/$seriesId/subscribe',
        data: {'action': subscribe ? 'subscribe' : 'unsubscribe'},
      );
      if (response.statusCode == 200 && response.data != null) {
        return response.data['subscribed'] == true;
      }
      return subscribe;
    } catch (e) {
      _logger.e('Error toggling series subscription: $e');
      return !subscribe;
    }
  }

  /// Check creator application status
  Future<FilmCreatorApplication?> getApplicationStatus() async {
    try {
      final response = await _dio.get(ApiConstants.raftaarFilmsApply);
      if (response.statusCode == 200 && response.data != null) {
        final appData = response.data['application'];
        if (appData != null) {
          return FilmCreatorApplication.fromJson(appData);
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Submit creator application
  Future<bool> submitApplication(Map<String, dynamic> data) async {
    try {
      final response = await _dio.post(
        ApiConstants.raftaarFilmsApply,
        data: data,
      );
      return response.statusCode == 201 || response.statusCode == 200;
    } catch (e) {
      _logger.e('Error submitting film creator application: $e');
      return false;
    }
  }

  /// Fetch creator's own series
  Future<List<FilmSeries>> getMySeries() async {
    try {
      final response = await _dio.get(ApiConstants.raftaarFilmsMySeries);
      if (response.statusCode == 200 && response.data != null) {
        final List<dynamic> list = response.data['series'] ?? [];
        return list.map((item) => FilmSeries.fromJson(item)).toList();
      }
      return [];
    } catch (e) {
      _logger.e('Error fetching my series: $e');
      return [];
    }
  }
}
