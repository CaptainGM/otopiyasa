import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/screens/detail_screen.dart';
import 'package:otopiyasa/services/device_location.dart';

/// HARİTA — web'deki `/map` sayfasının mobil karşılığı.
///
/// Sunucu ilanları KÜME olarak döndürüyor (il/ilçe bazında adet + en düşük fiyat). Uzak
/// görünümde ilçeler il bazında toplanır; ekranda üst üste binen işaretçilerden yalnızca
/// en kalabalıkları tam kart olarak çizilir, diğerleri küçük noktaya dönüşür (dokununca
/// yakınlaşır). İşarete tıklanınca bölgedeki araçlar alttan açılan listede gösterilir.
class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

/// Ekrana çizilecek tek bir küme (il özeti ya da ilçe).
class _Spot {
  _Spot({
    required this.point,
    required this.count,
    required this.minPrice,
    required this.label,
    required this.key,
    required this.summary,
    required this.provinceOnly,
  });

  final LatLng point;
  final int count;
  final int minPrice;
  final String label;
  final String key;

  /// Uzak görünümde ilin tüm ilçelerini temsil eden özet (dokununca yakınlaşır).
  final bool summary;

  /// İlçesi bilinmeyen "il geneli" kümesi.
  final bool provinceOnly;
}

class _MapScreenState extends State<MapScreen> {
  final _api = ApiService();
  final _money = NumberFormat.decimalPattern('tr_TR');
  final _mapController = MapController();
  // "Konumum": cihaz konumu haritada mavi nokta olarak gösterilir, harita oraya yaklaşır.
  LatLng? _me;
  bool _locating = false;

  List<Map<String, dynamic>> _clusters = [];
  List<String> _brandOptions = [];
  List<String> _cityOptions = [];
  List<String> _fuelOptions = [];
  Map<String, List<String>> _brandModels = {};
  bool _loading = true;
  String? _error;

  String? _brand;
  String? _model;
  String? _city;
  String? _fuel;
  int? _minPrice;
  int? _maxPrice;
  bool _discountOnly = false;

  /// Bu yakınlığın altında ilçeler il bazında toplanır.
  static const double _districtZoom = 7.0;

  /// Dikey telefon ekranında Türkiye'nin genişliği (~19 boylam) bu yakınlıkta sığar.
  static const _turkeyCenter = LatLng(39.0, 35.3);
  static const double _turkeyZoom = 5.0;

  static const Size _provinceSize = Size(92, 40);
  static const Size _districtSize = Size(100, 50);
  static const double _dotSize = 12;

  @override
  void initState() {
    super.initState();
    _load();
    _api.fetchBrandModels().then((data) {
      final raw = (data['brandFamilies'] ?? data['brandModels']) as Map<String, dynamic>? ?? {};
      if (!mounted) return;
      setState(() {
        _brandModels = raw.map((k, v) => MapEntry(k, (v as List<dynamic>).map((e) => e.toString()).toList()));
      });
    }).catchError((_) {});
  }

  bool get _hasActiveFilters =>
      _brand != null || _model != null || _city != null || _fuel != null || _minPrice != null || _maxPrice != null || _discountOnly;

  /// Bölge listesine de aynı filtreler gider; yoksa filtreli haritada tıklanan bölge filtresiz ilanları gösterirdi.
  Map<String, String> get _filterParams => {
        'brand': ?_brand,
        if (_brand != null && _model != null) 'model': _model!,
        'city': ?_city,
        'fuel': ?_fuel,
        if (_minPrice != null) 'minPrice': '$_minPrice',
        if (_maxPrice != null) 'maxPrice': '$_maxPrice',
        if (_discountOnly) 'discountOnly': 'true',
      };

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await _api.fetchMap(
        brand: _brand,
        model: _model,
        city: _city,
        fuel: _fuel,
        minPrice: _minPrice,
        maxPrice: _maxPrice,
        discountOnly: _discountOnly,
      );
      if (!mounted) return;
      final options = data['options'] as Map<String, dynamic>? ?? {};
      List<String> list(String key) => (options[key] as List<dynamic>? ?? []).map((e) => e.toString()).toList();
      setState(() {
        _clusters = (data['clusters'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
        _brandOptions = list('brands');
        _cityOptions = list('cities');
        _fuelOptions = list('fuels');
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  /// 1.250.000 → "1,3 mn" / 850.000 → "850 bin"
  String _shortPrice(num price) {
    if (price >= 1000000) {
      return '${(price / 1000000).toStringAsFixed(1).replaceAll('.', ',')} mn';
    }
    if (price >= 1000) return '${(price / 1000).round()} bin';
    return price.toString();
  }

  List<_Spot> _districtSpots() => _clusters.map((c) {
        final count = (c['count'] as num?)?.toInt() ?? 0;
        final provinceOnly = c['level'] == 'province' && (c['district']?.toString().isEmpty ?? true);
        // districtLabel: sunucunun verdiği Türkçe yazılış ("Çerkezköy"); eski sunucuda yoksa ham ad.
        final districtName = (c['districtLabel'] ?? c['district'])?.toString() ?? '';
        return _Spot(
          point: LatLng((c['lat'] as num?)?.toDouble() ?? 0, (c['lng'] as num?)?.toDouble() ?? 0),
          count: count,
          minPrice: (c['minPrice'] as num?)?.toInt() ?? 0,
          label: districtName.isNotEmpty ? districtName : '${c['city']} (il geneli)',
          key: c['key']?.toString() ?? '',
          summary: false,
          provinceOnly: provinceOnly,
        );
      }).toList();

  /// İlçe kümelerini il bazında birleştirir (konum: ilan sayısına göre ağırlıklı ortalama).
  List<_Spot> _provinceSpots() {
    final byCity = <String, List<double>>{};
    final minPrices = <String, int>{};
    for (final c in _clusters) {
      final city = c['city']?.toString() ?? '';
      final count = (c['count'] as num?)?.toDouble() ?? 0;
      final acc = byCity.putIfAbsent(city, () => [0, 0, 0]);
      acc[0] += count;
      acc[1] += ((c['lat'] as num?)?.toDouble() ?? 0) * count;
      acc[2] += ((c['lng'] as num?)?.toDouble() ?? 0) * count;
      final price = (c['minPrice'] as num?)?.toInt() ?? 0;
      final current = minPrices[city] ?? 0;
      if (price > 0 && (current == 0 || price < current)) minPrices[city] = price;
    }
    return byCity.entries.where((e) => e.value[0] > 0).map((e) {
      final count = e.value[0];
      return _Spot(
        point: LatLng(e.value[1] / count, e.value[2] / count),
        count: count.round(),
        minPrice: minPrices[e.key] ?? 0,
        label: e.key,
        key: '${e.key}|',
        summary: true,
        provinceOnly: false,
      );
    }).toList();
  }

  /// Çakışan işaretçileri ayıklar: en kalabalık küme önce yerleşir, ekranda başka bir kartla
  /// çakışan küme küçük noktaya dönüşür. Göreli konumlar yalnızca yakınlığa bağlı olduğundan
  /// sonuç kaydırmada değişmez.
  List<Marker> _buildMarkers(MapCamera camera) {
    final summary = camera.zoom < _districtZoom;
    final spots = (summary ? _provinceSpots() : _districtSpots())..sort((a, b) => b.count.compareTo(a.count));
    final size = summary ? _provinceSize : _districtSize;
    final placed = <Rect>[];
    final full = <Marker>[];
    final dots = <Marker>[];
    // Kart önce tam konumuna, çakışırsa hemen üstüne/altına/yanlarına denenir (gerçek konumda nokta kalır).
    final offsets = [
      Offset.zero,
      Offset(0, -size.height * 0.8),
      Offset(0, size.height * 0.8),
      Offset(size.width * 0.75, 0),
      Offset(-size.width * 0.75, 0),
    ];
    for (final spot in spots) {
      final p = camera.latLngToScreenPoint(spot.point);
      final origin = Offset(p.x, p.y);
      Offset? chosen;
      for (final o in offsets) {
        final rect = Rect.fromCenter(center: origin + o, width: size.width + 6, height: size.height + 6);
        if (!placed.any((r) => r.overlaps(rect))) {
          placed.add(rect);
          chosen = o;
          break;
        }
      }
      if (chosen == null) {
        dots.add(_dotMarker(spot, camera.zoom));
        continue;
      }
      final at = chosen == Offset.zero
          ? spot.point
          : camera.pointToLatLng(math.Point(origin.dx + chosen.dx, origin.dy + chosen.dy));
      if (chosen != Offset.zero) dots.add(_dotMarker(spot, camera.zoom));
      full.add(summary ? _provinceMarker(spot, at) : _districtMarker(spot, at));
    }
    // Noktalar kartların altında kalsın.
    return [...dots, ...full.reversed];
  }

  Future<void> _locateMe() async {
    if (_locating) return;
    HapticFeedback.selectionClick();
    setState(() => _locating = true);
    try {
      final position = await currentDevicePosition();
      if (!mounted) return;
      final me = LatLng(position.latitude, position.longitude);
      setState(() => _me = me);
      _mapController.move(me, 11);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))));
      }
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  void _zoomInto(LatLng point, double zoom) {
    HapticFeedback.selectionClick();
    _mapController.move(point, zoom);
  }

  Marker _dotMarker(_Spot spot, double zoom) {
    final color = _densityColor(spot.count);
    return Marker(
      point: spot.point,
      width: _dotSize + 16,
      height: _dotSize + 16,
      child: GestureDetector(
        onTap: () => _zoomInto(spot.point, math.min(zoom + 2, 16)),
        child: Center(
          child: Container(
            width: _dotSize,
            height: _dotSize,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.85),
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFF0A0F18), width: 2),
            ),
          ),
        ),
      ),
    );
  }

  Marker _provinceMarker(_Spot spot, LatLng at) {
    final color = _densityColor(spot.count);
    return Marker(
      point: at,
      width: _provinceSize.width,
      height: _provinceSize.height,
      child: GestureDetector(
        onTap: () => _zoomInto(spot.point, _districtZoom + 1.2),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: const Color(0xF00A0F18),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: color, width: 1.5),
            boxShadow: [BoxShadow(color: color.withValues(alpha: 0.25), blurRadius: 6)],
          ),
          child: FittedBox(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(spot.label, style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w700)),
                Text('${_money.format(spot.count)} ilan',
                    style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w900)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Marker _districtMarker(_Spot spot, LatLng at) {
    final color = _densityColor(spot.count);
    return Marker(
      point: at,
      width: _districtSize.width,
      height: _districtSize.height,
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          if (spot.provinceOnly && _mapController.camera.zoom < 8.0) {
            _mapController.move(spot.point, 9.5);
          } else {
            _showClusterCars(spot.label, spot.key, spot.count, spot.minPrice);
          }
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
          decoration: BoxDecoration(
            color: const Color(0xF00A0F18),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color, width: 1.5),
            boxShadow: [BoxShadow(color: color.withValues(alpha: 0.25), blurRadius: 8, offset: const Offset(0, 2))],
          ),
          child: FittedBox(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(spot.label, style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w700)),
                Text('${_money.format(spot.count)} ilan',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11, color: color)),
                Text("${_shortPrice(spot.minPrice)} ₺'den", style: const TextStyle(fontSize: 9, color: Colors.white54)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// OSM karolarını gri tonlayıp ters çevirir: uygulamanın koyu temasına uyan sade altlık.
  Widget _darkTile(BuildContext context, Widget tileWidget, TileImage tile) => ColorFiltered(
        colorFilter: const ColorFilter.matrix(<double>[
          -0.17, -0.57, -0.06, 0, 225, //
          -0.17, -0.57, -0.06, 0, 228,
          -0.17, -0.57, -0.06, 0, 238,
          0, 0, 0, 1, 0,
        ]),
        child: tileWidget,
      );

  Color _densityColor(int count) {
    if (count >= 500) return const Color(0xFFF59E0B); // Amber / Gold
    if (count >= 50) return const Color(0xFF10B981); // Emerald
    return const Color(0xFF6366F1); // Indigo
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _clusters.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('İlan Haritası')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null && _clusters.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('İlan Haritası')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_error!),
                const SizedBox(height: 12),
                FilledButton(onPressed: _load, child: const Text('Tekrar Dene')),
              ],
            ),
          ),
        ),
      );
    }

    final total = _clusters.fold<int>(0, (sum, c) => sum + ((c['count'] as num?)?.toInt() ?? 0));

    return Scaffold(
      appBar: AppBar(
        title: const Text('İlan Haritası'),
        actions: [
          if (_hasActiveFilters)
            IconButton(
              tooltip: 'Filtreleri temizle',
              icon: const Icon(Icons.filter_alt_off_outlined),
              onPressed: () {
                setState(() {
                  _brand = null;
                  _model = null;
                  _city = null;
                  _fuel = null;
                  _minPrice = null;
                  _maxPrice = null;
                  _discountOnly = false;
                });
                _load();
              },
            ),
          IconButton(
            tooltip: 'Filtrele',
            icon: Icon(_hasActiveFilters ? Icons.filter_alt : Icons.filter_alt_outlined),
            onPressed: _openFilters,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(26),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (_loading)
                  const SizedBox(width: 10, height: 10, child: CircularProgressIndicator(strokeWidth: 1.5))
                else
                  Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle),
                  ),
                const SizedBox(width: 6),
                Text(
                  '${_money.format(total)} aktif ilan • ${_clusters.length} bölge',
                  style: const TextStyle(fontSize: 12, color: Colors.white70, fontWeight: FontWeight.bold),
                ),
                if (_discountOnly) ...[
                  const SizedBox(width: 8),
                  const Text('• İndirimli', style: TextStyle(fontSize: 11, color: Color(0xFFF59E0B))),
                ],
              ],
            ),
          ),
        ),
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: const MapOptions(
              initialCenter: _turkeyCenter,
              initialZoom: _turkeyZoom,
              minZoom: 4.5,
              maxZoom: 16.0,
            ),
            children: [
              // Carto'nun ücretsiz karoları artık API anahtarı istiyor ("API KEY REQUIRED" karosu
              // dönüyordu); web'deki haritayla aynı OpenStreetMap karoları, koyu temaya uyacak
              // şekilde gri tonlanıp ters çevrilerek kullanılır.
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.otopiyasa.otopiyasa',
                tileBuilder: _darkTile,
              ),
              // Kamera değiştikçe (yakınlaştırma) çakışma ayıklaması yeniden hesaplanır.
              Builder(builder: (context) => MarkerLayer(markers: _buildMarkers(MapCamera.of(context)))),
              if (_me != null)
                MarkerLayer(markers: [
                  Marker(
                    point: _me!,
                    width: 26,
                    height: 26,
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF3B82F6),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 3),
                        boxShadow: const [BoxShadow(color: Color(0x663B82F6), blurRadius: 0, spreadRadius: 6)],
                      ),
                    ),
                  ),
                ]),
              // OSM karo kullanım koşulu: kaynak belirtilmeli.
              const SimpleAttributionWidget(
                source: Text('OpenStreetMap katkıcıları', style: TextStyle(fontSize: 10, color: Colors.white70)),
                backgroundColor: Color(0x99000000),
              ),
            ],
          ),
          Positioned(
            top: 16,
            left: 16,
            child: FloatingActionButton.extended(
              heroTag: 'reset_map',
              onPressed: () => _zoomInto(_turkeyCenter, _turkeyZoom),
              icon: const Text('🇹🇷', style: TextStyle(fontSize: 14)),
              label: const Text('Tüm Türkiye', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              backgroundColor: const Color(0xF00E1626),
              foregroundColor: Colors.white,
              elevation: 4,
            ),
          ),
          Positioned(
            top: 16,
            right: 16,
            child: FloatingActionButton.small(
              heroTag: 'my_location',
              tooltip: 'Konumum',
              onPressed: _locateMe,
              backgroundColor: const Color(0xF00E1626),
              foregroundColor: Colors.white,
              child: _locating
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.my_location, size: 20),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openFilters() async {
    var brand = _brand;
    var model = _model;
    var city = _city;
    var fuel = _fuel;
    var discountOnly = _discountOnly;
    final minCtrl = TextEditingController(text: _minPrice?.toString() ?? '');
    final maxCtrl = TextEditingController(text: _maxPrice?.toString() ?? '');
    int? parsePrice(String s) {
      final v = int.tryParse(s.replaceAll(RegExp(r'\D'), ''));
      return v == null || v <= 0 ? null : v;
    }

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 20),
        child: StatefulBuilder(
          builder: (context, setSheetState) {
            final models = brand == null ? const <String>[] : (_brandModels[brand] ?? const <String>[]);
            return SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Haritayı Filtrele',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white)),
                      IconButton(icon: const Icon(Icons.close, color: Colors.white54), onPressed: () => Navigator.pop(context)),
                    ],
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Fiyatı Düşenler', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                    subtitle: const Text('Sadece indirimli fırsat araçları göster',
                        style: TextStyle(fontSize: 12, color: Colors.white54)),
                    value: discountOnly,
                    activeThumbColor: const Color(0xFFF59E0B),
                    onChanged: (v) => setSheetState(() => discountOnly = v),
                  ),
                  const Divider(color: Colors.white10),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String?>(
                    initialValue: brand,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Marka'),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('Tüm Markalar')),
                      ..._brandOptions.map((b) => DropdownMenuItem(value: b, child: Text(b))),
                    ],
                    onChanged: (v) => setSheetState(() {
                      brand = v;
                      model = null;
                    }),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String?>(
                    key: ValueKey('model-$brand'),
                    initialValue: models.contains(model) ? model : null,
                    isExpanded: true,
                    decoration: InputDecoration(labelText: 'Model', enabled: models.isNotEmpty),
                    items: [
                      DropdownMenuItem(value: null, child: Text(brand == null ? 'Önce marka seçin' : 'Tüm Modeller')),
                      ...models.map((m) => DropdownMenuItem(value: m, child: Text(m))),
                    ],
                    onChanged: models.isEmpty ? null : (v) => setSheetState(() => model = v),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String?>(
                    initialValue: city,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Şehir'),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('Tüm Şehirler')),
                      ..._cityOptions.map((c) => DropdownMenuItem(value: c, child: Text(c))),
                    ],
                    onChanged: (v) => setSheetState(() => city = v),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String?>(
                    initialValue: fuel,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Yakıt'),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('Tüm Yakıtlar')),
                      ..._fuelOptions.map((f) => DropdownMenuItem(value: f, child: Text(f))),
                    ],
                    onChanged: (v) => setSheetState(() => fuel = v),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: minCtrl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Min fiyat (₺)', hintText: '0'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: maxCtrl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Maks fiyat (₺)', hintText: 'Sınırsız'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () {
                        HapticFeedback.lightImpact();
                        Navigator.pop(context);
                        setState(() {
                          _brand = brand;
                          _model = brand == null ? null : model;
                          _city = city;
                          _fuel = fuel;
                          _minPrice = parsePrice(minCtrl.text);
                          _maxPrice = parsePrice(maxCtrl.text);
                          _discountOnly = discountOnly;
                        });
                        _load();
                      },
                      child: const Text('Filtreleri Uygula', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  void _showClusterCars(String label, String clusterKey, int count, int minPrice) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.65,
          minChildSize: 0.35,
          maxChildSize: 0.92,
          expand: false,
          builder: (context, scrollController) {
            return Column(
              children: [
                // Handle bar
                Container(
                  margin: const EdgeInsets.only(top: 10, bottom: 6),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),

                // Sheet Header
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            label,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              Text(
                                '$count İlan',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFFF59E0B),
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              if (minPrice > 0) ...[
                                const Text(' • ', style: TextStyle(color: Colors.white38)),
                                Text(
                                  '${_money.format(minPrice)} ₺\'den',
                                  style: const TextStyle(fontSize: 12, color: Color(0xFF10B981), fontWeight: FontWeight.bold),
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.white54),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ],
                  ),
                ),
                const Divider(color: Colors.white10),

                // Vehicle List
                Expanded(
                  child: FutureBuilder<List<Map<String, dynamic>>>(
                    future: _api.fetchMapCars(key: clusterKey, filters: _filterParams),
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      }
                      if (snapshot.hasError) {
                        return Center(
                          child: Padding(
                            padding: const EdgeInsets.all(20),
                            child: Text(
                              'İlanlar yüklenemedi: ${snapshot.error}',
                              style: const TextStyle(color: Colors.white54),
                            ),
                          ),
                        );
                      }
                      final items = snapshot.data ?? [];
                      if (items.isEmpty) {
                        return const Center(
                          child: Text(
                            'Bu bölgede ilan bulunamadı.',
                            style: TextStyle(color: Colors.white54),
                          ),
                        );
                      }

                      return ListView.separated(
                        controller: scrollController,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        itemCount: items.length,
                        separatorBuilder: (context, i) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final car = items[index];
                          final id = car['_id']?.toString() ?? '';
                          final title = car['title']?.toString() ?? '';
                          final year = car['year']?.toString() ?? '';
                          final mileage = (car['mileage'] as num?)?.toInt() ?? 0;
                          final price = (car['price'] as num?)?.toInt() ?? 0;
                          final fuel = car['fuelType']?.toString() ?? '';
                          final transmission = car['transmission']?.toString() ?? '';
                          final imgUrl = car['imageUrl']?.toString() ?? '';
                          final hasDropped = car['hasDropped'] == true;
                          final dropAmount = (car['dropAmount'] as num?)?.toInt() ?? 0;

                          return InkWell(
                            onTap: () {
                              if (id.isNotEmpty) {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => DetailScreen(carId: id),
                                  ),
                                );
                              }
                            },
                            borderRadius: BorderRadius.circular(16),
                            child: Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: const Color(0xFF1E293B).withValues(alpha: 0.6),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: Colors.white10),
                              ),
                              child: Row(
                                children: [
                                  // Thumbnail
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(12),
                                    child: Container(
                                      width: 100,
                                      height: 75,
                                      color: Colors.black26,
                                      child: imgUrl.isNotEmpty
                                          ? Image.network(
                                              imgUrl,
                                              fit: BoxFit.cover,
                                              errorBuilder: (context, error, stackTrace) => const Center(
                                                child: Icon(Icons.directions_car, color: Colors.white38),
                                              ),
                                            )
                                          : const Center(
                                              child: Icon(Icons.directions_car, color: Colors.white38),
                                            ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),

                                  // Info
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          title,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 13,
                                            color: Colors.white,
                                          ),
                                        ),
                                        const SizedBox(height: 3),
                                        Text(
                                          '$year • ${_money.format(mileage)} km • $fuel',
                                          style: const TextStyle(fontSize: 11, color: Colors.white60),
                                        ),
                                        Text(
                                          transmission,
                                          style: const TextStyle(fontSize: 10, color: Colors.white38),
                                        ),
                                        const SizedBox(height: 6),
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                if (hasDropped && dropAmount > 0)
                                                  Text(
                                                    '↓ ${_money.format(dropAmount)} ₺ indirim',
                                                    style: const TextStyle(
                                                      fontSize: 9,
                                                      fontWeight: FontWeight.bold,
                                                      color: Color(0xFF10B981),
                                                    ),
                                                  ),
                                                Text(
                                                  '${_money.format(price)} ₺',
                                                  style: const TextStyle(
                                                    fontSize: 14,
                                                    fontWeight: FontWeight.w900,
                                                    color: Color(0xFFF59E0B),
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const Icon(Icons.chevron_right, color: Colors.white38, size: 18),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      );
                    },
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
