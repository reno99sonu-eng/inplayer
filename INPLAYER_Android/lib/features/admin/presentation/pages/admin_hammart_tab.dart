import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../core/utils/time_utils.dart';
import '../../../../services/admin_service.dart';
import '../../../../models/admin_hammart.dart';
import '../widgets/admin_common.dart';

/// Hammart marketplace moderation — Products (listing moderation, GET/POST
/// /api/admin/hammart-products) and Vendors (KYC + payout review, GET/POST
/// /api/admin/hammart-vendors) are two separate backend concerns grouped
/// into one section here since both are "Hammart admin."
class AdminHammartTab extends StatelessWidget {
  const AdminHammartTab({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          Container(
            color: AppColors.backgroundDark,
            child: const TabBar(
              indicatorColor: AppColors.brandOrange,
              labelColor: AppColors.brandOrange,
              unselectedLabelColor: AppColors.textSecondaryDark,
              tabs: [Tab(text: 'Products'), Tab(text: 'Vendors')],
            ),
          ),
          const Expanded(
            child: TabBarView(children: [_ProductsView(), _VendorsView()]),
          ),
        ],
      ),
    );
  }
}

// ── Products ────────────────────────────────────────────────────────────

class _ProductsView extends StatefulWidget {
  const _ProductsView();

  @override
  State<_ProductsView> createState() => _ProductsViewState();
}

class _ProductsViewState extends State<_ProductsView> with SingleTickerProviderStateMixin {
  late final TabController _controller = TabController(length: 3, vsync: this);
  static const _tabs = ['flagged', 'removed', 'all'];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: TabBar(
            controller: _controller,
            indicatorColor: AppColors.brandOrange,
            labelColor: AppColors.brandOrange,
            unselectedLabelColor: AppColors.textSecondaryDark,
            labelStyle: const TextStyle(fontSize: 12),
            tabs: const [Tab(text: 'Flagged'), Tab(text: 'Removed'), Tab(text: 'All')],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _controller,
            children: _tabs.map((t) => _ProductsList(tab: t)).toList(),
          ),
        ),
      ],
    );
  }
}

class _ProductsList extends ConsumerStatefulWidget {
  final String tab;
  const _ProductsList({required this.tab});

  @override
  ConsumerState<_ProductsList> createState() => _ProductsListState();
}

class _ProductsListState extends ConsumerState<_ProductsList> {
  bool _loading = true;
  bool _tableMissing = false;
  List<AdminHammartProduct> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(adminServiceProvider).getHammartProducts(tab: widget.tab);
    if (!mounted) return;
    setState(() {
      _items = result.items;
      _tableMissing = result.tableMissing;
      _loading = false;
    });
  }

  Future<void> _act(AdminHammartProduct p, int index, String action) async {
    final ok = await ref.read(adminServiceProvider).hammartProductAction(p.productId, action);
    if (!mounted) return;
    if (ok) {
      setState(() => _items = List.of(_items)..removeAt(index));
    } else {
      showAdminSnack(context, "Couldn't do that.");
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return adminLoadingCenter;
    if (_tableMissing) {
      return const AdminTableMissingNotice(message: "The Hammart products table hasn't been created in AWS yet.");
    }
    if (_items.isEmpty) {
      return const AdminEmptyState(message: 'Nothing here', icon: Icons.storefront_outlined);
    }

    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: AppColors.surfaceDark,
      onRefresh: _load,
      child: ListView.separated(
        itemCount: _items.length,
        separatorBuilder: (context, index) => const Divider(height: 1, color: AppColors.cardDark),
        itemBuilder: (context, index) {
          final p = _items[index];
          final thumb = p.imageUrl != null && p.imageUrl!.isNotEmpty ? smartImageProvider(p.imageUrl!) : null;
          return ListTile(
            leading: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.surfaceDark,
                borderRadius: BorderRadius.circular(8),
                image: thumb != null ? DecorationImage(image: thumb, fit: BoxFit.cover) : null,
              ),
              child: thumb == null ? const Icon(Icons.shopping_bag_outlined, color: AppColors.textSecondaryDark) : null,
            ),
            title: Text(p.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.textPrimaryDark)),
            subtitle: Text(
              '₹${p.priceInr} • ${p.vendorUsername != null ? '@${p.vendorUsername}' : p.vendorId}'
              '${p.flaggedReason != null ? ' • ${p.flaggedReason}' : ''}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12),
            ),
            trailing: p.status == 'admin_removed'
                ? TextButton(onPressed: () => _act(p, index, 'restore'), child: const Text('Restore'))
                : TextButton(
                    onPressed: () => _act(p, index, 'remove'),
                    style: TextButton.styleFrom(foregroundColor: AppColors.error),
                    child: const Text('Remove'),
                  ),
          );
        },
      ),
    );
  }
}

// ── Vendors ─────────────────────────────────────────────────────────────

class _VendorsView extends StatefulWidget {
  const _VendorsView();

  @override
  State<_VendorsView> createState() => _VendorsViewState();
}

class _VendorsViewState extends State<_VendorsView> with SingleTickerProviderStateMixin {
  late final TabController _controller = TabController(length: 5, vsync: this);
  static const _tabs = ['pending_review', 'verified', 'rejected', 'not_started', 'all'];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: TabBar(
            controller: _controller,
            isScrollable: true,
            indicatorColor: AppColors.brandOrange,
            labelColor: AppColors.brandOrange,
            unselectedLabelColor: AppColors.textSecondaryDark,
            labelStyle: const TextStyle(fontSize: 12),
            tabs: const [
              Tab(text: 'Pending'),
              Tab(text: 'Verified'),
              Tab(text: 'Rejected'),
              Tab(text: 'Not started'),
              Tab(text: 'All'),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _controller,
            children: _tabs.map((t) => _VendorsList(tab: t)).toList(),
          ),
        ),
      ],
    );
  }
}

class _VendorsList extends ConsumerStatefulWidget {
  final String tab;
  const _VendorsList({required this.tab});

  @override
  ConsumerState<_VendorsList> createState() => _VendorsListState();
}

class _VendorsListState extends ConsumerState<_VendorsList> {
  bool _loading = true;
  AdminHammartVendorsResult? _result;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(adminServiceProvider).getHammartVendors(tab: widget.tab);
    if (!mounted) return;
    setState(() {
      _result = result;
      _loading = false;
    });
  }

  Future<void> _act(AdminHammartVendor v, int index, String action, {String? reason}) async {
    final result = await ref.read(adminServiceProvider).hammartVendorAction(v.userId, action, reason: reason);
    if (!mounted) return;
    if (result.success) {
      showAdminSnack(context, 'Done.');
      _load();
    } else {
      showAdminSnack(context, result.error ?? "Couldn't do that.");
    }
  }

  Future<void> _rejectFlow(AdminHammartVendor v, int index) async {
    final reasonController = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.cardDark,
        title: const Text('Reject vendor', style: TextStyle(color: AppColors.textPrimaryDark)),
        content: TextField(
          controller: reasonController,
          maxLines: 3,
          style: const TextStyle(color: AppColors.textPrimaryDark),
          decoration: const InputDecoration(hintText: 'Reason', hintStyle: TextStyle(color: AppColors.textSecondaryDark)),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.of(context).pop(reasonController.text.trim()),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
    if (reason == null || reason.isEmpty) return;
    _act(v, index, 'reject', reason: reason);
  }

  Color _kycColor(String status) {
    switch (status) {
      case 'verified':
        return AppColors.success;
      case 'rejected':
        return AppColors.error;
      case 'pending_review':
        return AppColors.brandOrange;
      default:
        return AppColors.textSecondaryDark;
    }
  }

  List<PopupMenuEntry<String>> _actionsFor(AdminHammartVendor v) {
    final items = <PopupMenuEntry<String>>[];
    if (v.kycStatus == 'pending_review') {
      items.add(const PopupMenuItem(value: 'approve', child: Text('Approve', style: TextStyle(color: AppColors.textPrimaryDark))));
      items.add(const PopupMenuItem(value: 'reject', child: Text('Reject', style: TextStyle(color: AppColors.error))));
    }
    if (v.kycStatus == 'verified') {
      items.add(PopupMenuItem(
        value: v.suspended ? 'unsuspend' : 'suspend',
        child: Text(v.suspended ? 'Unsuspend' : 'Suspend',
            style: TextStyle(color: v.suspended ? AppColors.success : AppColors.error)),
      ));
      if (v.razorpayAccountStatus == 'failed' || v.razorpayAccountStatus == 'not_started') {
        items.add(const PopupMenuItem(value: 'retry_razorpay', child: Text('Retry Razorpay payout setup', style: TextStyle(color: AppColors.textPrimaryDark))));
      }
      if (v.razorpayAccountStatus == 'pending' || v.razorpayAccountStatus == 'active') {
        items.add(const PopupMenuItem(value: 'sync_razorpay', child: Text('Sync Razorpay status', style: TextStyle(color: AppColors.textPrimaryDark))));
      }
    }
    return items;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return adminLoadingCenter;
    final result = _result;
    if (result == null || result.tableMissing) {
      return const AdminTableMissingNotice(message: "The Hammart vendors table hasn't been created in AWS yet.");
    }
    if (result.items.isEmpty) {
      return const AdminEmptyState(message: 'No vendors here', icon: Icons.storefront_outlined);
    }

    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: AppColors.surfaceDark,
      onRefresh: _load,
      child: ListView.separated(
        itemCount: result.items.length,
        separatorBuilder: (context, index) => const Divider(height: 1, color: AppColors.cardDark),
        itemBuilder: (context, index) {
          final v = result.items[index];
          return ListTile(
            title: Text(
              v.businessName?.isNotEmpty == true ? v.businessName! : v.vendorId,
              style: const TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.w600),
            ),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Wrap(
                spacing: 6,
                runSpacing: 4,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  AdminStatusPill(label: v.kycStatus.replaceAll('_', ' '), color: _kycColor(v.kycStatus)),
                  if (v.suspended) const AdminStatusPill(label: 'Suspended', color: AppColors.error),
                  Text(
                    '${v.totalProducts} products • ${v.totalSold} sold • ₹${v.totalRevenueInr.toStringAsFixed(0)}',
                    style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 11),
                  ),
                ],
              ),
            ),
            trailing: PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, color: AppColors.textPrimaryDark),
              color: AppColors.cardDark,
              onSelected: (action) {
                if (action == 'reject') {
                  _rejectFlow(v, index);
                } else {
                  _act(v, index, action);
                }
              },
              itemBuilder: (context) => _actionsFor(v),
            ),
          );
        },
      ),
    );
  }
}
