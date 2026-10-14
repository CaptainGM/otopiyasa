import 'package:flutter/material.dart';

/// Karşılaştırmada tek araç varken yanındaki boş sütun: "Sağ tarafa bir araç daha ekle" (web'deki kutunun mobil karşılığı).
/// Dokununca Keşfet'e (ilan listesine) götürür. Ölçüleri tablonun geri kalanıyla aynıdır. İçerik sığmazsa küçülür, kesilmez
/// (320 px ekranda ve büyük yazıda da).
class CompareAddSlot extends StatelessWidget {
  const CompareAddSlot({
    super.key,
    required this.width,
    required this.imageWidth,
    required this.imageHeight,
    required this.headerHeight,
    required this.onTap,
  });

  final double width;
  final double imageWidth;
  final double imageHeight;
  final double headerHeight;
  final VoidCallback onTap;

  static const _accent = Color(0xFFF5B942);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: headerHeight,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 3),
          child: Column(
            children: [
              // Fotoğrafın yerinde kesikli çerçeve.
              SizedBox(
                width: imageWidth,
                height: imageHeight,
                child: CustomPaint(
                  painter: const _DashedRoundedRectPainter(color: Color(0x99F5B942)),
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(6),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Text('+', style: TextStyle(fontSize: 22, height: 1, color: _accent)),
                            SizedBox(height: 4),
                            Text(
                              'Sağ tarafa bir araç daha ekle',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 11, height: 1.2, fontWeight: FontWeight.w700, color: _accent),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              const Expanded(
                child: Text(
                  'En az 2 araç gerekli',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 11, height: 1.15, color: Colors.white54),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Kesikli köşeli çerçeve: Flutter'da hazır kesikli kenarlık yok, yol boyunca parça parça çizilir.
class _DashedRoundedRectPainter extends CustomPainter {
  const _DashedRoundedRectPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    final outline = Path()..addRRect(RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(12)));
    for (final metric in outline.computeMetrics()) {
      var start = 0.0;
      while (start < metric.length) {
        final end = (start + 6).clamp(0.0, metric.length).toDouble();
        canvas.drawPath(metric.extractPath(start, end), paint);
        start += 10;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedRoundedRectPainter oldDelegate) => oldDelegate.color != color;
}
