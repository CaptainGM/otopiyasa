import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/models/account.dart';
import 'package:otopiyasa/models/offer.dart';
import 'package:otopiyasa/screens/offer_thread_screen.dart';
import 'package:otopiyasa/screens/sell_screen.dart';
import 'package:otopiyasa/services/api_service.dart';

/// "İlanlarım" — web'deki `/listings` sayfasının mobil karşılığı.
///
/// Her ilanın altında: gelen teklifler, bekleyen sorular (buradan yanıtlanır)
/// ve düzenle/sil. Satıcı tarafındaki tüm iş burada toplanıyor; "Tekliflerim"
/// yalnızca alıcı olarak verilen teklifleri gösteriyor.
class MyListingsScreen extends StatefulWidget {
  const MyListingsScreen({super.key});

  @override
  State<MyListingsScreen> createState() => _MyListingsScreenState();
}

class _MyListingsScreenState extends State<MyListingsScreen> {
  final _api = ApiService();
  final _money = NumberFormat.decimalPattern('tr_TR');

  late Future<List<MyListing>> _future;
  List<Offer> _offers = [];

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<MyListing>> _load() async {
    // Gelen teklifleri de çekip ilan bazında gruplayacağız.
    final results = await Future.wait([
      _api.fetchMyListings(),
      _api.fetchMyOffers(role: 'selling').catchError((_) => <Offer>[]),
    ]);
    _offers = results[1] as List<Offer>;
    return results[0] as List<MyListing>;
  }

  void _reload() => setState(() => _future = _load());

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _toggleStatus(MyListing listing) async {
    final next = listing.status == 'sold' ? 'active' : 'sold';
    try {
      await _api.setListingStatus(listing.id, next);
      _toast(next == 'sold' ? 'İlan satıldı olarak işaretlendi' : 'İlan tekrar yayına alındı');
      _reload();
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _delete(MyListing listing) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('İlanı sil'),
        content: Text('"${listing.title}" kalıcı olarak silinsin mi?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sil'),
          ),
        ],
      ),
    );
    if (ok != true) return;

    try {
      await _api.deleteListing(listing.id);
      _toast('İlan silindi');
      _reload();
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('İlanlarım')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final saved = await Navigator.of(context).push<bool>(
            MaterialPageRoute(builder: (_) => const SellScreen()),
          );
          if (saved == true) _reload();
        },
        icon: const Icon(Icons.add),
        label: const Text('İlan ver'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => _reload(),
        child: FutureBuilder<List<MyListing>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return _scrollable(
                Text(snapshot.error.toString().replaceFirst('Exception: ', '')),
              );
            }
            final listings = snapshot.data ?? [];
            if (listings.isEmpty) {
              return _scrollable(const Text('Henüz ilan vermedin.'));
            }
            return ListView.builder(
              padding: const EdgeInsets.only(bottom: 90),
              itemCount: listings.length,
              itemBuilder: (context, i) => _card(listings[i]),
            );
          },
        ),
      ),
    );
  }

  Widget _scrollable(Widget child) => ListView(
        children: [Padding(padding: const EdgeInsets.all(32), child: Center(child: child))],
      );

  Widget _card(MyListing listing) {
    final offers = _offers.where((o) => o.carId == listing.id).toList();

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
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
                  child: listing.imageUrl.isEmpty
                      ? Container(
                          width: 88,
                          height: 66,
                          color: Colors.white10,
                          child: const Icon(Icons.directions_car),
                        )
                      : Image.network(
                          listing.imageUrl,
                          width: 88,
                          height: 66,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => Container(
                            width: 88,
                            height: 66,
                            color: Colors.white10,
                            child: const Icon(Icons.directions_car),
                          ),
                        ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(listing.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(
                        '${_money.format(listing.price)} ₺  •  '
                        '${_money.format(listing.mileage)} km  •  ${listing.city}',
                        style: const TextStyle(fontSize: 12, color: Colors.white54),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${listing.viewCount} görüntülenme',
                        style: const TextStyle(fontSize: 11, color: Colors.white38),
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 6,
                        children: [
                          Chip(
                            label: Text(listing.statusLabel, style: const TextStyle(fontSize: 11)),
                            visualDensity: VisualDensity.compact,
                          ),
                          if (listing.listingStatusLabel.isNotEmpty)
                            Chip(
                              label: Text(listing.listingStatusLabel, style: const TextStyle(fontSize: 11)),
                              visualDensity: VisualDensity.compact,
                              backgroundColor: Colors.white10,
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (listing.moderationStatus == 'rejected' && listing.rejectionReason.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text('Sebep: ${listing.rejectionReason}',
                    style: const TextStyle(fontSize: 12, color: Colors.redAccent)),
              ),

            const Divider(height: 20),
            Text('Gelen teklifler (${offers.length})',
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            if (offers.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 6),
                child: Text('Bu ilana henüz teklif gelmedi.',
                    style: TextStyle(fontSize: 12, color: Colors.white54)),
              )
            else
              ...offers.map(
                (o) => ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text('${_money.format(o.amount)} ₺  •  ${o.counterpartName}'),
                  trailing: Chip(
                    label: Text(o.statusLabel, style: const TextStyle(fontSize: 10)),
                    visualDensity: VisualDensity.compact,
                  ),
                  onTap: () async {
                    await Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => OfferThreadScreen(offerId: o.id)),
                    );
                    _reload();
                  },
                ),
              ),

            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (listing.moderationStatus == 'approved' && listing.status != 'removed')
                  TextButton.icon(
                    onPressed: () => _toggleStatus(listing),
                    icon: Icon(listing.status == 'sold' ? Icons.visibility_outlined : Icons.check_circle_outline, size: 18),
                    label: Text(listing.status == 'sold' ? 'Tekrar yayına al' : 'Satıldı işaretle'),
                  ),
                TextButton.icon(
                  onPressed: () async {
                    final saved = await Navigator.of(context).push<bool>(
                      MaterialPageRoute(
                        builder: (_) => SellScreen(
                          listingId: listing.id,
                          initial: {
                            'brand': listing.brand,
                            'model': listing.model,
                            'year': listing.year,
                            'price': listing.price,
                            'mileage': listing.mileage,
                            'city': listing.city,
                          },
                        ),
                      ),
                    );
                    if (saved == true) _reload();
                  },
                  icon: const Icon(Icons.edit, size: 18),
                  label: const Text('Düzenle'),
                ),
                TextButton.icon(
                  onPressed: () => _delete(listing),
                  icon: const Icon(Icons.delete_outline, size: 18),
                  label: const Text('Sil'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
