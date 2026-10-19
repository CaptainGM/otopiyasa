import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';

final _n = NumberFormat.decimalPattern('tr_TR');

/// Ana ekranın en üstündeki piyasa panosu — web ana sayfasının "Piyasa panosu" kutularıyla aynı veri
/// (bkz. src/app/page.tsx, src/lib/market-board.ts). Veri gelmezse (hata/ağ) hiçbir şey göstermez; sayfa
/// bir istatistik eksik diye bozulmasın.
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
    final total = (board['total'] as num?)?.toInt();
    final addedLastDay = (board['addedLastDay'] as num?)?.toInt();
    final featured = (board['featured'] as num?)?.toInt();
    final sources = (board['sources'] as num?)?.toInt();
    if (total == null) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: _tile(context, 'Aktif ilan', _n.format(total))),
              _divider(c),
              Expanded(child: _tile(context, 'Son 24 saat', '+${_n.format(addedLastDay ?? 0)}')),
            ],
          ),
          Divider(height: 1, thickness: 1, color: c.border),
          Row(
            children: [
              Expanded(
                child: _tile(
                  context,
                  'Fırsat ve kıyas ilanı',
                  featured == null ? '—' : _n.format(featured),
                  valueColor: c.cheap,
                  note: 'Haftanın fırsatları ile her marka, model ve yılın en düşük fiyatlı ilanı, tekrarsız',
                ),
              ),
              _divider(c),
              Expanded(child: _tile(context, 'Kaynak site', '${sources ?? '—'}')),
            ],
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
          Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.4, color: c.muted)),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(fontSize: 21, fontWeight: FontWeight.w800, color: valueColor, fontFeatures: const [FontFeature.tabularFigures()]),
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
