import 'package:flutter/material.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/models/damage_report.dart';

const Map<DamageLevel, Color> _levelColor = {
  DamageLevel.original: Color(0xFF10B981),
  DamageLevel.light: Color(0xFFEAB24A),
  DamageLevel.moderate: Color(0xFFF97316),
  DamageLevel.heavy: Color(0xFFEF4444),
  DamageLevel.unknown: Color(0xFF64748B),
};

const Map<String, Color> _partStateColor = {
  'Değişmiş': Color(0xFFEF4444),
  'Boyanmış': Color(0xFFF97316),
  'Lokal Boyanmış': Color(0xFFEAB24A),
  'Orijinal': Color(0xFF10B981),
};

const Map<String, String> _partStateLabel = {
  'Değişmiş': 'değişmiş',
  'Boyanmış': 'boyanmış',
  'Lokal Boyanmış': 'lokal boyalı',
  'Orijinal': 'orijinal',
};

const _maxArrows = 8;

/// Hasar/boya görsel özeti — web'deki DamageDiagram'ın mobil karşılığı.
/// Parça bazlı veri varsa araç siluetinde yaklaşık konumlarına ok çeker
/// (bkz. models/damage_report.dart partPositionOf), yoksa yalnızca özet
/// sayıları gösterir. Bilgi kaynak sitenin beyanıdır, tahmin değildir.
class DamageDiagram extends StatelessWidget {
  const DamageDiagram({
    super.key,
    this.paintChange,
    this.damageFlag = false,
    this.damageParts = const [],
  });

  final String? paintChange;
  final bool damageFlag;
  final List<DamagePart> damageParts;

  @override
  Widget build(BuildContext context) {
    final report = parseDamageReport(paintChange);
    final tone = _levelColor[report.level]!;
    final affectedParts = damageParts
        .where((p) => p.state == 'Değişmiş' || p.state == 'Boyanmış' || p.state == 'Lokal Boyanmış')
        .toList();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Hasar / boya durumu', style: Theme.of(context).textTheme.titleMedium),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: tone.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    damageLevelLabel(report.level),
                    style: TextStyle(color: tone, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 200,
              width: double.infinity,
              child: CustomPaint(
                painter: _CarDamagePainter(color: tone, report: report, affectedParts: affectedParts),
              ),
            ),
            const SizedBox(height: 12),
            Text(report.summary, style: TextStyle(color: tone, fontSize: 13)),
            if (!report.unknown && !report.allOriginal) ...[
              const SizedBox(height: 8),
              if (report.changed > 0) _row('${report.changed} parça değişmiş', 'Orijinal parça sökülüp yenisi takılmış — en ciddi müdahale.'),
              if (report.painted > 0) _row('${report.painted} parça boyanmış', 'Parçanın tamamı yeniden boyanmış.'),
              if (report.localPainted > 0)
                _row('${report.localPainted} parça lokal boyalı', 'Parçanın yalnızca küçük bir bölümü boyanmış (çizik/ufak darbe).'),
            ],
            if (affectedParts.isNotEmpty) ...[
              const SizedBox(height: 10),
              const Text(
                'İŞLEM GÖRMÜŞ PARÇALAR',
                style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, letterSpacing: 0.6, color: Colors.white38),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: affectedParts.map((part) {
                  final c = _partStateColor[part.state] ?? Colors.white54;
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: RichText(
                      text: TextSpan(
                        style: const TextStyle(fontSize: 11.5),
                        children: [
                          TextSpan(text: part.name, style: const TextStyle(color: Colors.white)),
                          const TextSpan(text: ' — ', style: TextStyle(color: Colors.white38)),
                          TextSpan(text: _partStateLabel[part.state] ?? part.state, style: TextStyle(color: c)),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
            if (damageFlag) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.red.withValues(alpha: 0.25)),
                ),
                child: const Text(
                  'Bu araçta hasar kaydı bildirilmiş. Satın almadan önce ekspertiz yaptırman önerilir.',
                  style: TextStyle(fontSize: 11.5, color: Colors.redAccent),
                ),
              ),
            ],
            const SizedBox(height: 8),
            Text(
              'Bilgi ilan sahibinin/kaynak sitenin beyanıdır.'
              '${affectedParts.isEmpty ? ' Bu ilan için parça bazlı ayrıntı kaynakta bulunmadığından yalnızca sayılar gösteriliyor.' : ''}',
              style: const TextStyle(fontSize: 10.5, color: Colors.white38),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(String title, String hint) => Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            Text(hint, style: const TextStyle(fontSize: 11, color: Colors.white38)),
          ],
        ),
      );
}

class _CarDamagePainter extends CustomPainter {
  _CarDamagePainter({required this.color, required this.report, required this.affectedParts});

  final Color color;
  final DamageReport report;
  final List<DamagePart> affectedParts;

  // Web'deki 260x220 SVG viewBox'ıyla aynı koordinat sistemi — araç 6px sağa
  // kaydırılmış, viewBox'a orantılı ölçeklenir.
  static const double _vbW = 260;
  static const double _vbH = 220;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / _vbW < size.height / _vbH ? size.width / _vbW : size.height / _vbH;
    final dx = (size.width - _vbW * scale) / 2;
    final dy = (size.height - _vbH * scale) / 2;
    canvas.save();
    canvas.translate(dx, dy);
    canvas.scale(scale);

    _drawCarBody(canvas);

    if (affectedParts.isNotEmpty) {
      _drawPartArrows(canvas);
    } else {
      _drawSummaryLabels(canvas);
    }

    canvas.restore();
  }

  void _drawCarBody(Canvas canvas) {
    // Basitleştirilmiş üstten görünüm silueti — web'deki tam bezier yoluna
    // birebir değil ama aynı oranlarda tanınabilir bir araç formu.
    final body = Path()
      ..moveTo(66, 8)
      ..quadraticBezierTo(90, 8, 94, 40)
      ..quadraticBezierTo(97, 70, 97, 110)
      ..quadraticBezierTo(97, 150, 94, 180)
      ..quadraticBezierTo(90, 212, 66, 212)
      ..lineTo(60, 212)
      ..quadraticBezierTo(36, 212, 32, 180)
      ..quadraticBezierTo(29, 150, 29, 110)
      ..quadraticBezierTo(29, 70, 32, 40)
      ..quadraticBezierTo(36, 8, 60, 8)
      ..close();

    canvas.drawPath(body, Paint()..color = color.withValues(alpha: 0.28)..style = PaintingStyle.fill);
    canvas.drawPath(
      body,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );

    // Ön cam / arka cam ipucu
    final glassPaint = Paint()..color = color.withValues(alpha: 0.18);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(44, 46, 32, 20), const Radius.circular(4)), glassPaint);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(40, 156, 40, 18), const Radius.circular(4)), glassPaint);
    // Kabin gövdesi
    canvas.drawRRect(
      RRect.fromRectAndRadius(const Rect.fromLTWH(42, 72, 36, 78), const Radius.circular(8)),
      Paint()..color = color.withValues(alpha: 0.14),
    );
    // Aynalar
    final mirrorPaint = Paint()..color = color.withValues(alpha: 0.5);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(27, 70, 9, 6), const Radius.circular(3)), mirrorPaint);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(84, 70, 9, 6), const Radius.circular(3)), mirrorPaint);
  }

  void _drawDashedLine(Canvas canvas, Offset a, Offset b, Color c) {
    const dashLength = 3.0;
    const gapLength = 3.0;
    final total = (b - a).distance;
    if (total == 0) return;
    final direction = (b - a) / total;
    var covered = 0.0;
    final paint = Paint()
      ..color = c
      ..strokeWidth = 1.6;
    while (covered < total) {
      final start = a + direction * covered;
      final end = a + direction * (covered + dashLength).clamp(0, total);
      canvas.drawLine(start, end, paint);
      covered += dashLength + gapLength;
    }
  }

  void _label(Canvas canvas, String text, Offset at, Color c, {double fontSize = 12}) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: TextStyle(color: const Color(0xFFE2E8F0), fontSize: fontSize, fontWeight: FontWeight.bold)),
      textDirection: TextDirection.ltr,
    )..layout();
    painter.paint(canvas, at);
  }

  void _drawPartArrows(Canvas canvas) {
    final withPos = affectedParts.map((p) => (part: p, pos: partPositionOf(p.name))).toList()
      ..sort((a, b) => a.pos.y.compareTo(b.pos.y));
    final shown = withPos.take(_maxArrows).toList();
    final extra = withPos.length - shown.length;

    const top = 24.0;
    const bottom = 200.0;
    final gap = shown.length > 1 ? (bottom - top) / (shown.length - 1) : 0.0;

    for (var i = 0; i < shown.length; i++) {
      final part = shown[i].part;
      final pos = shown[i].pos;
      final bodyX = pos.x + 6;
      final labelY = shown.length == 1 ? 110.0 : top + i * gap;
      final tone = _partStateColor[part.state] ?? const Color(0xFF94A3B8);

      _drawDashedLine(canvas, Offset(bodyX, pos.y), Offset(140, labelY), tone);
      canvas.drawCircle(Offset(bodyX, pos.y), 3.5, Paint()..color = tone);
      _label(canvas, part.name, Offset(146, labelY - 6), tone, fontSize: 11);
    }
    if (extra > 0) {
      _label(canvas, '+$extra parça daha (aşağıdaki listede)', const Offset(146, bottom + 10), const Color(0xFF64748B), fontSize: 10);
    }
  }

  void _drawSummaryLabels(Canvas canvas) {
    final labels = <(String, Color)>[];
    if (report.allOriginal) {
      labels.add(('Tamamı orijinal', const Color(0xFF10B981)));
    } else if (report.unknown) {
      labels.add(('Bilgi verilmemiş', const Color(0xFF64748B)));
    } else {
      if (report.changed > 0) labels.add(('${report.changed} değişen', const Color(0xFFEF4444)));
      if (report.painted > 0) labels.add(('${report.painted} boyalı', const Color(0xFFF97316)));
      if (report.localPainted > 0) labels.add(('${report.localPainted} lokal boyalı', const Color(0xFFEAB24A)));
      if (labels.isEmpty) labels.add(('Tamamı boyalı', const Color(0xFFEF4444)));
    }

    const top = 40.0;
    final gap = labels.length > 1 ? 130.0 / (labels.length - 1) : 0.0;
    for (var i = 0; i < labels.length; i++) {
      final y = labels.length == 1 ? 110.0 : top + i * gap;
      final (text, tone) = labels[i];
      _drawDashedLine(canvas, Offset(102, y), Offset(140, y), tone);
      canvas.drawCircle(Offset(102, y), 3.5, Paint()..color = tone);
      _label(canvas, text, Offset(146, y - 6), tone);
    }
  }

  @override
  bool shouldRepaint(covariant _CarDamagePainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.report != report || oldDelegate.affectedParts != affectedParts;
}
