/// GET/PATCH /api/admin/settings — mirrors app/lib/platformSettings.ts's
/// PlatformSettings shape (minus updatedBy, which the UI doesn't need to
/// show). PATCH only sends whichever fields actually changed, using the
/// same whitelist as the backend.
class PlatformContactEmail {
  final String label;
  final String address;

  const PlatformContactEmail({required this.label, required this.address});

  factory PlatformContactEmail.fromJson(Map<String, dynamic> json) {
    final label = (json['label'] ?? json['name'] ?? 'Contact').toString();
    final address = (json['address'] ?? json['email'] ?? '').toString();
    return PlatformContactEmail(label: label, address: address);
  }
}

class AdminPlatformSettings {
  final bool maintenanceMode;
  final String maintenanceMessage;
  final bool signupsEnabled;
  final bool announcementEnabled;
  final String announcementText;
  final String announcementLinkUrl;
  final bool moderationEnabledComments;
  final bool moderationEnabledMessages;
  final bool moderationEnabledUploads;
  final bool adsenseEnabled;
  final String adsensePublisherId;
  final bool admobEnabled;
  final String admobAppId;
  final String admobBannerUnitId;
  final String admobInterstitialUnitId;
  final String admobRewardedUnitId;
  final String admobNativeUnitId;
  final String admobOpenAppUnitId;
  final String homepageBannerSource; // 'house' | 'adsense' | 'off'
  final String watchPageBannerSource;
  final bool weeklyFeaturedEnabled;
  final bool midrollEnabled;
  final int midrollIntervalSeconds;
  final List<PlatformContactEmail> contactEmails;
  final String supportEmail;
  final String helpEmail;
  final String contactEmail;
  final String sponsorEmail;
  final String? updatedAt;

  AdminPlatformSettings({
    this.maintenanceMode = false,
    this.maintenanceMessage = '',
    this.signupsEnabled = true,
    this.announcementEnabled = false,
    this.announcementText = '',
    this.announcementLinkUrl = '',
    this.moderationEnabledComments = true,
    this.moderationEnabledMessages = true,
    this.moderationEnabledUploads = true,
    this.adsenseEnabled = true,
    this.adsensePublisherId = 'pub-2093353589258497',
    this.admobEnabled = true,
    this.admobAppId = 'ca-app-pub-2093353589258497~5197320427',
    this.admobBannerUnitId = 'ca-app-pub-2093353589258497/2053845436',
    this.admobInterstitialUnitId = 'ca-app-pub-2093353589258497/7761467681',
    this.admobRewardedUnitId = '',
    this.admobNativeUnitId = '',
    this.admobOpenAppUnitId = '',
    this.homepageBannerSource = 'house',
    this.watchPageBannerSource = 'house',
    this.weeklyFeaturedEnabled = true,
    this.midrollEnabled = true,
    this.midrollIntervalSeconds = 120,
    this.contactEmails = const [],
    this.supportEmail = 'support@inplayer.in',
    this.helpEmail = 'help@inplayer.in',
    this.contactEmail = 'contact@inplayer.in',
    this.sponsorEmail = 'Sponsor@inplayer.in',
    this.updatedAt,
  });

  factory AdminPlatformSettings.fromJson(Map<String, dynamic> json) {
    final rawContactEmails = json['contactEmails'];
    final parsedContactEmails = rawContactEmails is List
        ? rawContactEmails
            .whereType<Map>()
            .map((item) => PlatformContactEmail.fromJson(Map<String, dynamic>.from(item)))
            .where((item) => item.address.trim().isNotEmpty)
            .toList()
        : <PlatformContactEmail>[];

    final defaultContactEmails = <PlatformContactEmail>[
      const PlatformContactEmail(label: 'Hammart', address: 'Hammart@inplayer.in'),
      const PlatformContactEmail(label: 'MillonBook', address: 'Millonbook@inplayer.in'),
      const PlatformContactEmail(label: 'Sponsor / Banner Specs', address: 'Sponsor@inplayer.in'),
      const PlatformContactEmail(label: 'InPlayer Digital', address: 'inplayerdigital@gmail.com'),
    ];

    final contactEmails = parsedContactEmails.isNotEmpty ? parsedContactEmails : defaultContactEmails;

    return AdminPlatformSettings(
      maintenanceMode: json['inplayerMaintenanceMode'] == true,
      maintenanceMessage: json['inplayerMaintenanceMessage']?.toString() ?? '',
      signupsEnabled: json['signupsEnabled'] != false,
      announcementEnabled: json['inplayerAnnouncementEnabled'] == true,
      announcementText: json['inplayerAnnouncementText']?.toString() ?? '',
      announcementLinkUrl: json['inplayerAnnouncementLinkUrl']?.toString() ?? '',
      moderationEnabledComments: json['moderationEnabledComments'] != false,
      moderationEnabledMessages: json['moderationEnabledMessages'] != false,
      moderationEnabledUploads: json['moderationEnabledUploads'] != false,
      adsenseEnabled: json['adsenseEnabled'] == true,
      adsensePublisherId: json['adsensePublisherId']?.toString() ?? '',
      admobEnabled: json['admobEnabled'] == true,
      admobAppId: json['admobAppId']?.toString() ?? '',
      admobBannerUnitId: json['admobBannerUnitId']?.toString() ?? '',
      admobInterstitialUnitId: json['admobInterstitialUnitId']?.toString() ?? '',
      admobRewardedUnitId: json['admobRewardedUnitId']?.toString() ?? '',
      admobNativeUnitId: json['admobNativeUnitId']?.toString() ?? '',
      admobOpenAppUnitId: json['admobOpenAppUnitId']?.toString() ?? '',
      homepageBannerSource: json['homepageBannerSource']?.toString() ?? 'house',
      watchPageBannerSource: json['watchPageBannerSource']?.toString() ?? 'house',
      weeklyFeaturedEnabled: json['weeklyFeaturedEnabled'] != false,
      midrollEnabled: json['midrollEnabled'] != false,
      midrollIntervalSeconds: (json['midrollIntervalSeconds'] as num?)?.toInt() ?? 120,
      contactEmails: contactEmails,
      supportEmail: json['supportEmail']?.toString() ?? 'support@inplayer.in',
      helpEmail: json['helpEmail']?.toString() ?? 'help@inplayer.in',
      contactEmail: json['contactEmail']?.toString() ?? 'contact@inplayer.in',
      sponsorEmail: json['sponsorEmail']?.toString() ?? 'Sponsor@inplayer.in',
      updatedAt: json['updatedAt'] as String?,
    );
  }

  AdminPlatformSettings copyWith({
    bool? maintenanceMode,
    String? maintenanceMessage,
    bool? signupsEnabled,
    bool? announcementEnabled,
    String? announcementText,
    String? announcementLinkUrl,
    bool? moderationEnabledComments,
    bool? moderationEnabledMessages,
    bool? moderationEnabledUploads,
    bool? adsenseEnabled,
    String? adsensePublisherId,
    bool? admobEnabled,
    String? admobAppId,
    String? admobBannerUnitId,
    String? admobInterstitialUnitId,
    String? admobRewardedUnitId,
    String? admobNativeUnitId,
    String? admobOpenAppUnitId,
    String? homepageBannerSource,
    String? watchPageBannerSource,
    bool? weeklyFeaturedEnabled,
    bool? midrollEnabled,
    int? midrollIntervalSeconds,
    List<PlatformContactEmail>? contactEmails,
    String? supportEmail,
    String? helpEmail,
    String? contactEmail,
    String? sponsorEmail,
  }) {
    return AdminPlatformSettings(
      maintenanceMode: maintenanceMode ?? this.maintenanceMode,
      maintenanceMessage: maintenanceMessage ?? this.maintenanceMessage,
      signupsEnabled: signupsEnabled ?? this.signupsEnabled,
      announcementEnabled: announcementEnabled ?? this.announcementEnabled,
      announcementText: announcementText ?? this.announcementText,
      announcementLinkUrl: announcementLinkUrl ?? this.announcementLinkUrl,
      moderationEnabledComments: moderationEnabledComments ?? this.moderationEnabledComments,
      moderationEnabledMessages: moderationEnabledMessages ?? this.moderationEnabledMessages,
      moderationEnabledUploads: moderationEnabledUploads ?? this.moderationEnabledUploads,
      adsenseEnabled: adsenseEnabled ?? this.adsenseEnabled,
      adsensePublisherId: adsensePublisherId ?? this.adsensePublisherId,
      admobEnabled: admobEnabled ?? this.admobEnabled,
      admobAppId: admobAppId ?? this.admobAppId,
      admobBannerUnitId: admobBannerUnitId ?? this.admobBannerUnitId,
      admobInterstitialUnitId: admobInterstitialUnitId ?? this.admobInterstitialUnitId,
      admobRewardedUnitId: admobRewardedUnitId ?? this.admobRewardedUnitId,
      admobNativeUnitId: admobNativeUnitId ?? this.admobNativeUnitId,
      admobOpenAppUnitId: admobOpenAppUnitId ?? this.admobOpenAppUnitId,
      homepageBannerSource: homepageBannerSource ?? this.homepageBannerSource,
      watchPageBannerSource: watchPageBannerSource ?? this.watchPageBannerSource,
      weeklyFeaturedEnabled: weeklyFeaturedEnabled ?? this.weeklyFeaturedEnabled,
      midrollEnabled: midrollEnabled ?? this.midrollEnabled,
      midrollIntervalSeconds: midrollIntervalSeconds ?? this.midrollIntervalSeconds,
      contactEmails: contactEmails ?? this.contactEmails,
      supportEmail: supportEmail ?? this.supportEmail,
      helpEmail: helpEmail ?? this.helpEmail,
      contactEmail: contactEmail ?? this.contactEmail,
      sponsorEmail: sponsorEmail ?? this.sponsorEmail,
      updatedAt: updatedAt,
    );
  }
}
