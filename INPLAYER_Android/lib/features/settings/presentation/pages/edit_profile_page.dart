import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/settings_service.dart';

class EditProfilePage extends ConsumerStatefulWidget {
  const EditProfilePage({super.key});

  @override
  ConsumerState<EditProfilePage> createState() => _EditProfilePageState();
}

class _EditProfilePageState extends ConsumerState<EditProfilePage> {
  late final TextEditingController _nameController;
  late final TextEditingController _bioController;
  bool _saving = false;

  Widget _buildSectionHeader(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          color: AppColors.brandOrange,
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.4,
        ),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    final authState = ref.read(authStateProvider);
    final user = authState is AuthStateAuthenticated ? authState.user : null;
    _nameController = TextEditingController(text: user?.name ?? '');
    _bioController = TextEditingController(text: user?.bio ?? '');
    
    // Refresh quietly in background
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(authStateProvider.notifier).refreshUser().then((_) {
        if (!mounted) return;
        final freshState = ref.read(authStateProvider);
        if (freshState is AuthStateAuthenticated) {
          final freshUser = freshState.user;
          if (_nameController.text == user?.name) {
            _nameController.text = freshUser.name;
          }
          if (_bioController.text == user?.bio) {
            _bioController.text = freshUser.bio;
          }
        }
      });
    });
  }

  @override
  void dispose() {
    _nameController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text("Name can't be empty."),
          backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
        ),
      );
      return;
    }

    setState(() => _saving = true);

    final service = ref.read(settingsServiceProvider);
    final bio = _bioController.text.trim();

    final results = await Future.wait([
      service.updateName(name),
      service.updateBio(bio),
    ]);

    if (!mounted) return;
    setState(() => _saving = false);

    if (results.every((ok) => ok)) {
      ref
          .read(authStateProvider.notifier)
          .updateLocalUser((u) => u.copyWith(name: name, bio: bio));
      Navigator.of(context).pop();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text("Couldn't save your profile. Please try again."),
          backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final user = authState is AuthStateAuthenticated ? authState.user : null;

    return PatternBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
          elevation: 0,
          iconTheme: IconThemeData(color: context.textPrimary),
          title: Text(
            'Edit Profile',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: context.textPrimary,
              letterSpacing: -0.5,
            ),
          ),
          actions: [
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: _saving ? null : _save,
                borderRadius: BorderRadius.circular(12),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.brandOrange,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.brandOrange.withValues(alpha: 0.20),
                        blurRadius: 12,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: _saving
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(Colors.white)),
                        )
                      : const Text('Save', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                ),
              ),
            ),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: context.bgCard,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: context.borderSubtle),
                boxShadow: [
                  BoxShadow(
                    color: (context.isDark ? Colors.black : const Color(0xFFE2E8F0)).withValues(alpha: 0.10),
                    blurRadius: 16,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Center(
                    child: Stack(
                      alignment: Alignment.bottomRight,
                      children: [
                        CircleAvatar(
                          radius: 46,
                          backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                          backgroundImage: user?.avatarUrl != null ? smartImageProvider(user!.avatarUrl!) : null,
                          child: user?.avatarUrl == null ? Icon(Icons.person, size: 42, color: context.textDim) : null,
                        ),
                        Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: () async {
                              final dataUrl = await pickImageAsDataUrl(
                                maxDimension: 800,
                                quality: 75,
                                maxChars: 150000,
                              );
                              if (dataUrl != null) {
                                final ok = await ref.read(settingsServiceProvider).updateAvatar(dataUrl);
                                if (!context.mounted) return;
                                if (ok) {
                                  ref.read(authStateProvider.notifier).updateLocalUser((u) => u.copyWith(avatarUrl: dataUrl));
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Avatar updated!'), backgroundColor: Color(0xFF10B981)),
                                  );
                                  setState(() {});
                                }
                              }
                            },
                            borderRadius: BorderRadius.circular(100),
                            child: Container(
                              padding: const EdgeInsets.all(7),
                              decoration: BoxDecoration(
                                color: AppColors.brandOrange,
                                shape: BoxShape.circle,
                                border: Border.all(color: context.bgCanvas, width: 2),
                                boxShadow: [
                                  BoxShadow(
                                    color: AppColors.brandOrange.withValues(alpha: 0.25),
                                    blurRadius: 16,
                                    offset: const Offset(0, 6),
                                  ),
                                ],
                              ),
                              child: const Icon(Icons.camera_alt, color: Colors.white, size: 17),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Tap the camera icon to change your profile photo',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: context.textDim, fontSize: 12),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: context.bgCard,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: context.borderSubtle),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildSectionHeader('Name'),
                  const SizedBox(height: 4),
                  TextField(
                    controller: _nameController,
                    maxLength: 100,
                    style: TextStyle(color: context.textPrimary),
                    decoration: _fieldDecoration('Your display name'),
                  ),
                  const SizedBox(height: 16),
                  _buildSectionHeader('Bio'),
                  const SizedBox(height: 4),
                  TextField(
                    controller: _bioController,
                    maxLength: 500,
                    maxLines: 4,
                    style: TextStyle(color: context.textPrimary),
                    decoration: _fieldDecoration('Tell viewers about your channel'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _fieldDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(color: context.textDim),
      filled: true,
      fillColor: context.isDark ? const Color(0xFF101821) : const Color(0xFFF8FAFC),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: context.borderSubtle),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: context.borderSubtle),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.brandOrange, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    );
  }
}
