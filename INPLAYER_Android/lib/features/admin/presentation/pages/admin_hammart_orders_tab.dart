import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../models/admin_hammart_order.dart';
import '../../../../services/admin_service.dart';

class AdminHammartOrdersTab extends ConsumerStatefulWidget {
  const AdminHammartOrdersTab({super.key});

  @override
  ConsumerState<AdminHammartOrdersTab> createState() => _AdminHammartOrdersTabState();
}

class _AdminHammartOrdersTabState extends ConsumerState<AdminHammartOrdersTab> {
  String _tab = 'all';
  bool _loading = true;
  List<AdminHammartOrder> _orders = [];
  Map<String, int> _counts = {};
  bool _tableMissing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(adminServiceProvider).getHammartOrders(tab: _tab);
    if (!mounted) return;
    setState(() {
      _orders = result.items;
      _counts = result.counts;
      _tableMissing = result.tableMissing;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_tableMissing) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.storefront_outlined, size: 48, color: context.textDim),
              const SizedBox(height: 12),
              Text('Hammart Orders Table Not Initialized', style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.bold)),
              const SizedBox(height: 6),
              Text('The Hammart orders table in DynamoDB has not been created yet.', textAlign: TextAlign.center, style: TextStyle(color: context.textSecondary, fontSize: 12)),
            ],
          ),
        ),
      );
    }

    final totalRevenue = _orders.fold<num>(0, (sum, o) => sum + o.totalInr);
    final paidCount = _orders.where((o) => o.status == 'paid' || o.status == 'vendor_confirmed').length;

    return Scaffold(
      backgroundColor: context.bgCanvas,
      body: RefreshIndicator(
        color: AppColors.brandOrange,
        backgroundColor: context.bgCard,
        onRefresh: _load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildKpiCards(context, totalRevenue, paidCount),
                    const SizedBox(height: 12),
                    _buildStatusTabs(context),
                  ],
                ),
              ),
            ),
            if (_loading)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator(color: AppColors.brandOrange)),
              )
            else if (_orders.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.receipt_long_outlined, size: 48, color: context.textDim),
                      const SizedBox(height: 12),
                      Text('No orders found', style: TextStyle(color: context.textSecondary)),
                    ],
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _buildOrderCard(context, _orders[index]),
                    childCount: _orders.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiCards(BuildContext context, num totalRevenue, int paidCount) {
    return Row(
      children: [
        Expanded(
          child: _statCard(context, 'Total Orders', '${_orders.length}', Icons.shopping_bag_outlined, AppColors.brandOrange),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _statCard(context, 'Volume', '₹$totalRevenue', Icons.currency_rupee, const Color(0xFF10B981)),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _statCard(context, 'Settled', '$paidCount', Icons.check_circle_outline, const Color(0xFF06B6D4)),
        ),
      ],
    );
  }

  Widget _statCard(BuildContext context, String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 14),
              const SizedBox(width: 4),
              Text(label, style: TextStyle(color: context.textDim, fontSize: 10, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(color: context.textPrimary, fontSize: 15, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }

  Widget _buildStatusTabs(BuildContext context) {
    final tabs = [
      (key: 'all', label: 'All (${_counts['all'] ?? _orders.length})'),
      (key: 'placed', label: 'Placed (${_counts['placed'] ?? 0})'),
      (key: 'paid', label: 'Paid (${_counts['paid'] ?? 0})'),
      (key: 'vendor_confirmed', label: 'Confirmed (${_counts['vendor_confirmed'] ?? 0})'),
      (key: 'payment_failed', label: 'Failed (${_counts['payment_failed'] ?? 0})'),
      (key: 'vendor_cancelled', label: 'Cancelled (${_counts['vendor_cancelled'] ?? 0})'),
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: tabs.map((tab) {
          final isSelected = _tab == tab.key;
          return Padding(
            padding: const EdgeInsets.only(right: 6),
            child: ChoiceChip(
              label: Text(tab.label),
              selected: isSelected,
              onSelected: (_) {
                setState(() => _tab = tab.key);
                _load();
              },
              selectedColor: AppColors.brandOrange,
              backgroundColor: context.bgCard,
              labelStyle: TextStyle(
                color: isSelected ? Colors.white : context.textSecondary,
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
              ),
              side: BorderSide(color: isSelected ? AppColors.brandOrange : context.borderSubtle),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildOrderCard(BuildContext context, AdminHammartOrder order) {
    Color statusColor;
    switch (order.status) {
      case 'paid':
      case 'vendor_confirmed':
        statusColor = const Color(0xFF10B981);
        break;
      case 'placed':
      case 'payment_pending':
        statusColor = const Color(0xFFF59E0B);
        break;
      case 'payment_failed':
      case 'vendor_cancelled':
        statusColor = const Color(0xFFEF4444);
        break;
      default:
        statusColor = context.textDim;
    }

    final imageUrl = order.productImageUrl ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.borderSubtle),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: SizedBox(
              width: 54,
              height: 54,
              child: imageUrl.isNotEmpty
                  ? CachedNetworkImage(imageUrl: imageUrl, fit: BoxFit.cover)
                  : Container(color: context.borderSubtle, child: Icon(Icons.shopping_bag, color: context.textDim, size: 24)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        order.productTitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: context.textPrimary, fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        order.status.toUpperCase().replaceAll('_', ' '),
                        style: TextStyle(color: statusColor, fontSize: 9.5, fontWeight: FontWeight.w800),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '₹${order.totalInr} • Qty: ${order.quantity} • Via ${order.paymentMethod.toUpperCase()}',
                  style: TextStyle(color: AppColors.brandOrangeLight, fontSize: 11.5, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Text(
                  'Buyer: ${order.buyerName} (${order.buyerEmail})',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: context.textDim, fontSize: 10.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
