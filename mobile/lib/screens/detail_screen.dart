import 'dart:async';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/widgets/fuel_cost_card.dart';
import 'package:otopiyasa/widgets/listing_description.dart';
import 'package:otopiyasa/widgets/listing_map.dart';
import 'package:otopiyasa/services/recently_viewed_store.dart';
import 'package:otopiyasa/widgets/listing_interaction.dart';
import 'package:otopiyasa/screens/compare_screen.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/utils/relative_time.dart';
import 'package:otopiyasa/widgets/market_badge.dart';
import 'package:otopiyasa/widgets/price_histogram.dart';
import 'package:otopiyasa/widgets/damage_diagram.dart';
import 'package:otopiyasa/widgets/favorite_sheets.dart';
import 'package:otopiyasa/widgets/report_dialog.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:otopiyasa/widgets/listing_image.dart';
import 'package:otopiyasa/utils/car_headline.dart';
import 'package:otopiyasa/utils/tr_text.dart';
import 'package:otopiyasa/widgets/car_card.dart' show SourcePill, PhotoBadge;
import 'package:otopiyasa/widgets/market_gauge.dart';
import 'package:otopiyasa/widgets/market_tempo_card.dart';

class DetailScreen extends StatefulWidget {
  const DetailScreen({super.key, required this.carId, this.initialCar});

  final String carId;
  final CarListing? initialCar;

  @override
  State<DetailScreen> createState() => _DetailScreenState();
}

class _DetailScreenState extends State<DetailScreen> {
  final _api = ApiService();
  CarListing? _car;
  bool _loading = true;
  bool _isFavorite = false;
  bool _togglingFavorite = false;
  List<FavoriteList> _favLists = const [];
  FavoriteMeta? _favMeta;
  String? _error;
  int _activeImageIndex = 0;
  Map<String, dynamic>? _fuelCost;
  bool _inCompare = false;
  static const _similarStep = 6;
  int _similarShown = _similarStep;

  @override
  void initState() {
    super.initState();
    CompareStore.contains(widget.carId).then((value) {
      if (mounted) setState(() => _inCompare = value);
    });
    // Yayından kaldırılmış araç kontrolü: Eğer initialCar aktif değilse ve kullanıcı admin değilse gösterme
    if (widget.initialCar != null && !widget.initialCar!.isActive && !_api.isAdmin) {
      _car = null;
      _error = 'Bu ilan yayından kaldırılmış veya bulunamadı.';
      _loading = false;
    } else {
      _car = widget.initialCar;
      _loading = widget.initialCar == null;
    }
    _load();
    if (_api.isLoggedIn) _loadFavoriteState();
    // Görüntülenme + bekçi önceliği (kaynakta son kontrolü eski ilan sıranın başına alınır).
    _api.reportView(widget.carId);
    _api.fetchFuelCost(widget.carId).then((cost) {
      if (mounted && cost != null) setState(() => _fuelCost = cost);
    });
  }

  Future<void> _load() async {
    if (_car == null) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final car = await _api.fetchCar(widget.carId);
      // İlan kaldırılmış veya satılmışsa ve kullanıcı admin değilse gösterme
      if (!car.isActive && !_api.isAdmin) {
        if (mounted) {
          setState(() {
            _car = null;
            _error = 'Bu ilan yayından kaldırılmış veya bulunamadı.';
            _loading = false;
          });
        }
        return;
      }
      var isFavorite = false;
      if (_api.isLoggedIn) {
        final favoriteIds =
            (_api.currentUser?['favorites'] as List<dynamic>? ?? [])
                .map((id) => id.toString());
        isFavorite = favoriteIds.contains(widget.carId);
      }
      if (mounted) {
        setState(() {
          _car = car;
          _isFavorite = isFavorite;
          _loading = false;
        });
      }
      unawaited(RecentlyViewedStore.record(widget.carId));
    } catch (error) {
      if (mounted) {
        setState(() {
          _car = null;
          _error = 'Bu ilan yayından kaldırılmış veya bulunamadı.';
          _loading = false;
        });
      }
    }
  }

  /// Favori kimliği, listeler ve bu ilanın not/bildirim ayarı.
  Future<void> _loadFavoriteState() async {
    try {
      final state = await _api.fetchFavoriteState();
      if (!mounted) return;
      setState(() {
        _isFavorite = state.ids.contains(widget.carId);
        _favLists = state.lists;
        _favMeta = state.meta[widget.carId];
      });
    } catch (_) {
      // Durum alınamazsa kalp, oturumdaki favori listesine göre görünmeye devam eder.
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  FavoriteList? get _currentFavList {
    for (final list in _favLists) {
      if (list.contains(widget.carId)) return list;
    }
    return null;
  }

  /// Favorilerin değiştiğini diğer ekranlara (Favoriler sekmesi) ve oturuma bildirir.
  Future<void> _favoritesChanged() async {
    ApiService.favoritesRevision.value++;
    final refreshed = await _api.me();
    if (refreshed != null) _api.currentUser = refreshed;
  }

  /// Kalbe dokununca: favori değilse "hangi listeye ekleyelim?", favoriyse seçenek menüsü
  /// (not, fiyat bildirimi, başka listeye taşı, favorilerden kaldır).
  Future<void> _onHeart() async {
    HapticFeedback.lightImpact();
    if (!_api.isLoggedIn) {
      _snack('Favorilere eklemek için giriş yapmalısın');
      return;
    }
    if (_togglingFavorite) return;
    setState(() => _togglingFavorite = true);
    try {
      if (_favLists.isEmpty) await _loadFavoriteState();
      if (!mounted) return;
      if (!_isFavorite) {
        await _addToList();
      } else {
        await _openFavoriteMenu();
      }
    } finally {
      if (mounted) setState(() => _togglingFavorite = false);
    }
  }

  Future<void> _addToList() async {
    final pick = await showFavoriteListPicker(context, title: 'Hangi listeye ekleyelim?', lists: _favLists);
    if (pick == null || !mounted) return;
    try {
      final lists = await applyFavoriteListPick(_api, widget.carId, pick);
      if (!mounted) return;
      setState(() {
        _favLists = lists;
        _isFavorite = true;
      });
      final name = _currentFavList?.name ?? 'Favori Listem';
      _snack('"$name" listesine eklendi');
      unawaited(_favoritesChanged());
    } catch (error) {
      _snack(error.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _openFavoriteMenu() async {
    final car = _car;
    final action = await showFavoriteCarMenu(
      context,
      title: car?.title ?? 'İlan',
      listName: _currentFavList?.name ?? 'Favori Listem',
      meta: _favMeta,
    );
    if (action == null || !mounted) return;
    switch (action) {
      case FavoriteMenuAction.note:
        final saved = await showFavoriteNoteSheet(context, carId: widget.carId, meta: _favMeta);
        if (saved != null && mounted) setState(() => _favMeta = saved);
      case FavoriteMenuAction.alert:
        final saved = await showFavoriteAlertSheet(context, carId: widget.carId, meta: _favMeta, price: car?.price);
        if (saved != null && mounted) setState(() => _favMeta = saved);
      case FavoriteMenuAction.move:
        final pick = await showFavoriteListPicker(
          context,
          title: 'Hangi listeye taşıyalım?',
          lists: _favLists,
          currentId: _currentFavList?.id,
        );
        if (pick == null || !mounted) return;
        try {
          final lists = await applyFavoriteListPick(_api, widget.carId, pick);
          if (!mounted) return;
          setState(() => _favLists = lists);
          _snack('İlan "${_currentFavList?.name ?? 'Favori Listem'}" listesine taşındı');
          unawaited(_favoritesChanged());
        } catch (error) {
          _snack(error.toString().replaceFirst('Exception: ', ''));
        }
      case FavoriteMenuAction.remove:
        try {
          await _api.removeFavorite(widget.carId);
          if (!mounted) return;
          setState(() {
            _isFavorite = false;
            _favMeta = null;
            _favLists = [
              for (final list in _favLists)
                FavoriteList(id: list.id, name: list.name, carIds: list.carIds.where((e) => e != widget.carId).toList()),
            ];
          });
          _snack('Favorilerden kaldırıldı');
          unawaited(_favoritesChanged());
        } catch (error) {
          _snack(error.toString().replaceFirst('Exception: ', ''));
        }
    }
  }

  /// Karşılaştırma listesine ekler/çıkarır; hem fotoğrafın üstündeki düğme hem alttaki buton bunu kullanır.
  Future<void> _toggleCompare(CarListing car) async {
    HapticFeedback.selectionClick();
    // context'i async boşluktan ÖNCE yakala; sonrasında State'in kendi `mounted` kontrolü geçerli olan.
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final wasThere = _inCompare;
    final added = await CompareStore.toggle(car.id);
    if (!mounted) return;
    setState(() => _inCompare = added);
    final full = !wasThere && !added;
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Text(full
            ? 'Karşılaştırma listesi dolu (en fazla ${CompareStore.maxItems} araç)'
            : added
                ? 'Karşılaştırmaya eklendi'
                : 'Karşılaştırmadan çıkarıldı'),
        action: SnackBarAction(
          label: 'Aç',
          onPressed: () => navigator.push(MaterialPageRoute(builder: (_) => const CompareScreen())),
        ),
      ),
    );
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

  
  Widget _buildImageGallery(CarListing car) {
    final allImages = car.images.isNotEmpty
        ? car.images
        : [car.imageUrl].where((u) => u.isNotEmpty).toList();

    if (allImages.isEmpty) {
      return AspectRatio(
        aspectRatio: 16 / 10,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Container(
              color: const Color(0xFF202631),
              alignment: Alignment.center,
              child: const Icon(Icons.directions_car_outlined, size: 48, color: Colors.white38),
            ),
            Positioned(top: 10, right: 10, child: _compareOverlayButton(car)),
          ],
        ),
      );
    }

    return AspectRatio(
      aspectRatio: 16 / 10,
      child: Stack(
        fit: StackFit.expand,
        children: [
          PageView.builder(
            itemCount: allImages.length,
            // Komşu fotoğraf önceden indirilmez: galeride kimse hepsini görmüyor, hücresel veride her
            // fotoğraf 90–270 KB.
            onPageChanged: (idx) => setState(() => _activeImageIndex = idx),
            itemBuilder: (context, index) {
              final imgUrl = allImages[index];
              final isFirst = index == 0;
              // Tam genişlik galeri: 480 px çözüm yüksek yoğunluklu ekranlarda bulanık görünüyordu.
              final child = ListingImage(
                url: imgUrl,
                fit: BoxFit.cover,
                cacheWidth: 1080,
                // İlk fotoğrafın kart varyantı zaten önbellekte; diğerlerinde ~10 KB'lık önizleme.
                tinyPreview: !isFirst,
              );
              return isFirst
                  ? Hero(tag: 'car-img-${car.id}', child: child)
                  : child;
            },
          ),
          if (allImages.length > 1)
            Positioned(
              right: 12,
              bottom: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.72),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
                ),
                child: Text(
                  '${_activeImageIndex + 1} / ${allImages.length}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          Positioned(top: 10, right: 10, child: _compareOverlayButton(car)),
        ],
      ),
    );
  }

  /// Fotoğrafın sağ üstündeki "karşılaştırmaya ekle" düğmesi; ekliyken dolu vurgulu görünür.
  Widget _compareOverlayButton(CarListing car) {
    final active = _inCompare;
    return Tooltip(
      message: active ? 'Karşılaştırmadan çıkar' : 'Karşılaştırmaya ekle',
      child: Material(
        color: active ? AppTheme.accent : Colors.black.withValues(alpha: 0.62),
        shape: const StadiumBorder(side: BorderSide(color: Color(0x33FFFFFF))),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: () => _toggleCompare(car),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(active ? Icons.check : Icons.compare_arrows, size: 17, color: Colors.white),
                const SizedBox(width: 5),
                Text(
                  active ? 'Karşılaştırmada' : 'Karşılaştır',
                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
        ),
      ),
    );
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
            onPressed: _togglingFavorite ? null : _onHeart,
            icon: Icon(
              _isFavorite ? Icons.favorite : Icons.favorite_outline,
              color: _isFavorite ? Colors.redAccent : null,
            ),
            tooltip: _isFavorite ? 'Favori seçenekleri' : 'Favorilere ekle',
          ),
        ],
      ),
      body: _car != null
          ? Column(
              children: [
                if (_loading) const LinearProgressIndicator(minHeight: 2),
                Expanded(child: _buildContent(_car!)),
              ],
            )
          : _loading
              ? const Center(child: CircularProgressIndicator())
              : _buildUnavailableState(),
    );
  }

  Widget _buildUnavailableState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.amber.withValues(alpha: 0.12),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
              ),
              child: const Icon(Icons.remove_shopping_cart_outlined, size: 56, color: Colors.amber),
            ),
            const SizedBox(height: 20),
            const Text(
              'Bu İlan Yayından Kaldırılmış',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 8),
            Text(
              _error ?? 'İncelemek istediğiniz araç ilanı artık satışta değildir veya yayından kaldırılmıştır.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: Colors.white60, height: 1.4),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: () => Navigator.of(context).maybePop(),
              icon: const Icon(Icons.arrow_back, size: 18),
              label: const Text('Geri Dön'),
              style: FilledButton.styleFrom(
                backgroundColor: AppTheme.accent,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(CarListing car) {
    return ListView(
      children: [
        _buildImageGallery(car),
        if (!car.isActive)
          Container(
            margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.redAccent.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.redAccent.withValues(alpha: 0.4)),
            ),
            child: Row(
              children: [
                const Icon(Icons.lock_clock_outlined, color: Colors.redAccent, size: 24),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Piyasa Arşivi (Yönetici Görünümü)',
                        style: TextStyle(fontWeight: FontWeight.bold, color: Colors.redAccent, fontSize: 13),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Bu araç orijinal sitede (${car.sourceSite.toUpperCase()}) yayından kalkmıştır.',
                        style: const TextStyle(color: Colors.white70, fontSize: 12),
                      ),
                      if (car.removedAt != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            'Arşive taşındı: ${relativeTimeTr(car.removedAt!)}'
                            '${car.removedReason.isNotEmpty ? ' — ${car.removedReason}' : ''}',
                            style: const TextStyle(color: Colors.white54, fontSize: 11),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  SourcePill(source: car.sourceSite),
                  if (car.damageFlag) const PhotoBadge(text: 'Hasar kaydı', color: Color(0xFFC8281F)),
                  if (!car.isActive) PhotoBadge(text: car.statusLabel, color: Colors.black87),
                ],
              ),
              const SizedBox(height: 12),
              Text.rich(
                TextSpan(children: [
                  TextSpan(text: '${car.year}', style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
                  TextSpan(text: '  /  ', style: TextStyle(color: AppColors.of(context).faint)),
                  TextSpan(text: trUpper(car.city)),
                ]),
                style: AppText.eyebrow(context, size: 11),
              ),
              const SizedBox(height: 4),
              Builder(builder: (context) {
                final name = carHeadline(title: car.title, brand: car.brand, model: car.model);
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: AppText.display(size: 26, weight: FontWeight.w700)),
                    if (name != car.title) ...[
                      const SizedBox(height: 4),
                      Text(car.title, style: TextStyle(color: AppColors.of(context).muted, fontSize: 13.5, height: 1.35)),
                    ],
                  ],
                );
              }),
              const SizedBox(height: 10),
              Text(
                '${NumberFormat.decimalPattern('tr_TR').format(car.mileage)} km  ·  ${car.viewCount} görüntülenme  ·  ${car.favoriteCount} favori',
                style: AppText.num(size: 12, color: AppColors.of(context).muted),
              ),
              if (car.verifiedLabel.isNotEmpty) ...[
                const SizedBox(height: 6),
                Row(
                  children: [
                    Icon(Icons.check, size: 15, color: AppColors.of(context).cheap),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(car.verifiedLabel, style: TextStyle(color: AppColors.of(context).cheap, fontSize: 12)),
                    ),
                  ],
                ),
              ],
              if (!car.isActive && car.status == 'sold') ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                  ),
                  child: const Text(
                    'Bu ilan satıldı olarak işaretlendi. Yeni teklif ya da soru gönderilemez.',
                    style: TextStyle(fontSize: 12.5),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  border: Border.symmetric(horizontal: BorderSide(color: AppColors.of(context).border)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _formatPrice(car.price),
                      style: AppText.num(size: 32, weight: FontWeight.w600, color: Theme.of(context).colorScheme.onSurface),
                    ),
                    const SizedBox(height: 12),
                    MarketGauge(price: car.price, avg: car.fairPrice, count: car.fairSample, large: true),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              MarketBadge(car: car),
              if (car.isActive && car.sourceSite != 'user') ...[
                const SizedBox(height: 12),
                MarketTempoCard(carId: car.id),
              ],
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                // Bilinmeyen değer gösterilmez; kaynaktan henüz okunmamışlar tek etikette toplanır.
                children: [
                  for (final v in [car.fuelType, car.transmission, car.bodyType])
                    if (!_unknownFeature(v) && v != 'Doğrulanıyor') _chip(v),
                  if ([car.fuelType, car.transmission, car.bodyType].contains('Doğrulanıyor'))
                    _chip('Özellikler doğrulanıyor'),
                ],
              ),
              if (_fuelCost != null) ...[
                const SizedBox(height: 16),
                FuelCostCard(cost: _fuelCost!),
              ],
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
              ListingDescription(value: car.description),
              DamageDiagram(paintChange: car.paintChange, damageFlag: car.damageFlag, damageParts: car.damageParts),
              if (car.mapPoint != null) ...[
                const SizedBox(height: 20),
                ListingMap(point: car.mapPoint!),
              ],
              const SizedBox(height: 20),
              if (car.listingUrl.isNotEmpty) ...[
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => _openListing(car.listingUrl),
                    icon: const Icon(Icons.open_in_new, size: 19),
                    label: const Text('Orijinal ilana git'),
                  ),
                ),
                const SizedBox(height: 10),
              ],
              OutlinedButton.icon(
                onPressed: () => _toggleCompare(car),
                icon: Icon(_inCompare ? Icons.check : Icons.compare_arrows),
                label: Text(_inCompare ? 'Karşılaştırmadan çıkar' : 'Karşılaştırmaya ekle'),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => SharePlus.instance.share(
                  ShareParams(text: '${car.title} — ${_formatPrice(car.price)}\nhttps://otopiyasa.app/cars/${car.id}'),
                ),
                icon: const Icon(Icons.ios_share),
                label: const Text('Paylaş'),
              ),
              const SizedBox(height: 12),
              TextButton.icon(
                onPressed: () => showReportDialog(
                  context,
                  reasons: listingReportReasons,
                  onSubmit: (reason, note) => _api.reportListing(carId: car.id, reason: reason, note: note),
                ),
                icon: const Icon(Icons.flag_outlined, size: 16),
                label: const Text('İlanı bildir', style: TextStyle(fontSize: 12)),
                style: TextButton.styleFrom(foregroundColor: AppColors.of(context).muted),
              ),
              // Teklif + soru-cevap (yalnızca üye ilanlarında ve aktif ilanlarda görünür).
              ListingInteraction(
                carId: car.id,
                sourceSite: car.sourceSite,
                listingPrice: car.price,
                isActive: car.isActive,
              ),
              if (car.similarCars.isNotEmpty) ...[
                const SizedBox(height: 24),
                Row(
                  children: [
                    const Icon(Icons.auto_awesome, size: 18, color: AppTheme.accent),
                    const SizedBox(width: 8),
                    const Text(
                      'Benzer İlanlar',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppTheme.accent.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.accent.withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        '${car.similarCars.length} İlan',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.accent,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // Sunucu 50 benzer ilan gönderiyor; hepsini birden çizmek 50 küçük resim indiriyordu (açılışta ~1–2 MB).
                // İlk birkaçı gösterilir, kalanı kullanıcı isterse açılır.
                for (final similar in car.similarCars.take(_similarShown)) ...[
                  _buildSimilarCarRow(context, similar),
                  const SizedBox(height: 10),
                ],
                if (car.similarCars.length > _similarShown)
                  Center(
                    child: TextButton.icon(
                      onPressed: () => setState(() => _similarShown += _similarStep),
                      icon: const Icon(Icons.expand_more),
                      label: Text('Daha fazla göster (${car.similarCars.length - _similarShown})'),
                    ),
                  ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  static const _unknownFeatureValues = {'', '-', 'bilinmiyor', 'belirtilmemiş', 'belirtilmemis', 'otomobil'};
  bool _unknownFeature(String v) => _unknownFeatureValues.contains(v.trim().toLowerCase());

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

  Widget _buildSimilarCarRow(BuildContext context, CarListing similar) {
    return InkWell(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => DetailScreen(carId: similar.id, initialCar: similar),
        ),
      ),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                width: 105,
                height: 78,
                child: similar.imageUrl.isEmpty
                    ? Container(
                        color: Colors.white10,
                        child: const Icon(Icons.directions_car, color: Colors.white30),
                      )
                    : ListingImage(
                        url: similar.imageUrl,
                        fit: BoxFit.cover,
                        cacheWidth: 320,
                      ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    similar.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      height: 1.25,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    '${similar.year} • ${NumberFormat.decimalPattern('tr_TR').format(similar.mileage)} km • ${similar.city}',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.white.withValues(alpha: 0.55),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 5),
                  Row(
                    children: [
                      Text(
                        _formatPrice(similar.price),
                        style: const TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w900,
                          color: AppTheme.accent,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        similar.sourceSite.toUpperCase(),
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w700,
                          color: Colors.white.withValues(alpha: 0.38),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
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
