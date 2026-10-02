import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

final admobConsentServiceProvider = Provider<AdMobConsentService>(
  (ref) => AdMobConsentService(),
);

final admobPrivacyOptionsRequiredProvider = FutureProvider.autoDispose<bool>(
  (ref) => ref.read(admobConsentServiceProvider).isPrivacyOptionsRequired(),
);

/// Initializes Google's consent flow before the Android app requests ads.
///
/// UMP consent information is refreshed once per app process, and the SDK is
/// initialized only after UMP confirms that ad requests are allowed.
class AdMobConsentService {
  Future<bool>? _initialization;

  Future<bool> initialize() => _initialization ??= _initialize();

  Future<bool> _initialize() async {
    if (!Platform.isAndroid) return false;

    try {
      final consentUpdate = Completer<void>();
      ConsentInformation.instance.requestConsentInfoUpdate(
        ConsentRequestParameters(),
        () async {
          try {
            await ConsentForm.loadAndShowConsentFormIfRequired((error) {
              if (error != null) {
                debugPrint('AdMob consent form warning: ${error.message}');
              }
            });
          } catch (error) {
            debugPrint('AdMob consent form warning: $error');
          } finally {
            if (!consentUpdate.isCompleted) consentUpdate.complete();
          }
        },
        (error) {
          debugPrint('AdMob consent update warning: ${error.message}');
          if (!consentUpdate.isCompleted) consentUpdate.complete();
        },
      );

      await consentUpdate.future;
      if (!await ConsentInformation.instance.canRequestAds()) return false;

      await MobileAds.instance.initialize();
      return true;
    } catch (error) {
      debugPrint('AdMob initialization warning: $error');
      return false;
    }
  }

  Future<bool> showPrivacyOptions() async {
    await initialize();

    try {
      if (!await isPrivacyOptionsRequired()) return false;

      await ConsentForm.showPrivacyOptionsForm((error) {
        if (error != null) {
          debugPrint('AdMob privacy options warning: ${error.message}');
        }
      });
      return true;
    } catch (error) {
      debugPrint('Could not open AdMob privacy options: $error');
      return false;
    }
  }

  Future<bool> isPrivacyOptionsRequired() async {
    if (!Platform.isAndroid) return false;
    await initialize();

    try {
      return await ConsentInformation.instance
              .getPrivacyOptionsRequirementStatus() ==
          PrivacyOptionsRequirementStatus.required;
    } catch (error) {
      debugPrint('Could not read AdMob privacy options status: $error');
      return false;
    }
  }
}
