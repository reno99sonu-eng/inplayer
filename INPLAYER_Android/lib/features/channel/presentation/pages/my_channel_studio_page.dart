import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../core/widgets/user_avatar.dart';
import '../../../../models/video.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/video_service.dart';
import '../../../../services/channel_service.dart';
import '../../../../services/settings_service.dart';
import '../../../../services/platform_update_service.dart';
import '../../../../services/creator_monetization_service.dart';

enum StudioTab {
  dashboard,
  editContent,
  profileSettings,
  revenueKYC,
  howItWorks,
}

class _EligibilityLockNotice extends StatelessWidget {
  final int subscribers;
  final int requiredSubscribers;
  final int videoViews;
  final int requiredVideoViews;

  const _EligibilityLockNotice({
    required this.subscribers,
    required this.requiredSubscribers,
    required this.videoViews,
    required this.requiredVideoViews,
  });

  @override
  Widget build(BuildContext context) {
    final subscriberTarget = requiredSubscribers > 0
        ? requiredSubscribers
        : 1000;
    final viewTarget = requiredVideoViews > 0 ? requiredVideoViews : 50000;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.warning.withValues(alpha: .45)),
      ),
      child: Row(
        children: [
          const Icon(Icons.lock_outline_rounded, color: AppColors.warning),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'KYC and monetization unlock after reaching $subscriberTarget subscribers and $viewTarget video plays. Progress: $subscribers subscribers, $videoViews plays.',
              style: TextStyle(
                color: context.textSecondary,
                fontSize: 12,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class MyChannelStudioPage extends ConsumerStatefulWidget {
  const MyChannelStudioPage({super.key});

  @override
  ConsumerState<MyChannelStudioPage> createState() =>
      _MyChannelStudioPageState();
}

class _MyChannelStudioPageState extends ConsumerState<MyChannelStudioPage>
    with WidgetsBindingObserver {
  StudioTab _activeTab = StudioTab.dashboard;
  String _contentFilter = 'all'; // 'all', 'video', 'short', 'music'
  String _analyticsScope = 'video'; // 'video', 'short', 'music'

  bool _loading = true;
  bool _loadInFlight = false;
  DateTime? _lastBackgroundRefresh;
  ProviderSubscription<int>? _platformUpdates;
  List<Video> _videos = [];
  int _subscriberCount = 0;
  int _totalViews = 0;
  Map<String, dynamic>? _analytics;
  bool _analyticsUnavailable = false;

  /// Why the upload list is empty, when it is empty because something went
  /// wrong rather than because nothing has been uploaded. Null means the
  /// fetch genuinely succeeded.
  String? _videosError;
  CreatorMonetizationState _monetization = const CreatorMonetizationState();

  // Bio state
  final _bioController = TextEditingController();
  bool _savingBio = false;
  bool _bioSaved = false;

  // Profile settings state
  final _handleController = TextEditingController();
  String _privacyLevel = 'public';
  bool _savingProfileSettings = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _platformUpdates = ref.listenManual<int>(platformUpdateRevisionProvider, (
      previous,
      next,
    ) {
      if (mounted && previous != next) _loadData();
    });
    final authState = ref.read(authStateProvider);
    if (authState is AuthStateAuthenticated) {
      _loadData();
    } else {
      setState(() {
        _loading = false;
        _loadInFlight = false;
      });
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _platformUpdates?.close();
    _bioController.dispose();
    _handleController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed || !mounted || _loadInFlight) return;
    final now = DateTime.now();
    if (_lastBackgroundRefresh != null &&
        now.difference(_lastBackgroundRefresh!).inSeconds < 15) {
      return;
    }
    _lastBackgroundRefresh = now;
    _loadData();
  }

  Future<void> _loadData() async {
    if (_loadInFlight) return;

    final authState = ref.read(authStateProvider);
    if (authState is! AuthStateAuthenticated) {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadInFlight = false;
        });
      }
      return;
    }

    _loadInFlight = true;
    if (mounted) setState(() => _loading = true);

    // Fetch the freshest user data from the backend so this dashboard
    // reflects real-time changes made on the web or other devices.
    await ref.read(authStateProvider.notifier).refreshUser();

    // Re-read state after refresh
    final freshAuthState = ref.read(authStateProvider);
    if (freshAuthState is! AuthStateAuthenticated) {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadInFlight = false;
        });
      }
      return;
    }

    final user = freshAuthState.user;
    _bioController.text = user.bio;
    _handleController.text = user.handle ?? user.username;
    _privacyLevel =
        const {
          'public',
          'connections',
          'private',
        }.contains(user.usernamePrivacy)
        ? user.usernamePrivacy
        : 'public';

    try {
      final results = await Future.wait([
        ref.read(videoServiceProvider).getMyVideosResult(),
        ref.read(channelServiceProvider).getSubscriptionStatus(user.userId),
        ref.read(videoServiceProvider).getChannelAnalytics(),
        ref.read(creatorMonetizationServiceProvider).getMonetizationStatus(),
      ]);

      if (!mounted) return;

      final videosResult = results[0] as MyVideosResult;
      final videos = videosResult.videos;
      final subStatus = results[1] as Map<String, dynamic>?;
      final analytics = results[2] as Map<String, dynamic>?;
      final monetization = results[3] as CreatorMonetizationState;

      int totalViews = 0;
      for (final v in videos) {
        final digits = v.views.replaceAll(RegExp(r'[^0-9]'), '');
        totalViews += int.tryParse(digits) ?? 0;
      }

      final analyticsViews = analytics == null
          ? null
          : _analyticsTotalViews(analytics);
      final analyticsSubscribers = analytics?['subscriberCount'];

      setState(() {
        _videos = videos;
        _videosError = videosResult.error;
        _subscriberCount = analyticsSubscribers is num
            ? analyticsSubscribers.toInt()
            : (subStatus?['subscriberCount'] as num?)?.toInt() ?? 0;
        _totalViews = analyticsViews ?? totalViews;
        _analytics = analytics;
        _analyticsUnavailable = analytics == null;
        _monetization = monetization;
        _loading = false;
        _loadInFlight = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadInFlight = false;
        });
      }
    }
  }

  int _analyticsTotalViews(Map<String, dynamic> analytics) {
    var total = 0;
    for (final key in const ['videos', 'shorts', 'music']) {
      final stats = analytics[key];
      if (stats is Map && stats['views'] is num) {
        total += (stats['views'] as num).toInt();
      }
    }
    return total;
  }

  Map<String, dynamic>? _analyticsForScope() {
    final key = switch (_analyticsScope) {
      'short' => 'shorts',
      'music' => 'music',
      _ => 'videos',
    };
    final stats = _analytics?[key];
    return stats is Map ? Map<String, dynamic>.from(stats) : null;
  }

  String _analyticsValue(Map<String, dynamic>? stats, String key) {
    final value = stats?[key];
    return value is num ? _formatCount(value.toInt()) : '—';
  }

  Future<void> _handleSaveBio() async {
    setState(() {
      _savingBio = true;
      _bioSaved = false;
    });

    final success = await ref
        .read(videoServiceProvider)
        .updateBio(_bioController.text.trim());

    if (!mounted) return;
    setState(() {
      _savingBio = false;
      _bioSaved = success;
    });

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Channel bio saved successfully!'),
          backgroundColor: Color(0xFF10B981),
        ),
      );
    }
  }

  void _showEditVideoModal(Video video) {
    final titleController = TextEditingController(text: video.title);
    final descController = TextEditingController(text: video.description);
    String selectedVisibility = video.visibility ?? 'public';
    bool saving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.bgCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (modalContext) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Edit Video Metadata',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: context.textPrimary,
                          ),
                        ),
                        IconButton(
                          icon: Icon(Icons.close, color: context.textSecondary),
                          onPressed: () => Navigator.pop(modalContext),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'TITLE',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1,
                        color: context.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: titleController,
                      style: TextStyle(
                        color: context.textPrimary,
                        fontSize: 14,
                      ),
                      decoration: InputDecoration(
                        hintText: 'Video title...',
                        hintStyle: TextStyle(color: context.textDim),
                        filled: true,
                        fillColor: context.isDark
                            ? Colors.white.withValues(alpha: 0.04)
                            : Colors.black.withValues(alpha: 0.03),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: context.borderSubtle),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'DESCRIPTION',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1,
                        color: context.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: descController,
                      maxLines: 3,
                      style: TextStyle(
                        color: context.textPrimary,
                        fontSize: 13,
                      ),
                      decoration: InputDecoration(
                        hintText: 'Tell viewers about your video...',
                        hintStyle: TextStyle(color: context.textDim),
                        filled: true,
                        fillColor: context.isDark
                            ? Colors.white.withValues(alpha: 0.04)
                            : Colors.black.withValues(alpha: 0.03),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: context.borderSubtle),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'VISIBILITY',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1,
                        color: context.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: context.isDark
                            ? Colors.white.withValues(alpha: 0.04)
                            : Colors.black.withValues(alpha: 0.03),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: context.borderSubtle),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: selectedVisibility,
                          isExpanded: true,
                          dropdownColor: context.bgCard,
                          items: const [
                            DropdownMenuItem(
                              value: 'public',
                              child: Text('Public (Anyone can see)'),
                            ),
                            DropdownMenuItem(
                              value: 'unlisted',
                              child: Text('Unlisted (Anyone with link)'),
                            ),
                            DropdownMenuItem(
                              value: 'private',
                              child: Text('Private (Only you)'),
                            ),
                          ],
                          onChanged: (val) {
                            if (val != null) {
                              setModalState(() => selectedVisibility = val);
                            }
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 22),
                    SizedBox(
                      width: double.infinity,
                      height: 46,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.brandOrange,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        onPressed: saving
                            ? null
                            : () async {
                                setModalState(() => saving = true);
                                final ok = await ref
                                    .read(videoServiceProvider)
                                    .updateMyVideo(video.videoId, {
                                      'title': titleController.text.trim(),
                                      'description': descController.text.trim(),
                                      'visibility': selectedVisibility,
                                    });
                                if (!ctx.mounted) return;
                                Navigator.pop(ctx);
                                if (!mounted) return;
                                if (ok) {
                                  _loadData();
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                        'Video updated successfully!',
                                      ),
                                      backgroundColor: Color(0xFF10B981),
                                    ),
                                  );
                                }
                              },
                        child: saving
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text(
                                'Save Changes',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _confirmDeleteVideo(Video video) {
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: context.bgCard,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          title: Text(
            'Delete Video?',
            style: TextStyle(
              color: context.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          content: Text(
            'Are you sure you want to delete "${video.title}"? This action cannot be undone.',
            style: TextStyle(color: context.textSecondary, fontSize: 13),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(
                'Cancel',
                style: TextStyle(color: context.textSecondary),
              ),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEF4444),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              onPressed: () async {
                Navigator.pop(ctx);
                final ok = await ref
                    .read(videoServiceProvider)
                    .deleteMyVideo(video.videoId);
                if (ok && mounted) {
                  setState(() {
                    _videos.removeWhere((v) => v.videoId == video.videoId);
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Video deleted successfully'),
                      backgroundColor: Color(0xFFEF4444),
                    ),
                  );
                }
              },
              child: const Text(
                'Delete',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  String _formatCount(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return '$n';
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final user = authState is AuthStateAuthenticated ? authState.user : null;

    if (user == null) {
      if (_loading) {
        return Scaffold(
          body: PatternBackground(
            child: const Center(
              child: CircularProgressIndicator(color: AppColors.brandOrange),
            ),
          ),
        );
      }
      return Scaffold(
        body: PatternBackground(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.lock_outline,
                    size: 48,
                    color: AppColors.brandOrange,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Sign in to access Your Channel',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: context.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Manage your videos, shorts, analytics, and payouts.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: context.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.brandOrange,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 28,
                        vertical: 12,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    onPressed: () => context.push('/signin'),
                    child: const Text(
                      'Sign In',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      body: PatternBackground(
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverAppBar(
              automaticallyImplyLeading: false,
              floating: true,
              snap: true,
              pinned: true,
              backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
              surfaceTintColor: Colors.transparent,
              elevation: 0,
              toolbarHeight: 64,
              title: Row(
                children: [
                  GestureDetector(
                    onTap: () {
                      if (context.canPop()) {
                        context.pop();
                      } else {
                        context.go('/');
                      }
                    },
                    child: Container(
                      width: 38,
                      height: 38,
                      margin: const EdgeInsets.only(right: 8),
                      decoration: BoxDecoration(
                        color: context.isDark
                            ? Colors.white.withValues(alpha: 0.06)
                            : Colors.black.withValues(alpha: 0.04),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: context.borderSubtle),
                      ),
                      child: Icon(
                        Icons.arrow_back_rounded,
                        color: context.textPrimary,
                        size: 20,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      'Your Channel Studio',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: context.textPrimary,
                      ),
                    ),
                  ),
                ],
              ),
              actions: [
                if (user.handle != null && user.handle!.isNotEmpty)
                  TextButton.icon(
                    style: TextButton.styleFrom(
                      backgroundColor: context.isDark
                          ? Colors.white.withValues(alpha: 0.08)
                          : Colors.black.withValues(alpha: 0.05),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                    ),
                    onPressed: () => context.push('/channel/${user.handle}'),
                    icon: const Icon(
                      Icons.public,
                      size: 14,
                      color: AppColors.brandOrange,
                    ),
                    label: Text(
                      'Public View',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: context.textPrimary,
                      ),
                    ),
                  ),
                const SizedBox(width: 8),
                IconButton(
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.brandOrange,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    padding: const EdgeInsets.all(8),
                  ),
                  icon: const Icon(Icons.add, color: Colors.white, size: 18),
                  onPressed: () => context.push('/upload'),
                ),
                const SizedBox(width: 12),
              ],
            ),
            SliverToBoxAdapter(child: _buildTopTabBar()),
            SliverToBoxAdapter(
              child: _loading
                  ? const Padding(
                      padding: EdgeInsets.symmetric(vertical: 80),
                      child: Center(
                        child: CircularProgressIndicator(
                          color: AppColors.brandOrange,
                        ),
                      ),
                    )
                  : Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: _buildActiveTabContent(user),
                    ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 60)),
          ],
        ),
      ),
    );
  }

  Widget _buildTopTabBar() {
    final tabs = [
      {
        'id': StudioTab.dashboard,
        'label': 'Dashboard',
        'icon': Icons.dashboard_outlined,
      },
      {
        'id': StudioTab.editContent,
        'label': 'Edit Content',
        'icon': Icons.edit_outlined,
      },
      {
        'id': StudioTab.profileSettings,
        'label': 'Profile & Settings',
        'icon': Icons.person_outline_rounded,
      },
      {
        'id': StudioTab.revenueKYC,
        'label': 'Revenue & KYC',
        'icon': Icons.attach_money_rounded,
      },
      {
        'id': StudioTab.howItWorks,
        'label': 'How It Works?',
        'icon': Icons.help_outline_rounded,
      },
    ];

    return Container(
      height: 48,
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        itemCount: tabs.length,
        itemBuilder: (context, index) {
          final item = tabs[index];
          final tabId = item['id'] as StudioTab;
          final isActive = _activeTab == tabId;

          return GestureDetector(
            onTap: () => setState(() => _activeTab = tabId),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                gradient: isActive
                    ? const LinearGradient(
                        colors: [
                          Color(0xFFFF7A18),
                          Color(0xFFFF9A00),
                          Color(0xFFFFD54A),
                        ],
                      )
                    : null,
                color: isActive
                    ? null
                    : (context.isDark ? const Color(0xFF071120) : Colors.white),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isActive ? Colors.transparent : context.borderSubtle,
                ),
                boxShadow: isActive
                    ? [
                        BoxShadow(
                          color: AppColors.brandOrange.withValues(alpha: 0.35),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ]
                    : null,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    item['icon'] as IconData,
                    size: 15,
                    color: isActive
                        ? Colors.white
                        : (context.isDark ? Colors.white70 : Colors.black87),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    item['label'] as String,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: isActive
                          ? Colors.white
                          : (context.isDark ? Colors.white70 : Colors.black87),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildActiveTabContent(dynamic user) {
    switch (_activeTab) {
      case StudioTab.dashboard:
        return _buildDashboardTab(user);
      case StudioTab.editContent:
        return _buildEditContentTab();
      case StudioTab.profileSettings:
        return _buildProfileSettingsTab(user);
      case StudioTab.revenueKYC:
        return _buildRevenueKYCTab();
      case StudioTab.howItWorks:
        return _buildHowItWorksTab();
    }
  }

  // --- PANEL 1: DASHBOARD ---
  Widget _buildDashboardTab(dynamic user) {
    final videoCount = _videos
        .where((v) => v.contentType != 'short' && v.contentType != 'music')
        .length;
    final shortCount = _videos.where((v) => v.contentType == 'short').length;
    final musicCount = _videos.where((v) => v.contentType == 'music').length;
    final stats = _analyticsForScope();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: context.bgCard,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: context.borderSubtle),
            boxShadow: [
              BoxShadow(
                color: (context.isDark ? Colors.black : const Color(0xFFE2E8F0))
                    .withValues(alpha: 0.10),
                blurRadius: 14,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: AppColors.brandOrange.withValues(alpha: 0.5),
                        width: 2,
                      ),
                    ),
                    child: UserAvatar(
                      avatarUrl: user.avatarUrl,
                      name: user.name,
                      size: 52,
                      isVerified: false,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user.name.isNotEmpty ? user.name : 'Your Channel',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: context.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '@${user.handle ?? user.username} • $_subscriberCount subscribers • ${_formatCount(_totalViews)} views',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: context.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Divider(height: 1, color: context.borderSubtle),
              const SizedBox(height: 12),
              Text(
                'CHANNEL BIO',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.2,
                  color: context.textSecondary,
                ),
              ),
              const SizedBox(height: 6), // mb-1.5 equivalent
              TextField(
                controller: _bioController,
                maxLines: 3,
                minLines: 3,
                style: TextStyle(color: context.textPrimary, fontSize: 13),
                decoration: InputDecoration(
                  hintText:
                      'Tell viewers about your channel, content topics, and upload schedule...',
                  hintStyle: TextStyle(color: context.textDim, fontSize: 12),
                  filled: true,
                  fillColor: context.isDark
                      ? const Color(0xFF060D18)
                      : Colors.white,
                  contentPadding: const EdgeInsets.all(12), // p-3
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12), // rounded-xl
                    borderSide: BorderSide(color: context.borderSubtle),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: context.borderSubtle),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: AppColors.brandOrange.withValues(alpha: 0.5),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      'Visible on your public channel profile page.',
                      style: TextStyle(fontSize: 11, color: context.textDim),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: _savingBio ? null : _handleSaveBio,
                      borderRadius: BorderRadius.circular(12),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.brandOrange,
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.brandOrange.withValues(
                                alpha: 0.20,
                              ),
                              blurRadius: 12,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _savingBio
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : Icon(
                                    _bioSaved ? Icons.check : Icons.save,
                                    size: 14,
                                    color: Colors.white,
                                  ),
                            const SizedBox(width: 6),
                            Text(
                              _savingBio
                                  ? 'Saving...'
                                  : (_bioSaved ? 'Saved!' : 'Save Bio'),
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // Analytics Section
        Text(
          'Analytics',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w900,
            color: context.textPrimary,
          ),
        ),
        const SizedBox(height: 10),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _buildScopePill('video', 'Videos ($videoCount)'),
              const SizedBox(width: 8),
              _buildScopePill('short', 'Shorts ($shortCount)'),
              const SizedBox(width: 8),
              _buildScopePill('music', 'Music ($musicCount)'),
            ],
          ),
        ),
        const SizedBox(height: 14),

        if (_analyticsUnavailable)
          Container(
            width: double.infinity,
            margin: const EdgeInsets.only(bottom: 14),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.brandOrange.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: AppColors.brandOrange.withValues(alpha: 0.25),
              ),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.analytics_outlined,
                  color: AppColors.brandOrange,
                  size: 18,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Creator analytics could not be loaded. Showing only totals available from your uploads.',
                    style: TextStyle(
                      color: context.textSecondary,
                      fontSize: 11,
                    ),
                  ),
                ),
                TextButton(onPressed: _loadData, child: const Text('Retry')),
              ],
            ),
          ),

        // All figures come from GET /api/my-videos/analytics.  Do not infer
        // engagement from views: the website deliberately reports only the
        // reactions/comments/shares actually stored by the backend.
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 1.5,
          children: [
            _buildAnalyticsMetricCard(
              'Reach',
              _analyticsValue(stats, 'reach'),
              Icons.remove_red_eye_outlined,
              const Color(0xFF3B82F6),
            ),
            _buildAnalyticsMetricCard(
              'Views',
              _analyticsValue(stats, 'views'),
              Icons.play_circle_outline,
              AppColors.brandOrange,
            ),
            _buildAnalyticsMetricCard(
              'Likes',
              _analyticsValue(stats, 'likes'),
              Icons.thumb_up_alt_outlined,
              const Color(0xFF10B981),
            ),
            _buildAnalyticsMetricCard(
              'Comments',
              _analyticsValue(stats, 'comments'),
              Icons.chat_bubble_outline,
              const Color(0xFF8B5CF6),
            ),
            _buildAnalyticsMetricCard(
              'Shares',
              _analyticsValue(stats, 'shares'),
              Icons.share_outlined,
              const Color(0xFFEC4899),
            ),
          ],
        ),
        const SizedBox(height: 40),
      ],
    );
  }

  Widget _buildScopePill(String scope, String label) {
    final isActive = _analyticsScope == scope;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => setState(() => _analyticsScope = scope),
        borderRadius: BorderRadius.circular(10),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: isActive
                ? AppColors.brandOrange
                : (context.isDark
                      ? Colors.white.withValues(alpha: 0.04)
                      : Colors.black.withValues(alpha: 0.025)),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isActive
                  ? AppColors.brandOrange.withValues(alpha: 0.30)
                  : context.borderSubtle,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: isActive ? Colors.white : context.textSecondary,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAnalyticsMetricCard(
    String title,
    String value,
    IconData icon,
    Color iconColor,
  ) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: (context.isDark ? Colors.black : const Color(0xFFE2E8F0))
                .withValues(alpha: 0.08),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: context.textSecondary,
                ),
              ),
              Icon(icon, size: 17, color: iconColor),
            ],
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: context.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  // --- PANEL 2: EDIT CONTENT ---
  Widget _buildEditContentTab() {
    final filtered = _videos.where((v) {
      if (_contentFilter == 'video') {
        return v.contentType != 'short' && v.contentType != 'music';
      }
      if (_contentFilter == 'short') return v.contentType == 'short';
      if (_contentFilter == 'music') return v.contentType == 'music';
      return true;
    }).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _buildFilterPill('all', 'All (${_videos.length})'),
              const SizedBox(width: 6),
              _buildFilterPill('video', 'Videos'),
              const SizedBox(width: 6),
              _buildFilterPill('short', 'Shorts'),
              const SizedBox(width: 6),
              _buildFilterPill('music', 'Music'),
            ],
          ),
        ),
        const SizedBox(height: 14),

        if (filtered.isEmpty)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 40),
            alignment: Alignment.center,
            child: Column(
              children: [
                Icon(
                  Icons.video_library_outlined,
                  size: 48,
                  color: context.textDim,
                ),
                const SizedBox(height: 12),
                Text(
                  _videosError ?? 'No content uploaded in this category',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: _videosError != null
                        ? AppColors.error
                        : context.textSecondary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (_videosError != null) ...[
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: _loadInFlight ? null : () => _loadData(),
                    child: const Text(
                      'Try again',
                      style: TextStyle(
                        color: AppColors.brandOrange,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: filtered.length,
            separatorBuilder: (context, index) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final v = filtered[index];
              return Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: context.bgCard,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: context.borderSubtle),
                ),
                child: Column(
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Thumbnail
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: SizedBox(
                            width: 100,
                            height: 60,
                            child: v.thumbnail.isNotEmpty
                                ? CachedNetworkImage(
                                    imageUrl: v.thumbnail,
                                    fit: BoxFit.cover,
                                    placeholder: (context, url) => Container(
                                      color: context.isDark
                                          ? AppColors.surfaceDark
                                          : AppColors.surfaceLight,
                                    ),
                                    errorWidget: (context, url, error) =>
                                        Container(
                                          color: context.isDark
                                              ? AppColors.surfaceDark
                                              : AppColors.surfaceLight,
                                          child: const Icon(
                                            Icons.play_circle_outline,
                                          ),
                                        ),
                                  )
                                : Container(
                                    color: context.isDark
                                        ? AppColors.surfaceDark
                                        : AppColors.surfaceLight,
                                    child: const Icon(
                                      Icons.play_circle_outline,
                                    ),
                                  ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                v.title.isNotEmpty ? v.title : 'Untitled',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: context.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Text(
                                    '${v.views} • ${v.uploaded}',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: context.textSecondary,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color:
                                          (v.visibility == 'private'
                                                  ? const Color(0xFFEF4444)
                                                  : const Color(0xFF10B981))
                                              .withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      v.visibility?.toUpperCase() ?? 'PUBLIC',
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.bold,
                                        color: v.visibility == 'private'
                                            ? const Color(0xFFEF4444)
                                            : const Color(0xFF10B981),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(color: context.borderSubtle),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                          ),
                          onPressed: () => _showEditVideoModal(v),
                          icon: const Icon(
                            Icons.edit,
                            size: 13,
                            color: AppColors.brandOrange,
                          ),
                          label: Text(
                            'Edit',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: context.textPrimary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(
                              color: const Color(
                                0xFFEF4444,
                              ).withValues(alpha: 0.3),
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                          ),
                          onPressed: () => _confirmDeleteVideo(v),
                          icon: const Icon(
                            Icons.delete_outline,
                            size: 13,
                            color: Color(0xFFEF4444),
                          ),
                          label: const Text(
                            'Delete',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFEF4444),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
        const SizedBox(height: 40),
      ],
    );
  }

  Widget _buildFilterPill(String filter, String label) {
    final isActive = _contentFilter == filter;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => setState(() => _contentFilter = filter),
        borderRadius: BorderRadius.circular(10),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: isActive
                ? AppColors.brandOrange
                : (context.isDark
                      ? Colors.white.withValues(alpha: 0.04)
                      : Colors.black.withValues(alpha: 0.025)),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isActive
                  ? AppColors.brandOrange.withValues(alpha: 0.30)
                  : context.borderSubtle,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: isActive ? Colors.white : context.textSecondary,
            ),
          ),
        ),
      ),
    );
  }

  // --- PANEL 3: PROFILE & SETTINGS ---
  Widget _buildProfileSettingsTab(dynamic user) {
    final coverUrl = user.coverPhotoUrl as String?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Channel Cover / Banner Photo Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: context.bgCard,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: context.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Channel Cover Photo',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: context.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Banner displayed at the top of your public channel page.',
                style: TextStyle(color: context.textSecondary, fontSize: 12),
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  height: 120,
                  width: double.infinity,
                  color: context.isDark
                      ? const Color(0xFF0F172A)
                      : const Color(0xFFE2E8F0),
                  child: coverUrl != null && coverUrl.isNotEmpty
                      ? Image(
                          image: smartImageProvider(coverUrl)!,
                          fit: BoxFit.cover,
                        )
                      : Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.image_outlined,
                                size: 36,
                                color: context.textDim,
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'No cover photo set',
                                style: TextStyle(
                                  color: context.textDim,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppColors.brandOrange),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                      onPressed: () async {
                        final dataUrl = await pickImageAsDataUrl(
                          maxDimension: 1200,
                          quality: 75,
                          maxChars: 150000,
                        );
                        if (dataUrl != null) {
                          final ok = await ref
                              .read(settingsServiceProvider)
                              .updateCoverPhoto(dataUrl);
                          if (ok && mounted) {
                            ref
                                .read(authStateProvider.notifier)
                                .updateLocalUser(
                                  (u) => u.copyWith(coverPhotoUrl: dataUrl),
                                );
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Cover photo updated!'),
                                backgroundColor: Color(0xFF10B981),
                              ),
                            );
                            setState(() {});
                          }
                        }
                      },
                      icon: const Icon(
                        Icons.upload,
                        size: 16,
                        color: AppColors.brandOrange,
                      ),
                      label: Text(
                        coverUrl != null ? 'Change Cover' : 'Upload Cover',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: AppColors.brandOrange,
                        ),
                      ),
                    ),
                  ),
                  if (coverUrl != null && coverUrl.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(
                        Icons.delete_outline,
                        color: Color(0xFFEF4444),
                      ),
                      tooltip: 'Remove cover photo',
                      onPressed: () async {
                        final ok = await ref
                            .read(settingsServiceProvider)
                            .updateCoverPhoto(null);
                        if (ok && mounted) {
                          ref
                              .read(authStateProvider.notifier)
                              .updateLocalUser(
                                (u) => u.copyWith(coverPhotoUrl: ''),
                              );
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Cover photo removed.'),
                            ),
                          );
                          setState(() {});
                        }
                      },
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: context.bgCard,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: context.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Channel Handle & Username',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: context.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _handleController,
                style: TextStyle(color: context.textPrimary, fontSize: 13),
                decoration: InputDecoration(
                  prefixText: '@ ',
                  prefixStyle: const TextStyle(
                    color: AppColors.brandOrange,
                    fontWeight: FontWeight.bold,
                  ),
                  filled: true,
                  fillColor: context.isDark
                      ? Colors.white.withValues(alpha: 0.04)
                      : Colors.black.withValues(alpha: 0.03),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: context.borderSubtle),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Username Privacy',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: context.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: context.isDark
                      ? Colors.white.withValues(alpha: 0.04)
                      : Colors.black.withValues(alpha: 0.03),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: context.borderSubtle),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _privacyLevel,
                    isExpanded: true,
                    dropdownColor: context.bgCard,
                    items: const [
                      DropdownMenuItem(
                        value: 'public',
                        child: Text('Public (Anyone can find and tag you)'),
                      ),
                      DropdownMenuItem(
                        value: 'connections',
                        child: Text('Connections Only'),
                      ),
                      DropdownMenuItem(
                        value: 'private',
                        child: Text('Private'),
                      ),
                    ],
                    onChanged: (val) {
                      if (val != null) setState(() => _privacyLevel = val);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.brandOrange,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: _savingProfileSettings
                      ? null
                      : () async {
                          final requestedHandle = _handleController.text.trim();
                          if (requestedHandle.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Your channel handle cannot be empty.',
                                ),
                              ),
                            );
                            return;
                          }

                          final currentHandle = user.handle ?? user.username;
                          setState(() => _savingProfileSettings = true);
                          final settings = ref.read(settingsServiceProvider);

                          var resolvedHandle = currentHandle;
                          String? error;
                          if (requestedHandle != currentHandle) {
                            final result = await settings.updateUsername(
                              requestedHandle,
                            );
                            if (result.success) {
                              resolvedHandle =
                                  result.username ?? requestedHandle;
                            } else {
                              error = result.error;
                            }
                          }

                          var privacySaved = true;
                          if (error == null &&
                              _privacyLevel != user.usernamePrivacy) {
                            privacySaved = await settings.updatePrivacy(
                              _privacyLevel,
                            );
                            if (!privacySaved) {
                              error =
                                  'Your username was saved, but privacy could not be updated.';
                            }
                          }

                          if (!mounted) return;
                          setState(() => _savingProfileSettings = false);

                          if (error != null) {
                            // Keep the local state aligned with any successful
                            // username change even when the second request
                            // failed, then tell the user exactly what remains.
                            if (resolvedHandle != currentHandle) {
                              ref
                                  .read(authStateProvider.notifier)
                                  .updateLocalUser(
                                    (u) => u.copyWith(
                                      username: resolvedHandle,
                                      handle: resolvedHandle,
                                    ),
                                  );
                            }
                            ScaffoldMessenger.of(
                              context,
                            ).showSnackBar(SnackBar(content: Text(error)));
                            return;
                          }

                          ref
                              .read(authStateProvider.notifier)
                              .updateLocalUser(
                                (u) => u.copyWith(
                                  username: resolvedHandle,
                                  handle: resolvedHandle,
                                  usernamePrivacy: privacySaved
                                      ? _privacyLevel
                                      : u.usernamePrivacy,
                                ),
                              );
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                'Profile settings saved successfully!',
                              ),
                              backgroundColor: Color(0xFF10B981),
                            ),
                          );
                        },
                  child: _savingProfileSettings
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text(
                          'Save Profile Settings',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // --- PANEL 4: REVENUE & KYC ---
  Widget _buildRevenueKYCTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: AppColors.brandOrange.withValues(alpha: 0.3),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'ESTIMATED REVENUE',
                    style: TextStyle(
                      color: Color(0xFFFDBA74),
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.5,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      _monetization.isEligible ? 'ELIGIBLE' : 'LOCKED',
                      style: TextStyle(
                        color: _monetization.isEligible
                            ? const Color(0xFF10B981)
                            : Colors.white70,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              const Text(
                '₹0.00',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Earnings from ad impressions, memberships, and super chats.',
                style: TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: context.bgCard,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: context.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Monetization Progress',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: context.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Subscribers Target (${_monetization.requiredSubscribers > 0 ? _monetization.requiredSubscribers : 1000})',
                    style: TextStyle(
                      fontSize: 12,
                      color: context.textSecondary,
                    ),
                  ),
                  Text(
                    '$_subscriberCount / ${_monetization.requiredSubscribers > 0 ? _monetization.requiredSubscribers : 1000}',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: context.textPrimary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                  value:
                      (_subscriberCount /
                              (_monetization.requiredSubscribers > 0
                                  ? _monetization.requiredSubscribers
                                  : 1000))
                          .clamp(0.0, 1.0),
                  backgroundColor: context.isDark
                      ? Colors.white10
                      : Colors.black12,
                  color: AppColors.brandOrange,
                  minHeight: 8,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Video plays target (${_monetization.requiredVideoViews > 0 ? _monetization.requiredVideoViews : 50000})',
                    style: TextStyle(
                      fontSize: 12,
                      color: context.textSecondary,
                    ),
                  ),
                  Text(
                    '${_monetization.videoViews} / ${_monetization.requiredVideoViews > 0 ? _monetization.requiredVideoViews : 50000}',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: context.textPrimary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                  value:
                      (_monetization.videoViews /
                              (_monetization.requiredVideoViews > 0
                                  ? _monetization.requiredVideoViews
                                  : 50000))
                          .clamp(0.0, 1.0),
                  backgroundColor: context.isDark
                      ? Colors.white10
                      : Colors.black12,
                  color: AppColors.brandOrange,
                  minHeight: 8,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (!_monetization.isEligible)
          _EligibilityLockNotice(
            subscribers: _monetization.subscribers > 0
                ? _monetization.subscribers
                : _subscriberCount,
            requiredSubscribers: _monetization.requiredSubscribers,
            videoViews: _monetization.videoViews,
            requiredVideoViews: _monetization.requiredVideoViews,
          ),
      ],
    );
  }

  // --- PANEL 5: HOW IT WORKS? ---
  Widget _buildHowItWorksTab() {
    final faqs = [
      {
        'q': 'How do creator payouts work on InPlayer?',
        'a':
            'InPlayer creators receive revenue share from ad views, direct creator tips, and channel memberships directly into their linked UPI / Bank account on the 1st of every month.',
      },
      {
        'q': 'What are the content guidelines?',
        'a':
            'All content must adhere to InPlayer community standards. Original videos, music tracks, and Raftaar vertical shorts are eligible for the creator fund.',
      },
      {
        'q': 'How do I get verified?',
        'a':
            'Channels reaching 5,000 subscribers and completing KYC identity verification are eligible for the verified creator badge.',
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'InPlayer Creator Guide',
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w900,
            color: context.textPrimary,
          ),
        ),
        const SizedBox(height: 12),
        ...faqs.map(
          (faq) => Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: context.bgCard,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: context.borderSubtle),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  faq['q']!,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: context.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  faq['a']!,
                  style: TextStyle(
                    fontSize: 12,
                    color: context.textSecondary,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
