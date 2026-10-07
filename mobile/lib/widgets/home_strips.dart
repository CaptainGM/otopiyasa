import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/screens/detail_screen.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/screens/nearby_screen.dart';
import 'package:otopiyasa/services/recently_viewed_store.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/utils/car_headline.dart';
import 'package:otopiyasa/utils/tr_text.dart';
import 'package:otopiyasa/widgets/listing_image.dart';

final _money = NumberFormat.currency(locale: 'tr_TR', symbol: '₺', decimalDigits: 0);

/// Şerit kartı — web'deki MiniCarCard ile aynı düzen: fotoğraf + etiket, yıl / şehir, marka model, fiyat.
Widget _miniCard(BuildContext context, CarListing car, {String? badge, bool cheap = false}) {
  final c = AppColors.of(context);
  final onSurface = Theme.of(context).colorScheme.onSurface;
  return GestureDetector(
    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => DetailScreen(carId: car.id, initialCar: car))),
    child: Container(
      width: 168,
      margin: const EdgeInsets.only(right: 10),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              AspectRatio(
                aspectRatio: 16 / 10,
                // İlk fotoğraf kaynakta silinmişse ilanın diğer fotoğrafı denenir.
                child: ListingImage(url: car.imageUrl, fallbacks: car.images, cacheWidth: 480),
              ),
              if (badge != null)
                Positioned(
                  left: 6,
                  top: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                    decoration: BoxDecoration(
                      color: cheap ? const Color(0xFF0F9D63) : Colors.black.withValues(alpha: 0.66),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(badge, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white, fontFeatures: [FontFeature.tabularFigures()])),
                  ),
                ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  trUpper('${car.year}  /  ${car.city}'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.eyebrow(context, size: 9),
                ),
                const SizedBox(height: 3),
                Text(
                  carHeadline(title: car.title, brand: car.brand, model: car.model),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.display(size: 13.5),
                ),
                const SizedBox(height: 4),
                Text(_money.format(car.price), style: AppText.num(size: 15, weight: FontWeight.w600, color: onSurface)),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

Widget _stripShell(BuildContext context, {required String eyebrow, required String title, required List<Widget> children}) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(trUpper(eyebrow), style: AppText.eyebrow(context)),
      const SizedBox(height: 2),
      Text(title, style: AppText.display(size: 18)),
      const SizedBox(height: 10),
      SizedBox(
        // Kart yüksekliği yazı tipi ölçeğine göre değişir; sabit yükseklik bazı cihazlarda taşıyordu.
        height: 190,
        child: ListView(scrollDirection: Axis.horizontal, children: children),
      ),
      const SizedBox(height: 22),
    ],
  );
}

/// Fırsat etiketi: piyasa ortalaması biliniyorsa "%14 ucuz", değilse "Fırsat".
String _dealBadge(CarListing car) {
  final avg = car.marketAvgPrice;
  if (avg == null || avg <= 0) return 'Fırsat';
  final pct = (((avg - car.price) / avg) * 100).round();
  return pct > 0 ? '%$pct ucuz' : 'Fırsat';
}

/// "Haftanın fırsatları" — web'deki DealsStrip'in mobil karşılığı (en çok 30 fırsat).
class DealsStrip extends StatefulWidget {
  final Object? refreshSignal;
  const DealsStrip({super.key, this.refreshSignal});

  @override
  State<DealsStrip> createState() => _DealsStripState();
}

class _DealsStripState extends State<DealsStrip> {
  late Future<List<CarListing>> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant DealsStrip oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.refreshSignal != oldWidget.refreshSignal) {
      _load();
    }
  }

  void _load() {
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
          context,
          eyebrow: 'Piyasanın altında · ${items.length} ilan',
          title: 'Haftanın fırsatları',
          children: items.map((car) => _miniCard(context, car, badge: _dealBadge(car), cheap: true)).toList(),
        );
      },
    );
  }
}

/// "En çok görüntülenenler" — web'deki TrendingStrip'in mobil karşılığı.
class TrendingStrip extends StatefulWidget {
  final Object? refreshSignal;
  const TrendingStrip({super.key, this.refreshSignal});

  @override
  State<TrendingStrip> createState() => _TrendingStripState();
}

class _TrendingStripState extends State<TrendingStrip> {
  late Future<List<CarListing>> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant TrendingStrip oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.refreshSignal != oldWidget.refreshSignal) {
      _load();
    }
  }

  void _load() {
    _future = ApiService().fetchTrending();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<CarListing>>(
      future: _future,
      builder: (context, snapshot) {
        final items = snapshot.data ?? [];
        if (items.isEmpty) return const SizedBox.shrink();
        return _stripShell(
          context,
          eyebrow: 'Ziyaretçilerin ilgisi',
          title: 'En çok bakılanlar',
          children: items
              .map((car) => _miniCard(
                    context,
                    car,
                    badge: car.viewCount > 0 ? '${NumberFormat.decimalPattern('tr_TR').format(car.viewCount)} görüntülenme' : null,
                  ))
              .toList(),
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
          context,
          eyebrow: 'Geçmiş',
          title: 'Son baktıkların',
          children: items.map((car) => _miniCard(context, car)).toList(),
        );
      },
    );
  }
}

/// "Yakınımdaki ilanlar" girişi — web ana sayfasındaki satırın karşılığı. Konum yalnızca dokununca istenir
/// (ekran açılır açılmaz izin penceresi çıkmasın).
class NearbyPrompt extends StatelessWidget {
  const NearbyPrompt({super.key});

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Material(
        color: c.surface2,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NearbyScreen())),
          child: Container(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: c.border),
            ),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: c.border)),
                  child: const Icon(Icons.my_location, size: 19, color: Color(0xFF3B82F6)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Yakınımdaki ilanlar', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
                      Text('Konumunu kullan, en yakın ilanları mesafeye göre sırala.',
                          style: TextStyle(color: c.muted, fontSize: 12.5)),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, color: c.faint),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
