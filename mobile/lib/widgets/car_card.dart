import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/screens/detail_screen.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/widgets/market_badge.dart';

class CarCard extends StatelessWidget {
  const CarCard({super.key, required this.car});

  final CarListing car;

  String _formatPrice(int value) {
    return NumberFormat.currency(locale: 'tr_TR', symbol: '₺', decimalDigits: 0)
        .format(value);
  }

  Color _sourceColor() {
    switch (car.sourceSite) {
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
        return const Color(0xFF26A69A);
      case 'otokoc':
        return const Color(0xFF5C6BC0);
      case 'dod':
        return const Color(0xFF29B6F6);
      case 'ikinciyeni':
        return const Color(0xFF26A69A);
      default:
        return Colors.white70;
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => DetailScreen(carId: car.id)),
        );
      },
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                AspectRatio(
                  aspectRatio: 16 / 10,
                  child: Image.network(
                    car.imageUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => Container(
                      color: AppTheme.card,
                      child: const Icon(Icons.directions_car, size: 48),
                    ),
                  ),
                ),
                Positioned(
                  left: 12,
                  top: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: _sourceColor().withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: _sourceColor().withValues(alpha: 0.35)),
                    ),
                    child: Text(
                      car.sourceSite.toUpperCase(),
                      style: TextStyle(
                        color: _sourceColor(),
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                if (!car.isActive)
                  Positioned(
                    right: 12,
                    top: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.55),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        car.statusLabel,
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 12,
                  child: Text(
                    _formatPrice(car.price),
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      shadows: [Shadow(color: Colors.black54, blurRadius: 8)],
                    ),
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    car.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${car.city} • ${NumberFormat.decimalPattern('tr_TR').format(car.mileage)} km',
                    style: const TextStyle(color: Colors.white54, fontSize: 13),
                  ),
                  const SizedBox(height: 10),
                  MarketBadge(car: car),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
