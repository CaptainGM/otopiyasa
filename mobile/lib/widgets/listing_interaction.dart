import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/models/offer.dart';
import 'package:otopiyasa/screens/offer_thread_screen.dart';
import 'package:otopiyasa/services/api_service.dart';

/// İlan detayındaki TEKLİF VER + SORU-CEVAP bölümü.
///
/// Yalnızca ÜYE ilanlarında (`sourceSite == "user"`) anlamlıdır: derlenen
/// arabam/otomerkezi kayıtlarının satıcısı sitede kayıtlı değil, teklif
/// iletilecek ya da soruyu yanıtlayacak kimse yok. Kurallar (alt sınır, tavan,
/// kimin ne yapabileceği) SUNUCUDA doğrulanıyor; burada yalnızca sunucunun
/// döndürdüğü hata mesajı gösteriliyor.
class ListingInteraction extends StatefulWidget {
  const ListingInteraction({
    super.key,
    required this.carId,
    required this.sourceSite,
    required this.listingPrice,
    this.isActive = true,
  });

  final String carId;
  final String sourceSite;
  final int listingPrice;

  /// false ise (satıldı/kaldırıldı) teklif/soru formu yerine bilgi metni gösterilir.
  final bool isActive;

  @override
  State<ListingInteraction> createState() => _ListingInteractionState();
}

class _ListingInteractionState extends State<ListingInteraction> {
  final _api = ApiService();
  final _offerController = TextEditingController();
  final _questionController = TextEditingController();
  final _money = NumberFormat.decimalPattern('tr_TR');

  List<ListingQuestion> _questions = [];
  bool _busy = false;

  bool get _isUserListing => widget.sourceSite == 'user';

  @override
  void initState() {
    super.initState();
    if (_isUserListing) _loadQuestions();
  }

  @override
  void dispose() {
    _offerController.dispose();
    _questionController.dispose();
    super.dispose();
  }

  Future<void> _loadQuestions() async {
    try {
      final list = await _api.fetchQuestions(widget.carId);
      if (mounted) setState(() => _questions = list);
    } catch (_) {
      // Soru listesi kritik değil; sessizce geç.
    }
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _sendOffer() async {
    final amount = int.tryParse(_offerController.text.replaceAll(RegExp(r'\D'), ''));
    if (amount == null || amount <= 0) {
      _toast('Geçerli bir tutar gir');
      return;
    }
    setState(() => _busy = true);
    try {
      final id = await _api.createOffer(carId: widget.carId, amount: amount);
      _offerController.clear();
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => OfferThreadScreen(offerId: id)),
      );
    } catch (e) {
      // Sunucu sebebi açıkça yazıyor (alt sınır, ilan fiyatını aşma vb.)
      _toast(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _askQuestion() async {
    final text = _questionController.text.trim();
    if (text.isEmpty) return;
    setState(() => _busy = true);
    try {
      await _api.askQuestion(carId: widget.carId, text: text);
      _questionController.clear();
      await _loadQuestions();
      _toast('Sorun iletildi');
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_isUserListing) return const SizedBox.shrink();
    if (!widget.isActive) return const SizedBox.shrink();
    final theme = Theme.of(context);
    final loggedIn = _api.isLoggedIn;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 24),
        Text('Teklif ver', style: theme.textTheme.titleMedium),
        const SizedBox(height: 8),
        if (!loggedIn)
          const Text('Teklif vermek ve soru sormak için giriş yapmalısın.')
        else ...[
          Text(
            'İlan fiyatı ${_money.format(widget.listingPrice)} ₺. Teklifin bu tutarı geçemez; '
            'kabul edilirse 48 saat mesajlaşabilirsiniz.',
            style: theme.textTheme.bodySmall,
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _offerController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Teklifin (₺)'),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: _busy ? null : _sendOffer,
                child: const Text('Gönder'),
              ),
            ],
          ),
        ],

        const SizedBox(height: 28),
        Text('Sorular (${_questions.length})', style: theme.textTheme.titleMedium),
        const SizedBox(height: 8),
        if (loggedIn)
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _questionController,
                  decoration: const InputDecoration(hintText: 'Araç hakkında sor…'),
                  maxLength: 1000,
                  buildCounter: (_, {required currentLength, required isFocused, maxLength}) =>
                      null,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.send),
                onPressed: _busy ? null : _askQuestion,
              ),
            ],
          ),
        if (_questions.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text('Henüz soru sorulmamış.', style: theme.textTheme.bodySmall),
          ),
        ..._questions.map(_questionTile),
      ],
    );
  }

  Widget _questionTile(ListingQuestion q) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${q.askerName}: ${q.text}'),
            const SizedBox(height: 6),
            if (q.answered)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text('Satıcı: ${q.answer}'),
              )
            else
              Text('Satıcının yanıtı bekleniyor.', style: theme.textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}
