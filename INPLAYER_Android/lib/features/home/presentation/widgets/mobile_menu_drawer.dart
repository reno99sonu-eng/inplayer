import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_logo.dart';
import '../../../../core/widgets/about_app_dialog.dart';
import '../../../../models/channel.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../providers/kid_mode_provider.dart';
import '../../../../services/channel_service.dart';
import '../../../auth/presentation/widgets/auth_modals.dart';
import '../../../safety/presentation/widgets/face_scan_modal.dart';
import '../../../safety/presentation/widgets/parental_pin_dialog.dart';

class MobileMenuDrawer extends ConsumerStatefulWidget {
  const MobileMenuDrawer({super.key});

  @override
  ConsumerState<MobileMenuDrawer> createState() => _MobileMenuDrawerState();
}

class _MobileMenuDrawerState extends ConsumerState<MobileMenuDrawer> {
  List<Channel> _subscribedChannels = [];
  bool _loadingSubscriptions = false;

  @override
  void initState() {
    super.initState();
    _loadSubscriptions();
  }

  Future<void> _loadSubscriptions() async {
    final authState = ref.read(authStateProvider);
    if (authState is! AuthStateAuthenticated) return;

    setState(() => _loadingSubscriptions = true);
    try {
      final subs = await ref.read(channelServiceProvider).getSubscribedChannels();
      if (mounted) {
        setState(() {
          _subscribedChannels = subs;
          _loadingSubscriptions = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingSubscriptions = false);
    }
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    bool launched = false;
    try {
      launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      launched = false;
    }
    if (!launched && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text("Couldn't open that page."),
          backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
        ),
      );
    }
  }

  Widget _buildMenuItem({
    required IconData icon,
    required String title,
    VoidCallback? onTap,
    Widget? trailing,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              Icon(icon, color: context.textSecondary, size: 20),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    color: context.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              ?trailing,
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title, {Widget? trailing, VoidCallback? onTap}) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              title,
              style: TextStyle(
                color: AppColors.brandOrangeLight,
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.8,
              ),
            ),
            ?trailing,
          ],
        ),
      ),
    );
  }

  Widget _buildDivider() {
    return Divider(
      color: context.isDark ? Colors.white.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.06),
      height: 16,
      thickness: 1,
      indent: 12,
      endIndent: 12,
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final isDark = context.isDark;
    final user = authState is AuthStateAuthenticated ? authState.user : null;

    return Drawer(
      backgroundColor: (isDark ? const Color(0xFF07101F) : const Color(0xFFF5EEDC)).withValues(alpha: 0.98),
      surfaceTintColor: Colors.transparent,
      width: 320,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. Header with Logo & Close
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 12, 10),
              child: Row(
                children: [
                  const AppNavbarLogo(height: 32),
                  const Spacer(),
                  IconButton(
                    icon: Icon(Icons.close, color: context.textSecondary, size: 22),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),

            _buildDivider(),

            // 2. Scrollable Body
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Primary Nav Items
                    _buildMenuItem(
                      icon: Icons.home_rounded,
                      title: 'Home',
                      onTap: () {
                        Navigator.pop(context);
                        context.go('/');
                      },
                    ),
                    _buildMenuItem(
                      icon: Icons.sports_esports_outlined,
                      title: 'InJoy',
                      onTap: () {
                        Navigator.pop(context);
                        // InJoy is a real mini-games hub on the website
                        // (app/injoy) — a grid of playable games, each its
                        // own /play/{id} route. Not yet built as a native
                        // screen (would mean either a WebView per game or
                        // reimplementing each one), so this opens the real
                        // page in the browser rather than a dead in-app
                        // link. Flagged for a future round.
                        _openUrl('https://inplayer.in/injoy');
                      },
                    ),
                    _buildMenuItem(
                      icon: Icons.campaign_outlined,
                      title: 'Sponsor an Ad',
                      onTap: () {
                        Navigator.pop(context);
                        // Sponsorships (app/sponsorships) is a real, large
                        // feature — package tiers, checkout, and a
                        // dashboard — that touches payments (Razorpay), so
                        // it's grouped with the other payment-touching
                        // items (Premium, Hammart checkout) that need the
                        // user's own involvement before building a native
                        // purchase flow. Opens the real page for now
                        // instead of a dead in-app link.
                        _openUrl('https://inplayer.in/sponsorships');
                      },
                    ),
                    _buildDivider(),
                    _buildSectionHeader('CONTENT ACCESS & SAFETY'),
                    _buildMenuItem(
                      icon: Icons.eighteen_up_rating_rounded,
                      title: '18+ Adult Content & Passcode',
                      trailing: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.brandOrange.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Text(
                          'PASSKEY',
                          style: TextStyle(
                            color: AppColors.brandOrange,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      onTap: () {
                        Navigator.pop(context);
                        context.push('/settings/content-access');
                      },
                    ),
                    Consumer(
                      builder: (context, ref, _) {
                        final isKid = ref.watch(kidModeProvider.select((s) => s.isEnabled));
                        return _buildMenuItem(
                          icon: isKid ? Icons.child_care_rounded : Icons.face_retouching_natural_rounded,
                          title: isKid ? 'Kids Mode: Active (Exit)' : 'Kids Mode & Face ID Safety',
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: isKid ? const Color(0x2210B981) : const Color(0x22F97316),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              isKid ? 'ACTIVE' : 'SCAN / PIN',
                              style: TextStyle(
                                color: isKid ? const Color(0xFF10B981) : AppColors.brandOrange,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          onTap: () {
                            Navigator.pop(context);
                            if (isKid) {
                              ParentalPinDialog.show(context);
                            } else {
                              FaceScanModal.show(context);
                            }
                          },
                        );
                      },
                    ),

                    // YOU Section (when signed in)
                    if (user != null) ...[
                      _buildDivider(),
                      _buildSectionHeader('YOU'),
                      _buildMenuItem(
                        icon: Icons.playlist_play_rounded,
                        title: 'Playlists',
                        onTap: () {
                          Navigator.pop(context);
                          context.push('/playlists');
                        },
                      ),
                      _buildMenuItem(
                        icon: Icons.thumb_up_alt_outlined,
                        title: 'Liked Videos',
                        onTap: () {
                          Navigator.pop(context);
                          context.push('/liked-videos');
                        },
                      ),
                      _buildMenuItem(
                        icon: Icons.history_rounded,
                        title: 'History',
                        onTap: () {
                          Navigator.pop(context);
                          context.push('/watch-history');
                        },
                      ),
                      _buildMenuItem(
                        icon: Icons.download_for_offline_outlined,
                        title: 'Downloads',
                        onTap: () {
                          Navigator.pop(context);
                          context.push('/downloads');
                        },
                      ),
                      _buildMenuItem(
                        icon: Icons.shopping_bag_outlined,
                        title: 'HamMart',
                        onTap: () {
                          Navigator.pop(context);
                          context.push('/marketplace');
                        },
                      ),
                    ],

                    _buildDivider(),

                    // IN-FAMILY (Subscriptions) Section
                    _buildSectionHeader(
                      'IN-FAMILY',
                      trailing: const Icon(Icons.chevron_right, color: AppColors.brandOrange, size: 16),
                      onTap: () {
                        Navigator.pop(context);
                        context.push('/subscriptions');
                      },
                    ),

                    if (_loadingSubscriptions)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brandOrange))),
                      )
                    else if (_subscribedChannels.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: isDark ? Colors.white.withValues(alpha: 0.04) : Colors.black.withValues(alpha: 0.03),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: context.borderSubtle),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                "You don't have any subscribed channels yet.",
                                style: TextStyle(color: context.textPrimary, fontSize: 12, fontWeight: FontWeight.w600),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                "Subscribe to your favourite creators and they'll appear here.",
                                style: TextStyle(color: context.textDim, fontSize: 10),
                              ),
                              const SizedBox(height: 8),
                              GestureDetector(
                                onTap: () {
                                  Navigator.pop(context);
                                  // There is no '/explore' route on this
                                  // app (this used to be a dead link) — the
                                  // real "browse public creators" page is
                                  // the website's app/creators, ported here
                                  // as DiscoverCreatorsPage.
                                  context.push('/creators');
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: AppColors.brandOrange,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Text(
                                    'Discover Creators',
                                    style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      ..._subscribedChannels.take(8).map((channel) {
                        return Material(
                          color: Colors.transparent,
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () {
                              Navigator.pop(context);
                              context.push('/channel/${channel.username}');
                            },
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                              child: Row(
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(14),
                                    child: SizedBox(
                                      width: 28,
                                      height: 28,
                                      child: channel.avatarUrl != null && channel.avatarUrl!.isNotEmpty
                                          ? CachedNetworkImage(
                                              imageUrl: channel.avatarUrl!,
                                              fit: BoxFit.cover,
                                              errorWidget: (context, url, error) => const Icon(Icons.person, size: 16),
                                            )
                                          : const Icon(Icons.person, size: 16),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      channel.name,
                                      style: TextStyle(color: context.textPrimary, fontSize: 13, fontWeight: FontWeight.w500),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  if (channel.notifyEnabled)
                                    Container(
                                      width: 6,
                                      height: 6,
                                      decoration: const BoxDecoration(color: AppColors.brandOrange, shape: BoxShape.circle),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        );
                      }),

                    _buildDivider(),

                    // Account Status & Actions
                    if (user != null) ...[
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 2),
                        child: Text(
                          'Signed in as ${user.name.isNotEmpty ? user.name : user.email}',
                          style: TextStyle(color: context.textDim, fontSize: 11, fontWeight: FontWeight.w500),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      _buildMenuItem(
                        icon: Icons.logout_rounded,
                        title: 'Sign Out',
                        onTap: () async {
                          Navigator.pop(context);
                          await ref.read(authStateProvider.notifier).signOut();
                        },
                      ),
                    ] else ...[
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        child: Column(
                          children: [
                            ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.brandOrange,
                                minimumSize: const Size.fromHeight(40),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              onPressed: () {
                                Navigator.pop(context);
                                showSignInModal(context);
                              },
                              child: const Text('Sign In', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                            ),
                            const SizedBox(height: 8),
                            OutlinedButton(
                              style: OutlinedButton.styleFrom(
                                side: BorderSide(color: context.borderSubtle),
                                minimumSize: const Size.fromHeight(40),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              onPressed: () {
                                Navigator.pop(context);
                                showSignUpModal(context);
                              },
                              child: Text('Create Account', style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.w600, fontSize: 13)),
                            ),
                          ],
                        ),
                      ),
                    ],

                    _buildDivider(),

                    // Company Section
                    _buildSectionHeader('COMPANY'),
                    _buildMenuItem(
                      icon: Icons.info_outline,
                      title: 'About',
                      onTap: () {
                        // Shows the real native About dialog (same one as
                        // Settings > Support > About) instead of opening
                        // https://inplayer.in/about, which doesn't exist on
                        // the live site — the drawer keeps itself open
                        // underneath since this is a dialog, not a page.
                        showInPlayerAboutDialog(context);
                      },
                    ),
                    _buildMenuItem(
                      icon: Icons.lock_outline,
                      title: 'Privacy Policy',
                      onTap: () {
                        Navigator.pop(context);
                        _openUrl('https://inplayer.in/privacy');
                      },
                    ),
                    _buildMenuItem(
                      icon: Icons.description_outlined,
                      title: 'Terms of Service',
                      onTap: () {
                        Navigator.pop(context);
                        _openUrl('https://inplayer.in/terms');
                      },
                    ),

                    _buildDivider(),

                    // Contact Us — was an inline expandable "CONTACT US"
                    // section here; now a single item pushing the dedicated
                    // Contact Us screen (see contact_us_page.dart).
                    _buildMenuItem(
                      icon: Icons.mail_outline_rounded,
                      title: 'Contact Us',
                      onTap: () {
                        Navigator.pop(context);
                        context.push('/contact');
                      },
                    ),

                    const SizedBox(height: 18),
                    Center(
                      child: Text(
                        '© 2026 Homox Prime Pvt Ltd',
                        style: TextStyle(
                          color: context.textDim,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
