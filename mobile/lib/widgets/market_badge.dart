import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/models/car.dart';

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
        child: const Row(
          children: [
            Icon(Icons.info_outline, size: 16, color: Colors.white38),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Bu segment için henüz yeterli karşılaştırma ilanı yok',
                style: TextStyle(color: Colors.white54, fontSize: 12),
              ),
            ),
          ],
        ),
      );
    }

    final diff = car.price - avg;
    final pct = ((diff / avg) * 100).round();
    final double pinFraction = ((50.0 + (pct * 2.5)).clamp(6.0, 94.0)) / 100.0;

    final String statusTag;
    final String statusIcon;
    final Color statusColor;
    final String analysisDesc;

    if (pct <= -6) {
      statusTag = 'Kondisyonuna Göre %${pct.abs()} Hesaplı (Fırsat)';
      statusIcon = '🔥';
      statusColor = const Color(0xFF10B981);
      analysisDesc = 'Bu araç, benzer kilometre ve hasar kondisyonundaki emsallerine göre %${pct.abs()} daha avantajlı fiyatlandırılmıştır.';
    } else if (pct >= 6) {
      statusTag = 'Hasar ve KM Durumuna Göre %$pct Yüksek';
      statusIcon = '🔴';
      statusColor = const Color(0xFFEF4444);
      analysisDesc = 'Bu araç, aynı kilometre ve hasar durumundaki piyasa beklentisinin %$pct üzerinde fiyatlandırılmıştır.';
    } else {
      statusTag = 'Piyasa Değerinde (Adil Fiyat)';
      statusIcon = '🟢';
      statusColor = const Color(0xFF38BDF8);
      analysisDesc = 'İlan fiyatı, aracın model yılı, kilometresi ve hasar kondisyonuna göre hesaplanan adil piyasa ederiyle tam uyumludur.';
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Başlık & Rozet
          Row(
            children: [
              const Text('🌡️', style: TextStyle(fontSize: 18)),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Fiyat Analiz Termometresi',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    Text(
                      '$count emsal araç verisi',
                      style: const TextStyle(color: Colors.white38, fontSize: 10.5),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(statusIcon, style: const TextStyle(fontSize: 11)),
                    const SizedBox(width: 4),
                    Text(
                      statusTag,
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 10.5,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // 2 Sütunlu Fiyat Kutusu
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.03),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Adil Piyasa Ederi', style: TextStyle(fontSize: 10.5, color: Colors.white38)),
                      const SizedBox(height: 2),
                      Text(
                        _formatPrice(avg),
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF34D399),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Piyasa Farkı', style: TextStyle(fontSize: 10.5, color: Colors.white38)),
                      const SizedBox(height: 2),
                      Text(
                        '${diff > 0 ? '+' : ''}${_formatPrice(diff)} (${pct > 0 ? '+' : ''}$pct%)',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: statusColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Görsel Termometre Çubuğu
          LayoutBuilder(
            builder: (context, constraints) {
              final w = constraints.maxWidth;
              final pinX = (w * pinFraction).clamp(8.0, w - 8.0);
              return Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.centerLeft,
                children: [
                  Container(
                    height: 10,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(5),
                      gradient: const LinearGradient(
                        colors: [
                          Color(0xFF10B981),
                          Color(0xFF38BDF8),
                          Color(0xFFEF4444),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    left: pinX - 7,
                    child: Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.black87, width: 2),
                        boxShadow: const [
                          BoxShadow(color: Colors.black45, blurRadius: 4),
                        ],
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 6),
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Hesaplı (Fırsat)', style: TextStyle(fontSize: 9.5, color: Color(0xFF34D399), fontWeight: FontWeight.bold)),
              Text('Adil Eder', style: TextStyle(fontSize: 9.5, color: Color(0xFF38BDF8), fontWeight: FontWeight.bold)),
              Text('Piyasa Üstü', style: TextStyle(fontSize: 9.5, color: Color(0xFFF87171), fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 8),

          // Açıklama Metni
          Text(
            '💡 $analysisDesc',
            style: const TextStyle(fontSize: 11, color: Colors.white54, height: 1.3),
          ),
        ],
      ),
    );
  }
}

