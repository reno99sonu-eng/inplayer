import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../services/hammart_service.dart';
import '../../../../models/hammart_cart_item.dart';

class WishlistPage extends ConsumerStatefulWidget {
  const WishlistPage({super.key});

  @override
  ConsumerState<WishlistPage> createState() => _WishlistPageState();
}

class _WishlistPageState extends ConsumerState<WishlistPage> {
  bool _loading = true;
  bool _tableMissing = false;
  List<HammartWishlistItem> _items = [];
  final Set<String> _busyIds = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(hammartServiceProvider).getWishlist();
    if (!mounted) return;
    setState(() {
      _items = result.items;
      _tableMissing = result.tableMissing;
      _loading = false;
    });
  }

  Future<void> _remove(HammartWishlistItem item) async {
    setState(() => _busyIds.add(item.productId));
    final ok = await ref.read(hammartServiceProvider).removeFromWishlist(item.productId);
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
          const SnackBar(content: Text("Couldn't remove that. Try again.")),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PatternBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
          elevation: 0,
          surfaceTintColor: Colors.transparent,
          leading: IconButton(
            icon: Icon(Icons.arrow_back, color: context.textPrimary),
            onPressed: () => context.pop(),
          ),
          title: Text(
            'Wishlist',
            style: TextStyle(color: context.textPrimary, fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.brandOrange))
            : _tableMissing
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        "HamMart isn't fully set up yet. Please check back shortly.",
                        textAlign: TextAlign.center,
                        style: TextStyle(color: context.textSecondary, fontSize: 13),
                      ),
                    ),
                  )
                : _items.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.favorite_border, size: 56, color: context.textDim),
                            const SizedBox(height: 16),
                            Text(
                              'Nothing saved yet',
                              style: TextStyle(color: context.textSecondary, fontSize: 14, fontWeight: FontWeight.w600),
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
                        backgroundColor: context.bgCard,
                        onRefresh: _load,
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _items.length,
                          separatorBuilder: (context, index) => const SizedBox(height: 12),
                          itemBuilder: (context, index) => _WishlistTile(
                            item: _items[index],
                            busy: _busyIds.contains(_items[index].productId),
                            onRemove: () => _remove(_items[index]),
                          ),
                        ),
                      ),
      ),
    );
  }
}

class _WishlistTile extends StatelessWidget {
  final HammartWishlistItem item;
  final bool busy;
  final VoidCallback onRemove;

  const _WishlistTile({
    required this.item,
    required this.busy,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final product = item.product;
    final image = product != null && product.gallery.isNotEmpty ? smartImageProvider(product.gallery.first) : null;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.borderSubtle),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Container(
              width: 72,
              height: 72,
              color: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
              child: image != null
                  ? Image(image: image, fit: BoxFit.cover)
                  : Icon(Icons.shopping_bag_outlined, color: context.textDim),
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
                  style: TextStyle(color: context.textPrimary, fontSize: 14, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Text(
                  '₹${product?.priceInr ?? 0}',
                  style: const TextStyle(color: AppColors.brandOrange, fontSize: 14, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(Icons.delete_outline, color: context.textDim, size: 20),
            onPressed: busy ? null : onRemove,
          ),
        ],
      ),
    );
  }
}
