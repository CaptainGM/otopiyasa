import 'package:flutter/material.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/widgets/car_card.dart';

/// Hazır bir sorgunun sonuçları (ör. asistanın "1 milyon altı dizel" önerisi).
/// Parametreler web'deki arama adresiyle aynıdır, bu yüzden /api/cars'a olduğu gibi gider.
class SearchResultsScreen extends StatefulWidget {
  const SearchResultsScreen({super.key, required this.params, required this.title});

  final Map<String, String> params;
  final String title;

  @override
  State<SearchResultsScreen> createState() => _SearchResultsScreenState();
}

class _SearchResultsScreenState extends State<SearchResultsScreen> {
  final _api = ApiService();
  final _scroll = ScrollController();
  final List<CarListing> _cars = [];
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  int _page = 1;
  int _totalPages = 1;
  int _total = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 600) _loadMore();
    });
    _load();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await _api.fetchCarsByQuery(widget.params);
      if (!mounted) return;
      setState(() {
        _cars
          ..clear()
          ..addAll(data.items);
        _page = data.page;
        _totalPages = data.totalPages;
        _total = data.total;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    if (_loading || _loadingMore || _page >= _totalPages) return;
    setState(() => _loadingMore = true);
    try {
      final data = await _api.fetchCarsByQuery(widget.params, page: _page + 1);
      if (!mounted) return;
      setState(() {
        _cars.addAll(data.items);
        _page = data.page;
        _totalPages = data.totalPages;
      });
    } catch (_) {
      // Sonraki sayfa yüklenemezse liste olduğu gibi kalır; kaydırınca yeniden denenir.
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!),
                      const SizedBox(height: 12),
                      OutlinedButton(onPressed: _load, child: const Text('Tekrar dene')),
                    ],
                  ),
                )
              : _cars.isEmpty
                  ? const Center(child: Text('Bu kriterlere uyan ilan bulunamadı.'))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        controller: _scroll,
                        padding: const EdgeInsets.all(16),
                        itemCount: _cars.length + 1,
                        separatorBuilder: (_, _) => const SizedBox(height: 12),
                        itemBuilder: (context, i) {
                          if (i == 0) {
                            return Text(
                              '$_total ilan bulundu',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            );
                          }
                          return CarCard(car: _cars[i - 1]);
                        },
                      ),
                    ),
    );
  }
}
