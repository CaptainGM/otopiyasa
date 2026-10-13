import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Fiyat tahmini ekranındaki araç şablonu: üstten görünümde bölgeler duruma göre renklenir, her bölgeden bir ok (kesikli çizgi)
/// parça adına gider. Hem bölgeye hem yazıya dokunmak durumu değiştirir. Geometri web ile aynıdır (bkz. src/lib/car-parts-layout.ts ve
/// src/components/InteractiveDamageSelector.tsx); etiketler çizimin dışında gerçek widget'tır: şema küçülünce yazı küçülmez ve ad
/// hiçbir ekranda "…" ile kesilmez.
class CarPartsDiagram extends StatelessWidget {
  const CarPartsDiagram({super.key, required this.states, required this.names, required this.onToggle});

  /// Parça anahtarı (hood, f_l_door…) → durum: original | painted | replaced.
  final Map<String, String> states;

  /// Parça anahtarı → görünen ad.
  final Map<String, String> names;
  final void Function(String key) onToggle;

  static const double _viewW = 340;
  static const double _viewH = 420;

  /// Yan etiket sütununun genişliği (şema genişliğinin oranı); ok bu sütunun iç kenarından bölgeye gider.
  static const double _labelColumn = 0.29;

  /// Çizimin en büyük genişliği (geniş ekranda şema aşırı büyümesin).
  static const double _maxWidth = 380;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = math.min(constraints.maxWidth, _maxWidth);
        final scale = width / _viewW;
        final height = _viewH * scale;
        // Dar şemada (≈300 dp altı) yazı küçülür ve durum sözcüğü gizlenir: etiket zaten renkli, ayrıntı yukarıdaki listede.
        final narrow = width < 300;
        return Center(
          child: SizedBox(
            width: width,
            height: height,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned.fill(
                  child: CustomPaint(painter: _DiagramPainter(states: states)),
                ),
                for (final region in _regions)
                  Positioned(
                    left: region.x * scale - 4,
                    top: region.y * scale,
                    width: region.w * scale + 8,
                    height: region.h * scale,
                    child: Semantics(
                      button: true,
                      label: '${names[region.key] ?? region.key}: ${_meta(states[region.key]).label}. Değiştirmek için dokun.',
                      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: () => onToggle(region.key)),
                    ),
                  ),
                for (final region in _regions) _label(region, scale: scale, width: width, narrow: narrow),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _label(_Region region, {required double scale, required double width, required bool narrow}) {
    final meta = _meta(states[region.key]);
    final side = region.side;
    final crossAxis = side == _Side.left
        ? CrossAxisAlignment.end
        : side == _Side.right
            ? CrossAxisAlignment.start
            : CrossAxisAlignment.center;
    final textAlign = side == _Side.left
        ? TextAlign.right
        : side == _Side.right
            ? TextAlign.left
            : TextAlign.center;
    final box = GestureDetector(
      onTap: () => onToggle(region.key),
      child: Container(
        width: side == _Side.left || side == _Side.right ? double.infinity : null,
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        decoration: BoxDecoration(
          color: meta.background,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: meta.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: crossAxis,
          children: [
            Text(
              names[region.key] ?? region.key,
              textAlign: textAlign,
              style: TextStyle(fontSize: narrow ? 9.5 : 11, fontWeight: FontWeight.w600, height: 1.15, color: const Color(0xFFF1F5F9)),
            ),
            if (!narrow) ...[
              const SizedBox(height: 2),
              Text(
                meta.upper,
                textAlign: textAlign,
                style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 0.8, color: meta.foreground),
              ),
            ],
          ],
        ),
      ),
    );

    final top = region.labelY * scale;
    switch (side) {
      case _Side.left:
        return Positioned(
          left: 0,
          top: top,
          width: width * _labelColumn,
          child: FractionalTranslation(translation: const Offset(0, -0.5), child: box),
        );
      case _Side.right:
        return Positioned(
          right: 0,
          top: top,
          width: width * _labelColumn,
          child: FractionalTranslation(translation: const Offset(0, -0.5), child: box),
        );
      case _Side.top:
      case _Side.bottom:
        return Positioned(
          left: width / 2,
          top: top,
          child: FractionalTranslation(translation: const Offset(-0.5, -0.5), child: box),
        );
    }
  }
}

enum _Side { left, right, top, bottom }

class _Region {
  const _Region(this.key, this.x, this.y, this.w, this.h, this.r, this.targetX, this.targetY, this.side, this.labelY);

  final String key;
  // Üstten görünümde bölgenin dikdörtgeni (çizim birimi).
  final double x, y, w, h, r;
  // Okun bölgedeki ucu.
  final double targetX, targetY;
  // Etiketin yeri: yan sütunlarda dikey konum, üst/alt etiketlerde şemanın ortası.
  final _Side side;
  final double labelY;

  /// Okun etikete bağlandığı nokta.
  Offset get anchor {
    switch (side) {
      case _Side.left:
        return Offset(CarPartsDiagram._viewW * CarPartsDiagram._labelColumn, labelY);
      case _Side.right:
        return Offset(CarPartsDiagram._viewW * (1 - CarPartsDiagram._labelColumn), labelY);
      case _Side.top:
        return Offset(CarPartsDiagram._viewW / 2, labelY + 16);
      case _Side.bottom:
        return Offset(CarPartsDiagram._viewW / 2, labelY - 16);
    }
  }
}

/// Araç üstten bakışla: ortada kaput-tavan-bagaj, iki yanda çamurluk ve kapılar. Etiketler üç satıra kadar uzar (ad iki satır + durum):
/// komşu etiketler arası en az ~62 birim bırakılır, yoksa dar ekranda üst üste biner (web ile aynı değerler).
const List<_Region> _regions = [
  _Region('hood', 146, 62, 48, 66, 18, 170, 90, _Side.top, 26),
  _Region('roof', 146, 144, 48, 94, 8, 176, 190, _Side.right, 222),
  _Region('trunk', 146, 254, 48, 68, 18, 170, 290, _Side.bottom, 394),
  _Region('f_l_fender', 120, 74, 22, 62, 10, 131, 105, _Side.left, 88),
  _Region('f_l_door', 120, 140, 22, 58, 6, 131, 169, _Side.left, 164),
  _Region('r_l_door', 120, 202, 22, 58, 6, 131, 231, _Side.left, 240),
  _Region('r_l_fender', 120, 264, 22, 60, 10, 131, 294, _Side.left, 316),
  _Region('f_r_fender', 198, 74, 22, 62, 10, 209, 105, _Side.right, 70),
  _Region('f_r_door', 198, 140, 22, 58, 6, 209, 169, _Side.right, 146),
  _Region('r_r_door', 198, 202, 22, 58, 6, 209, 231, _Side.right, 298),
  _Region('r_r_fender', 198, 264, 22, 60, 10, 209, 294, _Side.right, 374),
];

/// Çizimdeki parça anahtarları (testte parça adlarıyla tutarlılık denetimi için).
List<String> get carPartsDiagramKeys => [for (final region in _regions) region.key];

class _StateMeta {
  const _StateMeta({
    required this.label,
    required this.upper,
    required this.foreground,
    required this.background,
    required this.border,
    required this.fill,
    required this.stroke,
  });

  final String label;

  /// Büyük harfli yazım elle verilir: Dart'ın toUpperCase'i Türkçe "i"yi "I" yapar ("ORIJINAL", "DEĞIŞEN").
  final String upper;
  final Color foreground;
  final Color background;
  final Color border;

  /// Çizimdeki bölgenin dolgusu ve çizgisi (ok ve nokta çizgi renginde).
  final Color fill;
  final Color stroke;
}

_StateMeta _meta(String? state) {
  switch (state) {
    case 'replaced':
      return const _StateMeta(
        label: 'Değişen',
        upper: 'DEĞİŞEN',
        foreground: Color(0xFFFDA4AF),
        background: Color(0x26F43F5E),
        border: Color(0x4DF43F5E),
        fill: Color.fromRGBO(239, 68, 68, 0.62),
        stroke: Color(0xFFEF4444),
      );
    case 'painted':
      return const _StateMeta(
        label: 'Boyalı',
        upper: 'BOYALI',
        foreground: Color(0xFFFCD34D),
        background: Color(0x26F59E0B),
        border: Color(0x4DF59E0B),
        fill: Color.fromRGBO(234, 178, 74, 0.55),
        stroke: Color(0xFFEAB24A),
      );
    default:
      return const _StateMeta(
        label: 'Orijinal',
        upper: 'ORİJİNAL',
        foreground: Color(0xFF6EE7B7),
        background: Color(0x2610B981),
        border: Color(0x4D10B981),
        fill: Color.fromRGBO(16, 185, 129, 0.28),
        stroke: Color(0xFF10B981),
      );
  }
}

class _DiagramPainter extends CustomPainter {
  // Üst bileşen durum haritasını yerinde değiştirir: kopyası alınmazsa eski ve yeni çizici aynı haritayı gösterir,
  // shouldRepaint "değişmedi" der ve dokunulan bölgenin rengi güncellenmezdi.
  _DiagramPainter({required Map<String, String> states}) : states = Map.of(states);

  final Map<String, String> states;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / CarPartsDiagram._viewW;
    canvas.save();
    canvas.scale(scale);

    // Gövde, camlar ve tekerlekler (yalnızca süs).
    final body = Path()
      ..moveTo(170, 52)
      ..cubicTo(200, 52, 222, 64, 224, 94)
      ..lineTo(226, 150)
      ..lineTo(226, 250)
      ..lineTo(224, 312)
      ..cubicTo(222, 340, 200, 354, 170, 354)
      ..cubicTo(140, 354, 118, 340, 116, 312)
      ..lineTo(114, 250)
      ..lineTo(114, 150)
      ..lineTo(116, 94)
      ..cubicTo(118, 64, 140, 52, 170, 52)
      ..close();
    canvas.drawPath(body, Paint()..color = const Color.fromRGBO(30, 41, 59, 0.55));
    canvas.drawPath(
      body,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = const Color.fromRGBO(148, 163, 184, 0.45),
    );
    final glass = Paint()..color = const Color.fromRGBO(100, 116, 139, 0.45);
    canvas.drawPath(
      Path()
        ..moveTo(150, 131)
        ..lineTo(190, 131)
        ..lineTo(186, 142)
        ..lineTo(154, 142)
        ..close(),
      glass,
    );
    canvas.drawPath(
      Path()
        ..moveTo(154, 241)
        ..lineTo(186, 241)
        ..lineTo(190, 252)
        ..lineTo(150, 252)
        ..close(),
      glass,
    );
    final tireFill = Paint()..color = const Color.fromRGBO(15, 23, 42, 0.95);
    final tireStroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = const Color.fromRGBO(148, 163, 184, 0.35);
    for (final tire in const [Offset(108, 86), Offset(223, 86), Offset(108, 286), Offset(223, 286)]) {
      final rect = RRect.fromRectAndRadius(Rect.fromLTWH(tire.dx, tire.dy, 9, 30), const Radius.circular(4));
      canvas.drawRRect(rect, tireFill);
      canvas.drawRRect(rect, tireStroke);
    }

    for (final region in _regions) {
      final meta = _meta(states[region.key]);
      _dashedLine(
        canvas,
        region.anchor,
        Offset(region.targetX, region.targetY),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6
          ..color = meta.stroke,
      );
      final rect = RRect.fromRectAndRadius(Rect.fromLTWH(region.x, region.y, region.w, region.h), Radius.circular(region.r));
      canvas.drawRRect(rect, Paint()..color = meta.fill);
      canvas.drawRRect(
        rect,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..color = meta.stroke,
      );
      canvas.drawCircle(Offset(region.targetX, region.targetY), 3.5, Paint()..color = meta.stroke);
    }
    canvas.restore();
  }

  /// 3 birim çizgi, 3 birim boşluk (SVG'deki stroke-dasharray "3 3").
  void _dashedLine(Canvas canvas, Offset from, Offset to, Paint paint) {
    final delta = to - from;
    final length = delta.distance;
    if (length == 0) return;
    final direction = delta / length;
    for (double start = 0; start < length; start += 6) {
      final end = math.min(start + 3, length);
      canvas.drawLine(from + direction * start, from + direction * end, paint);
    }
  }

  @override
  bool shouldRepaint(_DiagramPainter old) => !_sameStates(old.states, states);

  bool _sameStates(Map<String, String> a, Map<String, String> b) {
    if (a.length != b.length) return false;
    for (final entry in a.entries) {
      if (b[entry.key] != entry.value) return false;
    }
    return true;
  }
}
