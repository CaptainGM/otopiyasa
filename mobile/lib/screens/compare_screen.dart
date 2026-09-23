import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Karşılaştırma listesi — cihazda saklanır (web'de de localStorage'da).
/// Giriş gerektirmez, bu yüzden sunucuda tutulmuyor.
class CompareStore {
  static const _key = 'compare_ids';
  static const maxItems = 4;

  static Future<List<String>> ids() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getStringList(_key) ?? [];
  }

  static Future<bool> contains(String carId) async => (await ids()).contains(carId);

  /// Ekli değilse ekler, ekliyse çıkarır. Yeni durumu (ekli mi) döner.
  static Future<bool> toggle(String carId) async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_key) ?? [];
    final wasThere = list.remove(carId);
    if (!wasThere) {
      if (list.length >= maxItems) return false; // sınır dolu
      list.add(carId);
    }
    await prefs.setStringList(_key, list);
    return !wasThere;
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}

/// KARŞILAŞTIRMA — web'deki `/compare` sayfasının mobil karşılığı.
/// Seçilen araçlar yan yana değil ALT ALTA satırlarda gösteriliyor (dar ekran).
class CompareScreen extends StatefulWidget {
  const CompareScreen({super.key});

  @override
  State<CompareScreen> createState() => _CompareScreenState();
}

class _CompareScreenState extends State<CompareScreen> {
  final _api = ApiService();
  final _money = NumberFormat.decimalPattern('tr_TR');

  List<CarListing> _cars = [];
  bool _loading = true;
  String? _error;

  String? _aiSummary;
  bool _aiLoading = false;
  bool _aiOpen = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final ids = await CompareStore.ids();
      if (ids.isEmpty) {
        setState(() {
          _cars = [];
          _loading = false;
        });
        return;
      }
      final cars = await _api.compareCars(ids);
      if (!mounted) return;
      setState(() {
        _cars = cars;
        _loading = false;
      });
      if (cars.length >= 2) _loadAiSummary(cars.map((c) => c.id).toList());
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Future<void> _loadAiSummary(List<String> ids) async {
    setState(() {
      _aiLoading = true;
      _aiSummary = null;
    });
    final summary = await _api.compareSummary(ids).catchError((_) => null);
    if (!mounted) return;
    setState(() {
      _aiSummary = summary;
      _aiLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Karşılaştır'),
        actions: [
          if (_cars.isNotEmpty)
            IconButton(
              tooltip: 'Listeyi temizle',
              icon: const Icon(Icons.delete_sweep_outlined),
              onPressed: () async {
                await CompareStore.clear();
                _load();
              },
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!)))
              : _cars.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(32),
                        child: Text(
                          'Karşılaştırma listen boş.\n\nİlan detayında "Karşılaştır" '
                          'düğmesine basarak en fazla 4 araç ekleyebilirsin.',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    )
                  : Stack(
                      children: [
                        _table(),
                        if (_cars.length >= 2)
                          Positioned(
                            left: 12,
                            right: 12,
                            bottom: 12,
                            child: _aiSummaryCard(),
                          ),
                      ],
                    ),
    );
  }

  Widget _aiSummaryCard() {
    if (!_aiOpen) {
      return Align(
        alignment: Alignment.centerRight,
        child: FilledButton.icon(
          onPressed: () => setState(() => _aiOpen = true),
          icon: const Text('🤖'),
          label: const Text('AI Önerisi'),
        ),
      );
    }
    if (!_aiLoading && (_aiSummary == null || _aiSummary!.isEmpty)) return const SizedBox.shrink();
    return Card(
      elevation: 8,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('🤖 AI Önerisi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                IconButton(
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  iconSize: 18,
                  onPressed: () => setState(() => _aiOpen = false),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 6),
            if (_aiLoading)
              const Row(
                children: [
                  SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2)),
                  SizedBox(width: 8),
                  Text('Araçlar analiz ediliyor…', style: TextStyle(fontSize: 12.5, color: Colors.white54)),
                ],
              )
            else
              Text(_aiSummary ?? '', style: const TextStyle(fontSize: 13, height: 1.4)),
          ],
        ),
      ),
    );
  }

  Widget _table() {
    // En iyi (en düşük) değerleri vurgulamak için önce hesapla.
    final minPrice = _cars.map((c) => c.price).reduce((a, b) => a < b ? a : b);
    final minMileage = _cars.map((c) => c.mileage).reduce((a, b) => a < b ? a : b);
    final maxYear = _cars.map((c) => c.year).reduce((a, b) => a > b ? a : b);

    return ListView(
      padding: EdgeInsets.fromLTRB(12, 12, 12, _cars.length >= 2 ? 100 : 12),
      children: [
        for (final car in _cars)
          Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.network(
                          car.imageUrl,
                          width: 96,
                          height: 72,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => Container(
                            width: 96,
                            height: 72,
                            color: Colors.white10,
                            child: const Icon(Icons.directions_car),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(car.title,
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  _row('Fiyat', '${_money.format(car.price)} ₺', best: car.price == minPrice),
                  _row('Kilometre', '${_money.format(car.mileage)} km',
                      best: car.mileage == minMileage),
                  _row('Yıl', car.year.toString(), best: car.year == maxYear),
                  _row('Yakıt', car.fuelType),
                  _row('Vites', car.transmission),
                  _row('Şehir', car.city),
                ],
              ),
            ),
          ),
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 8),
          child: Text(
            'Yeşil işaretli değerler o satırda en avantajlı olanı gösterir.',
            style: TextStyle(fontSize: 12, color: Colors.white54),
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
  }

  Widget _row(String label, String value, {bool best = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.white54, fontSize: 13)),
          Row(
            children: [
              if (best)
                const Padding(
                  padding: EdgeInsets.only(right: 4),
                  child: Icon(Icons.check_circle, size: 15, color: Colors.greenAccent),
                ),
              Text(value,
                  style: TextStyle(
                    fontWeight: best ? FontWeight.w900 : FontWeight.normal,
                    color: best ? Colors.greenAccent : null,
                  )),
            ],
          ),
        ],
      ),
    );
  }
}
