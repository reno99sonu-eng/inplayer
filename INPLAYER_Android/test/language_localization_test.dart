import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:inplayer_android/core/localization/app_strings.dart';
import 'package:inplayer_android/providers/app_language_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('AppStrings Localization Dictionary Tests', () {
    test('English dictionary has valid non-empty values', () {
      final strings = AppStrings.english;
      expect(strings.code, 'en');
      expect(strings.home, 'Home');
      expect(strings.music, 'Music');
      expect(strings.shorts, 'Raftaar Shorts');
      expect(strings.settingsTitle, 'Settings');
      expect(strings.language, 'Language');
      expect(strings.play, 'Play');
      expect(strings.pause, 'Pause');
      expect(strings.subscribe, 'Subscribe');
    });

    test('Hindi dictionary has valid Hindi translations', () {
      final strings = AppStrings.hindi;
      expect(strings.code, 'hi');
      expect(strings.home, 'होम');
      expect(strings.music, 'संगीत');
      expect(strings.shorts, 'रफ्तार शॉर्ट्स');
      expect(strings.settingsTitle, 'सेटिंग्स');
      expect(strings.language, 'भाषा');
      expect(strings.play, 'चलाएं');
      expect(strings.pause, 'रोकें');
    });

    test('Bengali dictionary has valid Bengali translations', () {
      final strings = AppStrings.bengali;
      expect(strings.code, 'bn');
      expect(strings.home, 'হোম');
      expect(strings.music, 'সঙ্গীত');
      expect(strings.shorts, 'রফতার শর্টস');
      expect(strings.settingsTitle, 'সেটিংস');
      expect(strings.language, 'ভাষা');
    });

    test('Tamil dictionary has valid Tamil translations', () {
      final strings = AppStrings.tamil;
      expect(strings.code, 'ta');
      expect(strings.home, 'முகப்பு');
      expect(strings.music, 'இசை');
      expect(strings.settingsTitle, 'அமைப்புகள்');
      expect(strings.language, 'மொழி');
    });

    test('Telugu dictionary has valid Telugu translations', () {
      final strings = AppStrings.telugu;
      expect(strings.code, 'te');
      expect(strings.home, 'హోమ్');
      expect(strings.music, 'సంగీతం');
      expect(strings.settingsTitle, 'సెట్టింగ్‌లు');
      expect(strings.language, 'భాష');
    });

    test('Marathi dictionary has valid Marathi translations', () {
      final strings = AppStrings.marathi;
      expect(strings.code, 'mr');
      expect(strings.home, 'होम');
      expect(strings.music, 'संगीत');
      expect(strings.settingsTitle, 'सेटिंग्ज');
      expect(strings.language, 'भाषा');
    });

    test('Gujarati dictionary has valid Gujarati translations', () {
      final strings = AppStrings.gujarati;
      expect(strings.code, 'gu');
      expect(strings.home, 'હોમ');
      expect(strings.music, 'સંગીત');
      expect(strings.settingsTitle, 'સેટિંગ્સ');
      expect(strings.language, 'ભાષા');
    });

    test('Kannada dictionary has valid Kannada translations', () {
      final strings = AppStrings.kannada;
      expect(strings.code, 'kn');
      expect(strings.home, 'ಮುಖಪುಟ');
      expect(strings.music, 'ಸಂಗೀತ');
      expect(strings.settingsTitle, 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು');
      expect(strings.language, 'ಭಾಷೆ');
    });

    test('Malayalam dictionary has valid Malayalam translations', () {
      final strings = AppStrings.malayalam;
      expect(strings.code, 'ml');
      expect(strings.home, 'ഹോം');
      expect(strings.music, 'സംഗീതം');
      expect(strings.settingsTitle, 'ക്രമീകരണങ്ങൾ');
      expect(strings.language, 'ഭാഷ');
    });

    test('Punjabi dictionary has valid Punjabi translations', () {
      final strings = AppStrings.punjabi;
      expect(strings.code, 'pa');
      expect(strings.home, 'ਹੋਮ');
      expect(strings.music, 'ਸੰਗੀਤ');
      expect(strings.settingsTitle, 'ਸੈਟਿੰਗਾਂ');
      expect(strings.language, 'ਭਾਸ਼ਾ');
    });

    test('Odia dictionary has valid Odia translations', () {
      final strings = AppStrings.odia;
      expect(strings.code, 'or');
      expect(strings.home, 'ମୂଳପୃଷ୍ଠା');
      expect(strings.music, 'ସଙ୍ଗୀତ');
      expect(strings.settingsTitle, 'ସେଟିଙ୍ଗ୍ସ');
      expect(strings.language, 'ଭାଷା');
    });

    test('Assamese dictionary has valid Assamese translations', () {
      final strings = AppStrings.assamese;
      expect(strings.code, 'as');
      expect(strings.home, 'গৃহপৃষ্ঠা');
      expect(strings.music, 'সংগীত');
      expect(strings.settingsTitle, 'ছেটিংছ');
      expect(strings.language, 'ভাষা');
    });

    test('Fallback to English on unknown or null language code', () {
      final fromNull = AppStrings.get(null);
      expect(fromNull.code, 'en');
      expect(fromNull.home, 'Home');

      final fromUnknown = AppStrings.get('xyz_unknown');
      expect(fromUnknown.code, 'en');
      expect(fromUnknown.home, 'Home');
    });

    test('All 12 supported languages are present in AppLanguages.supported', () {
      expect(AppLanguages.supported.length, 12);
      final codes = AppLanguages.supported.map((l) => l.code).toSet();
      expect(
        codes,
        containsAll([
          'en',
          'hi',
          'bn',
          'ta',
          'te',
          'mr',
          'gu',
          'kn',
          'ml',
          'pa',
          'or',
          'as',
        ]),
      );
    });
  });

  group('AppLanguageNotifier Tests', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('Initializes with default language and sets new language with persistence', () async {
      final notifier = AppLanguageNotifier();
      expect(notifier.state.code, 'en');

      await notifier.setLanguage('hi');
      expect(notifier.state.code, 'hi');
      expect(notifier.state.strings.home, 'होम');

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('inplayer_app_language'), 'hi');
    });
  });
}
