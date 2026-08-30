import 'package:flutter_test/flutter_test.dart';
import 'package:inplayer_android/models/admin_platform_settings.dart';

void main() {
  test('parses platform contact emails from backend config', () {
    final settings = AdminPlatformSettings.fromJson({
      'contactEmails': [
        {'label': 'Hammart', 'address': 'Hammart@inplayer.in'},
        {'label': 'MillonBook', 'address': 'Millonbook@inplayer.in'},
        {'label': 'Sponsor / Banner Specs', 'address': 'Sponsor@inplayer.in'},
        {'label': 'InPlayer Digital', 'address': 'inplayerdigital@gmail.com'},
      ],
      'supportEmail': 'support@inplayer.in',
      'contactEmail': 'contact@inplayer.in',
    });

    expect(
      settings.contactEmails.map((e) => e.address),
      containsAll([
        'Hammart@inplayer.in',
        'Millonbook@inplayer.in',
        'Sponsor@inplayer.in',
        'inplayerdigital@gmail.com',
      ]),
    );
    expect(settings.supportEmail, 'support@inplayer.in');
    expect(settings.contactEmail, 'contact@inplayer.in');
  });
}
