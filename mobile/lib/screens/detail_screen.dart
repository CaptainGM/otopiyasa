import 'dart:async';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/services/recently_viewed_store.dart';
import 'package:otopiyasa/widgets/listing_interaction.dart';
import 'package:otopiyasa/screens/compare_screen.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/widgets/market_badge.dart';
import 'package:otopiyasa/widgets/live_market_badge.dart';
import 'package:otopiyasa/widgets/price_histogram.dart';
import 'package:otopiyasa/widgets/damage_diagram.dart';
import 'package:otopiyasa/widgets/report_dialog.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

class DetailScreen extends StatefulWidget {
  const DetailScreen({super.key, required this.carId});

  final String carId;

  @override
  State<DetailScreen> createState() => _DetailScreenState();
}

class _DetailScreenState extends State<DetailScreen> {
  final _api = ApiService();
  CarListing? _car;
  bool _loading = true;
  bool _isFavorite = false;
  bool _togglingFavorite = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final car = await _api.fetchCar(widget.carId);
      var isFavorite = false;
      if (_api.isLoggedIn) {
        final favoriteIds =
            (_api.currentUser?['favorites'] as List<dynamic>? ?? [])
                .map((id) => id.toString());
        isFavorite = favoriteIds.contains(widget.carId);
      }
      setState(() {
        _car = car;
        _isFavorite = isFavorite;
      });
      unawaited(RecentlyViewedStore.record(widget.carId));
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _toggleFavorite() async {
    if (!_api.isLoggedIn) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Favorilere eklemek için giriş yapmalısın')),
      );
      return;
    }

    setState(() => _togglingFavorite = true);
    try {
      if (_isFavorite) {
        await _api.removeFavorite(widget.carId);
      } else {
        await _api.addFavorite(widget.carId);
      }
      // Oturumdaki favori listesini tazele ki diğer ekranlar da güncel kalsın.
      _api.currentUser = await _api.me() ?? _api.currentUser;
      setState(() => _isFavorite = !_isFavorite);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => _togglingFavorite = false);
    }
  }

  Future<void> _openListing(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bağlantı açılamadı')),
      );
    }
  }

  String _formatPrice(int value) {
    return NumberFormat.currency(locale: 'tr_TR', symbol: '₺', decimalDigits: 0)
        .format(value);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('İlan Detayı'),
        actions: [
          IconButton(
            onPressed: _togglingFavorite ? null : _toggleFavorite,
            icon: Icon(
              _isFavorite ? Icons.favorite : Icons.favorite_outline,
              color: _isFavorite ? Colors.redAccent : null,
            ),
            tooltip: _isFavorite ? 'Favoriden çıkar' : 'Favorilere ekle',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : _buildContent(_car!),
    );
  }

  Widget _buildContent(CarListing car) {
    return ListView(
      children: [
        AspectRatio(
          aspectRatio: 16 / 10,
          child: Image.network(
            car.imageUrl,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => Container(
              color: AppTheme.card,
              child: const Icon(Icons.directions_car, size: 64),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    car.sourceSite.toUpperCase(),
                    style: const TextStyle(color: AppTheme.accent, fontWeight: FontWeight.bold),
                  ),
                  if (!car.isActive) ...[
                    const SizedBox(width: 8),
                    Chip(
                      label: Text(car.statusLabel, style: const TextStyle(fontSize: 11)),
                      visualDensity: VisualDensity.compact,
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 8),
              Text(
                car.title,
                style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              Text(
                '${car.city} • ${NumberFormat.decimalPattern('tr_TR').format(car.mileage)} km • ${car.year}',
                style: const TextStyle(color: Colors.white54),
              ),
              const SizedBox(height: 4),
              Text(
                '👁 ${car.viewCount} görüntülenme  •  ♥ ${car.favoriteCount} favori',
                style: const TextStyle(color: Colors.white38, fontSize: 12),
              ),
              if (!car.isActive) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                  ),
                  child: Text(
                    car.status == 'sold'
                        ? 'Bu ilan satıldı olarak işaretlendi. Yeni teklif ya da soru gönderilemez.'
                        : 'Bu ilan artık kaynak sitede bulunamıyor (satılmış ya da kaldırılmış olabilir).',
                    style: const TextStyle(fontSize: 12.5),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Text(
                _formatPrice(car.price),
                style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 16),
              LiveMarketBadge(brand: car.brand, model: car.model, price: car.price),
              const SizedBox(height: 12),
              MarketBadge(car: car),
              if (car.anomaly?.label == 'ucuz') ...[
                const SizedBox(height: 12),
                _anomalyCallout(
                  icon: '⚡',
                  title: 'İstatistiksel fırsat',
                  text:
                      'Bu ilan, ${car.segmentLabel} segmentindeki ${car.anomaly!.sampleCount} emsalin '
                      'ortalamasının %${car.anomaly!.pctFromMean.abs()} altında (z-skoru ${car.anomaly!.z}). '
                      'Fırsat olabilir — yine de düşük fiyatın nedenini (hasar, km, acil satış) kontrol et.',
                  color: Colors.greenAccent,
                ),
              ],
              if (car.anomaly?.label == 'pahali') ...[
                const SizedBox(height: 12),
                _anomalyCallout(
                  icon: '📈',
                  title: 'Piyasa üstü fiyat',
                  text:
                      'Bu ilan, ${car.segmentLabel} segmentindeki ${car.anomaly!.sampleCount} emsalin '
                      'ortalamasının %${car.anomaly!.pctFromMean} üzerinde (z-skoru ${car.anomaly!.z}). '
                      'Pazarlık payı olabilir.',
                  color: Colors.orangeAccent,
                ),
              ],
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _chip(car.fuelType),
                  _chip(car.transmission),
                  _chip(car.bodyType),
                ],
              ),
              if (car.priceHistory.length >= 2) ...[
                const SizedBox(height: 24),
                const Text(
                  'Fiyat geçmişi',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 12),
                _PriceHistoryChart(history: car.priceHistory),
              ],
              if (car.priceBins.isNotEmpty) ...[
                const SizedBox(height: 24),
                PriceHistogramChart(bins: car.priceBins, segmentLabel: car.segmentLabel),
              ],
              const SizedBox(height: 16),
              Text(car.description, style: const TextStyle(height: 1.6)),
              DamageDiagram(paintChange: car.paintChange, damageFlag: car.damageFlag, damageParts: car.damageParts),
              const SizedBox(height: 20),
              OutlinedButton.icon(
                onPressed: () async {
                  // context'i async boşluktan ÖNCE yakala; sonrasında State'in
                  // kendi `mounted` kontrolü geçerli olan.
                  final messenger = ScaffoldMessenger.of(context);
                  final navigator = Navigator.of(context);
                  final added = await CompareStore.toggle(car.id);
                  if (!mounted) return;
                  messenger.showSnackBar(
                    SnackBar(
                      content: Text(added
                          ? 'Karşılaştırmaya eklendi'
                          : 'Karşılaştırmadan çıkarıldı (ya da liste dolu)'),
                      action: SnackBarAction(
                        label: 'Aç',
                        onPressed: () => navigator.push(
                          MaterialPageRoute(builder: (_) => const CompareScreen()),
                        ),
                      ),
                    ),
                  );
                },
                icon: const Icon(Icons.compare_arrows),
                label: const Text('Karşılaştırmaya ekle'),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => SharePlus.instance.share(
                  ShareParams(text: '${car.title} — ${_formatPrice(car.price)}\nhttps://otopiyasa.app/cars/${car.id}'),
                ),
                icon: const Icon(Icons.ios_share),
                label: const Text('Paylaş'),
              ),
              if (car.listingUrl.isNotEmpty) ...[
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () => _openListing(car.listingUrl),
                  icon: const Icon(Icons.open_in_new),
                  label: const Text('Orijinal ilana git'),
                ),
              ],
              const SizedBox(height: 12),
              TextButton.icon(
                onPressed: () => showReportDialog(
                  context,
                  reasons: listingReportReasons,
                  onSubmit: (reason, note) => _api.reportListing(carId: car.id, reason: reason, note: note),
                ),
                icon: const Icon(Icons.flag_outlined, size: 16),
                label: const Text('İlanı bildir', style: TextStyle(fontSize: 12)),
                style: TextButton.styleFrom(foregroundColor: Colors.white54),
              ),
              // Teklif + soru-cevap (yalnızca üye ilanlarında ve aktif ilanlarda görünür).
              ListingInteraction(
                carId: car.id,
                sourceSite: car.sourceSite,
                listingPrice: car.price,
                isActive: car.isActive,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _anomalyCallout({
    required String icon,
    required String title,
    required String text,
    required Color color,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: RichText(
        text: TextSpan(
          style: DefaultTextStyle.of(context).style.copyWith(fontSize: 12.5, height: 1.4),
          children: [
            TextSpan(text: '$icon '),
            TextSpan(text: '$title: ', style: TextStyle(fontWeight: FontWeight.bold, color: color)),
            TextSpan(text: text),
          ],
        ),
      ),
    );
  }

  Widget _chip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Text(label, style: const TextStyle(fontSize: 12)),
    );
  }
}

class _PriceHistoryChart extends StatelessWidget {
  const _PriceHistoryChart({required this.history});

  final List<PricePoint> history;

  @override
  Widget build(BuildContext context) {
    final sorted = [...history]..sort((a, b) => a.recordedAt.compareTo(b.recordedAt));
    final spots = [
      for (var i = 0; i < sorted.length; i++)
        FlSpot(i.toDouble(), sorted[i].price.toDouble()),
    ];
    final prices = sorted.map((p) => p.price).toList();
    final minPrice = prices.reduce((a, b) => a < b ? a : b).toDouble();
    final maxPrice = prices.reduce((a, b) => a > b ? a : b).toDouble();
    final padding = ((maxPrice - minPrice) * 0.15).clamp(1000.0, double.infinity);
    final dateFormat = DateFormat('d MMM', 'tr_TR');
    final shortPrice = NumberFormat.compactCurrency(
      locale: 'tr_TR',
      symbol: '₺',
      decimalDigits: 0,
    );

    return Container(
      height: 220,
      padding: const EdgeInsets.fromLTRB(8, 16, 16, 8),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: LineChart(
        LineChartData(
          minY: minPrice - padding,
          maxY: maxPrice + padding,
          gridData: FlGridData(
            drawVerticalLine: false,
            getDrawingHorizontalLine: (_) => FlLine(
              color: Colors.white.withValues(alpha: 0.06),
              strokeWidth: 1,
            ),
          ),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            topTitles: const AxisTitles(),
            rightTitles: const AxisTitles(),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 56,
                getTitlesWidget: (value, _) => Text(
                  shortPrice.format(value),
                  style: const TextStyle(fontSize: 10, color: Colors.white54),
                ),
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                interval: (sorted.length / 4).clamp(1, double.infinity).toDouble(),
                getTitlesWidget: (value, _) {
                  final index = value.toInt();
                  if (index < 0 || index >= sorted.length) return const SizedBox();
                  return Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      dateFormat.format(sorted[index].recordedAt),
                      style: const TextStyle(fontSize: 10, color: Colors.white54),
                    ),
                  );
                },
              ),
            ),
          ),
          lineBarsData: [
            LineChartBarData(
              spots: spots,
              isCurved: true,
              curveSmoothness: 0.25,
              barWidth: 3,
              color: AppTheme.accent,
              dotData: FlDotData(show: sorted.length <= 12),
              belowBarData: BarAreaData(
                show: true,
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    AppTheme.accent.withValues(alpha: 0.25),
                    AppTheme.accent.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
