import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../services/creator_monetization_service.dart';

class CreatorKycPage extends ConsumerStatefulWidget {
  const CreatorKycPage({super.key});

  @override
  ConsumerState<CreatorKycPage> createState() => _CreatorKycPageState();
}

class _CreatorKycPageState extends ConsumerState<CreatorKycPage> {
  final _formKey = GlobalKey<FormState>();
  final _imagePicker = ImagePicker();

  final _legalNameController = TextEditingController();
  final _panNumberController = TextEditingController();
  final _addressController = TextEditingController();
  final _cityController = TextEditingController();
  final _stateController = TextEditingController();
  final _pincodeController = TextEditingController();
  final _aadhaarController = TextEditingController();
  final _passportController = TextEditingController();
  final _bankAccountController = TextEditingController();
  final _bankIfscController = TextEditingController();

  String _idProofType = 'aadhaar';
  bool _submitting = false;
  bool _eligibilityLoading = true;
  bool _eligible = false;
  final Map<String, String> _documents = {};

  @override
  void initState() {
    super.initState();
    _checkEligibility();
  }

  Future<void> _checkEligibility() async {
    final state = await ref
        .read(creatorMonetizationServiceProvider)
        .getMonetizationStatus();
    if (!mounted) return;
    setState(() {
      _eligible = state.isEligible;
      _eligibilityLoading = false;
    });
  }

  Future<void> _pickDocument(String key, String label) async {
    final file = await _imagePicker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 80,
      maxWidth: 1600,
    );
    if (file == null) return;

    final bytes = await file.readAsBytes();
    final dataUrl = 'data:image/jpeg;base64,${base64Encode(bytes)}';
    setState(() {
      _documents[key] = dataUrl;
    });

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label added.'),
        backgroundColor: context.isDark
            ? AppColors.surfaceDark
            : AppColors.surfaceLight,
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    if (_documents.length != 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please upload all four KYC documents.')),
      );
      return;
    }

    setState(() => _submitting = true);

    final result = await ref
        .read(creatorMonetizationServiceProvider)
        .submitKyc(
          legalName: _legalNameController.text.trim(),
          panNumber: _panNumberController.text.trim(),
          addressLine1: _addressController.text.trim(),
          city: _cityController.text.trim(),
          state: _stateController.text.trim(),
          pincode: _pincodeController.text.trim(),
          idProofType: _idProofType,
          aadhaarNumber: _aadhaarController.text.trim(),
          passportNumber: _passportController.text.trim(),
          bankAccountNumber: _bankAccountController.text.trim(),
          bankIfsc: _bankIfscController.text.trim(),
          payoutFrequency: 'monthly',
          minPayoutAmount: 500,
          documents: _documents,
        );

    if (!mounted) return;
    setState(() => _submitting = false);

    if (result['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('KYC submitted successfully. Admin review is pending.'),
        ),
      );
      context.pop();
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(result['error']?.toString() ?? 'KYC submission failed.'),
      ),
    );
  }

  @override
  void dispose() {
    _legalNameController.dispose();
    _panNumberController.dispose();
    _addressController.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _pincodeController.dispose();
    _aadhaarController.dispose();
    _passportController.dispose();
    _bankAccountController.dispose();
    _bankIfscController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_eligibilityLoading) {
      return Scaffold(
        body: Center(
          child: CircularProgressIndicator(color: AppColors.brandOrange),
        ),
      );
    }
    if (!_eligible) {
      return Scaffold(
        appBar: AppBar(title: const Text('Creator KYC')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.lock_outline_rounded,
                  size: 52,
                  color: AppColors.warning,
                ),
                const SizedBox(height: 16),
                const Text(
                  'KYC is locked',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                Text(
                  'Reach the monetization likes, plays, and subscriber milestones first. Your eligibility is checked from the live creator metrics.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: context.textSecondary),
                ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: () => context.pop(),
                  child: const Text('Back to Creator Studio'),
                ),
              ],
            ),
          ),
        ),
      );
    }
    return Scaffold(
      backgroundColor: context.bgCanvas,
      appBar: AppBar(
        backgroundColor: context.bgCanvas,
        elevation: 0,
        iconTheme: IconThemeData(color: context.textPrimary),
        title: Text(
          'Creator KYC',
          style: TextStyle(
            color: context.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        AppColors.brandOrange.withValues(alpha: 0.16),
                        context.isDark
                            ? const Color(0xFF111827)
                            : const Color(0xFFFFFFFF),
                      ],
                    ),
                    border: Border.all(
                      color: AppColors.brandOrange.withValues(alpha: 0.25),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Complete your payout profile',
                        style: TextStyle(
                          color: context.textPrimary,
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'The website admin reviews these fields and your uploaded documents before payouts are enabled.',
                        style: TextStyle(
                          color: context.textSecondary,
                          fontSize: 13,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                _buildSection('Personal details'),
                const SizedBox(height: 8),
                _buildField(
                  'Legal name',
                  _legalNameController,
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                _buildField(
                  'PAN number',
                  _panNumberController,
                  validator: (v) => (v == null || v.trim().length < 10)
                      ? 'Enter valid PAN'
                      : null,
                ),
                _buildField(
                  'Address line 1',
                  _addressController,
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                Row(
                  children: [
                    Expanded(
                      child: _buildField(
                        'City',
                        _cityController,
                        validator: (v) =>
                            (v == null || v.trim().isEmpty) ? 'Required' : null,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildField(
                        'State',
                        _stateController,
                        validator: (v) =>
                            (v == null || v.trim().isEmpty) ? 'Required' : null,
                      ),
                    ),
                  ],
                ),
                _buildField(
                  'PIN code',
                  _pincodeController,
                  keyboardType: TextInputType.number,
                  validator: (v) => (v == null || v.trim().length < 6)
                      ? 'Enter valid pincode'
                      : null,
                ),
                const SizedBox(height: 20),
                _buildSection('Identity proof'),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: context.borderSubtle),
                    color: context.isDark
                        ? const Color(0xFF101821)
                        : const Color(0xFFF8FAFC),
                  ),
                  child: DropdownButtonFormField<String>(
                    initialValue: _idProofType,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(vertical: 12),
                    ),
                    items: const [
                      DropdownMenuItem(
                        value: 'aadhaar',
                        child: Text('Aadhaar'),
                      ),
                      DropdownMenuItem(
                        value: 'passport',
                        child: Text('Passport'),
                      ),
                    ],
                    onChanged: (value) =>
                        setState(() => _idProofType = value ?? 'aadhaar'),
                  ),
                ),
                if (_idProofType == 'aadhaar')
                  _buildField(
                    'Aadhaar number',
                    _aadhaarController,
                    keyboardType: TextInputType.number,
                    validator: (v) => (v == null || v.trim().length != 12)
                        ? '12-digit Aadhaar required'
                        : null,
                  )
                else
                  _buildField(
                    'Passport number',
                    _passportController,
                    validator: (v) => (v == null || v.trim().length < 6)
                        ? 'Passport number required'
                        : null,
                  ),
                const SizedBox(height: 20),
                _buildSection('Bank account'),
                const SizedBox(height: 8),
                _buildField(
                  'Bank account number',
                  _bankAccountController,
                  keyboardType: TextInputType.number,
                  validator: (v) => (v == null || v.trim().length < 9)
                      ? 'Valid account number required'
                      : null,
                ),
                _buildField(
                  'IFSC code',
                  _bankIfscController,
                  textCapitalization: TextCapitalization.characters,
                  validator: (v) => (v == null || v.trim().length < 8)
                      ? 'Valid IFSC required'
                      : null,
                ),
                const SizedBox(height: 20),
                _buildSection('Documents'),
                const SizedBox(height: 10),
                _DocumentPickerTile(
                  label: 'PAN card',
                  selected: _documents.containsKey('pan_card'),
                  onTap: () => _pickDocument('pan_card', 'PAN card'),
                ),
                _DocumentPickerTile(
                  label: 'ID proof',
                  selected: _documents.containsKey('id_proof'),
                  onTap: () => _pickDocument('id_proof', 'ID proof'),
                ),
                _DocumentPickerTile(
                  label: 'Bank proof',
                  selected: _documents.containsKey('bank_proof'),
                  onTap: () => _pickDocument('bank_proof', 'Bank proof'),
                ),
                _DocumentPickerTile(
                  label: 'Selfie',
                  selected: _documents.containsKey('selfie'),
                  onTap: () => _pickDocument('selfie', 'Selfie'),
                ),
                const SizedBox(height: 28),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _submitting ? null : _submit,
                    icon: _submitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.upload_file),
                    label: Text(_submitting ? 'Submitting...' : 'Submit KYC'),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.brandOrange,
                      padding: const EdgeInsets.symmetric(vertical: 16),
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

  Widget _buildSection(String title) {
    return Text(
      title,
      style: TextStyle(
        color: AppColors.brandOrange,
        fontSize: 13,
        fontWeight: FontWeight.bold,
        letterSpacing: 1.1,
      ),
    );
  }

  Widget _buildField(
    String label,
    TextEditingController controller, {
    String? Function(String?)? validator,
    TextInputType keyboardType = TextInputType.text,
    TextCapitalization textCapitalization = TextCapitalization.none,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        textCapitalization: textCapitalization,
        style: TextStyle(color: context.textPrimary),
        validator: validator,
        decoration: InputDecoration(
          labelText: label,
          filled: true,
          fillColor: context.isDark
              ? const Color(0xFF101821)
              : const Color(0xFFF8FAFC),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(color: context.borderSubtle),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(color: context.borderSubtle),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(color: AppColors.brandOrange, width: 1.5),
          ),
        ),
      ),
    );
  }
}

class _DocumentPickerTile extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _DocumentPickerTile({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: context.bgCard,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? AppColors.brandOrange : context.borderSubtle,
          ),
        ),
        child: Row(
          children: [
            Icon(
              selected ? Icons.check_circle : Icons.upload_file,
              color: selected ? AppColors.brandOrange : context.textSecondary,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: context.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Text(
              selected ? 'Uploaded' : 'Pick file',
              style: TextStyle(
                color: selected ? AppColors.brandOrange : context.textSecondary,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
