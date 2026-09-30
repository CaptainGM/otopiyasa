import 'package:flutter/material.dart';
import 'package:otopiyasa/screens/detail_screen.dart';
import 'package:otopiyasa/screens/search_results_screen.dart';
import 'package:otopiyasa/services/api_service.dart';

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
  const _ChatMessage({required this.text, required this.mine, this.href, this.label});
  final String text;
  final bool mine;

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
      text: 'Merhaba! 👋 Araç ararken yardımcı olabilirim. '
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
      // Önerilen ilan kartı varsa ona, yoksa arama bağlantısına giden buton gösterilir.
      final href = (card?['href'] ?? link?['href'])?.toString();
      final label = card != null
          ? card['title']?.toString()
          : link?['label']?.toString().replaceAll('→', '').trim();

      setState(() {
        _messages.add(_ChatMessage(text: reply, mine: false, href: href, label: label));
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
                    constraints: const BoxConstraints(maxWidth: 300),
                    decoration: BoxDecoration(
                      color: m.mine
                          ? theme.colorScheme.primaryContainer
                          : theme.colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: m.href == null
                        ? SelectableText(m.text)
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              SelectableText(m.text),
                              const SizedBox(height: 8),
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
