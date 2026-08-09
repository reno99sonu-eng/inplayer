import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';
import '../models/channel.dart';

final channelServiceProvider = Provider<ChannelService>((ref) {
  return ChannelService();
});

class ChannelService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  Future<List<Channel>> getSubscribedChannels() async {
    try {
      final response = await _dio.get(ApiConstants.subscriptionsList);

      if (response.statusCode == 200) {
        final data = response.data;
        final subscriptions = data['subscriptions'] as List<dynamic>? ?? [];
        return subscriptions.map((json) => Channel.fromJson(json)).toList();
      }

      return [];
    } catch (e) {
      _logger.e('Error fetching subscribed channels: $e');
      return [];
    }
  }

  Future<bool> subscribeToChannel(String creatorId) async {
    try {
      final response = await _dio.post(
        ApiConstants.subscribe,
        data: {'creatorId': creatorId},
      );

      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error subscribing to channel: $e');
      return false;
    }
  }

  Future<bool> unsubscribeFromChannel(String creatorId) async {
    try {
      final response = await _dio.post(
        ApiConstants.unsubscribe,
        data: {'creatorId': creatorId},
      );

      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error unsubscribing from channel: $e');
      return false;
    }
  }

  Future<Channel?> getChannel(String username) async {
    try {
      final response = await _dio.get(
        ApiConstants.creators,
        queryParameters: {'username': username},
      );

      if (response.statusCode == 200) {
        return Channel.fromJson(response.data);
      }

      return null;
    } catch (e) {
      _logger.e('Error fetching channel: $e');
      return null;
    }
  }

  Future<List<Channel>> searchChannels(String query) async {
    try {
      final response = await _dio.get(
        ApiConstants.creators,
        queryParameters: {'q': query},
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        return data.map((json) => Channel.fromJson(json)).toList();
      }

      return [];
    } catch (e) {
      _logger.e('Error searching channels: $e');
      return [];
    }
  }
}
