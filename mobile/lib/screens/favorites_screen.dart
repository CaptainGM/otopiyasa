import 'package:flutter/material.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/widgets/car_card.dart';
import 'package:otopiyasa/widgets/listing_image.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  final _api = ApiService();
  List<CarListing> _favorites = [];
  List<UnavailableFavorite> _unavailable = [];
  bool _loading = true;
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
      final result = await _api.fetchFavorites();
      setState(() {
        _favorites = result.available;
        _unavailable = result.unavailable;
      });
    } catch (error) {
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _remove(String id, String title) async {
    try {
      await _api.removeFavorite(id);
      setState(() {
        _favorites.removeWhere((item) => item.id == id);
        _unavailable.removeWhere((item) => item.id == id);
      });
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$title favorilerden çıkarıldı')));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    }
  }

  /// Satılmış/kaldırılmış favori: solgun, dokunulamaz kart. Yalnızca favoriden çıkarılabilir.
  Widget _unavailableCard(UnavailableFavorite item) {
    return Opacity(
      opacity: 0.8,
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: Row(
          children: [
            SizedBox(
              width: 110,
              height: 96,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (item.imageUrl.isNotEmpty)
                    ColorFiltered(
                      colorFilter: const ColorFilter.mode(
                        Colors.grey,
                        BlendMode.saturation,
                      ),
                      child: ListingImage(url: item.imageUrl, cacheWidth: 240),
                    )
                  else
                    const ColoredBox(color: Color(0xFF202631)),
                  Positioned(
                    left: 6,
                    top: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.8),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        item.statusLabel,
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFFB7185),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${item.brand} ${item.model} · ${item.year}',
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Colors.white54,
                      ),
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      'Bu ilan artık yayında değil.',
                      style: TextStyle(fontSize: 11, color: Colors.white38),
                    ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () => _remove(item.id, item.title),
                        child: const Text('Favorilerden çıkar'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isEmpty = _favorites.isEmpty && _unavailable.isEmpty;
    return Scaffold(
      appBar: AppBar(title: const Text('Favorilerim')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
            ? ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  const SizedBox(height: 48),
                  Text(_error!, textAlign: TextAlign.center),
                ],
              )
            : isEmpty
            ? ListView(
                padding: const EdgeInsets.all(24),
                children: const [
                  SizedBox(height: 48),
                  Icon(Icons.favorite_border, size: 48, color: Colors.white38),
                  SizedBox(height: 12),
                  Text(
                    'Henüz favori ilanın yok.\nBeğendiğin ilanların kalbine dokun.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white54),
                  ),
                ],
              )
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  for (final car in _favorites) ...[
                    Stack(
                      children: [
                        CarCard(car: car),
                        Positioned(
                          right: 10,
                          top: 10,
                          child: IconButton.filledTonal(
                            onPressed: () => _remove(car.id, car.title),
                            icon: const Icon(
                              Icons.favorite,
                              color: Colors.redAccent,
                            ),
                            tooltip: 'Favoriden çıkar',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                  ],
                  if (_unavailable.isNotEmpty) ...[
                    const Padding(
                      padding: EdgeInsets.only(top: 8, bottom: 4),
                      child: Text(
                        'Artık yayında olmayan ilanlar',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Colors.white70,
                        ),
                      ),
                    ),
                    for (final item in _unavailable) ...[
                      _unavailableCard(item),
                      const SizedBox(height: 10),
                    ],
                  ],
                ],
              ),
      ),
    );
  }
}
