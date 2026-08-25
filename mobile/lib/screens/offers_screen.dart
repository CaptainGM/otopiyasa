import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/models/offer.dart';
import 'package:otopiyasa/screens/offer_thread_screen.dart';
import 'package:otopiyasa/services/api_service.dart';

/// "Tekliflerim" — alıcı olarak verdiğim teklifler ve durumları.
///
/// Web'deki `/offers` ile aynı veri; satıcı tarafı (ilanlarıma gelen teklifler)
/// web'de `/listings` altında toplandığı için burada da ayrı sekmede duruyor.
class OffersScreen extends StatefulWidget {
  const OffersScreen({super.key});

  @override
  State<OffersScreen> createState() => _OffersScreenState();
}

class _OffersScreenState extends State<OffersScreen> {
  final _api = ApiService();
  final _money = NumberFormat.decimalPattern('tr_TR');

  late Future<List<Offer>> _future;
  String _role = 'buying';

  @override
  void initState() {
    super.initState();
    _future = _api.fetchMyOffers(role: _role);
  }

  void _reload() {
    setState(() => _future = _api.fetchMyOffers(role: _role));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tekliflerim'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(52),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'buying', label: Text('Verdiğim')),
                ButtonSegment(value: 'selling', label: Text('İlanlarıma gelen')),
              ],
              selected: {_role},
              onSelectionChanged: (s) {
                setState(() {
                  _role = s.first;
                  _future = _api.fetchMyOffers(role: _role);
                });
              },
            ),
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async => _reload(),
        child: FutureBuilder<List<Offer>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return _message(snapshot.error.toString().replaceFirst('Exception: ', ''));
            }
            final offers = snapshot.data ?? [];
            if (offers.isEmpty) {
              return _message(
                _role == 'buying'
                    ? 'Henüz teklif vermedin.'
                    : 'İlanlarına henüz teklif gelmedi.',
              );
            }
            return ListView.separated(
              itemCount: offers.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, i) => _tile(offers[i]),
            );
          },
        ),
      ),
    );
  }

  /// Boş/hata durumunda da aşağı çekip yenilenebilsin diye kaydırılabilir liste.
  Widget _message(String text) => ListView(
        children: [
          Padding(
            padding: const EdgeInsets.all(32),
            child: Text(text, textAlign: TextAlign.center),
          ),
        ],
      );

  Widget _tile(Offer offer) {
    return ListTile(
      leading: offer.carImage.isEmpty
          ? const Icon(Icons.directions_car)
          : ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.network(
                offer.carImage,
                width: 64,
                height: 48,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const Icon(Icons.directions_car),
              ),
            ),
      title: Text(offer.carTitle, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(
        '${offer.role == "seller" ? offer.counterpartName : "Satıcı: ${offer.counterpartName}"}'
        '  •  ${_money.format(offer.amount)} ₺',
      ),
      trailing: Chip(
        label: Text(offer.statusLabel, style: const TextStyle(fontSize: 11)),
        visualDensity: VisualDensity.compact,
      ),
      onTap: () async {
        await Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => OfferThreadScreen(offerId: offer.id)),
        );
        // Kanalda kabul/ret yapılmış olabilir → liste tazelensin.
        _reload();
      },
    );
  }
}
