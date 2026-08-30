import 'package:flutter_test/flutter_test.dart';
import 'package:inplayer_android/models/creator_payout_status.dart';
import 'package:inplayer_android/models/sponsorship.dart';

void main() {
  test('creator payout status parses website contract', () {
    final status = CreatorPayoutStatus.fromJson({
      'kycStatus': 'pending_review',
      'payoutFrequency': 'monthly',
      'legalName': 'Reno Sen',
      'submittedAt': '2026-08-29T10:00:00.000Z',
      'minPayoutAmount': 500,
      'lifetimeEarnedInr': 1240,
      'lifetimePaidOutInr': 300,
      'rejectionReason': null,
    });

    expect(status.kycStatus, 'pending_review');
    expect(status.payoutFrequency, 'monthly');
    expect(status.legalName, 'Reno Sen');
    expect(status.minPayoutAmount, 500);
    expect(status.lifetimeEarnedInr, 1240);
    expect(status.lifetimePaidOutInr, 300);
  });

  test('sponsorship checkout parses website contract', () {
    final checkout = SponsorshipCheckout.fromJson({
      'sponsorshipId': 's-123',
      'razorpayOrderId': 'order_123',
      'razorpayKeyId': 'rzp_test_123',
      'amountInr': 7000,
    });

    expect(checkout.sponsorshipId, 's-123');
    expect(checkout.razorpayOrderId, 'order_123');
    expect(checkout.razorpayKeyId, 'rzp_test_123');
    expect(checkout.amountInr, 7000);
    expect(checkout.isValid, isTrue);
  });
}
