import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/utils/tr_text.dart';

/// İşaret: hız göstergesi biçiminde piyasa göstergesi (web'deki LogoMark ile aynı çizim). Üç yay ucuz (nane) →
/// adil (buz mavisi) → pahalı (mercan), ibre ucuz bölgede.
class LogoMark extends StatelessWidget {
  const LogoMark({super.key, this.size = 38});

  final double size;

  @override
  Widget build(BuildContext context) => CustomPaint(size: Size.square(size), painter: _LogoPainter());
}

class _LogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 64;
    canvas.scale(s);
    final tile = RRect.fromRectAndRadius(const Rect.fromLTWH(0.5, 0.5, 63, 63), const Radius.circular(16));
    canvas.drawRRect(tile, Paint()..color = const Color(0xFF121418));
    canvas.drawRRect(
      tile,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = Colors.white.withValues(alpha: 0.12),
    );

    const center = Offset(32, 36);
    const radius = 18.0;
    final arcRect = Rect.fromCircle(center: center, radius: radius);
    double rad(double deg) => -deg * math.pi / 180; // Canvas açısı saat yönünde, göstergede saat tersine ölçüyoruz.
    void arc(double fromDeg, double toDeg, Color color) {
      canvas.drawArc(
        arcRect,
        rad(fromDeg),
        rad(toDeg) - rad(fromDeg),
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 5
          ..strokeCap = StrokeCap.round
          ..color = color,
      );
    }

    arc(200, 129, const Color(0xFF34D399));
    arc(125, 55, const Color(0xFF7DD3FC));
    arc(51, -20, const Color(0xFFFB7185));

    canvas.drawLine(
      center,
      const Offset(20.74, 29.5),
      Paint()
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round
        ..color = const Color(0xFFF2F1EC),
    );
    canvas.drawCircle(center, 3.6, Paint()..color = AppTheme.accent);
    canvas.drawLine(
      const Offset(22, 50),
      const Offset(42, 50),
      Paint()
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round
        ..color = Colors.white.withValues(alpha: 0.22),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    final onSurface = Theme.of(context).colorScheme.onSurface;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        LogoMark(size: compact ? 32 : 36),
        if (!compact) ...[
          const SizedBox(width: 10),
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              RichText(
                text: TextSpan(
                  style: AppText.display(size: 18.5, weight: FontWeight.w700, color: onSurface),
                  children: const [
                    TextSpan(text: 'Oto'),
                    TextSpan(text: 'Piyasa', style: TextStyle(color: AppTheme.accent)),
                  ],
                ),
              ),
              const SizedBox(height: 2),
              Text(trUpper('İlan fiyat istihbaratı'), style: AppText.eyebrow(context, size: 8.5)),
            ],
          ),
        ],
      ],
    );
  }
}
