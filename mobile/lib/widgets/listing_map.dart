import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:otopiyasa/models/car.dart';

/// İlan konumu önizlemesi (web'deki "Konum" haritasının karşılığı). Dokununca tam ekran, sürüklenebilir
/// harita açılır. Konum çoğu zaman ilçe/il merkezi olduğundan işaret yaklaşık bir dairedir.
class ListingMap extends StatelessWidget {
  const ListingMap({super.key, required this.point});

  final MapPoint point;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Konum',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: SizedBox(
            height: 180,
            child: Stack(
              children: [
                _MapView(point: point, interactive: false),
                Positioned.fill(
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => ListingMapScreen(point: point),
                        ),
                      ),
                      child: Align(
                        alignment: Alignment.topRight,
                        child: Container(
                          margin: const EdgeInsets.all(8),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.7),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            '⤢ Büyüt',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFF5B942),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (point.note.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              point.note,
              style: const TextStyle(fontSize: 11, color: Colors.white38),
            ),
          ),
      ],
    );
  }
}

/// Tam ekran, sürüklenip yakınlaştırılabilen ilan haritası.
class ListingMapScreen extends StatelessWidget {
  const ListingMapScreen({super.key, required this.point});

  final MapPoint point;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('İlan konumu')),
      body: Stack(
        children: [
          _MapView(point: point, interactive: true),
          if (point.note.isNotEmpty)
            Positioned(
              left: 12,
              bottom: 28,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.75),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  point.note,
                  style: const TextStyle(fontSize: 12, color: Colors.white70),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _MapView extends StatelessWidget {
  const _MapView({required this.point, required this.interactive});

  final MapPoint point;
  final bool interactive;

  @override
  Widget build(BuildContext context) {
    final center = LatLng(point.lat, point.lng);
    return FlutterMap(
      options: MapOptions(
        initialCenter: center,
        initialZoom: point.zoom,
        minZoom: 4.5,
        maxZoom: 17,
        interactionOptions: InteractionOptions(
          flags: interactive
              ? InteractiveFlag.all & ~InteractiveFlag.rotate
              : InteractiveFlag.none,
        ),
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.otopiyasa.otopiyasa',
        ),
        CircleLayer(
          circles: [
            CircleMarker(
              point: center,
              radius: interactive ? 14 : 10,
              color: const Color(0xE6F59E0B),
              borderColor: Colors.white,
              borderStrokeWidth: 3,
            ),
          ],
        ),
        if (interactive)
          const SimpleAttributionWidget(
            source: Text(
              'OpenStreetMap katkıcıları',
              style: TextStyle(fontSize: 10, color: Colors.white70),
            ),
            backgroundColor: Color(0x99000000),
          ),
      ],
    );
  }
}
