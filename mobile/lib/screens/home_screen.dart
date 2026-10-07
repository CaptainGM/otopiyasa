import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/utils/tr_text.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/screens/notifications_screen.dart';
import 'package:otopiyasa/screens/assistant_screen.dart';
import 'package:otopiyasa/widgets/home_strips.dart';
import 'package:otopiyasa/services/api_service.dart';
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

/// Araç tipleri (bkz. src/lib/vehicle-scope.ts VEHICLE_CLASSES).
const _vehicleClasses = [
  ('otomobil', 'Otomobil'),
  ('suv-pickup', 'Arazi, SUV & Pickup'),
  ('minivan-panelvan', 'Minivan & Panelvan'),
  ('ticari', 'Ticari'),
  ('motosiklet', 'Motosiklet'),
  ('karavan', 'Karavan'),
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
  final _random = Random.secure();
  // Keşfet: sunucu 15 dakikada bir dönen 24 "dilim" verir (CDN'de saklanır, web ile aynı, bkz.
  // src/lib/car-mix.ts). Her yenileme rastgele başka bir dilim seçer ve gelen ilanları kendi içinde
  // karıştırır: her açılışta farklı ilanlar/sıra, sunucuya kullanıcı başına ek yük yok.
  static const _feedSlots = 24;
  static const _feedRotateMs = 15 * 60 * 1000;
  int _feedSlot = -1;
  int _feedBucket = 0;

  void _pickFeedSlot() {
    var slot = _random.nextInt(_feedSlots);
    while (slot == _feedSlot) {
      slot = _random.nextInt(_feedSlots);
    }
    _feedSlot = slot;
    _feedBucket = DateTime.now().millisecondsSinceEpoch ~/ _feedRotateMs;
  }

  bool get _isFeed => _sort == 'mixed' && _searchController.text.trim().isEmpty;

  String _brand = '';
  String _model = '';
  String _fuelType = '';
  String _transmission = '';
  String _sort = 'mixed';
  String _vehicleClass = '';
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
      // Model aileleri ("Juke" tüm Juke donanımlarını bulur); eski sunucuda tam model listesi.
      final rawModels = (data['brandFamilies'] ?? data['brandModels']) as Map<String, dynamic>? ?? {};
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
      _pickFeedSlot();
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
        vehicleClass: _vehicleClass,
        discountOnly: _discountOnly,
        page: nextPage,
        slot: _isFeed ? _feedSlot : null,
        bucket: _isFeed ? _feedBucket : null,
      );
      if (!mounted || requestId != _carsRequestId) return;
      final incoming = [...data.items];
      if (_isFeed) incoming.shuffle(_random);
      setState(() {
        if (reset) _cars.clear();
        final known = _cars.map((c) => c.id).toSet();
        _cars.addAll(incoming.where((c) => !known.contains(c.id)));
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

  /// Seçili filtre sayısı (arama kutusu hariç): filtre düğmesindeki rozet.
  int get _filterCount =>
      [_brand, _model, _fuelType, _transmission].where((v) => v.isNotEmpty).length +
      (_discountOnly ? 1 : 0) +
      (_sort != 'mixed' ? 1 : 0);

  Widget _filterButton() {
    final c = AppColors.of(context);
    final count = _filterCount;
    return SizedBox(
      height: 50,
      child: OutlinedButton(
        onPressed: _openFilters,
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          side: BorderSide(color: count > 0 ? AppTheme.accent : c.border),
          backgroundColor: Theme.of(context).inputDecorationTheme.fillColor,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.tune, size: 20, color: count > 0 ? AppTheme.accent : null),
            if (count > 0) ...[
              const SizedBox(width: 6),
              Text('$count', style: AppText.num(size: 13, weight: FontWeight.w600, color: AppTheme.accent)),
            ],
          ],
        ),
      ),
    );
  }

  /// Araç tipi şeridi (web'deki ana sayfa çipleriyle aynı). Seçilince liste o tiple süzülür.
  Widget _vehicleClassChips() {
    final onSurface = Theme.of(context).colorScheme.onSurface;
    return SizedBox(
      height: 36,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (final entry in [('', 'Tümü'), ..._vehicleClasses]) ...[
            ChoiceChip(
              label: Text(entry.$2),
              selected: _vehicleClass == entry.$1,
              labelStyle: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: _vehicleClass == entry.$1 ? Theme.of(context).scaffoldBackgroundColor : AppColors.of(context).muted,
              ),
              selectedColor: onSurface,
              side: BorderSide(color: _vehicleClass == entry.$1 ? onSurface : AppColors.of(context).border),
              onSelected: (_) {
                if (_vehicleClass == entry.$1) return;
                HapticFeedback.selectionClick();
                setState(() => _vehicleClass = entry.$1);
                _loadCars(reset: true);
              },
            ),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }

  /// Marka, model, yakıt, vites, sıralama ve "fiyatı düşenler": eskiden ana sayfanın üstünde sürekli açık duran
  /// form duvarıydı; artık tek düğmeyle açılan alt sayfa. Seçimler anında uygulanır (liste arkada yenilenir).
  Future<void> _openFilters() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheet) {
          void refresh(VoidCallback change) {
            change();
            setSheet(() {});
            setState(() {});
          }

          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('FİLTRELER', style: AppText.eyebrow(context)),
                  const SizedBox(height: 2),
                  Text('Aradığın aracı daralt', style: AppText.display(size: 19)),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _searchablePickerButton(
                          label: 'Marka',
                          value: _brand,
                          options: _brands,
                          isBrand: true,
                          onChanged: (value) => refresh(() {
                            _brand = value;
                            _model = '';
                          }),
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
                          onChanged: (value) => refresh(() => _model = value),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: _filterDropdown(
                          key: ValueKey('fuel-$_fuelType'),
                          label: 'Yakıt',
                          value: _fuelType,
                          options: _fuelTypes,
                          onChanged: (value) => refresh(() => _fuelType = value),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _filterDropdown(
                          key: ValueKey('gear-$_transmission'),
                          label: 'Vites',
                          value: _transmission,
                          options: _transmissions,
                          onChanged: (value) => refresh(() => _transmission = value),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    key: ValueKey('sort-$_sort'),
                    initialValue: _sort,
                    isDense: true,
                    decoration: const InputDecoration(labelText: 'Sıralama'),
                    items: _sorts.entries
                        .map((entry) => DropdownMenuItem(value: entry.key, child: Text(entry.value, style: const TextStyle(fontSize: 14))))
                        .toList(),
                    onChanged: (selected) {
                      if (selected == null) return;
                      refresh(() => _sort = selected);
                      _loadCars(reset: true);
                    },
                  ),
                  const SizedBox(height: 6),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    value: _discountOnly,
                    activeThumbColor: AppTheme.accent,
                    title: const Text('Yalnızca fiyatı düşenler', style: TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(
                      'Yayındayken fiyatı indirilmiş ilanlar',
                      style: TextStyle(color: AppColors.of(context).muted, fontSize: 12),
                    ),
                    onChanged: (value) {
                      refresh(() => _discountOnly = value);
                      _loadCars(reset: true);
                    },
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _filterCount == 0
                              ? null
                              : () {
                                  refresh(() {
                                    _brand = '';
                                    _model = '';
                                    _fuelType = '';
                                    _transmission = '';
                                    _sort = 'mixed';
                                    _discountOnly = false;
                                  });
                                  _loadCars(reset: true);
                                },
                          child: const Text('Temizle'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton(
                          onPressed: () => Navigator.of(sheetContext).pop(),
                          child: Text(_loading ? 'Yükleniyor…' : '${NumberFormat.decimalPattern('tr_TR').format(_total)} ilanı göster'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _resultsHeader() {
    final c = AppColors.of(context);
    final label = _vehicleClasses.where((e) => e.$1 == _vehicleClass).map((e) => e.$2).firstOrNull;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          trUpper(_isFeed && !_hasActiveFilters ? 'Keşfet · karışık sıra' : 'Sonuçlar'),
          style: AppText.eyebrow(context),
        ),
        const SizedBox(height: 2),
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Flexible(
              child: Text(
                label ?? (_hasActiveFilters ? 'Eşleşen ilanlar' : 'Tüm ilanlar'),
                style: AppText.display(size: 21),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              _loading ? '…' : NumberFormat.decimalPattern('tr_TR').format(_total),
              style: AppText.num(size: 15, color: c.muted),
            ),
          ],
        ),
      ],
    );
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
    Key? key,
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
      key: key,
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
        titleSpacing: 14,
        title: const AppLogo(),
        actions: [
          ValueListenableBuilder<int>(
            valueListenable: _api.authRevision,
            builder: (context, _, _) => _api.isLoggedIn
                ? IconButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                    ),
                    icon: const Icon(Icons.notifications_outlined, size: 22),
                    tooltip: 'Bildirimler',
                  )
                : const SizedBox.shrink(),
          ),
          IconButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const AssistantScreen()),
            ),
            icon: const Icon(Icons.auto_awesome_outlined, size: 22, color: AppTheme.accent),
            tooltip: 'Asistana sor',
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () {
          HapticFeedback.mediumImpact();
          return _loadCars(reset: true);
        },
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
                    textInputAction: TextInputAction.search,
                    decoration: InputDecoration(
                      hintText: 'Marka, model, şehir ara…',
                      prefixIcon: const Icon(Icons.search, size: 21),
                      suffixIcon: _searchController.text.isEmpty
                          ? null
                          : IconButton(
                              icon: const Icon(Icons.close, size: 18),
                              onPressed: () {
                                _searchController.clear();
                                _loadCars(reset: true);
                              },
                            ),
                    ),
                    onChanged: (_) => setState(() {}),
                    onSubmitted: (_) => _loadCars(reset: true),
                  ),
                ),
                const SizedBox(width: 8),
                _filterButton(),
              ],
            ),
            const SizedBox(height: 12),
            _vehicleClassChips(),
            const SizedBox(height: 18),
            if (!_hasActiveFilters && _vehicleClass.isEmpty) ...[
              const NearbyPrompt(),
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
              _resultsHeader(),
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
                    separatorBuilder: (_, _) => const SizedBox(width: 8),
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
