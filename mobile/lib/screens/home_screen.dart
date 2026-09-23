import 'package:flutter/material.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/screens/favorites_screen.dart';
import 'package:otopiyasa/screens/offers_screen.dart';
import 'package:otopiyasa/screens/my_listings_screen.dart';
import 'package:otopiyasa/screens/notifications_screen.dart';
import 'package:otopiyasa/screens/profile_screen.dart';
import 'package:otopiyasa/screens/predict_screen.dart';
import 'package:otopiyasa/screens/assistant_screen.dart';
import 'package:otopiyasa/screens/sell_screen.dart';
import 'package:otopiyasa/screens/map_screen.dart';
import 'package:otopiyasa/screens/compare_screen.dart';
import 'package:otopiyasa/screens/analytics_screen.dart';
import 'package:otopiyasa/screens/admin_screen.dart';
import 'package:otopiyasa/screens/nearby_screen.dart';
import 'package:otopiyasa/widgets/home_strips.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/services/notification_service.dart';
import 'package:otopiyasa/services/update_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/widgets/app_logo.dart';
import 'package:otopiyasa/widgets/car_card.dart';

// Sunucudan gerçek marka listesi gelene kadar gösterilen dar yedek liste.
const _fallbackBrands = [
  '',
  'Toyota', 'Volkswagen', 'Renault', 'Fiat', 'Ford', 'Opel', 'Hyundai',
  'Honda', 'BMW', 'Mercedes-Benz', 'Audi', 'Peugeot', 'Skoda', 'Kia',
];

const _fuelTypes = ['', 'Benzin', 'Dizel', 'LPG', 'Hibrit', 'Elektrik'];
const _transmissions = ['', 'Manuel', 'Otomatik', 'Yarı Otomatik'];

// NOT: anahtarlar sunucudaki lib/car-query.ts buildCarSort ile BİREBİR aynı
// olmalı (alt çizgi, tire değil) — eskiden "price-asc" gibi tireli anahtarlar
// vardı, sunucu hiçbirini tanımadığı için sessizce "en yeni"ye düşüyordu ve
// fiyat/yıl sıralaması hiç çalışmıyordu. "Km (düşük)" seçeneği de sunucuda
// hiç desteklenmediği için tamamen kaldırıldı (var olmayan bir işlevi var
// gibi göstermek yerine).
const _sorts = {
  'mixed': 'Keşfet (Rastgele / Çeşitli)',
  'newest': 'En yeni',
  'views': 'Trend (en çok görüntülenen)',
  'price_asc': 'Fiyat (artan)',
  'price_desc': 'Fiyat (azalan)',
  'year_desc': 'Yıl (yeni)',
};

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _api = ApiService();
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();

  final List<CarListing> _cars = [];
  bool _loading = true;
  bool _loadingMore = false;
  bool _importing = false;
  String? _error;
  int _total = 0;
  int _page = 1;
  int _totalPages = 1;
  int _refreshSignal = 0;
  int _carsRequestId = 0;

  String _brand = '';
  String _model = '';
  String _fuelType = '';
  String _transmission = '';
  String _sort = 'mixed';
  bool _discountOnly = false;

  List<String> _brands = _fallbackBrands;
  Map<String, List<String>> _brandModels = {};
  List<String> get _models => _brand.isEmpty ? const [] : (_brandModels[_brand] ?? const []);

  /// Bir filtre/arama aktifken şeritler (haftanın fırsatları, son baktıkların)
  /// gizlenir — web'deki hasAnyFilter ile aynı davranış.
  bool get _hasActiveFilters =>
      _searchController.text.trim().isNotEmpty ||
      _brand.isNotEmpty ||
      _model.isNotEmpty ||
      _fuelType.isNotEmpty ||
      _transmission.isNotEmpty ||
      _discountOnly;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);

    _loadCars(reset: true);
    _loadBrandOptions();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      UpdateService.checkUpdate(context);
    });
  }

  /// Web'deki CarFilters ile aynı kaynaktan (gerçek DB markaları + o markanın
  /// modelleri) filtre panelini doldurur. Başarısız olursa dar yedek listede
  /// kalınır — filtre çalışmaya devam eder, sadece kapsamı sınırlı.
  Future<void> _loadBrandOptions() async {
    try {
      final data = await _api.fetchBrandModels();
      final brands = (data['brands'] as List<dynamic>? ?? []).cast<String>();
      final rawModels = data['brandModels'] as Map<String, dynamic>? ?? {};
      final brandModels = rawModels.map(
        (key, value) => MapEntry(key, (value as List<dynamic>).cast<String>()),
      );
      if (!mounted) return;
      setState(() {
        _brands = ['', ...brands];
        _brandModels = brandModels;
      });
    } catch (_) {
      // Sessizce yedek listede kal.
    }
  }

  @override
  void dispose() {

    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }


  void _onScroll() {
    if (_loading || _loadingMore || _page >= _totalPages) return;
    if (_scrollController.position.pixels >
        _scrollController.position.maxScrollExtent - 400) {
      _loadCars(reset: false);
    }
  }

  Future<void> _loadCars({required bool reset}) async {
    final requestId = ++_carsRequestId;
    if (reset) {
      setState(() {
        _loading = true;
        _loadingMore = false;
        _error = null;
        _page = 1;
        _refreshSignal++;
      });
    } else {
      setState(() => _loadingMore = true);
    }

    try {
      final nextPage = reset ? 1 : _page + 1;
      final data = await _api.fetchCars(
        q: _searchController.text.trim(),
        brand: _brand,
        model: _model,
        fuelType: _fuelType,
        transmission: _transmission,
        sort: _sort,
        discountOnly: _discountOnly,
        page: nextPage,
      );
      if (!mounted || requestId != _carsRequestId) return;
      setState(() {
        if (reset) _cars.clear();
        _cars.addAll(data.items);
        _total = data.total;
        _page = data.page;
        _totalPages = data.totalPages;
      });
    } catch (error) {
      if (mounted && requestId == _carsRequestId) {
        setState(() => _error = error.toString());
      }
    } finally {
      if (mounted && requestId == _carsRequestId) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  Future<void> _importDemo() async {
    setState(() => _importing = true);
    try {
      await _api.importDemoListings();
      await _loadCars(reset: true);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Demo ilanlar yüklendi')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => _importing = false);
    }
  }

  Future<void> _openAccountMenu() async {
    if (!_api.isLoggedIn) {
      await Navigator.of(context).pushNamed('/login');
      if (mounted) setState(() {});
      return;
    }

    Widget sectionLabel(String text) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
          child: Text(
            text,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.1,
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45),
            ),
          ),
        );

    final action = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: DraggableScrollableSheet(
          initialChildSize: 0.75,
          maxChildSize: 0.9,
          expand: false,
          builder: (context, scrollController) => ListView(
            controller: scrollController,
            children: [
              // Hesap bilgisi doğrudan Profil'e götürür — arayıp bulmak yerine tek dokunuş.
              ListTile(
                leading: CircleAvatar(
                  backgroundColor: AppTheme.accent.withValues(alpha: 0.2),
                  child: Text(
                    ((_api.currentUser?['name'] as String?)?.trim().isNotEmpty ?? false)
                        ? (_api.currentUser!['name'] as String).trim()[0].toUpperCase()
                        : '?',
                    style: const TextStyle(color: AppTheme.accent, fontWeight: FontWeight.bold),
                  ),
                ),
                title: Text(_api.currentUser?['name'] as String? ?? 'Hesabım'),
                subtitle: Text(_api.currentUser?['email'] as String? ?? ''),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).pop('profile'),
              ),
              const Divider(height: 1),
              sectionLabel('İLANLAR'),
              ListTile(
                leading: const Icon(Icons.favorite_outline),
                title: const Text('Favorilerim'),
                onTap: () => Navigator.of(context).pop('favorites'),
              ),
              ListTile(
                leading: const Icon(Icons.local_offer_outlined),
                title: const Text('Tekliflerim'),
                onTap: () => Navigator.of(context).pop('offers'),
              ),
              ListTile(
                leading: const Icon(Icons.list_alt),
                title: const Text('İlanlarım'),
                onTap: () => Navigator.of(context).pop('listings'),
              ),
              ListTile(
                leading: const Icon(Icons.add_box_outlined),
                title: const Text('İlan Ver'),
                onTap: () => Navigator.of(context).pop('sell'),
              ),
              sectionLabel('ARAÇLAR'),
              ListTile(
                leading: const Icon(Icons.map_outlined),
                title: const Text('Harita'),
                onTap: () => Navigator.of(context).pop('map'),
              ),
              ListTile(
                leading: const Icon(Icons.near_me_outlined),
                title: const Text('Yakınımdaki ilanlar'),
                onTap: () => Navigator.of(context).pop('nearby'),
              ),
              ListTile(
                leading: const Icon(Icons.compare_arrows),
                title: const Text('Karşılaştır'),
                onTap: () => Navigator.of(context).pop('compare'),
              ),
              ListTile(
                leading: const Icon(Icons.insights_outlined),
                title: const Text('Analiz'),
                onTap: () => Navigator.of(context).pop('analytics'),
              ),
              ListTile(
                leading: const Icon(Icons.calculate_outlined),
                title: const Text('Fiyat Tahmini'),
                onTap: () => Navigator.of(context).pop('predict'),
              ),
              if (_api.isAdmin) ...[
                sectionLabel('YÖNETİM & SİSTEM'),
                ListTile(
                  leading: const Icon(Icons.admin_panel_settings, color: AppTheme.accent),
                  title: const Text('Yönetim & 7/24 Bot Takibi', style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.accent)),
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppTheme.accent.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text('CANLI', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.accent)),
                  ),
                  onTap: () => Navigator.of(context).pop('admin'),
                ),
              ],
              sectionLabel('HESAP'),
              ListTile(
                leading: const Icon(Icons.person_outline),
                title: const Text('Profil'),
                onTap: () => Navigator.of(context).pop('profile'),
              ),
              ListTile(
                leading: const Icon(Icons.notifications_outlined),
                title: const Text('Bildirimler'),
                onTap: () => Navigator.of(context).pop('notifications'),
              ),
              ListTile(
                leading: const Icon(Icons.logout, color: Colors.redAccent),
                title: const Text('Çıkış yap', style: TextStyle(color: Colors.redAccent)),
                onTap: () => Navigator.of(context).pop('logout'),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );

    if (!mounted) return;
    if (action == 'favorites') {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const FavoritesScreen()),
      );
    } else if (action == 'offers') {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const OffersScreen()),
      );
    } else if (action == 'listings') {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const MyListingsScreen()),
      );
    } else if (action == 'sell') {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const SellScreen()),
      );
    } else if (action == 'notifications') {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const NotificationsScreen()),
      );
    } else if (action == 'map') {
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const MapScreen()));
    } else if (action == 'nearby') {
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NearbyScreen()));
    } else if (action == 'compare') {
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CompareScreen()));
    } else if (action == 'analytics') {
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AnalyticsScreen()));
    } else if (action == 'predict') {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const PredictScreen()),
      );
    } else if (action == 'admin') {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const AdminScreen()),
      );
    } else if (action == 'profile') {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const ProfileScreen()),
      );
    } else if (action == 'logout') {
      await _api.logout();
      NotificationService.instance.stop();
      if (mounted) {
        setState(() {});
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Çıkış yapıldı')),
        );
      }
    }
  }

  
  Widget _searchablePickerButton({
    required String label,
    required String value,
    required List<String> options,
    required ValueChanged<String> onChanged,
    bool enabled = true,
    String emptyLabel = 'Tümü',
    bool isBrand = false,
  }) {
    final displayText = value.isEmpty ? emptyLabel : value;
    final isSelected = value.isNotEmpty;

    return InkWell(
      onTap: enabled
          ? () {
              showModalBottomSheet(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (ctx) => _SearchablePickerSheet(
                  title: '$label Seçin',
                  options: options,
                  currentValue: value,
                  emptyLabel: emptyLabel,
                  isBrand: isBrand,
                  onSelected: (val) {
                    onChanged(val);
                    _loadCars(reset: true);
                  },
                ),
              );
            }
          : null,
      borderRadius: BorderRadius.circular(12),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          enabled: enabled,
          suffixIcon: Icon(
            Icons.arrow_drop_down,
            color: enabled
                ? (isSelected ? AppTheme.accent : Colors.white70)
                : Colors.white24,
          ),
        ),
        child: Text(
          displayText,
          style: TextStyle(
            fontSize: 13,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
            color: enabled
                ? (isSelected ? Colors.white : Colors.white60)
                : Colors.white24,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }

  Widget _filterDropdown({
    required String label,
    required String value,
    required List<String> options,
    required ValueChanged<String> onChanged,
    bool enabled = true,
    String emptyLabel = 'Tümü',
  }) {
    // DropdownButtonFormField, initialValue options içinde yoksa hata verir
    // (ör. marka değişip henüz eski model listesinden çıkmamışken).
    final safeOptions = options.contains(value) ? options : [value, ...options];
    return DropdownButtonFormField<String>(
      initialValue: value,
      isDense: true,
      decoration: InputDecoration(
        labelText: label,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
      items: safeOptions
          .map((option) => DropdownMenuItem(
                value: option,
                child: Text(option.isEmpty ? emptyLabel : option,
                    style: const TextStyle(fontSize: 13)),
              ))
          .toList(),
      onChanged: enabled
          ? (selected) {
              if (selected == null) return;
              onChanged(selected);
              _loadCars(reset: true);
            }
          : null,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 10,
        title: const AppLogo(),
        actions: [
          ValueListenableBuilder<ThemeMode>(
            valueListenable: themeController,
            builder: (context, mode, _) => IconButton(
              visualDensity: VisualDensity.compact,
              padding: const EdgeInsets.all(4),
              constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
              onPressed: themeController.toggle,
              icon: Icon(mode == ThemeMode.dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined, size: 21),
              tooltip: mode == ThemeMode.dark ? 'Aydınlık tema' : 'Karanlık tema',
            ),
          ),
          ValueListenableBuilder<int>(
            valueListenable: _api.authRevision,
            builder: (context, _, __) => Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_api.isLoggedIn) ...[
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    padding: const EdgeInsets.all(4),
                    constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const FavoritesScreen()),
                    ),
                    icon: const Icon(Icons.favorite_outline, size: 21),
                    tooltip: 'Favorilerim',
                  ),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    padding: const EdgeInsets.all(4),
                    constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                    ),
                    icon: const Icon(Icons.notifications_outlined, size: 21),
                    tooltip: 'Bildirimler',
                  ),
                ],
              ],
            ),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            padding: const EdgeInsets.all(4),
            constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const AssistantScreen()),
            ),
            icon: const Icon(Icons.chat_bubble_outline, size: 21),
            tooltip: 'Asistan',
          ),
          ValueListenableBuilder<int>(
            valueListenable: _api.authRevision,
            builder: (context, _, __) => IconButton(
              visualDensity: VisualDensity.compact,
              padding: const EdgeInsets.all(4),
              constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
              onPressed: _openAccountMenu,
              icon: Icon(
                _api.isLoggedIn ? Icons.person : Icons.person_outline,
                color: _api.isLoggedIn ? AppTheme.accent : null,
                size: 24,
              ),
              tooltip: _api.isLoggedIn ? 'Hesabım' : 'Giriş yap',
            ),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => _loadCars(reset: true),
        child: CustomScrollView(
          controller: _scrollController,
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    decoration: const InputDecoration(
                      hintText: 'Toyota, Civic, İstanbul...',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onSubmitted: (_) => _loadCars(reset: true),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: () => _loadCars(reset: true),
                  child: const Text('Ara'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _searchablePickerButton(
                    label: 'Marka',
                    value: _brand,
                    options: _brands,
                    isBrand: true,
                    onChanged: (value) {
                      _brand = value;
                      _model = '';
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _searchablePickerButton(
                    label: 'Model',
                    value: _model,
                    options: ['', ..._models],
                    enabled: _models.isNotEmpty,
                    emptyLabel: _brand.isEmpty ? 'Önce marka seçin' : 'Tümü',
                    onChanged: (value) => _model = value,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _filterDropdown(
                    label: 'Yakıt',
                    value: _fuelType,
                    options: _fuelTypes,
                    onChanged: (value) => _fuelType = value,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _filterDropdown(
                    label: 'Vites',
                    value: _transmission,
                    options: _transmissions,
                    onChanged: (value) => _transmission = value,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _sort,
                    isDense: true,
                    decoration: const InputDecoration(
                      labelText: 'Sıralama',
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    items: _sorts.entries
                        .map((entry) => DropdownMenuItem(
                              value: entry.key,
                              child: Text(entry.value,
                                  style: const TextStyle(fontSize: 13)),
                            ))
                        .toList(),
                    onChanged: (selected) {
                      if (selected == null) return;
                      _sort = selected;
                      _loadCars(reset: true);
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                FilterChip(
                  avatar: const Text('🔥', style: TextStyle(fontSize: 13)),
                  label: const Text(
                    'Fiyatı Düşenler',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                  selected: _discountOnly,
                  selectedColor: const Color(0xFFF59E0B).withValues(alpha: 0.25),
                  checkmarkColor: const Color(0xFFF59E0B),
                  side: BorderSide(
                    color: _discountOnly ? const Color(0xFFF59E0B) : Colors.white12,
                  ),
                  onSelected: (val) {
                    setState(() => _discountOnly = val);
                    _loadCars(reset: true);
                  },
                ),
                if (_hasActiveFilters) ...[
                  const SizedBox(width: 8),
                  TextButton.icon(
                    icon: const Icon(Icons.clear, size: 14),
                    label: const Text('Temizle', style: TextStyle(fontSize: 12)),
                    onPressed: () {
                      setState(() {
                        _searchController.clear();
                        _brand = '';
                        _model = '';
                        _fuelType = '';
                        _transmission = '';
                        _discountOnly = false;
                      });
                      _loadCars(reset: true);
                    },
                  ),
                ],
              ],
            ),
            const SizedBox(height: 16),
            if (!_hasActiveFilters) ...[
              const RecentlyViewedStrip(),
              DealsStrip(refreshSignal: _refreshSignal),
              TrendingStrip(refreshSignal: _refreshSignal),
            ],
            if (_loading && _cars.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null && _cars.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Column(
                  children: [
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: _importing ? null : _importDemo,
                      child: Text(_importing ? 'Yükleniyor…' : 'Demo veriyi yükle'),
                    ),
                  ],
                ),
              )
            else if (!_loading && _cars.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Text(
                  'Filtrelere uyan ilan bulunamadı.',
                  textAlign: TextAlign.center,
                ),
              )
            else ...[
              Text(
                _loading ? 'İlanlar güncelleniyor…' : '$_total ilan bulundu',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
              ),
              if (_loading) ...[
                const SizedBox(height: 8),
                const LinearProgressIndicator(minHeight: 2),
              ],
              const SizedBox(height: 12),
              const SizedBox(height: 4),
            ],
                ]),
              ),
            ),
            if (_error == null && _cars.isNotEmpty)
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      if (index < _cars.length) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: CarCard(car: _cars[index]),
                        );
                      }
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        child: Center(
                          child: _loadingMore
                              ? const CircularProgressIndicator()
                              : Text(
                                  _page >= _totalPages ? 'Tüm ilanlar gösterildi' : 'Kaydırdıkça yeni ilanlar yüklenir',
                                  style: const TextStyle(color: Colors.white38, fontSize: 12),
                                ),
                        ),
                      );
                    },
                    childCount: _cars.length + 1,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SearchablePickerSheet extends StatefulWidget {
  const _SearchablePickerSheet({
    required this.title,
    required this.options,
    required this.currentValue,
    required this.emptyLabel,
    required this.onSelected,
    this.isBrand = false,
  });

  final String title;
  final List<String> options;
  final String currentValue;
  final String emptyLabel;
  final ValueChanged<String> onSelected;
  final bool isBrand;

  @override
  State<_SearchablePickerSheet> createState() => _SearchablePickerSheetState();
}

class _SearchablePickerSheetState extends State<_SearchablePickerSheet> {
  final _searchController = TextEditingController();
  String _query = '';

  static const _popularBrands = [
    'Tümü',
    'Fiat',
    'Renault',
    'Volkswagen',
    'Ford',
    'Toyota',
    'Audi',
    'BMW',
    'Mercedes-Benz',
    'Peugeot',
    'Opel',
    'Hyundai',
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<String> get _filteredOptions {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) {
      return widget.options;
    }
    return widget.options.where((option) {
      if (option.isEmpty) return false;
      return option.toLowerCase().contains(query);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final filtered = _filteredOptions;

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E293B) : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.25),
                blurRadius: 20,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          child: Column(
            children: [
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 10, bottom: 8),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: isDark ? Colors.white24 : Colors.black12,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
                child: Row(
                  children: [
                    Text(
                      widget.title,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.close, size: 20),
                      onPressed: () => Navigator.of(context).pop(),
                      visualDensity: VisualDensity.compact,
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: TextField(
                  controller: _searchController,
                  autofocus: true,
                  onChanged: (val) => setState(() => _query = val),
                  decoration: InputDecoration(
                    hintText: widget.isBrand
                        ? 'Marka ara (örn: Audi, BMW, Fiat)...'
                        : 'Model ara...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: _query.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _query = '');
                            },
                          )
                        : null,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    filled: true,
                    fillColor: isDark
                        ? const Color(0xFF0F172A)
                        : const Color(0xFFF1F5F9),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ),
              if (widget.isBrand && _query.isEmpty) ...[
                const SizedBox(height: 8),
                SizedBox(
                  height: 36,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _popularBrands.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (context, index) {
                      final brand = _popularBrands[index];
                      final val = brand == 'Tümü' ? '' : brand;
                      final isSelected = widget.currentValue == val;
                      return ChoiceChip(
                        label: Text(brand, style: const TextStyle(fontSize: 12)),
                        selected: isSelected,
                        onSelected: (_) {
                          widget.onSelected(val);
                          Navigator.of(context).pop();
                        },
                        visualDensity: VisualDensity.compact,
                      );
                    },
                  ),
                ),
              ],
              const Divider(height: 16),
              Expanded(
                child: filtered.isEmpty
                    ? Center(
                        child: Text(
                          '"$_query" ile eşleşen sonuç bulunamadı.',
                          style: TextStyle(
                            color: isDark ? Colors.white54 : Colors.black45,
                            fontSize: 13,
                          ),
                        ),
                      )
                    : ListView.builder(
                        controller: scrollController,
                        itemCount: filtered.length,
                        itemBuilder: (context, index) {
                          final item = filtered[index];
                          final isSelected = widget.currentValue == item;
                          final displayLabel =
                              item.isEmpty ? widget.emptyLabel : item;

                          return ListTile(
                            dense: true,
                            title: Text(
                              displayLabel,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: isSelected
                                    ? FontWeight.bold
                                    : FontWeight.normal,
                                color: isSelected ? AppTheme.accent : null,
                              ),
                            ),
                            trailing: isSelected
                                ? const Icon(Icons.check,
                                    color: AppTheme.accent, size: 20)
                                : null,
                            onTap: () {
                              widget.onSelected(item);
                              Navigator.of(context).pop();
                            },
                          );
                        },
                      ),
              ),
            ],
          ),
        );
      },
    );
  }
}
