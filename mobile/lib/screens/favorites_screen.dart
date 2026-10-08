import 'package:flutter/material.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/widgets/car_card.dart';
import 'package:otopiyasa/widgets/favorite_sheets.dart';
import 'package:otopiyasa/widgets/listing_image.dart';

/// Favoriler sekmesinin verisi ve işlemleri. Hem liste kartları ekranı hem tek liste ekranı aynı nesneyi kullanır.
class FavoritesController extends ChangeNotifier {
  final _api = ApiService();

  List<CarListing> cars = [];
  List<UnavailableFavorite> unavailable = [];
  List<FavoriteList> lists = [];
  Map<String, FavoriteMeta> meta = {};
  bool loading = true;
  String? error;

  Future<void> load({bool quiet = false}) async {
    if (!quiet) {
      loading = true;
      error = null;
      notifyListeners();
    }
    try {
      final result = await _api.fetchFavorites();
      cars = result.available;
      unavailable = result.unavailable;
      lists = result.lists;
      meta = result.meta;
      error = null;
    } catch (e) {
      error = e.toString().replaceFirst('Exception: ', '');
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  FavoriteList? listById(String? id) {
    for (final list in lists) {
      if (list.id == id) return list;
    }
    return null;
  }

  FavoriteList? listOf(String carId) {
    for (final list in lists) {
      if (list.contains(carId)) return list;
    }
    return null;
  }

  List<CarListing> carsIn(FavoriteList list) => cars.where((c) => list.contains(c.id)).toList();
  List<UnavailableFavorite> unavailableIn(FavoriteList list) => unavailable.where((c) => list.contains(c.id)).toList();
  int countOf(FavoriteList list) => carsIn(list).length + unavailableIn(list).length;

  /// Hata varsa kullanıcıya gösterilecek metni döner.
  Future<String?> _guard(Future<void> Function() action) async {
    try {
      await action();
      return null;
    } catch (e) {
      return e.toString().replaceFirst('Exception: ', '');
    }
  }

  Future<String?> applyPick(String carId, FavoriteListPick pick) => _guard(() async {
        lists = await applyFavoriteListPick(_api, carId, pick);
        notifyListeners();
      });

  Future<String?> createList(String name) => _guard(() async {
        lists = await _api.createFavoriteList(name);
        notifyListeners();
      });

  Future<String?> renameList(String id, String name) => _guard(() async {
        lists = await _api.renameFavoriteList(id, name);
        notifyListeners();
      });

  Future<String?> deleteList(String id) => _guard(() async {
        lists = await _api.deleteFavoriteList(id);
        notifyListeners();
      });

  Future<String?> removeCar(String carId) => _guard(() async {
        await _api.removeFavorite(carId);
        cars.removeWhere((c) => c.id == carId);
        unavailable.removeWhere((c) => c.id == carId);
        meta.remove(carId);
        lists = [
          for (final list in lists) FavoriteList(id: list.id, name: list.name, carIds: list.carIds.where((e) => e != carId).toList()),
        ];
        notifyListeners();
      });

  void setMeta(String carId, FavoriteMeta value) {
    final isDefault = value.note.isEmpty && value.alertMode == 'any' && value.alertEmail && value.alertPush;
    if (isDefault) {
      meta.remove(carId);
    } else {
      meta[carId] = value;
    }
    notifyListeners();
  }
}

/// Favoriler sekmesi: önce liste kartları ("Favori Listem" + kendi listeler), bir listeye dokununca ilanları.
class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  final _api = ApiService();
  final _controller = FavoritesController();

  @override
  void initState() {
    super.initState();
    _api.authRevision.addListener(_onAuthChanged);
    ApiService.favoritesRevision.addListener(_onFavoritesChanged);
    if (_api.isLoggedIn) _controller.load();
  }

  @override
  void dispose() {
    _api.authRevision.removeListener(_onAuthChanged);
    ApiService.favoritesRevision.removeListener(_onFavoritesChanged);
    _controller.dispose();
    super.dispose();
  }

  void _onAuthChanged() {
    if (_api.isLoggedIn) _controller.load();
  }

  // Başka ekranlarda (ilan detayı) favori değişince sessizce tazele.
  void _onFavoritesChanged() {
    if (_api.isLoggedIn && !_controller.loading) _controller.load(quiet: true);
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _createList() async {
    final name = await askFavoriteListName(context, title: 'Yeni liste', action: 'Oluştur');
    if (name == null || name.isEmpty) return;
    final error = await _controller.createList(name);
    if (error != null) _snack(error);
  }

  void _openList(FavoriteList list) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => FavoriteListScreen(controller: _controller, listId: list.id)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Favorilerim')),
      body: ValueListenableBuilder<int>(
        valueListenable: _api.authRevision,
        builder: (context, _, _) {
          if (!_api.isLoggedIn) return _loginPrompt(context);
          return ListenableBuilder(
            listenable: _controller,
            builder: (context, _) {
              if (_controller.loading) return const Center(child: CircularProgressIndicator());
              if (_controller.error != null) {
                return ListView(
                  padding: const EdgeInsets.all(24),
                  children: [
                    const SizedBox(height: 48),
                    Text(_controller.error!, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    Center(child: OutlinedButton(onPressed: _controller.load, child: const Text('Tekrar dene'))),
                  ],
                );
              }
              return RefreshIndicator(
                onRefresh: _controller.load,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  children: [
                    if (_controller.cars.isEmpty && _controller.unavailable.isEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(
                          'Henüz favori ilanın yok. Beğendiğin ilanın sayfasındaki kalbe dokun.',
                          style: TextStyle(color: AppColors.of(context).muted),
                        ),
                      ),
                    for (final list in _controller.lists) ...[
                      _ListCard(controller: _controller, list: list, onTap: () => _openList(list)),
                      const SizedBox(height: 10),
                    ],
                    OutlinedButton.icon(
                      onPressed: _createList,
                      icon: const Icon(Icons.add),
                      label: const Text('Yeni liste'),
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _loginPrompt(BuildContext context) {
    final c = AppColors.of(context);
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 64),
        Icon(Icons.favorite_border, size: 48, color: c.faint),
        const SizedBox(height: 12),
        const Text('Favorilerini görmek için giriş yap', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 6),
        Text(
          'Beğendiğin ilanları listelere ayır, not ekle, fiyatı düşünce haber al.',
          textAlign: TextAlign.center,
          style: TextStyle(color: c.muted, height: 1.35),
        ),
        const SizedBox(height: 16),
        Center(child: FilledButton(onPressed: () => Navigator.of(context).pushNamed('/login'), child: const Text('Giriş yap / Kayıt ol'))),
      ],
    );
  }
}

/// Liste kartı: ad, ilan sayısı ve ilk üç ilanın küçük resmi.
class _ListCard extends StatelessWidget {
  const _ListCard({required this.controller, required this.list, required this.onTap});

  final FavoritesController controller;
  final FavoriteList list;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final covers = controller.carsIn(list).map((car) => car.imageUrl).where((u) => u.isNotEmpty).take(3).toList();
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (list.isDefault) ...[const Icon(Icons.favorite, size: 16, color: Colors.redAccent), const SizedBox(width: 6)],
                  Expanded(
                    child: Text(list.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  ),
                  const SizedBox(width: 8),
                  Text('${controller.countOf(list)} ilan', style: TextStyle(color: c.muted, fontSize: 12.5)),
                  Icon(Icons.chevron_right, color: c.faint),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  for (var i = 0; i < 3; i++) ...[
                    if (i > 0) const SizedBox(width: 8),
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: AspectRatio(
                          aspectRatio: 4 / 3,
                          child: i < covers.length
                              ? ListingImage(url: covers[i], cacheWidth: 200)
                              : ColoredBox(color: c.border.withValues(alpha: 0.4)),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tek bir listenin ilanları. Her ilanın altında not, bildirim özeti ve seçenekler; karta uzun basınca da menü açılır.
class FavoriteListScreen extends StatelessWidget {
  const FavoriteListScreen({super.key, required this.controller, required this.listId});

  final FavoritesController controller;
  final String listId;

  void _snack(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _rename(BuildContext context, FavoriteList list) async {
    final name = await askFavoriteListName(context, title: 'Listeyi yeniden adlandır', initial: list.name, action: 'Kaydet');
    if (name == null || name.isEmpty || name == list.name) return;
    final error = await controller.renameList(list.id, name);
    if (error != null && context.mounted) _snack(context, error);
  }

  Future<void> _delete(BuildContext context, FavoriteList list) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Liste silinsin mi?'),
        content: Text('"${list.name}" listesi silinir; içindeki ilanlar "Favori Listem"e taşınır.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Vazgeç')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Sil')),
        ],
      ),
    );
    if (ok != true) return;
    final error = await controller.deleteList(list.id);
    if (!context.mounted) return;
    if (error != null) {
      _snack(context, error);
    } else {
      Navigator.of(context).pop();
    }
  }

  Future<void> _openMenu(BuildContext context, CarListing car) async {
    final list = controller.listOf(car.id);
    final action = await showFavoriteCarMenu(
      context,
      title: car.title,
      listName: list?.name ?? 'Favori Listem',
      meta: controller.meta[car.id],
    );
    if (action == null || !context.mounted) return;
    switch (action) {
      case FavoriteMenuAction.note:
        await _editNote(context, car);
      case FavoriteMenuAction.alert:
        await _editAlert(context, car);
      case FavoriteMenuAction.move:
        final pick = await showFavoriteListPicker(
          context,
          title: 'Hangi listeye taşıyalım?',
          lists: controller.lists,
          currentId: list?.id,
        );
        if (pick == null || !context.mounted) return;
        final error = await controller.applyPick(car.id, pick);
        if (context.mounted) _snack(context, error ?? 'İlan taşındı');
      case FavoriteMenuAction.remove:
        final error = await controller.removeCar(car.id);
        if (context.mounted) _snack(context, error ?? 'Favorilerden kaldırıldı');
    }
  }

  Future<void> _editNote(BuildContext context, CarListing car) async {
    final saved = await showFavoriteNoteSheet(context, carId: car.id, meta: controller.meta[car.id]);
    if (saved != null) controller.setMeta(car.id, saved);
  }

  Future<void> _editAlert(BuildContext context, CarListing car) async {
    final saved = await showFavoriteAlertSheet(context, carId: car.id, meta: controller.meta[car.id], price: car.price);
    if (saved != null) controller.setMeta(car.id, saved);
  }

  Widget _footer(BuildContext context, CarListing car) {
    final c = AppColors.of(context);
    final meta = controller.meta[car.id];
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 6, 0, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (meta != null && meta.note.isNotEmpty)
            InkWell(
              borderRadius: BorderRadius.circular(8),
              onTap: () => _editNote(context, car),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                margin: const EdgeInsets.only(bottom: 4),
                decoration: BoxDecoration(color: AppTheme.accent.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.edit_note, size: 17, color: AppTheme.accent),
                    const SizedBox(width: 6),
                    Expanded(child: Text(meta.note, style: const TextStyle(fontSize: 12.5, color: AppTheme.accent, height: 1.3))),
                  ],
                ),
              ),
            ),
          Row(
            children: [
              Expanded(
                child: InkWell(
                  borderRadius: BorderRadius.circular(6),
                  onTap: () => _editAlert(context, car),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Icon(Icons.notifications_none, size: 15, color: c.muted),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            (meta ?? const FavoriteMeta()).alertSummary,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(color: c.muted, fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              TextButton.icon(
                onPressed: () => _openMenu(context, car),
                icon: const Icon(Icons.more_horiz, size: 18),
                label: const Text('Seçenekler'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Satılmış/kaldırılmış favori: solgun, dokunulamaz kart. Yalnızca favoriden çıkarılabilir.
  Widget _unavailableCard(BuildContext context, UnavailableFavorite item) {
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
                      colorFilter: const ColorFilter.mode(Colors.grey, BlendMode.saturation),
                      child: ListingImage(url: item.imageUrl, cacheWidth: 240),
                    )
                  else
                    const ColoredBox(color: Color(0xFF202631)),
                  Positioned(
                    left: 6,
                    top: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.8), borderRadius: BorderRadius.circular(6)),
                      child: Text(item.statusLabel, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFFFB7185))),
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
                    Text(item.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 2),
                    Text('${item.brand} ${item.model} · ${item.year}', style: const TextStyle(fontSize: 11.5, color: Colors.white54)),
                    const SizedBox(height: 2),
                    const Text('Bu ilan artık yayında değil.', style: TextStyle(fontSize: 11, color: Colors.white38)),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () async {
                          final error = await controller.removeCar(item.id);
                          if (context.mounted) _snack(context, error ?? 'Favorilerden kaldırıldı');
                        },
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
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final list = controller.listById(listId);
        if (list == null) {
          // Liste silindiyse ekran kapanır; bu kare boş kalır.
          return const Scaffold(body: SizedBox.shrink());
        }
        final cars = controller.carsIn(list);
        final gone = controller.unavailableIn(list);
        return Scaffold(
          appBar: AppBar(
            title: Text(list.name),
            actions: [
              if (!list.isDefault)
                PopupMenuButton<String>(
                  onSelected: (value) => value == 'rename' ? _rename(context, list) : _delete(context, list),
                  itemBuilder: (_) => const [
                    PopupMenuItem(value: 'rename', child: Text('Yeniden adlandır')),
                    PopupMenuItem(value: 'delete', child: Text('Listeyi sil')),
                  ],
                ),
            ],
          ),
          body: cars.isEmpty && gone.isEmpty
              ? ListView(
                  padding: const EdgeInsets.all(24),
                  children: [
                    const SizedBox(height: 48),
                    Icon(Icons.bookmark_border, size: 44, color: AppColors.of(context).faint),
                    const SizedBox(height: 10),
                    Text(
                      'Bu liste henüz boş.\nBaşka bir listedeki ilanın "Seçenekler" menüsünden buraya taşıyabilirsin.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.of(context).muted, height: 1.4),
                    ),
                  ],
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  children: [
                    for (final car in cars) ...[
                      GestureDetector(
                        behavior: HitTestBehavior.translucent,
                        onLongPress: () => _openMenu(context, car),
                        child: CarCard(car: car),
                      ),
                      _footer(context, car),
                      const SizedBox(height: 14),
                    ],
                    if (gone.isNotEmpty) ...[
                      const Padding(
                        padding: EdgeInsets.only(top: 8, bottom: 4),
                        child: Text('Artık yayında olmayan ilanlar', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white70)),
                      ),
                      for (final item in gone) ...[
                        _unavailableCard(context, item),
                        const SizedBox(height: 10),
                      ],
                    ],
                  ],
                ),
        );
      },
    );
  }
}
