import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_logo.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../core/widgets/pattern_background.dart';
import '../../../../models/hammart_product.dart';
import '../../../../services/hammart_service.dart';
import '../../../home/presentation/widgets/mobile_menu_drawer.dart';

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

const _topCategories = [
  'All',
  'Verticals',
  'Entertainment',
  'Movies',
  'Web Series',
  'InPlay Originals',
];

class ShopPage extends ConsumerStatefulWidget {
  const ShopPage({super.key});

  @override
  ConsumerState<ShopPage> createState() => _ShopPageState();
}

class _ShopPageState extends ConsumerState<ShopPage> {
  final _searchController = TextEditingController();
  String _selectedCategory = 'All';

  // Real Hammart product data — GET /api/hammart/products, same backend
  // Round 9 already built a client for (see HammartService). This screen's
  // own layout was rebuilt in a later polish pass but never wired back up
  // to that real data, so it always showed the "coming soon" empty state
  // regardless of actual inventory. Fixed as of the Round 20 parity pass.
  List<HammartProduct> _products = [];
  bool _loading = true;
  bool _tableMissing = false;
  int _cartCount = 0;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() => setState(() {}));
    _loadProducts();
    _loadCartCount();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadProducts() async {
    final result = await ref.read(hammartServiceProvider).getProducts();
    if (!mounted) return;
    setState(() {
      _products = result.products;
      _tableMissing = result.tableMissing;
      _loading = false;
    });
  }

  Future<void> _loadCartCount() async {
    final cart = await ref.read(hammartServiceProvider).getCart();
    if (!mounted) return;
    setState(() => _cartCount = cart.items.length);
  }

  void _selectCategory(String category) {
    setState(() => _selectedCategory = category);
  }

  /// Live-visible products for the current category/search filter —
  /// client-side, same lightweight pattern already used for category pages,
  /// Music, and channel search elsewhere in this app. Excludes anything the
  /// vendor has hidden or admin has removed, matching what a real shopper
  /// should see.
  List<HammartProduct> get _visibleProducts {
    var list = _products.where((p) => p.status == 'active').toList();
    if (_selectedCategory != 'All') {
      list = list.where((p) => p.category == _selectedCategory).toList();
    }
    final query = _searchController.text.trim().toLowerCase();
    if (query.isNotEmpty) {
      list = list
          .where((p) =>
              p.title.toLowerCase().contains(query) || p.category.toLowerCase().contains(query))
          .toList();
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      backgroundColor: Colors.transparent,
      drawer: const MobileMenuDrawer(),
      body: PatternBackground(
        child: Stack(
          children: [
            CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                _buildSliverAppBar(context),
                SliverToBoxAdapter(
                  child: _buildTopCategories(),
                ),
                SliverToBoxAdapter(
                  child: _buildHammartHeader(),
                ),
                SliverToBoxAdapter(
                  child: _buildSearchBar(),
                ),
                SliverToBoxAdapter(
                  child: _buildCategories(),
                ),
                if (_loading)
                  SliverToBoxAdapter(child: _buildLoading())
                else if (_visibleProducts.isEmpty)
                  SliverToBoxAdapter(child: _buildEmptyState())
                else
                  _buildProductGrid(),
                const SliverPadding(padding: EdgeInsets.only(bottom: 100)),
              ],
            ),
            // Floating Support Button — positioned cleanly above frosted bottom navigation bar
            Positioned(
              bottom: 110,
              right: 18,
              child: Material(
                color: Colors.transparent,
                shape: const CircleBorder(),
                elevation: 8,
                shadowColor: AppColors.brandOrange.withValues(alpha: 0.50),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('HamMart Support & Helpdesk is available 24/7.'),
                        backgroundColor: AppColors.brandOrange,
                      ),
                    );
                  },
                  child: Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFFF9500), Color(0xFFFF5E00)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white.withValues(alpha: 0.25), width: 1.5),
                    ),
                    child: const Icon(
                      Icons.headset_mic_rounded,
                      color: Colors.white,
                      size: 26,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: _buildBottomNavigationBar(),
    );
  }

  Widget _buildSliverAppBar(BuildContext context) {
    return SliverAppBar(
      automaticallyImplyLeading: false,
      floating: true,
      snap: true,
      backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      toolbarHeight: 64,
      titleSpacing: 16,
      flexibleSpace: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            color: Colors.transparent,
            child: Stack(
              alignment: Alignment.center,
              children: [
                Text(
                  'INPLAYER',
                  style: TextStyle(
                    fontSize: 54,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 18.9,
                    color: context.isDark ? Colors.white.withValues(alpha: 0.03) : Colors.black.withValues(alpha: 0.03),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      title: Row(
        children: [
          Builder(
            builder: (context) => GestureDetector(
              onTap: () => Scaffold.of(context).openDrawer(),
              child: Container(
                width: 38,
                height: 38,
                margin: const EdgeInsets.only(right: 10),
                decoration: BoxDecoration(
                  color: context.isDark ? Colors.white.withValues(alpha: 0.06) : Colors.black.withValues(alpha: 0.04),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: context.borderSubtle),
                ),
                child: Icon(
                  Icons.menu,
                  color: context.textPrimary,
                  size: 20,
                ),
              ),
            ),
          ),
          const AppNavbarLogo(height: 32),
        ],
      ),
      actions: [
        IconButton(
          icon: Icon(Icons.search, color: context.textPrimary),
          onPressed: () => context.push('/search'),
        ),
        IconButton(
          icon: Icon(Icons.notifications_none, color: context.textPrimary),
          onPressed: () => context.push('/notifications'),
        ),
        const SizedBox(width: 8),
      ],
    );
  }

  Widget _buildTopCategories() {
    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _topCategories.length,
        itemBuilder: (context, index) {
          final isFirst = index == 0;
          return Container(
            margin: const EdgeInsets.only(right: 8),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            decoration: BoxDecoration(
              color: isFirst ? (context.isDark ? AppColors.surfaceDark : Colors.white) : Colors.transparent,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isFirst ? AppColors.brandOrange.withValues(alpha: 0.5) : context.borderSubtle,
              ),
            ),
            child: Text(
              _topCategories[index],
              style: TextStyle(
                color: isFirst ? AppColors.brandOrange : context.textSecondary,
                fontSize: 12,
                fontWeight: isFirst ? FontWeight.bold : FontWeight.w500,
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildHammartHeader() {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: context.bgCard,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: context.borderSubtle),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: context.isDark ? 0.2 : 0.05),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: const Icon(Icons.storefront, color: AppColors.brandOrange, size: 28),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'HamMart',
                      style: TextStyle(
                        color: context.textPrimary,
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      'Local vendors, Instant UPI checkout',
                      style: TextStyle(
                        color: context.textSecondary,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: context.bgCard,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: context.borderSubtle),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.location_on_outlined, size: 14, color: AppColors.brandOrange),
                    const SizedBox(width: 4),
                    Text(
                      'Delivering to 401107',
                      style: TextStyle(
                        color: context.textPrimary,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _buildIconBtn(
                Icons.inventory_2_outlined,
                onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text("Order history isn't available yet — checkout hasn't launched."),
                    backgroundColor: AppColors.brandOrange,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _buildIconBtn(
                Icons.favorite_border,
                onTap: () => context.push('/marketplace/wishlist'),
              ),
              const SizedBox(width: 8),
              _buildIconBtn(
                Icons.shopping_cart_outlined,
                badgeCount: _cartCount,
                onTap: () => context.push('/marketplace/cart').then((_) => _loadCartCount()),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Container(
                  height: 40,
                  decoration: BoxDecoration(
                    color: context.bgCard,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.brandOrange.withValues(alpha: 0.4)),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.brandOrange.withValues(alpha: 0.1),
                        blurRadius: 4,
                      ),
                    ],
                  ),
                  child: Center(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Text(
                          'Become a Seller / Open Storefront',
                          style: TextStyle(
                            color: AppColors.brandOrange,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        SizedBox(width: 4),
                        Icon(Icons.arrow_forward, color: AppColors.brandOrange, size: 14),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildIconBtn(IconData icon, {VoidCallback? onTap, int badgeCount = 0}) {
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: context.bgCard,
              shape: BoxShape.circle,
              border: Border.all(color: context.borderSubtle),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: context.isDark ? 0.2 : 0.05),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Icon(icon, color: context.textSecondary, size: 20),
          ),
          if (badgeCount > 0)
            Positioned(
              top: -2,
              right: -2,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: AppColors.brandOrange,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: context.bgCanvas, width: 1.5),
                ),
                constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                child: Text(
                  badgeCount > 99 ? '99+' : '$badgeCount',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: Row(
        children: [
          Expanded(
            flex: 7,
            child: Container(
              height: 44,
              decoration: BoxDecoration(
                color: context.bgCard,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: context.borderSubtle),
              ),
              child: TextField(
                controller: _searchController,
                style: TextStyle(color: context.textPrimary, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Search products, categories, or sellers...',
                  hintStyle: TextStyle(color: context.textDim, fontSize: 13),
                  prefixIcon: Icon(Icons.search, color: context.textDim, size: 20),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 3,
            child: Container(
              height: 44,
              decoration: BoxDecoration(
                color: context.bgCard,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: context.borderSubtle),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.tune, color: AppColors.brandOrange, size: 16),
                  const SizedBox(width: 6),
                  Text(
                    'All Items',
                    style: TextStyle(
                      color: context.textPrimary,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(width: 2),
                  Icon(Icons.keyboard_arrow_down, color: context.textDim, size: 16),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategories() {
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _categories.length,
        itemBuilder: (context, index) {
          final category = _categories[index];
          final isSelected = category == _selectedCategory;
          return GestureDetector(
            onTap: () => _selectCategory(category),
            child: Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(
                color: isSelected ? AppColors.brandOrange : context.bgCard,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isSelected ? AppColors.brandOrange : context.borderSubtle,
                ),
              ),
              child: Center(
                child: Text(
                  category,
                  style: TextStyle(
                    color: isSelected ? Colors.white : context.textPrimary,
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildLoading() {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 64),
      child: Center(child: CircularProgressIndicator(color: AppColors.brandOrange)),
    );
  }

  Widget _buildEmptyState() {
    final hasAnyProducts = _products.isNotEmpty;
    final isFiltered = _selectedCategory != 'All' || _searchController.text.trim().isNotEmpty;

    final String title;
    final String subtitle;
    if (_tableMissing) {
      title = 'HamMart isn\'t fully set up yet';
      subtitle = 'The marketplace is still being connected on our end — check back soon.';
    } else if (hasAnyProducts && isFiltered) {
      title = 'No products match';
      subtitle = 'Try a different category or search term.';
    } else {
      title = 'Coming soon to your neighborhood!';
      subtitle = "We don't have any sellers within 15km of 401107 yet. We're expanding rapidly!";
    }

    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
        decoration: BoxDecoration(
          color: context.bgCard,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: context.borderSubtle),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: context.isDark ? 0.2 : 0.05),
              blurRadius: 20,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          children: [
            const Icon(
              Icons.storefront,
              size: 48,
              color: AppColors.brandOrange,
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: context.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: context.textSecondary,
                fontSize: 13,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProductGrid() {
    final products = _visibleProducts;
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 0.68,
        ),
        delegate: SliverChildBuilderDelegate(
          (context, index) => _buildProductCard(products[index]),
          childCount: products.length,
        ),
      ),
    );
  }

  Widget _buildProductCard(HammartProduct product) {
    final image = product.gallery.isNotEmpty ? smartImageProvider(product.gallery.first) : null;

    return GestureDetector(
      onTap: () => context.push('/marketplace/product/${product.productId}'),
      child: Container(
        decoration: BoxDecoration(
          color: context.bgCard,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: context.borderSubtle),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: context.isDark ? 0.2 : 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: image != null
                  ? Image(image: image, fit: BoxFit.cover, errorBuilder: (_, __, ___) => _productImageFallback())
                  : _productImageFallback(),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.title.isNotEmpty ? product.title : 'Untitled product',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: context.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      height: 1.25,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '₹${product.priceInr.toStringAsFixed(product.priceInr % 1 == 0 ? 0 : 2)}',
                    style: const TextStyle(
                      color: AppColors.brandOrange,
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _productImageFallback() {
    return Container(
      color: context.bgCard,
      child: Icon(Icons.image_not_supported_outlined, color: context.textDim, size: 28),
    );
  }

  Widget _buildBottomNavigationBar() {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          decoration: BoxDecoration(
            color: context.bgNavbar,
            border: Border(
              top: BorderSide(
                color: context.borderSubtle,
                width: 1,
              ),
            ),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: 8,
                vertical: 8,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildNavItem(
                    0,
                    Icons.home_outlined,
                    'Home',
                    onTap: () => context.go('/'),
                  ),
                  _buildNavItem(
                    1,
                    Icons.play_circle_outline,
                    'Raftaar',
                    onTap: () => context.push('/shorts'),
                  ),
                  _buildCreateButton(),
                  _buildNavItem(
                    3,
                    Icons.cast,
                    'In-Family',
                    onTap: () => context.push('/subscriptions'),
                  ),
                  _buildNavItem(
                    4,
                    Icons.person_outline,
                    'You',
                    onTap: () => context.push('/profile'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(
    int index,
    IconData icon,
    String label, {
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(
          minWidth: 62,
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: 10,
          vertical: 8,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: context.textSecondary,
              size: 24,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: context.textSecondary,
                fontSize: 10,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCreateButton() {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        context.push('/upload');
      },
      child: Container(
        width: 48,
        height: 48,
        margin: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.brandGold,
              AppColors.brandOrangeLight,
            ],
          ),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: AppColors.brandOrange.withValues(alpha: 0.2),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: const Icon(
          Icons.add,
          color: Colors.black,
          size: 26,
        ),
      ),
    );
  }
}
