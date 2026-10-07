import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/screens/detail_screen.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/services/device_location.dart';
import 'package:otopiyasa/widgets/listing_image.dart';

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

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final position = await currentDevicePosition();
      final items = await _api.fetchNearby(position.latitude, position.longitude);
      if (!mounted) return;
      setState(() => _items = items);
    } on LocationServiceDisabledException {
      if (!mounted) return;
      setState(() => _error = 'Konum servisleri kapalı. Cihaz ayarlarından konumu açıp tekrar dene.');
    } on PermissionDeniedException {
      if (!mounted) return;
      setState(() => _error = 'Konum izni verilmedi.');
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
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        children: [
                          const Padding(
                            padding: EdgeInsets.only(bottom: 8),
                            child: Text(
                              'Mesafeler ilanın ilçe (bilinmiyorsa il) merkezine göre yaklaşıktır.',
                              style: TextStyle(fontSize: 12, color: Colors.white54),
                            ),
                          ),
                          if (_nearestKm > _farAwayKm) _farAwayNotice(),
                          ..._grouped(),
                        ],
                      ),
                    ),
    );
  }

  /// En yakın ilan bu kadar uzaksa cihaz konumu Türkiye dışında (ya da yanlış) demektir.
  static const _farAwayKm = 500;

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

  /// Aynı ilçedeki ilanların mesafesi aynıdır; her ilana tekrar yazmak yerine ilçe başlığı altında toplanır.
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
