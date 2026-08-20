import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../services/hammart_service.dart';
import '../../../../models/hammart_cart_item.dart';

/// HamMart cart — real items against GET/PATCH/DELETE
/// /api/hammart/cart[/{productId}]. Checkout (payment) isn't wired up
/// yet, so this page says so honestly instead of pretending a "Pay now"
/// button works.
class CartPage extends ConsumerStatefulWidget {
  const CartPage({super.key});

  @override
  ConsumerState<CartPage> createState() => _CartPageState();
}

class _CartPageState extends ConsumerState<CartPage> {
  bool _loading = true;
  bool _tableMissing = false;
  List<HammartCartItem> _items = [];
  final Set<String> _busyIds = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(hammartServiceProvider).getCart();
    if (!mounted) return;
    setState(() {
      _items = result.items;
      _tableMissing = result.tableMissing;
      _loading = false;
    });
  }

  num get _total => _items.where((i) => !i.unavailable).fold<num>(0, (sum, i) => sum + i.lineTotalInr);

  Future<void> _updateQuantity(HammartCartItem item, int newQuantity) async {
    if (newQuantity < 1) {
      _remove(item);
      return;
    }
    setState(() => _busyIds.add(item.productId));
    final ok = await ref.read(hammartServiceProvider).setCartQuantity(item.productId, newQuantity);
    if (!mounted) return;
    if (ok) {
      setState(() {
        final index = _items.indexWhere((i) => i.productId == item.productId);
        if (index != -1) {
          _items[index] = HammartCartItem(
            productId: item.productId,
            quantity: newQuantity,
            addedAt: item.addedAt,
            product: item.product,
            unavailable: item.unavailable,
          );
        }
        _busyIds.remove(item.productId);
      });
    } else {
      setState(() => _busyIds.remove(item.productId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Couldn't update quantity. Try again.")),
        );
      }
    }
  }

  Future<void> _remove(HammartCartItem item) async {
    setState(() => _busyIds.add(item.productId));
    final ok = await ref.read(hammartServiceProvider).removeFromCart(item.productId);
    if (!mounted) return;
    if (ok) {
      setState(() {
        _items.removeWhere((i) => i.productId == item.productId);
        _busyIds.remove(item.productId);
      });
    } else {
      setState(() => _busyIds.remove(item.productId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Couldn't remove that item. Try again.")),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          'Your Cart',
          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.brandOrange))
          : _tableMissing
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text(
                      "HamMart isn't fully set up yet. Please check back shortly.",
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 13),
                    ),
                  ),
                )
              : _items.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.shopping_cart_outlined, size: 56, color: Colors.white.withValues(alpha: 0.3)),
                          const SizedBox(height: 16),
                          const Text(
                            'Your cart is empty',
                            style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 14, fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 16),
                          TextButton(
                            onPressed: () => context.pop(),
                            child: const Text('Browse HamMart', style: TextStyle(color: AppColors.brandOrange)),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      color: AppColors.brandOrange,
                      backgroundColor: AppColors.surfaceDark,
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, index) => _CartTile(
                          item: _items[index],
                          busy: _busyIds.contains(_items[index].productId),
                          onQuantityChanged: (q) => _updateQuantity(_items[index], q),
                          onRemove: () => _remove(_items[index]),
                        ),
                      ),
                    ),
      bottomNavigationBar: (_loading || _tableMissing || _items.isEmpty)
          ? null
          : SafeArea(
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                decoration: BoxDecoration(
                  color: AppColors.surfaceDark,
                  border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Total', style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 13)),
                        Text(
                          '₹$_total',
                          style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text("Checkout isn't available yet — we're still wiring up payments.")),
                          );
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white.withValues(alpha: 0.08),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          elevation: 0,
                        ),
                        child: const Text('Checkout — coming soon', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

class _CartTile extends StatelessWidget {
  final HammartCartItem item;
  final bool busy;
  final ValueChanged<int> onQuantityChanged;
  final VoidCallback onRemove;

  const _CartTile({
    required this.item,
    required this.busy,
    required this.onQuantityChanged,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final product = item.product;
    final image = product != null && product.gallery.isNotEmpty ? smartImageProvider(product.gallery.first) : null;
    return Opacity(
      opacity: item.unavailable ? 0.5 : 1.0,
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: AppColors.cardDark, borderRadius: BorderRadius.circular(14)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Container(
                width: 72,
                height: 72,
                color: AppColors.surfaceDark,
                child: image != null
                    ? Image(image: image, fit: BoxFit.cover)
                    : const Icon(Icons.shopping_bag_outlined, color: AppColors.textSecondaryDark),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product?.title ?? 'Product no longer available',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  if (item.unavailable)
                    const Text(
                      'No longer available',
                      style: TextStyle(color: Colors.redAccent, fontSize: 11, fontWeight: FontWeight.w600),
                    )
                  else ...[
                    Text(
                      '₹${product?.priceInr ?? 0}',
                      style: const TextStyle(color: AppColors.brandOrange, fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        _QtyButton(
                          icon: Icons.remove,
                          onTap: busy ? null : () => onQuantityChanged(item.quantity - 1),
                        ),
                        SizedBox(
                          width: 32,
                          child: Center(
                            child: busy
                                ? const SizedBox(
                                    width: 12,
                                    height: 12,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brandOrange),
                                  )
                                : Text('${item.quantity}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          ),
                        ),
                        _QtyButton(
                          icon: Icons.add,
                          onTap: busy || item.quantity >= 20 ? null : () => onQuantityChanged(item.quantity + 1),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.delete_outline, color: AppColors.textSecondaryDark, size: 20),
              onPressed: busy ? null : onRemove,
            ),
          ],
        ),
      ),
    );
  }
}

class _QtyButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  const _QtyButton({required this.icon, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 26,
        height: 26,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: onTap == null ? 0.02 : 0.06),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, size: 14, color: onTap == null ? Colors.white.withValues(alpha: 0.2) : Colors.white),
      ),
    );
  }
}
