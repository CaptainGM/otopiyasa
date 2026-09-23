import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/screens/detail_screen.dart';

/// HARİTA — web'deki `/map` sayfasının tam donanımlı mobil karşılığı.
///
/// Sunucu ilanları KÜME olarak döndürüyor (il/ilçe bazında adet + en düşük
/// fiyat). Döşemeler CartoDB Dark Matter — web tarafıyla birebir aynı koyu tema.
/// İşarete tıklandığında alttan açılan şık çekmecede bölgedeki araçlar listelenir.
class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final _api = ApiService();
  final _money = NumberFormat.decimalPattern('tr_TR');
  final _mapController = MapController();

  List<Map<String, dynamic>> _clusters = [];
  List<String> _brandOptions = [];
  List<String> _cityOptions = [];
  List<String> _fuelOptions = [];
  bool _loading = true;
  String? _error;

  String? _brand;
  String? _city;
  String? _fuel;
  bool _discountOnly = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  bool get _hasActiveFilters =>
      _brand != null || _city != null || _fuel != null || _discountOnly;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await _api.fetchMap(
        brand: _brand,
        city: _city,
        fuel: _fuel,
        discountOnly: _discountOnly,
      );
      if (!mounted) return;
      final options = data['options'] as Map<String, dynamic>? ?? {};
      setState(() {
        _clusters = (data['clusters'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .toList();
        _brandOptions = (options['brands'] as List<dynamic>? ?? [])
            .map((e) => e.toString())
            .toList();
        _cityOptions = (options['cities'] as List<dynamic>? ?? [])
            .map((e) => e.toString())
            .toList();
        _fuelOptions = (options['fuels'] as List<dynamic>? ?? [])
            .map((e) => e.toString())
            .toList();
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

  /// 1.250.000 → "1,3M" / 850.000 → "850B"
  String _shortPrice(num price) {
    if (price >= 1000000) {
      return '${(price / 1000000).toStringAsFixed(1).replaceAll('.', ',')}M';
    }
    if (price >= 1000) return '${(price / 1000).round()}B';
    return price.toString();
  }

  Color _densityColor(int count) {
    if (count >= 500) return const Color(0xFFF59E0B); // Amber / Gold
    if (count >= 50) return const Color(0xFF10B981); // Emerald
    return const Color(0xFF6366F1); // Indigo
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('İlan Haritası')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null) {
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

    final total = _clusters.fold<int>(
      0,
      (sum, c) => sum + ((c['count'] as num?)?.toInt() ?? 0),
    );

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
                  _city = null;
                  _fuel = null;
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
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    color: Color(0xFF10B981),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  '$total aktif ilan • ${_clusters.length} bölge',
                  style: const TextStyle(fontSize: 12, color: Colors.white70, fontWeight: FontWeight.bold),
                ),
                if (_discountOnly) ...[
                  const SizedBox(width: 8),
                  const Text('• 🔥 İndirimli', style: TextStyle(fontSize: 11, color: Color(0xFFF59E0B))),
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
              initialCenter: LatLng(39.0, 35.0),
              initialZoom: 5.6,
              minZoom: 4.5,
              maxZoom: 16.0,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png',
                subdomains: const ['a', 'b', 'c'],
                userAgentPackageName: 'app.otopiyasa',
              ),
              MarkerLayer(
                markers: _clusters.map((c) {
                  final lat = (c['lat'] as num?)?.toDouble() ?? 0;
                  final lng = (c['lng'] as num?)?.toDouble() ?? 0;
                  final count = (c['count'] as num?)?.toInt() ?? 0;
                  final minPrice = (c['minPrice'] as num?)?.toInt() ?? 0;
                  final clusterKey = c['key']?.toString() ?? '';
                  final isProvinceLevel = c['level'] == 'province' && (c['district']?.toString().isEmpty ?? true);
                  final label = (c['district']?.toString().isNotEmpty ?? false)
                      ? c['district'].toString()
                      : (isProvinceLevel ? '${c['city']} (İl Geneli)' : c['city']?.toString() ?? '');

                  final accentColor = _densityColor(count);

                  return Marker(
                    point: LatLng(lat, lng),
                    width: 96,
                    height: 46,
                    child: GestureDetector(
                      onTap: () {
                        // Eğer il düzeyinde ve uzaksa yakınlaştır
                        if (isProvinceLevel && _mapController.camera.zoom < 8.0) {
                          _mapController.move(LatLng(lat, lng), 9.5);
                        } else {
                          _showClusterCars(label, clusterKey, count, minPrice);
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xF00A0F18),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: accentColor, width: 1.5),
                          boxShadow: [
                            BoxShadow(
                              color: accentColor.withValues(alpha: 0.25),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              count >= 1000 ? '${(count / 1000).toStringAsFixed(1)}B' : '$count',
                              style: TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 12,
                                color: accentColor,
                              ),
                            ),
                            Text(
                              label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 9, color: Colors.white, fontWeight: FontWeight.w600),
                            ),
                            Text(
                              "${_shortPrice(minPrice)} ₺'den",
                              style: const TextStyle(fontSize: 8, color: Colors.white54),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),

          // Floating Reset Button
          Positioned(
            top: 16,
            left: 16,
            child: FloatingActionButton.extended(
              heroTag: 'reset_map',
              onPressed: () {
                _mapController.move(const LatLng(39.0, 35.0), 5.6);
              },
              icon: const Text('🇹🇷', style: TextStyle(fontSize: 14)),
              label: const Text('Tüm Türkiye', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              backgroundColor: const Color(0xF00E1626),
              foregroundColor: Colors.white,
              elevation: 4,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openFilters() async {
    var brand = _brand;
    var city = _city;
    var fuel = _fuel;
    var discountOnly = _discountOnly;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: StatefulBuilder(
          builder: (context, setSheetState) => Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Haritayı Filtrele', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white)),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white54),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Fiyatı Düşenler Switch
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Row(
                  children: [
                    Text('🔥 ', style: TextStyle(fontSize: 16)),
                    Text('Fiyatı Düşenler', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                  ],
                ),
                subtitle: const Text('Sadece indirimli fırsat araçları göster', style: TextStyle(fontSize: 12, color: Colors.white54)),
                value: discountOnly,
                activeThumbColor: const Color(0xFFF59E0B),
                onChanged: (v) => setSheetState(() => discountOnly = v),
              ),
              const Divider(color: Colors.white10),
              const SizedBox(height: 8),

              DropdownButtonFormField<String?>(
                initialValue: brand,
                decoration: const InputDecoration(labelText: 'Marka'),
                items: [
                  const DropdownMenuItem(value: null, child: Text('Tüm Markalar')),
                  ..._brandOptions.map((b) => DropdownMenuItem(value: b, child: Text(b))),
                ],
                onChanged: (v) => setSheetState(() => brand = v),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String?>(
                initialValue: city,
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
                decoration: const InputDecoration(labelText: 'Yakıt'),
                items: [
                  const DropdownMenuItem(value: null, child: Text('Tüm Yakıtlar')),
                  ..._fuelOptions.map((f) => DropdownMenuItem(value: f, child: Text(f))),
                ],
                onChanged: (v) => setSheetState(() => fuel = v),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    Navigator.pop(context);
                    setState(() {
                      _brand = brand;
                      _city = city;
                      _fuel = fuel;
                      _discountOnly = discountOnly;
                    });
                    _load();
                  },
                  child: const Text('Filtreleri Uygula', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
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
                    future: _api.fetchMapCars(key: clusterKey),
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
