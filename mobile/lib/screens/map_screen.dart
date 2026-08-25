import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import 'package:otopiyasa/services/api_service.dart';

/// HARİTA — web'deki `/map` sayfasının mobil karşılığı.
///
/// Sunucu ilanları KÜME olarak döndürüyor (il/ilçe bazında adet + en düşük
/// fiyat), yani 16 bin ilan tek tek indirilmiyor. Aynı uç nokta `/api/map`.
///
/// Döşemeler OpenStreetMap/Carto — Google Maps'in aksine API anahtarı
/// gerektirmiyor, web tarafıyla da aynı görünüm.
class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final _api = ApiService();
  final _money = NumberFormat.decimalPattern('tr_TR');

  List<Map<String, dynamic>> _clusters = [];
  List<String> _brandOptions = [];
  List<String> _cityOptions = [];
  List<String> _fuelOptions = [];
  bool _loading = true;
  String? _error;

  String? _brand;
  String? _city;
  String? _fuel;

  @override
  void initState() {
    super.initState();
    _load();
  }

  bool get _hasActiveFilters => _brand != null || _city != null || _fuel != null;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await _api.fetchMap(brand: _brand, city: _city, fuel: _fuel);
      if (!mounted) return;
      final options = data['options'] as Map<String, dynamic>? ?? {};
      setState(() {
        _clusters = (data['clusters'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
        _brandOptions = (options['brands'] as List<dynamic>? ?? []).map((e) => e.toString()).toList();
        _cityOptions = (options['cities'] as List<dynamic>? ?? []).map((e) => e.toString()).toList();
        _fuelOptions = (options['fuels'] as List<dynamic>? ?? []).map((e) => e.toString()).toList();
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

  /// 1.250.000 → "1,3M" / 850.000 → "850B" (işaret üstünde yer dar).
  String _shortPrice(num price) {
    if (price >= 1000000) {
      return '${(price / 1000000).toStringAsFixed(1).replaceAll('.', ',')}M';
    }
    if (price >= 1000) return '${(price / 1000).round()}B';
    return price.toString();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Harita')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Harita')),
        body: Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!))),
      );
    }

    final total = _clusters.fold<int>(0, (sum, c) => sum + ((c['count'] as num?)?.toInt() ?? 0));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Harita'),
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
          preferredSize: const Size.fromHeight(24),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text('$total ilan • ${_clusters.length} bölge',
                style: const TextStyle(fontSize: 12, color: Colors.white60)),
          ),
        ),
      ),
      body: FlutterMap(
        options: const MapOptions(
          // Türkiye merkezi
          initialCenter: LatLng(39.0, 35.0),
          initialZoom: 5.6,
        ),
        children: [
          TileLayer(
            urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
            subdomains: const ['a', 'b', 'c'],
            userAgentPackageName: 'app.otopiyasa',
          ),
          MarkerLayer(
            markers: _clusters.map((c) {
              final lat = (c['lat'] as num?)?.toDouble() ?? 0;
              final lng = (c['lng'] as num?)?.toDouble() ?? 0;
              final count = (c['count'] as num?)?.toInt() ?? 0;
              final minPrice = (c['minPrice'] as num?)?.toInt() ?? 0;
              final label = (c['district']?.toString().isNotEmpty ?? false)
                  ? c['district'].toString()
                  : c['city']?.toString() ?? '';

              return Marker(
                point: LatLng(lat, lng),
                width: 92,
                height: 44,
                child: GestureDetector(
                  onTap: () => _showCluster(label, count, minPrice),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xEE1A1F2B),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFEAB24A), width: 1.2),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('$count',
                            style: const TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 13,
                                color: Color(0xFFEAB24A))),
                        Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 9, color: Colors.white70),
                        ),
                        Text(
                          "${_shortPrice(minPrice)} ₺'den",
                          style: const TextStyle(fontSize: 8, color: Colors.white38),
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
    );
  }

  Future<void> _openFilters() async {
    var brand = _brand;
    var city = _city;
    var fuel = _fuel;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
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
              const Text('Haritayı filtrele', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 12),
              DropdownButtonFormField<String?>(
                initialValue: brand,
                decoration: const InputDecoration(labelText: 'Marka'),
                items: [
                  const DropdownMenuItem(value: null, child: Text('Tümü')),
                  ..._brandOptions.map((b) => DropdownMenuItem(value: b, child: Text(b))),
                ],
                onChanged: (v) => setSheetState(() => brand = v),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String?>(
                initialValue: city,
                decoration: const InputDecoration(labelText: 'Şehir'),
                items: [
                  const DropdownMenuItem(value: null, child: Text('Tümü')),
                  ..._cityOptions.map((c) => DropdownMenuItem(value: c, child: Text(c))),
                ],
                onChanged: (v) => setSheetState(() => city = v),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String?>(
                initialValue: fuel,
                decoration: const InputDecoration(labelText: 'Yakıt'),
                items: [
                  const DropdownMenuItem(value: null, child: Text('Tümü')),
                  ..._fuelOptions.map((f) => DropdownMenuItem(value: f, child: Text(f))),
                ],
                onChanged: (v) => setSheetState(() => fuel = v),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () {
                  Navigator.pop(context);
                  setState(() {
                    _brand = brand;
                    _city = city;
                    _fuel = fuel;
                  });
                  _load();
                },
                child: const Text('Uygula'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showCluster(String label, int count, int minPrice) {
    showModalBottomSheet<void>(
      context: context,
      builder: (context) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            Text('$count ilan'),
            Text('En düşük fiyat: ${_money.format(minPrice)} ₺'),
            const SizedBox(height: 12),
            const Text(
              'Bu bölgedeki ilanları görmek için arama ekranından şehir filtresini kullanabilirsin.',
              style: TextStyle(fontSize: 12, color: Colors.white54),
            ),
          ],
        ),
      ),
    );
  }
}
