/// Fiyatın kendi segmentindeki yeri — web ile aynı kural (bkz. src/lib/market-position.ts):
///  - ±%6 içinde: piyasa değerinde
///  - %6+ altında: ucuz; %30+ altında: şüpheli ucuz (hatalı fiyat ya da kapora dolandırıcılığı olabilir)
///  - %6+ üstünde: pahalı; ortalamanın 5 katından fazlaysa: olası veri hatası
/// Gösterge ibresi 0 farkta ortada, her %1 fark için %2,5 kayar (uçlarda %6–%94 arasında kalır).
///
/// DİKKAT: bu sabitler web tarafındaki TEK KAYNAĞIN (src/lib/market-thresholds.ts) aynasıdır.
/// Uygulama web API'sinden yalnızca fiyat/ortalama/emsal sayısını aldığı için eşikler istemcide
/// hesaplanır; bir eşiği değiştirirken İKİ dosya birlikte güncellenmelidir.
const int fairBandPct = 6;
const int suspiciousPct = 30;
const int minMarketComparables = 3;
/// Ortalamanın bu katından pahalı ilan veri hatası sayılır ("%74453 pahalı" gibi anlamsız
/// etiketler yerine "Piyasa dışı fiyat" yazılır).
const int absurdPricePct = 400;

enum MarketBand { suspicious, cheap, fair, pricey, invalid }

class MarketPosition {
  const MarketPosition({required this.pct, required this.band, required this.marker, required this.label});

  /// Ortalamaya göre fark yüzdesi (eksi = ucuz).
  final int pct;
  final MarketBand band;

  /// Gösterge üzerindeki yer, 0.06–0.94.
  final double marker;
  final String label;

  static MarketPosition? of(int price, int? avg, int? count) {
    if (price <= 0 || avg == null || avg <= 0 || count == null || count < minMarketComparables) return null;
    final pct = (((price - avg) / avg) * 100).round();
    final marker = ((50 + pct * 2.5) / 100).clamp(0.06, 0.94).toDouble();
    if (pct > absurdPricePct) {
      return MarketPosition(pct: pct, band: MarketBand.invalid, marker: 0.94, label: 'Piyasa dışı fiyat');
    }
    if (pct <= -suspiciousPct) {
      return MarketPosition(pct: pct, band: MarketBand.suspicious, marker: marker, label: 'Şüpheli ucuz');
    }
    if (pct <= -fairBandPct) {
      return MarketPosition(pct: pct, band: MarketBand.cheap, marker: marker, label: '%${pct.abs()} ucuz');
    }
    if (pct >= fairBandPct) {
      return MarketPosition(pct: pct, band: MarketBand.pricey, marker: marker, label: '%$pct pahalı');
    }
    return MarketPosition(pct: pct, band: MarketBand.fair, marker: marker, label: 'Piyasa değerinde');
  }
}
