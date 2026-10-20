import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';

final _n = NumberFormat.decimalPattern('tr_TR');

/// Ana ekranın en üstündeki piyasa panosu — web ana sayfasının hero bölümüyle aynı kimlik, küçültülmüş:
/// canlı rozet, başlık, renkli açıklama metni ve istatistik kutuları (bkz. src/app/page.tsx, src/lib/market-board.ts).
/// Veri gelmezse (hata/ağ) hiçbir şey göstermez; sayfa bir istatistik eksik diye bozulmasın.
class MarketBoardPanel extends StatefulWidget {
  const MarketBoardPanel({super.key});

  @override
  State<MarketBoardPanel> createState() => _MarketBoardPanelState();
}

class _MarketBoardPanelState extends State<MarketBoardPanel> {
  final _api = ApiService();
  Map<String, dynamic>? _board;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final board = await _api.fetchMarketBoard();
    if (mounted) setState(() => _board = board);
  }

  @override
  Widget build(BuildContext context) {
    final board = _board;
    if (board == null) return const SizedBox.shrink();
    return MarketBoardContent(board: board);
  }
}

/// Panonun saf gösterimi (ağ çağrısı yapmaz) — [MarketBoardPanel] bunu veri gelince kullanır; testler de doğrudan
/// bunu, örnek veriyle, dar ekran genişliklerinde taşma olmadığını doğrulamak için kullanır.
class MarketBoardContent extends StatelessWidget {
  const MarketBoardContent({super.key, required this.board});

  final Map<String, dynamic> board;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final total = (board['total'] as num?)?.toInt();
    final addedLastDay = (board['addedLastDay'] as num?)?.toInt();
    final featured = (board['featured'] as num?)?.toInt();
    final sources = (board['sources'] as num?)?.toInt();
    if (total == null) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: c.border),
      ),
      child: Stack(
        children: [
          // Köşedeki altın ışıltı — web'deki .hero::before radial-gradient (bkz. globals.css).
          const Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment(-0.88, -0.8),
                  radius: 1.15,
                  colors: [Color(0x24F0B23C), Colors.transparent],
                  stops: [0.0, 0.65],
                ),
              ),
            ),
          ),
          // İnce ölçü ızgarası — web'deki .grid-paper zemini (bkz. src/app/globals.css).
          Positioned.fill(child: CustomPaint(painter: _GridPaperPainter(isDark: isDark))),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Canlı rozet — web'deki yanıp sönen halkalı nokta + "Piyasa panosu · canlı" (eyebrow: PlexMono).
                // Expanded (kesme yok): dar ekranda ya da büyütülmüş yazıda sarar, "..." ile kesilmez.
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    const _LiveDot(),
                    const SizedBox(width: 7),
                    Expanded(
                      child: Text(
                        'PİYASA PANOSU · CANLI',
                        style: TextStyle(fontFamily: AppTheme.mono, fontSize: 10.5, fontWeight: FontWeight.w600, letterSpacing: 0.8, color: c.muted),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                // Başlık — web'deki font-display (Archivo Bold).
                Text(
                  'Fiyat iyi mi?',
                  style: TextStyle(fontFamily: AppTheme.display, fontSize: 24, fontWeight: FontWeight.w700, height: 1.05, color: onSurface),
                ),
                Text(
                  'Piyasaya sor.',
                  style: TextStyle(fontFamily: AppTheme.display, fontSize: 24, fontWeight: FontWeight.w700, height: 1.05, color: c.muted),
                ),
                const SizedBox(height: 8),
                Text.rich(
                  TextSpan(
                    style: TextStyle(fontSize: 12.5, height: 1.4, color: c.muted),
                    children: [
                      TextSpan(text: '${sources ?? 8} kaynaktan toplanan her ilan kendi marka, model ve yıl emsalleriyle '
                          'karşılaştırılır. Kartlardaki çizgi fiyatın yerini gösterir: '),
                      TextSpan(text: 'ucuz', style: TextStyle(color: c.cheap, fontWeight: FontWeight.w700)),
                      const TextSpan(text: ', '),
                      TextSpan(text: 'adil', style: TextStyle(color: c.fair, fontWeight: FontWeight.w700)),
                      const TextSpan(text: ', '),
                      TextSpan(text: 'pahalı', style: TextStyle(color: c.pricey, fontWeight: FontWeight.w700)),
                      const TextSpan(text: '.'),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: c.border)),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Expanded(child: _tile(context, 'AKTİF İLAN', _n.format(total))),
                          _divider(c),
                          Expanded(child: _tile(context, 'SON 24 SAAT', '+${_n.format(addedLastDay ?? 0)}')),
                        ],
                      ),
                      Divider(height: 1, thickness: 1, color: c.border),
                      Row(
                        children: [
                          Expanded(
                            child: _tile(
                              context,
                              'FIRSAT VE KIYAS İLANI',
                              featured == null ? '—' : _n.format(featured),
                              valueColor: c.cheap,
                              note: 'Haftanın fırsatları ile her marka, model ve yılın en düşük fiyatlı ilanı, tekrarsız',
                            ),
                          ),
                          _divider(c),
                          Expanded(child: _tile(context, 'KAYNAK SİTE', '${sources ?? '—'}')),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _divider(AppColors c) => Container(width: 1, color: c.border);

  Widget _tile(BuildContext context, String label, String value, {Color? valueColor, String? note}) {
    final c = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 13),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontFamily: AppTheme.mono, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.3, color: c.muted)),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontFamily: AppTheme.mono,
              fontSize: 21,
              fontWeight: FontWeight.w500,
              letterSpacing: -0.3,
              color: valueColor,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          if (note != null) ...[
            const SizedBox(height: 4),
            Text(note, style: TextStyle(fontSize: 10.5, height: 1.25, color: c.muted)),
          ],
        ],
      ),
    );
  }
}

/// Web'deki canlı nokta: etrafında yavaşça büyüyüp sönen halka (bkz. .live-dot::after / @keyframes live-ping,
/// src/app/globals.css). Renk temadan bağımsız sabit yeşil (web'de de --cheap doğrudan kullanılıyor).
class _LiveDot extends StatefulWidget {
  const _LiveDot();

  @override
  State<_LiveDot> createState() => _LiveDotState();
}

class _LiveDotState extends State<_LiveDot> with SingleTickerProviderStateMixin {
  static const _cheap = Color(0xFF34D399);
  late final AnimationController _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 2400))..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 15,
      height: 15,
      child: Stack(
        alignment: Alignment.center,
        children: [
          AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              // CSS: 0% scale(0.5) opacity 0.8 → 100% scale(1.6) opacity 0, ease-out.
              final t = Curves.easeOut.transform(_controller.value);
              final scale = 0.5 + t * 1.1;
              final opacity = 0.8 * (1 - t);
              return Opacity(
                opacity: opacity.clamp(0.0, 1.0),
                child: Transform.scale(
                  scale: scale,
                  child: Container(
                    width: 15,
                    height: 15,
                    decoration: const BoxDecoration(shape: BoxShape.circle, border: Border.fromBorderSide(BorderSide(color: _cheap, width: 1))),
                  ),
                ),
              );
            },
          ),
          Container(width: 7, height: 7, decoration: const BoxDecoration(color: _cheap, shape: BoxShape.circle)),
        ],
      ),
    );
  }
}

/// Web'deki `.grid-paper` zemini: 32 px aralıklı, çok soluk ölçü çizgileri (bkz. src/app/globals.css).
class _GridPaperPainter extends CustomPainter {
  const _GridPaperPainter({required this.isDark});

  final bool isDark;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = isDark ? Colors.white.withValues(alpha: 0.035) : const Color(0xFF1C1A16).withValues(alpha: 0.05)
      ..strokeWidth = 1;
    const step = 32.0;
    for (double x = 0; x <= size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y <= size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant _GridPaperPainter oldDelegate) => oldDelegate.isDark != isDark;
}
