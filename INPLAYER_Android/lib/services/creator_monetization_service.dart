import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/constants/api_constants.dart';
import '../core/network/dio_client.dart';
import '../models/creator_payout_status.dart';

final creatorMonetizationServiceProvider = Provider<CreatorMonetizationService>(
  (ref) {
    return CreatorMonetizationService();
  },
);

class CreatorMonetizationState {
  final String status;
  final String? monetizedAt;
  final String? suspensionReason;
  final bool isEligible;
  final int subscribers;
  final int videoViews;
  final int shortViews;
  final int requiredSubscribers;
  final int requiredVideoViews;
  final int requiredShortViews;

  const CreatorMonetizationState({
    this.status = 'NOT_ELIGIBLE',
    this.monetizedAt,
    this.suspensionReason,
    this.isEligible = false,
    this.subscribers = 0,
    this.videoViews = 0,
    this.shortViews = 0,
    this.requiredSubscribers = 0,
    this.requiredVideoViews = 0,
    this.requiredShortViews = 0,
  });

  factory CreatorMonetizationState.fromJson(Map<String, dynamic> json) {
    final state = json['state'] is Map
        ? Map<String, dynamic>.from(json['state'])
        : <String, dynamic>{};
    final eligibility = json['eligibility'] is Map
        ? Map<String, dynamic>.from(json['eligibility'])
        : <String, dynamic>{};
    final metrics = eligibility['metrics'] is Map
        ? Map<String, dynamic>.from(eligibility['metrics'])
        : <String, dynamic>{};
    final thresholds = eligibility['thresholds'] is Map
        ? Map<String, dynamic>.from(eligibility['thresholds'])
        : <String, dynamic>{};
    int number(Map<String, dynamic> map, String key) =>
        (map[key] as num?)?.toInt() ?? 0;
    return CreatorMonetizationState(
      status: (state['status'] ?? eligibility['status'] ?? 'NOT_ELIGIBLE')
          .toString(),
      monetizedAt: state['monetizedAt']?.toString(),
      suspensionReason: state['suspensionReason']?.toString(),
      isEligible: eligibility['isEligible'] == true,
      subscribers: number(metrics, 'subscribers'),
      videoViews: number(metrics, 'videoViews'),
      shortViews: number(metrics, 'shortViews'),
      requiredSubscribers: number(thresholds, 'subscribers'),
      requiredVideoViews: number(thresholds, 'videoViews'),
      requiredShortViews: number(thresholds, 'shortViews'),
    );
  }
}

class CreatorMonetizationService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  Future<CreatorPayoutStatus> getPayoutStatus() async {
    try {
      final response = await _dio.get(ApiConstants.creatorPayoutStatus);
      if (response.statusCode == 200 && response.data is Map) {
        return CreatorPayoutStatus.fromJson(
          Map<String, dynamic>.from(response.data as Map),
        );
      }
    } catch (e) {
      _logger.e('Error fetching creator payout status: $e');
    }

    return const CreatorPayoutStatus();
  }

  Future<Map<String, dynamic>> submitKyc({
    required String legalName,
    required String panNumber,
    required String addressLine1,
    required String city,
    required String state,
    required String pincode,
    required String idProofType,
    String? aadhaarNumber,
    String? passportNumber,
    required String bankAccountNumber,
    required String bankIfsc,
    String payoutFrequency = 'monthly',
    int minPayoutAmount = 500,
    required Map<String, String> documents,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.creatorKyc,
        data: {
          'legalName': legalName,
          'panNumber': panNumber,
          'addressLine1': addressLine1,
          'city': city,
          'state': state,
          'pincode': pincode,
          'idProofType': idProofType,
          if (aadhaarNumber?.isNotEmpty ?? false)
            'aadhaarNumber': aadhaarNumber,
          if (passportNumber?.isNotEmpty ?? false)
            'passportNumber': passportNumber,
          'bankAccountNumber': bankAccountNumber,
          'bankIfsc': bankIfsc,
          'payoutFrequency': payoutFrequency,
          'minPayoutAmount': minPayoutAmount,
          'documents': documents,
        },
      );

      if (response.statusCode == 200 && response.data is Map) {
        return Map<String, dynamic>.from(response.data as Map);
      }

      final error = response.data is Map
          ? response.data['error']?.toString()
          : null;
      return {'success': false, 'error': error ?? 'Could not submit KYC.'};
    } catch (e) {
      _logger.e('Error submitting KYC: $e');
      return {
        'success': false,
        'error': 'Could not submit KYC. Please try again.',
      };
    }
  }

  Future<Map<String, dynamic>> updatePayoutPreferences({
    String? payoutFrequency,
    int? minPayoutAmount,
  }) async {
    try {
      final payload = <String, dynamic>{'action': 'update_payout_prefs'};
      if (payoutFrequency != null) payload['payoutFrequency'] = payoutFrequency;
      if (minPayoutAmount != null) payload['minPayoutAmount'] = minPayoutAmount;

      final response = await _dio.post(ApiConstants.creatorKyc, data: payload);

      if (response.statusCode == 200 && response.data is Map) {
        return Map<String, dynamic>.from(response.data as Map);
      }

      final error = response.data is Map
          ? response.data['error']?.toString()
          : null;
      return {
        'success': false,
        'error': error ?? 'Could not update payout preferences.',
      };
    } catch (e) {
      _logger.e('Error updating payout preferences: $e');
      return {
        'success': false,
        'error': 'Could not update payout preferences.',
      };
    }
  }

  Future<CreatorMonetizationState> getMonetizationStatus() async {
    try {
      final response = await _dio.get(ApiConstants.creatorMonetizeStatus);
      if (response.statusCode == 200 && response.data is Map) {
        return CreatorMonetizationState.fromJson(
          Map<String, dynamic>.from(response.data as Map),
        );
      }
    } catch (e) {
      _logger.e('Error fetching monetization status: $e');
    }

    return const CreatorMonetizationState();
  }

  Future<Map<String, dynamic>> activateMonetization() async {
    try {
      final response = await _dio.post(ApiConstants.creatorMonetizeActivate);
      if (response.statusCode == 200 && response.data is Map) {
        return Map<String, dynamic>.from(response.data as Map);
      }

      final error = response.data is Map
          ? response.data['error']?.toString()
          : null;
      return {
        'success': false,
        'error': error ?? 'Could not activate monetization.',
      };
    } catch (e) {
      _logger.e('Error activating monetization: $e');
      return {
        'success': false,
        'error': 'Could not activate monetization. Please try again.',
      };
    }
  }
}
