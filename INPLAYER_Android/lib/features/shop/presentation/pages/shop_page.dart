import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../services/hammart_service.dart';
import '../../../../models/hammart_product.dart';

const _categories = [
  'All',
  'Merchandise',
  'Digital Products',
  'Handicrafts',
  'Fashion',
  'Electronics',
  'Home & Living',
  'Other',
];

/// HamMart storefront — real product browsing against
/// GET /api/hammart/products, with a real cart and wishlist. Checkout
/// (payment) isn't wired up yet; the Cart page says so honestly rather
/// than pretending it works.
class ShopPage extends ConsumerStatefulWidget {
  const ShopPage({super.key});

  @override
  ConsumerState<ShopPage> createState() => _ShopPageState();
}

class _ShopPageState extends ConsumerState<ShopPage> {
  final _searchController = TextEditingController();
  String _selectedCategory = 'All';
  String _query = '';
  bool _loading = true;
  bool _tableMissing = false;
  List<HammartProduct> _products = [];
  int _cartCount = 0;

  @override
  void initState() {
    super.initState();
    _load();
    _loadCartCount();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref
        .read(hammartServiceProvider)
        .getProducts(category: _selectedCategory == 'All' ? null : _selectedCategory);
    if (!mounted) return;
    setState(() {
      _products = result.products;
      _tableMissing = result.tableMissing;
      _loading = false;
    });
  }

  Future<void> _loadCartCount() async {
    final result = await ref.read(hammartServiceProvider).getCart();
    if (!mounted) return;
    setState(() => _cartCount = result.items.length);
  }

  void _selectCategory(String category) {
    setState(() => _selectedCategory = category);
    _load();
  }

  List<HammartProduct> get _filtered {
    if (_query.isEmpty) return _products;
    final q = _query.toLowerCase();
    return _products.where((p) => p.title.toLowerCase().contains(q) || p.vendorId.toLowerCase().contains(q)).toList();
  }

  Future<void> _openCart() async {
    await context.push('/marketplace/cart');
    _loadCartCount();
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
        title: Row(
          children: [
            const Icon(Icons.storefront, color: AppColors.brandOrange, size: 24),
            const SizedBox(width: 8),
            const Text(
              'HamMart',
              style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900, letterSpacing: -0.5),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.favorite_border, color: Colors.white),
            onPressed: () => context.push('/marketplace/wishlist'),
          ),
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.shopping_cart_outlined, color: Colors.white),
                onPressed: _openCart,
              ),
              if (_cartCount > 0)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: const BoxDecoration(color: AppColors.brandOrange, shape: BoxShape.circle),
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    child: Text(
                      '$_cartCount',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.brandOrange,
        backgroundColor: AppColors.surfaceDark,
        onRefresh: () async {
          await _load();
          await _loadCartCount();
        },
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Buy directly from verified creators & vendors',
                      style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 12, fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      height: 44,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.04),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
                      ),
                      child: TextField(
                        controller: _searchController,
                        onChanged: (v) => setState(() => _query = v.trim()),
                        style: const TextStyle(color: Colors.white, fontSize: 14),
                        decoration: InputDecoration(
                          hintText: 'Search products or sellers...',
                          hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 14),
                          prefixIcon: Icon(Icons.search, color: Colors.white.withValues(alpha: 0.4), size: 20),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      height: 36,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: _categories.length,
                        itemBuilder: (context, index) {
                          final category = _categories[index];
                          final isSelected = category == _selectedCategory;
                          return GestureDetector(
                            onTap: () => _selectCategory(category),
                            child: Container(
                              margin: const EdgeInsets.only(right: 8),
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              decoration: BoxDecoration(
                                color: isSelected ? AppColors.brandOrange : Colors.white.withValues(alpha: 0.03),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: isSelected ? AppColors.brandOrange : Colors.white.withValues(alpha: 0.1)),
                              ),
                              child: Center(
                                child: Text(
                                  category,
                                  style: TextStyle(
                                    color: isSelected ? Colors.white : AppColors.textSecondaryDark,
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_loading)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator(color: AppColors.brandOrange)),
              )
            else if (_tableMissing)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text(
                      "HamMart isn't fully set up yet. Please check back shortly.",
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 13),
                    ),
                  ),
                ),
              )
            else if (_filtered.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.shopping_bag_outlined, size: 48, color: Colors.white.withValues(alpha: 0.3)),
                      const SizedBox(height: 16),
                      const Text(
                        'No products found',
                        style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 14, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.all(16),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.66,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _ProductCard(product: _filtered[index]),
                    childCount: _filtered.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  final HammartProduct product;
  const _ProductCard({required this.product});

  @override
  Widget build(BuildContext context) {
    final image = product.gallery.isNotEmpty ? smartImageProvider(product.gallery.first) : null;
    return GestureDetector(
      onTap: () => context.push('/marketplace/product/${product.productId}'),
      child: Container(
        decoration: BoxDecoration(color: AppColors.cardDark, borderRadius: BorderRadius.circular(16)),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
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
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '₹${product.priceInr}',
                    style: const TextStyle(color: AppColors.brandOrange, fontSize: 14, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'by @${product.vendorId}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 11),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
