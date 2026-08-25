import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/screens/detail_screen.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/services/recently_viewed_store.dart';

final _money = NumberFormat.currency(locale: 'tr_TR', symbol: '₺', decimalDigits: 0);

Widget _miniCard(BuildContext context, CarListing car, {String? badge}) {
  return GestureDetector(
    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => DetailScreen(carId: car.id))),
    child: Container(
      width: 160,
      margin: const EdgeInsets.only(right: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              AspectRatio(
                aspectRatio: 16 / 10,
                child: car.imageUrl.isEmpty
                    ? Container(color: Colors.white10, child: const Icon(Icons.directions_car))
                    : Image.network(
                        car.imageUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => Container(color: Colors.white10, child: const Icon(Icons.directions_car)),
                      ),
              ),
              if (badge != null)
                Positioned(
                  left: 6,
                  top: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.green.withValues(alpha: 0.9),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(badge, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold)),
                  ),
                ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  car.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(_money.format(car.price), style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

Widget _stripShell({required String title, required List<Widget> children}) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
      const SizedBox(height: 8),
      SizedBox(
        height: 152,
        child: ListView(scrollDirection: Axis.horizontal, children: children),
      ),
      const SizedBox(height: 20),
    ],
  );
}

/// "Haftanın fırsatları" — web'deki DealsStrip'in mobil karşılığı.
class DealsStrip extends StatefulWidget {
  const DealsStrip({super.key});

  @override
  State<DealsStrip> createState() => _DealsStripState();
}

class _DealsStripState extends State<DealsStrip> {
  late Future<List<CarListing>> _future;

  @override
  void initState() {
    super.initState();
    _future = ApiService().fetchDeals();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<CarListing>>(
      future: _future,
      builder: (context, snapshot) {
        final items = snapshot.data ?? [];
        if (items.isEmpty) return const SizedBox.shrink();
        return _stripShell(
          title: 'Haftanın fırsatları',
          children: items.map((car) => _miniCard(context, car, badge: 'Fırsat')).toList(),
        );
      },
    );
  }
}

/// "Son baktıkların" — cihazda tutulan görüntülenme geçmişi.
class RecentlyViewedStrip extends StatefulWidget {
  const RecentlyViewedStrip({super.key});

  @override
  State<RecentlyViewedStrip> createState() => _RecentlyViewedStripState();
}

class _RecentlyViewedStripState extends State<RecentlyViewedStrip> {
  late Future<List<CarListing>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<CarListing>> _load() async {
    final ids = await RecentlyViewedStore.list();
    return ApiService().fetchCarsByIds(ids);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<CarListing>>(
      future: _future,
      builder: (context, snapshot) {
        final items = snapshot.data ?? [];
        if (items.isEmpty) return const SizedBox.shrink();
        return _stripShell(
          title: 'Son baktıkların',
          children: items.map((car) => _miniCard(context, car)).toList(),
        );
      },
    );
  }
}
