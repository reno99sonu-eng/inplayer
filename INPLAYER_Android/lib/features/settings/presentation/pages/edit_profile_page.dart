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

  @override
  void initState() {
    super.initState();
    final authState = ref.read(authStateProvider);
    final user = authState is AuthStateAuthenticated ? authState.user : null;
    _nameController = TextEditingController(text: user?.name ?? '');
    _bioController = TextEditingController(text: user?.bio ?? '');
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
          title: Text('Edit Profile',
              style: TextStyle(fontWeight: FontWeight.w800, color: context.textPrimary, letterSpacing: -0.5)),
          actions: [
            TextButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation(AppColors.brandOrange)),
                    )
                  : const Text('Save', style: TextStyle(color: AppColors.brandOrange, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Center(
              child: Stack(
                alignment: Alignment.bottomRight,
                children: [
                  CircleAvatar(
                    radius: 48,
                    backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                    backgroundImage:
                        user?.avatarUrl != null ? smartImageProvider(user!.avatarUrl!) : null,
                    child: user?.avatarUrl == null
                        ? Icon(Icons.person, size: 48, color: context.textDim)
                        : null,
                  ),
                  GestureDetector(
                    onTap: () async {
                      final dataUrl = await pickImageAsDataUrl(
                        maxDimension: 800,
                        quality: 75,
                        maxChars: 150000,
                      );
                      if (dataUrl != null) {
                        final ok = await ref.read(settingsServiceProvider).updateAvatar(dataUrl);
                        if (ok && mounted) {
                          ref.read(authStateProvider.notifier).updateLocalUser((u) => u.copyWith(avatarUrl: dataUrl));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Avatar updated!'), backgroundColor: Color(0xFF10B981)),
                          );
                          setState(() {});
                        }
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppColors.brandOrange,
                        shape: BoxShape.circle,
                        border: Border.all(color: context.bgCanvas, width: 2),
                      ),
                      child: const Icon(Icons.camera_alt, color: Colors.white, size: 16),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Center(
              child: Text(
                'Tap the camera icon to change your profile photo',
                textAlign: TextAlign.center,
                style: TextStyle(color: context.textDim, fontSize: 12),
              ),
            ),
            const SizedBox(height: 28),
            Text('Name',
                style: TextStyle(
                    color: context.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            TextField(
              controller: _nameController,
              maxLength: 100,
              style: TextStyle(color: context.textPrimary),
              decoration: _fieldDecoration('Your display name'),
            ),
            const SizedBox(height: 12),
            Text('Bio',
                style: TextStyle(
                    color: context.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
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
    );
  }

  InputDecoration _fieldDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(color: context.textDim),
      filled: true,
      fillColor: context.bgCard,
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
