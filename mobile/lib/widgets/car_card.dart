import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/screens/detail_screen.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/utils/car_headline.dart';
import 'package:otopiyasa/utils/tr_text.dart';
import 'package:otopiyasa/widgets/listing_image.dart';

/// Kaynak sitenin görünen adı ve rozet noktası rengi (web'deki SourceBadge ile aynı).
const sourceLabels = <String, String>{
  'sahibinden': 'Sahibinden',
  'arabam': 'Arabam',
  'otomerkezi': 'Otomerkezi',
  'vavacars': 'VavaCars',
  'otoplus': 'Otoplus',
  'carvak': 'Carvak',
  'otokoc': 'Otokoç 2. El',
  'dod': 'DOD',
  'ikinciyeni': 'İkinciyeni',
  'user': 'Üye İlanı',
  'manual': 'Manuel',
  'demo': 'Demo',
};

const sourceDots = <String, Color>{
  'sahibinden': Color(0xFFFDE047),
  'arabam': Color(0xFFFB923C),
  'otomerkezi': Color(0xFF38BDF8),
  'vavacars': Color(0xFFC084FC),
  'otoplus': Color(0xFFFB7185),
  'carvak': Color(0xFF2DD4BF),
  'otokoc': Color(0xFF818CF8),
  'dod': Color(0xFF3B82F6),
  'ikinciyeni': Color(0xFF34D399),
  'user': Color(0xFF6EE7B7),
};

/// Fotoğraf üstündeki koyu kaynak rozeti: renkli nokta + ad (her fotoğrafta okunur).
class SourcePill extends StatelessWidget {
  const SourcePill({super.key, required this.source, this.compact = false});

  final String source;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: compact ? 6 : 8, vertical: compact ? 3 : 4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.68),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(color: sourceDots[source] ?? Colors.white70, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            trUpper(sourceLabels[source] ?? source),
            style: TextStyle(color: Colors.white, fontSize: compact ? 8.5 : 9.5, fontWeight: FontWeight.w700, letterSpacing: 0.4),
          ),
        ],
      ),
    );
  }
}

/// Fotoğraf üstündeki dolu durum rozeti (hasar, fiyat düştü).
class PhotoBadge extends StatelessWidget {
  const PhotoBadge({super.key, required this.text, required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(6)),
      child: Text(text, style: AppText.num(size: 9.5, weight: FontWeight.w600, color: Colors.white)),
    );
  }
}

class CarCard extends StatefulWidget {
  const CarCard({super.key, required this.car});

  final CarListing car;

  @override
  State<CarCard> createState() => _CarCardState();
}

class _CarCardState extends State<CarCard> {
  late final PageController _pageController;
  int _activeImageIndex = 0;

  static final _price = NumberFormat.currency(locale: 'tr_TR', symbol: '₺', decimalDigits: 0);
  static final _km = NumberFormat.decimalPattern('tr_TR');

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  List<String> get _allImages {
    final list = <String>[];
    if (widget.car.imageUrl.isNotEmpty) {
      list.add(widget.car.imageUrl);
    }
    for (final img in widget.car.images) {
      if (img.isNotEmpty && !list.contains(img)) {
        list.add(img);
      }
    }
    return list;
  }

  void _openDetail() {
    HapticFeedback.selectionClick();
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => DetailScreen(carId: widget.car.id, initialCar: widget.car),
      ),
    );
  }

  void _swipePhoto(DragEndDetails details, int count) {
    if (count <= 1) return;
    final velocity = details.primaryVelocity ?? 0;
    if (velocity < -150 && _activeImageIndex < count - 1) {
      _pageController.nextPage(duration: const Duration(milliseconds: 220), curve: Curves.easeOutCubic);
    } else if (velocity > 150 && _activeImageIndex > 0) {
      _pageController.previousPage(duration: const Duration(milliseconds: 220), curve: Curves.easeOutCubic);
    }
  }

  @override
  Widget build(BuildContext context) {
    final car = widget.car;
    final c = AppColors.of(context);
    final images = _allImages;
    final imageWidth = (MediaQuery.sizeOf(context).width * .38).clamp(128.0, 210.0).toDouble();
    final imageCacheWidth = (imageWidth * MediaQuery.devicePixelRatioOf(context)).round();
    final name = carHeadline(title: car.title, brand: car.brand, model: car.model);

    // Doğrulanmamış özellik yazılmaz; yerine soluk "doğrulanıyor" çıkar (web ile aynı).
    final specs = <({String text, bool pending})>[
      (text: '${_km.format(car.mileage)} km', pending: false),
      for (final value in [car.fuelType, car.transmission])
        if (value.isNotEmpty && value != 'Belirtilmemiş' && value != 'Bilinmiyor')
          (text: value == 'Doğrulanıyor' ? 'doğrulanıyor' : value, pending: value == 'Doğrulanıyor'),
    ];
    // İki özellik de doğrulanıyorsa tek etiket yeter.
    final seen = <String>{};
    specs.retainWhere((s) => seen.add(s.text));

    return Card(
      clipBehavior: Clip.antiAlias,
      child: SizedBox(
        // Keşfet kartı sade: fiyat göstergesi ve indirim rozeti yalnızca ilan sayfasında.
        height: 140,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              width: imageWidth,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: _openDetail,
                    child: images.isEmpty
                        ? Container(color: c.surface2, child: Icon(Icons.directions_car_outlined, color: c.faint))
                        : images.length == 1
                            ? Hero(tag: 'car-img-${car.id}', child: ListingImage(url: images.first, cacheWidth: imageCacheWidth))
                            : PageView.builder(
                                controller: _pageController,
                                physics: const BouncingScrollPhysics(),
                                // Komşu fotoğraf ÖNCEDEN İNDİRİLMEZ: eskiden her kart bir sonraki fotoğrafını da
                                // indiriyordu, kullanıcı hiç kaydırmasa bile (ölçüm: 10 ekran ≈ 6,6 MB, kart başına ~3 dosya).
                                itemCount: images.length,
                                onPageChanged: (idx) => setState(() => _activeImageIndex = idx),
                                itemBuilder: (context, index) {
                                  final imageWidget = ListingImage(url: images[index], cacheWidth: imageCacheWidth);
                                  return index == 0 ? Hero(tag: 'car-img-${car.id}', child: imageWidget) : imageWidget;
                                },
                              ),
                  ),
                  Positioned(
                    left: 7,
                    top: 7,
                    right: 7,
                    child: IgnorePointer(
                      child: Wrap(
                        spacing: 4,
                        runSpacing: 4,
                        children: [
                          SourcePill(source: car.sourceSite, compact: true),
                        ],
                      ),
                    ),
                  ),
                  if (car.damageFlag || !car.isActive)
                    Positioned(
                      left: 7,
                      bottom: images.length > 1 ? 20 : 7,
                      child: IgnorePointer(
                        child: PhotoBadge(
                          text: !car.isActive ? car.statusLabel : 'Hasar kaydı',
                          color: !car.isActive ? Colors.black87 : const Color(0xFFC8281F),
                        ),
                      ),
                    ),
                  if (images.length > 1)
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 6,
                      child: IgnorePointer(
                        child: Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2.5),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.5),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: List.generate(
                                images.length.clamp(0, 6),
                                (index) => AnimatedContainer(
                                  duration: const Duration(milliseconds: 180),
                                  width: _activeImageIndex == index ? 8 : 4,
                                  height: 4,
                                  margin: const EdgeInsets.symmetric(horizontal: 1.5),
                                  decoration: BoxDecoration(
                                    color: _activeImageIndex == index ? Colors.white : Colors.white.withValues(alpha: 0.4),
                                    borderRadius: BorderRadius.circular(2),
                                  ),
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
            // Metin alanı: dokununca ilan açılır, sağa/sola çekilince fotoğraf değişir.
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: _openDetail,
                onHorizontalDragEnd: (details) => _swipePhoto(details, images.length),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text.rich(
                        TextSpan(children: [
                          TextSpan(text: '${car.year}', style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
                          TextSpan(text: '  /  ', style: TextStyle(color: c.faint)),
                          TextSpan(text: trUpper(car.city)),
                        ]),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.eyebrow(context, size: 9.5),
                      ),
                      const SizedBox(height: 3),
                      Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.display(size: 15)),
                      if (name != car.title)
                        Text(
                          car.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 11.5, color: c.muted, height: 1.3),
                        ),
                      const SizedBox(height: 4),
                      Text.rich(
                        TextSpan(children: [
                          for (var i = 0; i < specs.length; i++) ...[
                            if (i > 0) TextSpan(text: ' · ', style: TextStyle(color: c.faint)),
                            TextSpan(
                              text: specs[i].text,
                              style: specs[i].pending ? TextStyle(color: c.faint, fontStyle: FontStyle.italic) : null,
                            ),
                          ],
                        ]),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.num(size: 10.5, color: c.muted),
                      ),
                      const Spacer(),
                      Text(
                        _price.format(car.price),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.num(size: 18.5, weight: FontWeight.w600, color: Theme.of(context).colorScheme.onSurface),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
