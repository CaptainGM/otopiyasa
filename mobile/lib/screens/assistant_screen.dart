import 'package:flutter/material.dart';
import 'package:otopiyasa/screens/detail_screen.dart';
import 'package:otopiyasa/screens/search_results_screen.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/widgets/listing_image.dart';

/// SOHBET ASİSTANI — web'deki sağ alttaki widget'ın mobil karşılığı.
///
/// Aynı uç noktayı kullanır: yapay zeka niyeti anlar, gerçek veriyi sunucu
/// ekler. Site desteği soruları da yanıtlanır ("nasıl ilan veririm",
/// "giriş yapamıyorum" gibi).
class AssistantScreen extends StatefulWidget {
  const AssistantScreen({super.key});

  @override
  State<AssistantScreen> createState() => _AssistantScreenState();
}

class _ChatMessage {
  const _ChatMessage({required this.text, required this.mine, this.href, this.label, this.cards = const []});
  final String text;
  final bool mine;

  /// Önerilen ilanlar (başlık, fiyat, görsel, `/cars/<id>` adresi).
  final List<Map<String, dynamic>> cards;

  /// Sunucunun önerdiği site içi adres (`/?priceMax=…` ya da `/cars/<id>`) ve buton yazısı.
  final String? href;
  final String? label;
}

class _AssistantScreenState extends State<AssistantScreen> {
  final _api = ApiService();
  final _controller = TextEditingController();
  final _scroll = ScrollController();

  final List<_ChatMessage> _messages = [
    const _ChatMessage(
      text: 'Merhaba! Araç ararken yardımcı olabilirim. '
          '"1 milyon altı dizel araba öner" ya da "nasıl ilan veririm" diye sorabilirsin.',
      mine: false,
    ),
  ];
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;

    setState(() {
      _messages.add(_ChatMessage(text: text, mine: true));
      _sending = true;
    });
    _controller.clear();
    _scrollToEnd();

    try {
      // Son birkaç mesajı bağlam olarak gönder (çok turlu sohbet).
      final history = _messages
          .take(_messages.length - 1)
          .map((m) => {'role': m.mine ? 'user' : 'bot', 'text': m.text})
          .toList();
      final result = await _api.chat(text, history: history.length > 8
          ? history.sublist(history.length - 8)
          : history);

      final reply = result['reply']?.toString() ?? 'Yanıt alınamadı.';
      final link = result['link'] as Map<String, dynamic>?;
      final card = result['card'] as Map<String, dynamic>?;
      // Tek ilan önerisi ya da arama yanıtındaki öne çıkan ilanlar kart olarak gösterilir;
      // arama bağlantısı "Tümünü gör" butonu olur.
      final cards = [
        ?card,
        ...(result['cards'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>(),
      ];
      final href = link?['href']?.toString();
      final label = link?['label']?.toString().replaceAll('→', '').trim();

      setState(() {
        _messages.add(_ChatMessage(text: reply, mine: false, href: href, label: label, cards: cards));
      });
    } catch (e) {
      setState(() => _messages.add(_ChatMessage(
            text: e.toString().replaceFirst('Exception: ', ''),
            mine: false,
          )));
    } finally {
      if (mounted) setState(() => _sending = false);
      _scrollToEnd();
    }
  }

  /// Site içi adresi uygulama ekranına çevirir: `/cars/<id>` → ilan detayı, `/?…` → arama sonuçları.
  void _openHref(String href) {
    final uri = Uri.parse(href);
    final segments = uri.pathSegments.where((p) => p.isNotEmpty).toList();
    if (segments.length == 2 && segments[0] == 'cars') {
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => DetailScreen(carId: segments[1])));
      return;
    }
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => SearchResultsScreen(params: uri.queryParameters, title: 'Asistanın önerisi'),
    ));
  }

  static final _money = NumberFormat.decimalPattern('tr_TR');

  Widget _cardTile(Map<String, dynamic> card) {
    final href = card['href']?.toString() ?? '';
    final price = (card['price'] as num?)?.toInt() ?? 0;
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: href.isEmpty ? null : () => _openHref(href),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: 72,
                height: 52,
                child: ListingImage(url: card['imageUrl']?.toString() ?? '', cacheWidth: 200),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(card['title']?.toString() ?? '', maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  if ((card['subtitle']?.toString() ?? '').isNotEmpty)
                    Text(card['subtitle'].toString(), maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 11, color: Colors.white54)),
                  Text('${_money.format(price)} ₺',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFFF5B942))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Asistan')),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scroll,
              padding: const EdgeInsets.all(12),
              itemCount: _messages.length,
              itemBuilder: (context, i) {
                final m = _messages[i];
                return Align(
                  alignment: m.mine ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    constraints: BoxConstraints(maxWidth: m.cards.isEmpty ? 300 : 340),
                    decoration: BoxDecoration(
                      color: m.mine
                          ? theme.colorScheme.primaryContainer
                          : theme.colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: m.href == null && m.cards.isEmpty
                        ? SelectableText(m.text)
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              SelectableText(m.text),
                              const SizedBox(height: 6),
                              ...m.cards.map(_cardTile),
                              if (m.href != null) const SizedBox(height: 6),
                              if (m.href != null)
                              OutlinedButton.icon(
                                onPressed: () => _openHref(m.href!),
                                icon: Icon(m.href!.startsWith('/cars/') ? Icons.directions_car : Icons.search, size: 18),
                                label: Text(
                                  m.label?.isNotEmpty == true ? m.label! : 'İlanları gör',
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                  ),
                );
              },
            ),
          ),
          if (_sending)
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text('yazıyor…', style: TextStyle(fontSize: 12, color: Colors.white54)),
            ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      decoration: const InputDecoration(hintText: 'Bir şey sor…'),
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.send),
                    onPressed: _sending ? null : _send,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
