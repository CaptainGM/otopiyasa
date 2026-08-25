import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/theme/app_theme.dart';

class MarketBadge extends StatelessWidget {
  const MarketBadge({super.key, required this.car});

  final CarListing car;

  String _formatPrice(int value) {
    return NumberFormat.currency(locale: 'tr_TR', symbol: '₺', decimalDigits: 0)
        .format(value);
  }

  @override
  Widget build(BuildContext context) {
    final avg = car.marketAvgPrice;
    final count = car.marketListingCount;

    if (avg == null || count == null || count < 2) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        child: const Text(
          'Bu segment için henüz yeterli ilan yok',
          style: TextStyle(color: Colors.white54, fontSize: 12),
        ),
      );
    }

    final diff = car.price - avg;
    final isAbove = diff > 0;
    final color = diff == 0
        ? Colors.white70
        : isAbove
            ? const Color(0xFFF87171)
            : const Color(0xFF34D399);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Bu araca özel piyasa ort.',
            style: TextStyle(color: Colors.white54, fontSize: 11),
          ),
          const SizedBox(height: 4),
          Text(
            _formatPrice(avg),
            style: const TextStyle(
              color: AppTheme.accent,
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            diff == 0
                ? 'Piyasa ortalamasında'
                : '${isAbove ? '+' : ''}${_formatPrice(diff)}',
            style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700),
          ),
          Text(
            '$count benzer ilan',
            style: const TextStyle(color: Colors.white38, fontSize: 11),
          ),
        ],
      ),
    );
  }
}
