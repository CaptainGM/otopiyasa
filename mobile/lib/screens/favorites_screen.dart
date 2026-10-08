import 'package:flutter/material.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/widgets/car_card.dart';
import 'package:otopiyasa/widgets/favorite_lists_sheet.dart';
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
  List<FavoriteList> _lists = [];
  // null = "Tümü", aksi halde seçili grubun kimliği.
  String? _activeListId;
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
        _lists = result.lists;
        if (_activeListId != null && !_lists.any((l) => l.id == _activeListId)) _activeListId = null;
      });
    } catch (error) {
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  FavoriteList? get _activeList {
    for (final list in _lists) {
      if (list.id == _activeListId) return list;
    }
    return null;
  }

  List<CarListing> get _visibleCars {
    final list = _activeList;
    if (list == null) return _favorites;
    return _favorites.where((car) => list.contains(car.id)).toList();
  }

  int _countOf(FavoriteList list) => _favorites.where((car) => list.contains(car.id)).length;

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<String?> _askName({required String title, String initial = '', required String action}) {
    final controller = TextEditingController(text: initial);
    return showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: 40,
          textInputAction: TextInputAction.done,
          onSubmitted: (value) => Navigator.pop(dialogContext, value.trim()),
          decoration: const InputDecoration(hintText: 'ör. Sedan, SUV, Aile arabası'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Vazgeç')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, controller.text.trim()), child: Text(action)),
        ],
      ),
    );
  }

  Future<void> _createList() async {
    final name = await _askName(title: 'Yeni grup', action: 'Oluştur');
    if (name == null || name.isEmpty) return;
    final before = _lists.map((l) => l.id).toSet();
    try {
      final updated = await _api.createFavoriteList(name);
      if (!mounted) return;
      setState(() {
        _lists = updated;
        _activeListId = updated.where((l) => !before.contains(l.id)).map((l) => l.id).firstOrNull;
      });
    } catch (error) {
      _snack(error.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _renameList(FavoriteList list) async {
    final name = await _askName(title: 'Grubu yeniden adlandır', initial: list.name, action: 'Kaydet');
    if (name == null || name.isEmpty || name == list.name) return;
    try {
      final updated = await _api.renameFavoriteList(list.id, name);
      if (mounted) setState(() => _lists = updated);
    } catch (error) {
      _snack(error.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _deleteList(FavoriteList list) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Grup silinsin mi?'),
        content: Text('"${list.name}" grubu silinir; içindeki ilanlar favorilerinde kalır.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Vazgeç')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Sil')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final updated = await _api.deleteFavoriteList(list.id);
      if (mounted) {
        setState(() {
          _lists = updated;
          _activeListId = null;
        });
      }
    } catch (error) {
      _snack(error.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _removeFromActiveList(String carId) async {
    final list = _activeList;
    if (list == null) return;
    try {
      final updated = await _api.setCarInFavoriteList(list.id, carId, add: false);
      if (mounted) setState(() => _lists = updated);
    } catch (error) {
      _snack(error.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _assignLists(String carId) => showFavoriteListsSheet(
        context,
        carId: carId,
        lists: _lists,
        onChanged: (updated) {
          if (mounted) setState(() => _lists = updated);
        },
      );

  /// "Tümü" + grup sekmeleri + "Yeni grup".
  Widget _listChips() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          ChoiceChip(
            label: Text('Tümü (${_favorites.length})'),
            selected: _activeListId == null,
            onSelected: (_) => setState(() => _activeListId = null),
          ),
          for (final list in _lists) ...[
            const SizedBox(width: 8),
            ChoiceChip(
              label: Text('${list.name} (${_countOf(list)})'),
              selected: _activeListId == list.id,
              onSelected: (_) => setState(() => _activeListId = list.id),
            ),
          ],
          const SizedBox(width: 8),
          ActionChip(
            avatar: const Icon(Icons.add, size: 18),
            label: const Text('Yeni grup'),
            onPressed: _createList,
          ),
        ],
      ),
    );
  }

  Future<void> _remove(String id, String title) async {
    try {
      await _api.removeFavorite(id);
      setState(() {
        _favorites.removeWhere((item) => item.id == id);
        _unavailable.removeWhere((item) => item.id == id);
        // Favoriden çıkan ilan sunucuda gruplardan da çıkar; ekran da aynısını yapsın.
        _lists = [
          for (final list in _lists)
            FavoriteList(id: list.id, name: list.name, carIds: list.carIds.where((e) => e != id).toList()),
        ];
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
                  _listChips(),
                  if (_activeList case final list?) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${_countOf(list)} ilan · ${list.name}',
                            style: TextStyle(color: AppColors.of(context).muted, fontSize: 12.5),
                          ),
                        ),
                        TextButton(onPressed: () => _renameList(list), child: const Text('Yeniden adlandır')),
                        TextButton(onPressed: () => _deleteList(list), child: const Text('Sil')),
                      ],
                    ),
                  ],
                  const SizedBox(height: 10),
                  if (_activeListId != null && _visibleCars.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 36),
                      child: Text(
                        'Bu grup henüz boş.\n"Tümü" sekmesinde bir ilanın üstündeki etiket düğmesiyle buraya ilan ekleyebilirsin.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.of(context).muted, height: 1.4),
                      ),
                    ),
                  for (final car in _visibleCars) ...[
                    Stack(
                      children: [
                        CarCard(car: car),
                        Positioned(
                          right: 10,
                          top: 10,
                          child: Row(
                            children: [
                              IconButton.filledTonal(
                                onPressed: () => _assignLists(car.id),
                                icon: const Icon(Icons.label_outline),
                                tooltip: 'Gruplara ekle',
                              ),
                              const SizedBox(width: 6),
                              if (_activeListId != null)
                                IconButton.filledTonal(
                                  onPressed: () => _removeFromActiveList(car.id),
                                  icon: const Icon(Icons.bookmark_remove_outlined),
                                  tooltip: 'Gruptan çıkar',
                                )
                              else
                                IconButton.filledTonal(
                                  onPressed: () => _remove(car.id, car.title),
                                  icon: const Icon(Icons.favorite, color: Colors.redAccent),
                                  tooltip: 'Favoriden çıkar',
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                  ],
                  if (_unavailable.isNotEmpty && _activeListId == null) ...[
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
