// "Boya / değişen" özetini ayrıştırır — web'deki lib/damage-report.ts'in
// birebir Dart karşılığı. Kaynak site parça adı değil SAYI veriyor
// ("1 değişen, 3 boyalı" gibi), o yüzden burada da aynı kalıp aranıyor.

enum DamageLevel { original, light, moderate, heavy, unknown }

class DamageReport {
  const DamageReport({
    required this.changed,
    required this.painted,
    required this.localPainted,
    required this.allOriginal,
    required this.unknown,
    required this.affected,
    required this.level,
    required this.summary,
  });

  final int changed;
  final int painted;
  final int localPainted;
  final bool allOriginal;
  final bool unknown;
  final int affected;
  final DamageLevel level;
  final String summary;
}

int _countOf(String text, String labelPattern) {
  final match = RegExp('(\\d+)\\s*$labelPattern', caseSensitive: false).firstMatch(text);
  if (match == null) return 0;
  return int.tryParse(match.group(1) ?? '') ?? 0;
}

const _empty = DamageReport(
  changed: 0,
  painted: 0,
  localPainted: 0,
  allOriginal: false,
  unknown: true,
  affected: 0,
  level: DamageLevel.unknown,
  summary: 'Boya/değişen bilgisi belirtilmemiş.',
);

DamageReport parseDamageReport(String? raw) {
  final text = (raw ?? '').trim();
  final lower = text.toLowerCase();

  if (text.isEmpty || lower.contains('belirtilmemiş')) return _empty;

  if (RegExp(r'tamamı\s+or[ji]inal').hasMatch(lower)) {
    return const DamageReport(
      changed: 0,
      painted: 0,
      localPainted: 0,
      allOriginal: true,
      unknown: false,
      affected: 0,
      level: DamageLevel.original,
      summary: 'Aracın tamamı orijinal — boyalı ya da değişen parça yok.',
    );
  }

  if (RegExp(r'tamamı\s+boyalı').hasMatch(lower)) {
    return const DamageReport(
      changed: 0,
      painted: 0,
      localPainted: 0,
      allOriginal: false,
      unknown: false,
      affected: 0,
      level: DamageLevel.heavy,
      summary: 'Aracın tamamı boyalı.',
    );
  }

  // ÖNEMLİ: "lokal boyalı" ifadesi "boyalı" kalıbını da içeriyor — önce
  // lokali ayıklayıp metinden çıkarıyoruz, yoksa aynı parça iki kez sayılır.
  final localPainted = _countOf(lower, r'lokal\s+boyalı');
  final withoutLocal = lower.replaceAll(RegExp(r'\d+\s*lokal\s+boyalı'), '');
  final painted = _countOf(withoutLocal, r'boyalı');
  final changed = _countOf(lower, r'değişen');

  final affected = changed + painted + localPainted;
  if (affected == 0) return _empty;

  final score = changed * 3 + painted * 2 + localPainted;
  final level = score >= 12 ? DamageLevel.heavy : (score >= 5 ? DamageLevel.moderate : DamageLevel.light);

  final parts = <String>[];
  if (changed > 0) parts.add('$changed değişen');
  if (painted > 0) parts.add('$painted boyalı');
  if (localPainted > 0) parts.add('$localPainted lokal boyalı');

  return DamageReport(
    changed: changed,
    painted: painted,
    localPainted: localPainted,
    allOriginal: false,
    unknown: false,
    affected: affected,
    level: level,
    summary: '${parts.join(", ")} parça bildirilmiş.',
  );
}

String damageLevelLabel(DamageLevel level) {
  switch (level) {
    case DamageLevel.original:
      return 'Tamamı orijinal';
    case DamageLevel.light:
      return 'Az sayıda işlem';
    case DamageLevel.moderate:
      return 'Orta düzeyde işlem';
    case DamageLevel.heavy:
      return 'Yoğun işlem görmüş';
    case DamageLevel.unknown:
      return 'Bilgi yok';
  }
}

/// Parçanın araç siluetindeki yaklaşık konumu (260x220 görüş alanında) —
/// web'deki partPosition() ile aynı anahtar kelime eşleştirmesi.
class PartPosition {
  const PartPosition(this.x, this.y);
  final double x;
  final double y;
}

PartPosition partPositionOf(String name) {
  final n = name.toLowerCase();
  final isRight = n.contains('sağ');
  final isLeft = n.contains('sol');
  final isFront = n.contains('ön');
  final isRear = n.contains('arka');
  final double? side = isRight ? 85 : (isLeft ? 35 : null);

  if (n.contains('tampon')) return PartPosition(60, isRear ? 218 : 12);
  if (n.contains('kaput')) return PartPosition(60, isRear ? 192 : 38);
  if (n.contains('bagaj')) return const PartPosition(60, 192);
  if (n.contains('tavan')) return const PartPosition(60, 108);
  if (n.contains('ayna')) return PartPosition(side ?? 85, 68);
  if (n.contains('çamurluk')) return PartPosition(side ?? 85, isRear ? 158 : 66);
  if (n.contains('kapı')) return PartPosition(side ?? 85, isRear ? 128 : 92);
  if (n.contains('far') || n.contains('stop')) return PartPosition(side ?? 85, isRear ? 204 : 20);
  if (side != null) return PartPosition(side, isFront ? 40 : (isRear ? 180 : 108));
  if (isFront) return const PartPosition(60, 30);
  if (isRear) return const PartPosition(60, 198);
  return const PartPosition(60, 108);
}
