import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';
import '../models/channel.dart';
import '../models/public_creator.dart';

final channelServiceProvider = Provider<ChannelService>((ref) {
  return ChannelService();
});

class ChannelService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  /// The signed-in user's own subscriptions (In-Family list). Only carries
  /// creatorId/username/name/avatarUrl/notifyEnabled — no bio/videos.
  Future<List<Channel>> getSubscribedChannels() async {
    try {
      final response = await _dio.get(ApiConstants.subscriptionsList);

      if (response.statusCode == 200) {
        final data = response.data;
        final subscriptions = data['subscriptions'] as List<dynamic>? ?? [];
        return subscriptions
            .whereType<Map>()
            .map((json) => Channel.fromJson(Map<String, dynamic>.from(json)))
            .toList();
      }

      return [];
    } catch (e) {
      _logger.e('Error fetching subscribed channels: $e');
      return [];
    }
  }

  /// Live subscribe state + subscriber count for one creator, as seen by
  /// the current viewer (or anonymously if signed out).
  /// GET /api/subscriptions?creatorId=X -> { subscriberCount, isSubscribed, notifyEnabled }
  Future<Map<String, dynamic>?> getSubscriptionStatus(String creatorId) async {
    try {
      final response = await _dio.get(
        ApiConstants.subscriptions,
        queryParameters: {'creatorId': creatorId},
      );

      if (response.statusCode == 200) {
        return response.data as Map<String, dynamic>;
      }
      return null;
    } catch (e) {
      _logger.e('Error fetching subscription status: $e');
      return null;
    }
  }

  /// There is no dedicated /subscribe path — the backend is one endpoint
  /// keyed by an `action` field in the POST body (see api_constants.dart).
  Future<bool> subscribeToChannel(String creatorId) async {
    try {
      final response = await _dio.post(
        ApiConstants.subscriptions,
        data: {'creatorId': creatorId, 'action': 'subscribe'},
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
        ApiConstants.subscriptions,
        data: {'creatorId': creatorId, 'action': 'unsubscribe'},
      );

      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error unsubscribing from channel: $e');
      return false;
    }
  }

  /// The bell toggle — only changes notification preference on an
  /// already-existing subscription, never subscribes/unsubscribes.
  Future<bool> setNotifyEnabled(String creatorId, bool enabled) async {
    try {
      final response = await _dio.post(
        ApiConstants.subscriptions,
        data: {
          'creatorId': creatorId,
          'action': 'notify',
          'notifyEnabled': enabled,
        },
      );

      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error updating notification preference: $e');
      return false;
    }
  }

  /// A creator's full public channel page. `/api/creators` has no
  /// per-username filter (it's the paginated browse-all list) — the real
  /// per-creator lookup is a path param on `/api/users/{username}`, which
  /// also returns bio, cover photo, verified badge, subscriber/view counts
  /// and the creator's own video list in one call.
  Future<Channel?> getChannel(String username) async {
    try {
      final response = await _dio.get('${ApiConstants.users}/$username');

      if (response.statusCode == 200) {
        return Channel.fromJson(response.data as Map<String, dynamic>);
      }

      return null;
    } catch (e) {
      _logger.e('Error fetching channel: $e');
      return null;
    }
  }

  /// The public, paginated "browse everyone" list (GET /api/creators) —
  /// only accounts with a claimed, public @handle. Cursor-based: pass the
  /// previous page's nextCursor to continue. Powers DiscoverCreatorsPage,
  /// the real equivalent of the website's app/creators.
  Future<CreatorsPage> getCreators({String? cursor}) async {
    try {
      final response = await _dio.get(
        ApiConstants.creators,
        queryParameters: cursor != null ? {'cursor': cursor} : null,
      );

      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final creatorsJson = data['creators'] as List<dynamic>? ?? [];
        return CreatorsPage(
          creators: creatorsJson
              .whereType<Map>()
              .map((json) => PublicCreator.fromJson(Map<String, dynamic>.from(json)))
              .toList(),
          nextCursor: data['nextCursor'] as String?,
        );
      }

      return const CreatorsPage(creators: []);
    } catch (e) {
      _logger.e('Error fetching creators list: $e');
      return const CreatorsPage(creators: []);
    }
  }

  /// Search-as-you-type by handle. /api/creators doesn't support a `q`
  /// filter — the real search endpoint is /api/users/search.
  Future<List<Channel>> searchChannels(String query) async {
    if (query.trim().length < 2) return [];

    try {
      final response = await _dio.get(
        '${ApiConstants.users}/search',
        queryParameters: {'q': query},
      );

      if (response.statusCode == 200) {
        final data = response.data;
        final users = data['users'] as List<dynamic>? ?? [];
        return users
            .whereType<Map>()
            .map((json) => Channel.fromJson(Map<String, dynamic>.from(json)))
            .toList();
      }

      return [];
    } catch (e) {
      _logger.e('Error searching channels: $e');
      return [];
    }
  }

  /// Whether the signed-in viewer has an active paid membership with this
  /// one creator — GET /api/memberships/status?creatorId=. Read-only: the
  /// actual purchase still only happens on the real website (Razorpay).
  Future<bool> getMembershipStatus(String creatorId) async {
    try {
      final response = await _dio.get(
        ApiConstants.membershipStatus,
        queryParameters: {'creatorId': creatorId},
      );
      if (response.statusCode == 200 && response.data is Map) {
        return (response.data as Map)['isActive'] == true;
      }
    } catch (e) {
      _logger.e('Error fetching membership status for $creatorId: $e');
    }
    return false;
  }
}
