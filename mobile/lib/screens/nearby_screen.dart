import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/screens/detail_screen.dart';
import 'package:otopiyasa/services/api_service.dart';

/// "Yakınımdaki ilanlar" — web'deki NearbyListings ile aynı mantık: gerçek
/// konum verisi ilanlarda genelde yok, bu yüzden sunucu ilçe/il merkezine göre
/// yaklaşık mesafe hesaplıyor (bkz. src/app/api/nearby, lib/district-coords.ts).
/// Kesin GPS koordinatı değil, dürüst bir yaklaşık değer.
class NearbyScreen extends StatefulWidget {
  const NearbyScreen({super.key});

  @override
  State<NearbyScreen> createState() => _NearbyScreenState();
}

class _NearbyScreenState extends State<NearbyScreen> {
  final _api = ApiService();
  final _money = NumberFormat.decimalPattern('tr_TR');

  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<Position> _determinePosition() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw Exception('Konum servisleri kapalı. Cihaz ayarlarından konumu aç.');
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw Exception('Konum izni verilmedi.');
      }
    }
    if (permission == LocationPermission.deniedForever) {
      throw Exception('Konum izni kalıcı reddedilmiş. Ayarlardan izin vermen gerekiyor.');
    }
    return Geolocator.getCurrentPosition();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final position = await _determinePosition();
      final items = await _api.fetchNearby(position.latitude, position.longitude);
      if (!mounted) return;
      setState(() => _items = items);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Yakınımdaki ilanlar')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        OutlinedButton(onPressed: _load, child: const Text('Tekrar dene')),
                      ],
                    ),
                  ),
                )
              : _items.isEmpty
                  ? const Center(child: Text('Yakınında eşleşen ilan bulunamadı.'))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: _items.length,
                        itemBuilder: (context, i) => _card(_items[i]),
                      ),
                    ),
    );
  }

  Widget _thumbFallback() => Container(
        color: Colors.white10,
        child: const Icon(Icons.directions_car, size: 22),
      );

  Widget _card(Map<String, dynamic> item) {
    final approximate = item['approximate'] == true;
    final distance = (item['distanceKm'] as num?)?.toStringAsFixed(1) ?? '?';
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      clipBehavior: Clip.antiAlias,
      child: ListTile(
        contentPadding: const EdgeInsets.all(10),
        leading: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: SizedBox(
            width: 72,
            height: 54,
            child: (item['imageUrl'] as String?)?.isNotEmpty == true
                ? Image.network(
                    item['imageUrl'] as String,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => _thumbFallback(),
                  )
                : _thumbFallback(),
          ),
        ),
        title: Text(
          item['title']?.toString() ?? '',
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
        ),
        subtitle: Text(
          '${_money.format(item['price'] ?? 0)} ₺  •  ${approximate ? "~" : ""}$distance km  •  ${item['city'] ?? ''}',
          style: const TextStyle(fontSize: 12),
        ),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => DetailScreen(carId: item['_id'].toString())),
        ),
      ),
    );
  }
}
