import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/models/offer.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/widgets/report_dialog.dart';

/// Tek bir pazarlık kanalı: olay akışı + duruma göre değişen eylem alanı.
///
/// Web'deki `OfferThread` ile aynı kurallar geçerli (kurallar sunucuda):
///  - Teklif kabul edilene kadar burada yalnızca OLAYLAR görünür.
///  - Kabul edilince serbest mesajlaşma 48 saat boyunca açılır.
///  - Reddedilince alıcı yeni teklif verebilir.
class OfferThreadScreen extends StatefulWidget {
  const OfferThreadScreen({super.key, required this.offerId});

  final String offerId;

  @override
  State<OfferThreadScreen> createState() => _OfferThreadScreenState();
}

class _OfferThreadScreenState extends State<OfferThreadScreen> {
  final _api = ApiService();
  final _messageController = TextEditingController();
  final _amountController = TextEditingController();

  Offer? _offer;
  String? _error;
  bool _loading = true;
  bool _busy = false;

  final _money = NumberFormat.decimalPattern('tr_TR');

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _messageController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final offer = await _api.fetchOffer(widget.offerId);
      if (!mounted) return;
      setState(() {
        _offer = offer;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final offer = _offer;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Teklif'),
        actions: [
          if (offer != null)
            IconButton(
              tooltip: 'Bu sohbeti bildir',
              icon: const Icon(Icons.flag_outlined),
              onPressed: () => showReportDialog(
                context,
                reasons: chatReportReasons,
                onSubmit: (reason, note) => _api.reportChat(offerId: offer.id, reason: reason, note: note),
              ),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!)))
              : offer == null
                  ? const Center(child: Text('Teklif bulunamadı'))
                  : _buildBody(offer),
    );
  }

  Widget _buildBody(Offer offer) {
    return Column(
      children: [
        _header(offer),
        if (offer.chatOpen)
          Container(
            width: double.infinity,
            margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppTheme.accent.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.accent.withValues(alpha: 0.2)),
            ),
            child: const Text(
              '🛡️ Güvenliğin için: görüşmeyi WhatsApp/Instagram gibi platformlara taşımayı '
              'önerme ya da kabul etme. Aracı görmeden/denemeden asla kapora ya da ön ödeme gönderme.',
              style: TextStyle(fontSize: 11.5, height: 1.4),
            ),
          ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: offer.events.length,
            itemBuilder: (context, i) => _eventTile(offer.events[i]),
          ),
        ),
        _actions(offer),
      ],
    );
  }

  Widget _header(Offer offer) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(offer.carTitle, style: theme.textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(
            '${offer.role == "seller" ? "Alıcı" : "Satıcı"}: ${offer.counterpartName}'
            '  •  Teklif: ${_money.format(offer.amount)} ₺',
            style: theme.textTheme.bodySmall,
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              Chip(label: Text(offer.statusLabel), visualDensity: VisualDensity.compact),
              if (offer.remainingMs != null && offer.status == 'accepted')
                Chip(
                  label: Text('Kalan: ${_remaining(offer.remainingMs!)}'),
                  visualDensity: VisualDensity.compact,
                ),
            ],
          ),
          // Telefon yalnızca teklif kabul edilince ve yalnızca alıcıya gelir.
          if (offer.sellerPhone.isNotEmpty) ...[
            const SizedBox(height: 8),
            SelectableText(
              '📞 Satıcı: ${offer.sellerPhone}',
              style: theme.textTheme.titleSmall,
            ),
          ],
        ],
      ),
    );
  }

  String _remaining(int ms) {
    final hours = ms ~/ 3600000;
    final minutes = (ms % 3600000) ~/ 60000;
    if (hours <= 0 && minutes <= 0) return 'süre doldu';
    if (hours <= 0) return '$minutes dakika';
    return '$hours saat';
  }

  Widget _eventTile(OfferEvent event) {
    final theme = Theme.of(context);

    if (event.kind == 'message') {
      final time = event.createdAt != null ? DateFormat('HH:mm').format(event.createdAt!) : '';
      return Align(
        alignment: event.mine ? Alignment.centerRight : Alignment.centerLeft,
        child: Column(
          crossAxisAlignment: event.mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Container(
              margin: const EdgeInsets.symmetric(vertical: 4),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              constraints: const BoxConstraints(maxWidth: 280),
              decoration: BoxDecoration(
                color: event.mine ? AppTheme.accent : theme.colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(14),
                  topRight: const Radius.circular(14),
                  bottomLeft: Radius.circular(event.mine ? 14 : 4),
                  bottomRight: Radius.circular(event.mine ? 4 : 14),
                ),
              ),
              child: Text(
                event.text,
                style: event.mine ? const TextStyle(color: Color(0xFF241404)) : null,
              ),
            ),
            if (time.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(left: 4, right: 4, bottom: 2),
                child: Text(time, style: const TextStyle(fontSize: 10, color: Colors.white38)),
              ),
            if (event.riskFlags.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(left: 4, right: 4, bottom: 4),
                child: Column(
                  crossAxisAlignment: event.mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                  children: event.riskFlags
                      .map(
                        (flag) => Text(
                          '⚠️ ${riskFlagLabels[flag] ?? flag}',
                          style: const TextStyle(fontSize: 10, color: Colors.redAccent),
                        ),
                      )
                      .toList(),
                ),
              ),
          ],
        ),
      );
    }

    final label = switch (event.kind) {
      'offer' => 'Teklif: ${_money.format(event.amount ?? 0)} ₺',
      'accepted' => 'Teklif kabul edildi (${_money.format(event.amount ?? 0)} ₺)',
      'rejected' => 'Teklif reddedildi (${_money.format(event.amount ?? 0)} ₺)',
      _ => 'Süre doldu, sohbet kapandı',
    };

    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 6),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(label, style: theme.textTheme.bodySmall),
      ),
    );
  }

  Widget _actions(Offer offer) {
    // Satıcı: kabul / ret
    if (offer.canRespond) {
      return Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: FilledButton(
                onPressed: _busy
                    ? null
                    : () => _run(() => _api.offerAction(offer.id, action: 'accept')),
                child: Text('Kabul et (${_money.format(offer.amount)} ₺)'),
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton(
              onPressed: _busy
                  ? null
                  : () => _run(() => _api.offerAction(offer.id, action: 'reject')),
              child: const Text('Reddet'),
            ),
          ],
        ),
      );
    }

    // Kabul sonrası serbest yazışma
    if (offer.chatOpen) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _messageController,
                  decoration: const InputDecoration(hintText: 'Mesaj yaz…'),
                  maxLength: 1000,
                  buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.send),
                onPressed: _busy
                    ? null
                    : () {
                        final text = _messageController.text.trim();
                        if (text.isEmpty) return;
                        _messageController.clear();
                        _run(() => _api.offerAction(offer.id, action: 'message', text: text));
                      },
              ),
            ],
          ),
        ),
      );
    }

    // Alıcı: reddedildikten / süre dolduktan sonra yeni teklif
    if (offer.canOfferAgain) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _amountController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Yeni teklif (₺)'),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: _busy
                    ? null
                    : () {
                        final amount =
                            int.tryParse(_amountController.text.replaceAll(RegExp(r'\D'), ''));
                        if (amount == null) return;
                        _amountController.clear();
                        _run(() => _api
                            .createOffer(carId: offer.carId, amount: amount)
                            .then((_) {}));
                      },
                child: const Text('Gönder'),
              ),
            ],
          ),
        ),
      );
    }

    if (offer.status == 'pending' && offer.role == 'buyer') {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Text(
          'Teklifin satıcıya iletildi. Yanıt gelince bildirim alacaksın.',
          textAlign: TextAlign.center,
        ),
      );
    }

    return const SizedBox(height: 8);
  }
}
