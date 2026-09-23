import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';

/// Canlı piyasa ortalaması — web'deki LiveMarketBadge ile birebir aynı eşik
/// ve kopya (Arabam üzerinden anlık ortalama, %15+ altındaysa "Fırsat aracı").
class LiveMarketBadge extends StatefulWidget {
  const LiveMarketBadge({super.key, required this.brand, required this.model, required this.price});

  final String brand;
  final String model;
  final int price;

  @override
  State<LiveMarketBadge> createState() => _LiveMarketBadgeState();
}

class _LiveMarketBadgeState extends State<LiveMarketBadge> {
  final _api = ApiService();
  final _money = NumberFormat.currency(locale: 'tr_TR', symbol: '₺', decimalDigits: 0);

  Map<String, dynamic>? _data;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await _api.fetchMarketAverage(widget.brand, widget.model).catchError((_) => null);
    if (mounted) {
      setState(() {
        _data = data;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return _box(
        child: const Row(
          children: [
            SizedBox(
              width: 12,
              height: 12,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            SizedBox(width: 8),
            Text('Canlı piyasa ortalaması hesaplanıyor…', style: TextStyle(fontSize: 12, color: Colors.white54)),
          ],
        ),
      );
    }

    final data = _data;
    if (data == null) {
      return _box(
        child: const Text(
          'Bu model için canlı piyasa ortalaması alınamadı.',
          style: TextStyle(fontSize: 12, color: Colors.white54),
        ),
      );
    }

    final avg = (data['avg'] as num).toDouble();
    final min = (data['min'] as num).toDouble();
    final max = (data['max'] as num).toDouble();
    final count = (data['count'] as num).toInt();
    final source = data['source']?.toString() ?? '';

    final diff = widget.price - avg;
    final pct = avg != 0 ? ((diff / avg) * 100).round() : 0;
    final isDeal = pct <= -15;
    final above = diff > 0;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.accent.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.accent.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'CANLI PİYASA ORTALAMASI',
                style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, letterSpacing: 1, color: AppTheme.accent),
              ),
              if (isDeal)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.green.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text(
                    'FIRSAT ARACI',
                    style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.greenAccent),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(_money.format(avg), style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900)),
              Text(
                diff == 0
                    ? 'Ortalamada'
                    : 'Bu ilan ${above ? '+' : ''}${_money.format(diff)} (${above ? '+' : ''}$pct%)',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.bold,
                  color: above ? Colors.redAccent : (diff < 0 ? Colors.greenAccent : Colors.white70),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '$count canlı ilan • ${_money.format(min)} – ${_money.format(max)}',
                style: const TextStyle(fontSize: 10.5, color: Colors.white38),
              ),
              Text(source, style: const TextStyle(fontSize: 10.5, color: Colors.white38)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _box({required Widget child}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        child: child,
      );
}
