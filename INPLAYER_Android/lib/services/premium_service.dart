import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';

final premiumServiceProvider = Provider<PremiumService>((ref) {
  return PremiumService();
});

/// `GET /api/premium/me`'s full response — whether the viewer is Premium,
/// and the server-decided ceiling for their tier alone (before any Settings
/// > Playback quality preference is applied — see [effectiveMaxResolution]
/// below for that combination, mirroring app/lib/premium.ts exactly).
class PremiumStatus {
  final bool premium;
  final String maxResolution;

  /// ISO date string the current Premium term runs until, if any — shown on
  /// the Plans & Purchases page (real status, even though the app links out
  /// to the website for the actual Razorpay purchase/renewal itself).
  final String? premiumUntil;
  const PremiumStatus({
    required this.premium,
    required this.maxResolution,
    this.premiumUntil,
  });
}

class PremiumPlan {
  final String planId;
  final String label;
  final String cadence;
  final int durationDays;
  final int? amountInr;
  final String? badge;

  const PremiumPlan({
    required this.planId,
    required this.label,
    required this.cadence,
    required this.durationDays,
    this.amountInr,
    this.badge,
  });

  factory PremiumPlan.fromJson(Map<String, dynamic> json) => PremiumPlan(
    planId: json['planId']?.toString() ?? '',
    label: json['label']?.toString() ?? 'Premium',
    cadence: json['cadence']?.toString() ?? '',
    durationDays: (json['durationDays'] as num?)?.toInt() ?? 0,
    amountInr: (json['amountInr'] as num?)?.toInt(),
    badge: json['badge']?.toString(),
  );
}

/// A payment order created by the server. Amount and plan metadata are
/// authoritative server values; callers only pass a plan id to create it.
class PremiumCheckout {
  final String razorpayOrderId;
  final String razorpayKeyId;
  final int amountInr;
  final String planLabel;

  const PremiumCheckout({
    required this.razorpayOrderId,
    required this.razorpayKeyId,
    required this.amountInr,
    required this.planLabel,
  });

  factory PremiumCheckout.fromJson(Map<String, dynamic> json) =>
      PremiumCheckout(
        razorpayOrderId: json['razorpayOrderId']?.toString() ?? '',
        razorpayKeyId: json['razorpayKeyId']?.toString() ?? '',
        amountInr: (json['amountInr'] as num?)?.toInt() ?? 0,
        planLabel: json['planLabel']?.toString() ?? 'InPlayer Premium',
      );

  bool get isValid =>
      razorpayOrderId.isNotEmpty && razorpayKeyId.isNotEmpty && amountInr > 0;
}

class PremiumServiceException implements Exception {
  final String message;
  const PremiumServiceException(this.message);

  @override
  String toString() => message;
}

class PremiumService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  Future<PremiumStatus> getStatus() async {
    try {
      final response = await _dio.get('/api/premium/me');
      if (response.statusCode == 200 && response.data != null) {
        return PremiumStatus(
          premium: response.data['premium'] == true,
          maxResolution: response.data['maxResolution'] as String? ?? '1080p',
          premiumUntil: response.data['premiumUntil'] as String?,
        );
      }
    } catch (e) {
      _logger.e('Error fetching premium status: $e');
    }
    return const PremiumStatus(
      premium: false,
      maxResolution: '1080p',
    ); // Fail closed to the free ceiling.
  }

  /// Lists plans and their price for the authenticated user. The server
  /// intentionally withholds prices from anonymous calls, so an empty or
  /// incomplete response is treated as an error rather than guessed at.
  Future<List<PremiumPlan>> getPlans() async {
    try {
      final response = await _dio.get('/api/premium/plans');
      final data = response.data;
      if (response.statusCode == 200 && data is Map && data['plans'] is List) {
        return (data['plans'] as List)
            .whereType<Map>()
            .map((row) => PremiumPlan.fromJson(Map<String, dynamic>.from(row)))
            .where((plan) => plan.planId.isNotEmpty && plan.amountInr != null)
            .toList();
      }
    } catch (e) {
      _logger.e('Error fetching Premium plans: $e');
    }
    throw const PremiumServiceException(
      'Could not load Premium plans. Please try again.',
    );
  }

  /// Creates a Razorpay order on the backend. This endpoint never grants
  /// Premium; only the signed payment.captured webhook can do that.
  Future<PremiumCheckout> createCheckout(String planId) async {
    try {
      final response = await _dio.post(
        '/api/premium/checkout',
        data: {'planId': planId},
      );
      final data = response.data;
      if (response.statusCode == 200 && data is Map) {
        final checkout = PremiumCheckout.fromJson(
          Map<String, dynamic>.from(data),
        );
        if (checkout.isValid) return checkout;
      }
      final error = data is Map ? data['error']?.toString() : null;
      throw PremiumServiceException(
        error ?? 'Could not start payment. Please try again.',
      );
    } on PremiumServiceException {
      rethrow;
    } catch (e) {
      _logger.e('Error creating Premium checkout: $e');
      throw const PremiumServiceException(
        'Could not start payment. Please try again.',
      );
    }
  }

  /// Kept for callers that only need the tier ceiling, not the full status.
  Future<String> getMaxResolution() async => (await getStatus()).maxResolution;
}

// The values a Settings quality select can be set to — matches
// QUALITY_OPTIONS' `value`s in app/lib/premium.ts (no 480p/360p: those are
// valid Mux MIN renditions but not valid MAX/ceiling ones).
const Map<String, int> _knownResolutionHeights = {
  '720p': 720,
  '1080p': 1080,
  '1440p': 1440,
  '2160p': 2160,
};

/// The single place that combines a viewer's real tier ceiling with
/// whatever they picked in Settings > Playback — the direct Dart
/// equivalent of `effectiveMaxResolution()` in app/lib/premium.ts. Always
/// the LOWER of the two, so a free viewer who somehow has "2160p" saved
/// locally still gets capped server-tier-side, and "auto" (or anything
/// unrecognized, e.g. a stale value) simply defers entirely to the tier.
/// Returns a Mux `max_resolution` query value ("1080p", "720p", ...).
String effectiveMaxResolution(
  String tierMaxResolution,
  String preferredQuality,
) {
  final tierHeight =
      int.tryParse(tierMaxResolution.replaceAll(RegExp(r'[^0-9]'), '')) ?? 1080;
  final preferredHeight = _knownResolutionHeights[preferredQuality];
  if (preferredHeight == null || preferredHeight >= tierHeight) {
    return '${tierHeight}p';
  }
  return '${preferredHeight}p';
}
