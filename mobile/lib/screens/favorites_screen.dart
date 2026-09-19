import 'package:flutter/material.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/widgets/car_card.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  final _api = ApiService();
  List<CarListing> _favorites = [];
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
      final favorites = await _api.fetchFavorites();
      setState(() => _favorites = favorites);
    } catch (error) {
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _remove(CarListing car) async {
    try {
      await _api.removeFavorite(car.id);
      setState(() => _favorites.removeWhere((item) => item.id == car.id));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${car.title} favorilerden çıkarıldı')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
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
                : _favorites.isEmpty
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
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _favorites.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 14),
                        itemBuilder: (context, index) {
                          final car = _favorites[index];
                          return Stack(
                            children: [
                              CarCard(car: car),
                              Positioned(
                                right: 10,
                                top: 10,
                                child: IconButton.filledTonal(
                                  onPressed: () => _remove(car),
                                  icon: const Icon(Icons.favorite, color: Colors.redAccent),
                                  tooltip: 'Favoriden çıkar',
                                ),
                              ),
                            ],
                          );
                        },
                      ),
      ),
    );
  }
}
