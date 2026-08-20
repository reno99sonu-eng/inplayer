import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
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
        const SnackBar(
          content: Text("Name can't be empty."),
          backgroundColor: AppColors.surfaceDark,
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
        const SnackBar(
          content: Text("Couldn't save your profile. Please try again."),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final user = authState is AuthStateAuthenticated ? authState.user : null;

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        title: const Text('Edit Profile',
            style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimaryDark)),
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
                : const Text('Save', style: TextStyle(color: AppColors.brandOrange)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Center(
            child: CircleAvatar(
              radius: 44,
              backgroundColor: AppColors.surfaceDark,
              backgroundImage:
                  user?.avatarUrl != null ? smartImageProvider(user!.avatarUrl!) : null,
              child: user?.avatarUrl == null
                  ? const Icon(Icons.person, size: 44, color: AppColors.textSecondaryDark)
                  : null,
            ),
          ),
          const SizedBox(height: 8),
          const Center(
            child: Text(
              'Changing your photo isn\'t supported here yet — use the website for now.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 11.5),
            ),
          ),
          const SizedBox(height: 28),
          const Text('Name',
              style: TextStyle(
                  color: AppColors.textSecondaryDark,
                  fontSize: 12,
                  fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            controller: _nameController,
            maxLength: 100,
            style: const TextStyle(color: AppColors.textPrimaryDark),
            decoration: _fieldDecoration('Your display name'),
          ),
          const SizedBox(height: 12),
          const Text('Bio',
              style: TextStyle(
                  color: AppColors.textSecondaryDark,
                  fontSize: 12,
                  fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            controller: _bioController,
            maxLength: 500,
            maxLines: 4,
            style: const TextStyle(color: AppColors.textPrimaryDark),
            decoration: _fieldDecoration('Tell viewers about your channel'),
          ),
        ],
      ),
    );
  }

  InputDecoration _fieldDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: AppColors.textSecondaryDark),
      filled: true,
      fillColor: Colors.white.withValues(alpha: 0.05),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    );
  }
}
