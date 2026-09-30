/// "3 saat önce", "2 gün önce" gibi kısa Türkçe göreli zaman.
/// Webdeki `formatRelativeTr` (src/lib/utils.ts) ile aynı kuralları kullanır.
String relativeTimeTr(DateTime value, {DateTime? now}) {
  final diff = (now ?? DateTime.now()).difference(value);
  final minutes = diff.isNegative ? 0 : diff.inMinutes;
  if (minutes < 1) return 'az önce';
  if (minutes < 60) return '$minutes dk önce';
  final hours = minutes ~/ 60;
  if (hours < 24) return '$hours saat önce';
  final days = hours ~/ 24;
  if (days < 30) return '$days gün önce';
  final months = days ~/ 30;
  if (months < 12) return '$months ay önce';
  return '${days ~/ 365} yıl önce';
}
