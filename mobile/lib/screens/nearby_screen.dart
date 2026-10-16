import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/screens/detail_screen.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/services/device_location.dart';
import 'package:otopiyasa/widgets/listing_image.dart';

/// Araç sınıfı filtresi: etiket ve sunucudaki vehicleClass değeri (null = hepsi).
const _classChips = <(String, String?)>[
  ('Tümü', null),
  ('Otomobil', 'otomobil'),
  ('Arazi / SUV', 'suv-pickup'),
  ('Minivan', 'minivan-panelvan'),
  ('Ticari', 'ticari'),
];

/// Sıralama: etiket ve sunucudaki sort değeri.
const _sortOptions = <(String, String)>[
  ('En yakın', 'distance'),
  ('En ucuz', 'priceAsc'),
  ('En pahalı', 'priceDesc'),
];

/// "Yakınımdaki ilanlar": cihaz konumunun 10 km içindeki tüm ilanlar, sonsuz kaydırmayla.
/// Mesafeler ilanın ilçe (bilinmiyorsa il) merkezine göre yaklaşıktır: gerçek GPS koordinatı yoktur.
class NearbyScreen extends StatefulWidget {
  const NearbyScreen({super.key});

  @override
  State<NearbyScreen> createState() => _NearbyScreenState();
}

class _NearbyScreenState extends State<NearbyScreen> {
  static const _radiusKm = 10.0;

  /// En yakın ilan bu kadar uzaksa cihaz konumu Türkiye dışında (ya da yanlış) demektir.
  static const _farAwayKm = 500;

  final _api = ApiService();
  final _money = NumberFormat.decimalPattern('tr_TR');
  final _scroll = ScrollController();

  double? _lat;
  double? _lng;
  final List<Map<String, dynamic>> _items = [];
  int _page = 0;
  int _total = 0;

  /// Mesafesi hesaplanamayan (yalnızca il düzeyinde konumlu) ilan sayısı; listede yer almaz.
  int _withoutDistrict = 0;
  bool _hasMore = false;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  String? _vehicleClass;
  String _sort = 'distance';

  /// Yenileme ya da filtre değişiminde artar; eski (geciken) yanıt listeyi bozmasın diye.
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _reload();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_hasMore || _loadingMore || _loading) return;
    if (_scroll.position.extentAfter < 400) _loadMore();
  }

  /// İlk sayfa: yenileme (konum yeniden alınır) ya da filtre/sıralama değişimi (konum aynı kalır).
  Future<void> _reload({bool refreshLocation = true}) async {
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      if (refreshLocation || _lat == null || _lng == null) {
        final position = await currentDevicePosition();
        _lat = position.latitude;
        _lng = position.longitude;
      }
      final page = await _api.fetchNearbyPage(
        lat: _lat!,
        lng: _lng!,
        page: 1,
        radiusKm: _radiusKm,
        vehicleClass: _vehicleClass,
        sort: _sort,
      );
      if (!mounted || generation != _generation) return;
      setState(() {
        _items
          ..clear()
          ..addAll(page.items);
        _page = 1;
        _total = page.total;
        _withoutDistrict = page.withoutDistrict;
        _hasMore = page.hasMore;
      });
    } on LocationServiceDisabledException {
      if (!mounted || generation != _generation) return;
      setState(() => _error = 'Konum servisleri kapalı. Cihaz ayarlarından konumu açıp tekrar dene.');
    } on PermissionDeniedException {
      if (!mounted || generation != _generation) return;
      setState(() => _error = 'Konum izni verilmedi.');
    } catch (e) {
      if (!mounted || generation != _generation) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted && generation == _generation) setState(() => _loading = false);
    }
  }

  /// Sonraki sayfa. Hata olursa mevcut liste yerinde kalır; kullanıcı kaydırarak yeniden dener.
  Future<void> _loadMore() async {
    final lat = _lat;
    final lng = _lng;
    if (lat == null || lng == null) return;
    final generation = _generation;
    setState(() => _loadingMore = true);
    try {
      final page = await _api.fetchNearbyPage(
        lat: lat,
        lng: lng,
        page: _page + 1,
        radiusKm: _radiusKm,
        vehicleClass: _vehicleClass,
        sort: _sort,
      );
      if (!mounted || generation != _generation) return;
      setState(() {
        _items.addAll(page.items);
        _page += 1;
        _total = page.total;
        _hasMore = page.hasMore;
      });
    } catch (_) {
      if (!mounted || generation != _generation) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Daha fazla ilan yüklenemedi. Aşağı kaydırarak tekrar dene.')),
      );
    } finally {
      if (mounted && generation == _generation) setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Yakınımdaki ilanlar')),
      body: Column(
        children: [
          _filterBar(),
          Expanded(child: _body()),
        ],
      ),
    );
  }

  Widget _filterBar() {
    return SizedBox(
      height: 52,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        children: [
          for (final (label, value) in _classChips)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(label),
                selected: _vehicleClass == value,
                onSelected: (selected) {
                  if (!selected || _vehicleClass == value) return;
                  setState(() => _vehicleClass = value);
                  _reload(refreshLocation: false);
                },
              ),
            ),
        ],
      ),
    );
  }

  Widget _body() {
    if (_loading && _items.isEmpty) return const Center(child: CircularProgressIndicator());
    if (_error != null && _items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: () => _reload(), child: const Text('Tekrar dene')),
            ],
          ),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: () => _reload(),
      child: ListView(
        controller: _scroll,
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        children: [
          _summary(),
          if (_nearestKm > _farAwayKm) _farAwayNotice(),
          if (_items.isEmpty && !_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: Text(
                'Bu filtreyle 10 km içinde ilan bulunamadı.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white60),
              ),
            ),
          ..._grouped(),
          _footer(),
        ],
      ),
    );
  }

  /// Özet satırı: sayı solda, sıralama düğmesi sağda (filtre çubuğunun hemen altında).
  Widget _summary() {
    final sortLabel = _sortOptions.firstWhere((o) => o.$2 == _sort).$1;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '10 km içinde ${_money.format(_total)} ilan',
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                ),
              ),
              PopupMenuButton<String>(
                tooltip: 'Sırala',
                initialValue: _sort,
                onSelected: (value) {
                  if (value == _sort) return;
                  setState(() => _sort = value);
                  _reload(refreshLocation: false);
                },
                itemBuilder: (_) => [
                  for (final (label, value) in _sortOptions) PopupMenuItem(value: value, child: Text(label)),
                ],
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: Colors.white24),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.sort, size: 16),
                      const SizedBox(width: 6),
                      Text(sortLabel, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
                      const Icon(Icons.arrow_drop_down, size: 18),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Mesafeler ilçe (bilinmiyorsa il) merkezine göre yaklaşıktır.',
            style: TextStyle(fontSize: 12, color: Colors.white54),
          ),
          if (_withoutDistrict > 0) ...[
            const SizedBox(height: 4),
            Text(
              'İlçesi belirtilmeyen ${_money.format(_withoutDistrict)} ilanın mesafesi hesaplanamadığı için listelenmiyor.',
              style: const TextStyle(fontSize: 12, color: Colors.white54),
            ),
          ],
        ],
      ),
    );
  }

  Widget _footer() {
    if (_loadingMore) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (!_hasMore && _items.isNotEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(
          child: Text('Tüm ilanlar gösterildi', style: TextStyle(fontSize: 12, color: Colors.white38)),
        ),
      );
    }
    return const SizedBox.shrink();
  }

  double get _nearestKm => _items.isEmpty ? 0 : ((_items.first['distanceKm'] as num?)?.toDouble() ?? 0);

  Widget _farAwayNotice() {
    final km = NumberFormat.decimalPatternDigits(locale: 'tr_TR', decimalDigits: 0).format(_nearestKm);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFB923C).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFB923C).withValues(alpha: 0.4)),
      ),
      child: Text(
        'Konumun Türkiye dışında görünüyor: en yakın ilan $km km uzakta. '
        'Konum ayarını kontrol edip aşağı çekerek yenileyebilirsin.',
        style: const TextStyle(fontSize: 12.5, color: Color(0xFFFDBA74)),
      ),
    );
  }

  /// Aynı ilçedeki ilanların mesafesi eşit olduğundan, her ilana tekrar yazmak yerine ilçe başlığı altında toplanır.
  List<Widget> _grouped() {
    final out = <Widget>[];
    String? lastKey;
    for (final item in _items) {
      final place = [item['district'], item['city']]
          .map((e) => e?.toString() ?? '')
          .where((e) => e.isNotEmpty)
          .toSet()
          .join(', ');
      final km = (item['distanceKm'] as num?)?.toDouble() ?? 0;
      final key = '$place|$km';
      if (key != lastKey) {
        lastKey = key;
        out.add(Padding(
          padding: const EdgeInsets.only(top: 12, bottom: 8),
          child: Row(
            children: [
              const Icon(Icons.place_outlined, size: 18, color: Color(0xFFF5B942)),
              const SizedBox(width: 6),
              Expanded(
                child: Text(place.isEmpty ? 'Konum' : place, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
              ),
              Text(
                '${item['approximate'] == true ? '~' : ''}${km.toStringAsFixed(1).replaceAll('.', ',')} km',
                style: const TextStyle(fontSize: 13, color: Colors.white70, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ));
      }
      out.add(_card(item));
    }
    return out;
  }

  Widget _card(Map<String, dynamic> item) {
    final images = (item['images'] as List<dynamic>? ?? []).map((e) => e.toString()).toList();
    final mileage = (item['mileage'] as num?)?.toInt() ?? 0;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => DetailScreen(carId: item['_id'].toString())),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 130,
              height: 96,
              child: ListingImage(url: item['imageUrl']?.toString() ?? '', fallbacks: images, cacheWidth: 320),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item['title']?.toString() ?? '',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      ['${item['year'] ?? ''}', if (mileage > 0) '${_money.format(mileage)} km'].join(' • '),
                      style: const TextStyle(fontSize: 12, color: Colors.white60),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${_money.format(item['price'] ?? 0)} ₺',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFFF5B942)),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
