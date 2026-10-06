/// Kart başlığı web ile aynı (bkz. src/lib/car-headline.ts): "Opel Insignia 1.6 CDTI". Satıcının ilan başlığı
/// ("2016 OPEL İNSİGNİA 123.000 KM'DE...") ikinci satırda kalır.
final _caps = RegExp(r'(?<![A-Za-zÇĞİÖŞÜçğıöşü0-9])[A-ZÇĞİÖŞÜ]{4,}(?![A-Za-zÇĞİÖŞÜçğıöşü0-9])');
final _vowel = RegExp(r'[AEIOUÖÜİ]');

/// Büyük harfle yazılmış model adlarını düzeltir ("SPORTAGE" → "Sportage", "GOLF" → "Golf"); kısa kodlar
/// (GLC, AMG), I ile biten motor kodları (TDCI, TFSI) ve rakamlı ifadeler olduğu gibi kalır.
String tidyCaps(String text) => text.replaceAllMapped(_caps, (m) {
      final word = m.group(0)!;
      if (word.length == 4 && (!_vowel.hasMatch(word) || word.endsWith('I') || word.endsWith('İ'))) return word;
      // Model adları çoğunlukla yabancı: I da İ de "i" olur ("COMBI" → "Combi").
      return word[0] + word.substring(1).replaceAll(RegExp('[Iİ]'), 'i').toLowerCase();
    });

String carHeadline({required String title, String brand = '', String model = ''}) {
  final b = brand.trim();
  final m = model.trim();
  if (b.isEmpty || m.isEmpty) return title;
  final name = m.toLowerCase().startsWith(b.toLowerCase()) ? m : '$b $m';
  return tidyCaps(name);
}
