import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../services/hammart_service.dart';
import '../../../../models/hammart_cart_item.dart';

/// HamMart wishlist — saved products against GET/DELETE
/// /api/hammart/wishlist[/{productId}].
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
          'Wishlist',
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
                          Icon(Icons.favorite_border, size: 56, color: Colors.white.withValues(alpha: 0.3)),
                          const SizedBox(height: 16),
                          const Text(
                            'Nothing saved yet',
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
                      child: GridView.builder(
                        padding: const EdgeInsets.all(16),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          childAspectRatio: 0.66,
                        ),
                        itemCount: _items.length,
                        itemBuilder: (context, index) {
                          final item = _items[index];
                          return _WishlistCard(
                            item: item,
                            busy: _busyIds.contains(item.productId),
                            onRemove: () => _remove(item),
                          );
                        },
                      ),
                    ),
    );
  }
}

class _WishlistCard extends StatelessWidget {
  final HammartWishlistItem item;
  final bool busy;
  final VoidCallback onRemove;

  const _WishlistCard({required this.item, required this.busy, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    final product = item.product;
    final image = product != null && product.gallery.isNotEmpty ? smartImageProvider(product.gallery.first) : null;
    return GestureDetector(
      onTap: item.unavailable ? null : () => context.push('/marketplace/product/${item.productId}'),
      child: Opacity(
        opacity: item.unavailable ? 0.5 : 1.0,
        child: Container(
          decoration: BoxDecoration(color: AppColors.cardDark, borderRadius: BorderRadius.circular(16)),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  AspectRatio(
                    aspectRatio: 1,
                    child: Container(
                      color: AppColors.surfaceDark,
                      child: image != null
                          ? Image(image: image, fit: BoxFit.cover, width: double.infinity)
                          : const Icon(Icons.shopping_bag_outlined, color: AppColors.textSecondaryDark),
                    ),
                  ),
                  Positioned(
                    top: 4,
                    right: 4,
                    child: GestureDetector(
                      onTap: busy ? null : onRemove,
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.55), shape: BoxShape.circle),
                        child: busy
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.favorite, color: AppColors.brandOrange, size: 16),
                      ),
                    ),
                  ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product?.title ?? 'No longer available',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 4),
                    if (item.unavailable)
                      const Text(
                        'No longer available',
                        style: TextStyle(color: Colors.redAccent, fontSize: 11, fontWeight: FontWeight.w600),
                      )
                    else
                      Text(
                        '₹${product?.priceInr ?? 0}',
                        style: const TextStyle(color: AppColors.brandOrange, fontSize: 14, fontWeight: FontWeight.bold),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
