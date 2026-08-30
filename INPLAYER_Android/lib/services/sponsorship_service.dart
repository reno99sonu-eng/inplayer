import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/constants/api_constants.dart';
import '../core/network/dio_client.dart';
import '../models/sponsorship.dart';

final sponsorshipServiceProvider = Provider<SponsorshipService>((ref) {
  return SponsorshipService();
});

class SponsorshipService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  Future<List<Sponsorship>> listMySponsorships() async {
    try {
      final response = await _dio.get(ApiConstants.sponsorships);
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final sponsorships = (data['sponsorships'] as List? ?? [])
            .whereType<Map>()
            .map((json) => Sponsorship.fromJson(Map<String, dynamic>.from(json)))
            .toList();
        return sponsorships;
      }
    } catch (e) {
      _logger.e('Error fetching sponsorships: $e');
    }
    return const <Sponsorship>[];
  }

  Future<SponsorshipDetail?> getSponsorship(String sponsorshipId) async {
    try {
      final response = await _dio.get('${ApiConstants.sponsorships}/$sponsorshipId');
      if (response.statusCode == 200 && response.data is Map) {
        return SponsorshipDetail.fromJson(Map<String, dynamic>.from(response.data as Map));
      }
    } catch (e) {
      _logger.e('Error fetching sponsorship detail: $e');
    }
    return null;
  }

  Future<SponsorshipCheckout> createCheckout({
    required String packageType,
    required String companyName,
    required String contactName,
    required String contactEmail,
    required String contactPhone,
    required String websiteUrl,
    required String legalName,
    required String panOrGst,
    required String businessAddress,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.sponsorshipCheckout,
        data: {
          'packageType': packageType,
          'companyName': companyName,
          'contactName': contactName,
          'contactEmail': contactEmail,
          'contactPhone': contactPhone,
          'websiteUrl': websiteUrl,
          'legalName': legalName,
          'panOrGst': panOrGst,
          'businessAddress': businessAddress,
        },
      );

      if (response.statusCode == 200 && response.data is Map) {
        final checkout = SponsorshipCheckout.fromJson(Map<String, dynamic>.from(response.data as Map));
        if (checkout.isValid) return checkout;
      }

      final error = response.data is Map ? response.data['error']?.toString() : null;
      throw Exception(error ?? 'Could not start sponsorship checkout.');
    } catch (e) {
      _logger.e('Error creating sponsorship checkout: $e');
      throw Exception('Could not start sponsorship checkout. Please try again.');
    }
  }
}
