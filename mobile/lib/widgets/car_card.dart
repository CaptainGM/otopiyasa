import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/screens/detail_screen.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/widgets/listing_image.dart';

class CarCard extends StatefulWidget {
  const CarCard({super.key, required this.car});

  final CarListing car;

  @override
  State<CarCard> createState() => _CarCardState();
}

class _CarCardState extends State<CarCard> {
  late final PageController _pageController;
  int _activeImageIndex = 0;

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
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => DetailScreen(carId: widget.car.id, initialCar: widget.car),
      ),
    );
  }

  String _formatPrice(int value) => NumberFormat.currency(
    locale: 'tr_TR',
    symbol: '₺',
    decimalDigits: 0,
  ).format(value);

  Color _sourceColor() {
    switch (widget.car.sourceSite) {
      case 'sahibinden':
        return const Color(0xFFFACC15);
      case 'arabam':
        return AppTheme.accent2;
      case 'otomerkezi':
        return const Color(0xFF0288D1);
      case 'vavacars':
        return const Color(0xFFFF5000);
      case 'otoplus':
        return const Color(0xFF00C853);
      case 'carvak':
      case 'ikinciyeni':
        return const Color(0xFF26A69A);
      case 'otokoc':
        return const Color(0xFF5C6BC0);
      case 'dod':
        return const Color(0xFF29B6F6);
      default:
        return Colors.white70;
    }
  }

  @override
  Widget build(BuildContext context) {
    final car = widget.car;
    final sourceColor = _sourceColor();
    final images = _allImages;
    final imageWidth = (MediaQuery.sizeOf(context).width * .4)
        .clamp(136.0, 220.0)
        .toDouble();
    final imageCacheWidth =
        (imageWidth * MediaQuery.devicePixelRatioOf(context)).round();

    return Card(
      clipBehavior: Clip.antiAlias,
      child: SizedBox(
        height: 164,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Sol taraf: Fotoğraf alanı (Yön oku olmadan, sadece parmakla sağa/sola sürükleyerek geçiş)
            SizedBox(
              width: imageWidth,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (images.isEmpty)
                    GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: _openDetail,
                      child: Container(
                        color: Colors.white10,
                        child: const Icon(Icons.directions_car, color: Colors.white30),
                      ),
                    )
                  else if (images.length == 1)
                    GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: _openDetail,
                      child: Hero(
                        tag: 'car-img-${car.id}',
                        child: ListingImage(
                          url: images.first,
                          cacheWidth: imageCacheWidth,
                        ),
                      ),
                    )
                  else
                    GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: _openDetail,
                      child: PageView.builder(
                        controller: _pageController,
                        physics: const BouncingScrollPhysics(),
                        itemCount: images.length,
                        onPageChanged: (idx) {
                          setState(() => _activeImageIndex = idx);
                        },
                        itemBuilder: (context, index) {
                          final imageWidget = ListingImage(
                            url: images[index],
                            cacheWidth: imageCacheWidth,
                          );
                          if (index == 0) {
                            return Hero(
                              tag: 'car-img-${car.id}',
                              child: imageWidget,
                            );
                          }
                          return imageWidget;
                        },
                      ),
                    ),
                  // Kaynak site etiketi
                  Positioned(
                    left: 7,
                    top: 7,
                    child: IgnorePointer(
                      child: Container(
                        constraints: const BoxConstraints(maxWidth: 112),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: .72),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: sourceColor.withValues(alpha: .55),
                          ),
                        ),
                        child: Text(
                          car.sourceSite.toUpperCase(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: sourceColor,
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ),
                  // Satıldı / Kaldırıldı rozeti
                  if (!car.isActive)
                    Positioned(
                      left: 7,
                      bottom: 7,
                      child: IgnorePointer(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 7,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: .75),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            car.statusLabel,
                            style: const TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ),
                  // Yön oku OLMADAN, sadece kaçıncı fotoğrafta olduğunu gösteren minimalist nokta göstergesi
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
                              color: Colors.black.withValues(alpha: 0.55),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: List.generate(
                                images.length.clamp(0, 6),
                                (index) => Container(
                                  width: _activeImageIndex == index ? 8 : 4,
                                  height: 4,
                                  margin: const EdgeInsets.symmetric(horizontal: 1.5),
                                  decoration: BoxDecoration(
                                    color: _activeImageIndex == index
                                        ? Colors.white
                                        : Colors.white.withValues(alpha: 0.4),
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
            // Sağ taraf: İlan detayları (Metin alanına tıklanırsa detay açılır, sağa/sola çekilirse fotoğraf geçer)
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: _openDetail,
                onHorizontalDragEnd: (details) {
                  if (images.length <= 1) return;
                  final velocity = details.primaryVelocity ?? 0;
                  if (velocity < -150) {
                    if (_activeImageIndex < images.length - 1) {
                      _pageController.nextPage(
                        duration: const Duration(milliseconds: 220),
                        curve: Curves.easeOutCubic,
                      );
                    }
                  } else if (velocity > 150) {
                    if (_activeImageIndex > 0) {
                      _pageController.previousPage(
                        duration: const Duration(milliseconds: 220),
                        curve: Curves.easeOutCubic,
                      );
                    }
                  }
                },
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(11, 10, 12, 9),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        car.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          height: 1.2,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        '${car.year} • ${car.city} • ${NumberFormat.decimalPattern('tr_TR').format(car.mileage)} km',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white54,
                          fontSize: 10.5,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        _formatPrice(car.price),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 18,
                          height: 1.1,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFFFACC15),
                        ),
                      ),
                      if (car.marketAvgPrice != null)
                        Text(
                          'Piyasa: ${_formatPrice(car.marketAvgPrice!)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white38,
                            fontSize: 10,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: _openDetail,
              child: const Padding(
                padding: EdgeInsets.only(right: 9),
                child: Icon(
                  Icons.chevron_right,
                  color: Colors.white30,
                  size: 19,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
