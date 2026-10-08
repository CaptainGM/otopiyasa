import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';

/// Liste seçicinin sonucu: var olan bir liste ya da yeni açılacak liste adı.
class FavoriteListPick {
  const FavoriteListPick.existing(String this.listId) : newName = null;
  const FavoriteListPick.create(String this.newName) : listId = null;

  final String? listId;
  final String? newName;
}

const _maxLists = 20;

/// Liste seçimini sunucuya uygular: var olan listeye taşır (favorilerde değilse ekler) ya da yeni liste açıp ilanı oraya koyar.
/// Güncel listeleri döner.
Future<List<FavoriteList>> applyFavoriteListPick(ApiService api, String carId, FavoriteListPick pick) {
  final name = pick.newName;
  if (name != null) return api.createFavoriteList(name, carId: carId);
  return api.moveToFavoriteList(pick.listId!, carId);
}

/// Yeni liste adı / yeniden adlandırma için küçük bir pencere. İptalde null.
Future<String?> askFavoriteListName(
  BuildContext context, {
  required String title,
  String initial = '',
  required String action,
}) {
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
        decoration: const InputDecoration(hintText: 'ör. SUV, Sedan, Aile arabası'),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Vazgeç')),
        FilledButton(onPressed: () => Navigator.pop(dialogContext, controller.text.trim()), child: Text(action)),
      ],
    ),
  );
}

/// "Hangi listeye ekleyelim / taşıyalım?" alt sayfası. [currentId] işaretli görünür.
Future<FavoriteListPick?> showFavoriteListPicker(
  BuildContext context, {
  required String title,
  required List<FavoriteList> lists,
  String? currentId,
}) {
  return showModalBottomSheet<FavoriteListPick>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _ListPickerSheet(title: title, lists: lists, currentId: currentId),
  );
}

class _ListPickerSheet extends StatefulWidget {
  const _ListPickerSheet({required this.title, required this.lists, this.currentId});

  final String title;
  final List<FavoriteList> lists;
  final String? currentId;

  @override
  State<_ListPickerSheet> createState() => _ListPickerSheetState();
}

class _ListPickerSheetState extends State<_ListPickerSheet> {
  final _controller = TextEditingController();
  bool _creating = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _create() {
    final name = _controller.text.trim();
    if (name.isEmpty) return;
    Navigator.pop(context, FavoriteListPick.create(name));
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final customCount = widget.lists.where((l) => !l.isDefault).length;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.title, style: AppText.display(size: 18)),
          const SizedBox(height: 8),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              children: [
                for (final list in widget.lists)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    leading: Icon(
                      list.id == widget.currentId ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                      color: list.id == widget.currentId ? AppTheme.accent : c.muted,
                    ),
                    title: Text(list.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                    trailing: Text('${list.carIds.length}', style: TextStyle(color: c.muted)),
                    onTap: () => Navigator.pop(context, FavoriteListPick.existing(list.id)),
                  ),
              ],
            ),
          ),
          const Divider(height: 20),
          if (customCount >= _maxLists)
            Text('En fazla $_maxLists liste açılabilir.', style: TextStyle(color: c.muted, fontSize: 12.5))
          else if (!_creating)
            TextButton.icon(
              onPressed: () => setState(() => _creating = true),
              icon: const Icon(Icons.add),
              label: const Text('Yeni liste oluştur'),
            )
          else
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    autofocus: true,
                    maxLength: 40,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _create(),
                    decoration: const InputDecoration(hintText: 'Liste adı (ör. SUV)', counterText: '', isDense: true),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(onPressed: _create, child: const Text('Oluştur')),
              ],
            ),
        ],
      ),
    );
  }
}

/// Bir favori ilanın seçenek menüsünde yapılabilecekler.
enum FavoriteMenuAction { note, alert, move, remove }

Future<FavoriteMenuAction?> showFavoriteCarMenu(
  BuildContext context, {
  required String title,
  required String listName,
  FavoriteMeta? meta,
}) {
  final c = AppColors.of(context);
  final alertText = (meta ?? const FavoriteMeta()).alertSummary;
  return showModalBottomSheet<FavoriteMenuAction>(
    context: context,
    showDragHandle: true,
    builder: (sheetContext) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
            child: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text(listName, style: TextStyle(color: c.muted, fontSize: 12.5)),
          ),
          ListTile(
            leading: const Icon(Icons.edit_note),
            title: Text(meta != null && meta.note.isNotEmpty ? 'Notu düzenle' : 'Not ekle'),
            onTap: () => Navigator.pop(sheetContext, FavoriteMenuAction.note),
          ),
          ListTile(
            leading: const Icon(Icons.notifications_active_outlined),
            title: const Text('Fiyat bildirimi'),
            subtitle: Text(alertText),
            onTap: () => Navigator.pop(sheetContext, FavoriteMenuAction.alert),
          ),
          ListTile(
            leading: const Icon(Icons.drive_file_move_outlined),
            title: const Text('Başka listeye taşı'),
            onTap: () => Navigator.pop(sheetContext, FavoriteMenuAction.move),
          ),
          ListTile(
            leading: Icon(Icons.heart_broken_outlined, color: c.pricey),
            title: Text('Favorilerden kaldır', style: TextStyle(color: c.pricey)),
            onTap: () => Navigator.pop(sheetContext, FavoriteMenuAction.remove),
          ),
          const SizedBox(height: 8),
        ],
      ),
    ),
  );
}

/// Not yazma/düzenleme sayfası. Kaydedilen ayarı döner (iptalde null).
Future<FavoriteMeta?> showFavoriteNoteSheet(BuildContext context, {required String carId, FavoriteMeta? meta}) {
  return showModalBottomSheet<FavoriteMeta>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _NoteSheet(carId: carId, initial: meta?.note ?? ''),
  );
}

class _NoteSheet extends StatefulWidget {
  const _NoteSheet({required this.carId, required this.initial});

  final String carId;
  final String initial;

  @override
  State<_NoteSheet> createState() => _NoteSheetState();
}

class _NoteSheetState extends State<_NoteSheet> {
  late final _controller = TextEditingController(text: widget.initial);
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save(String note) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final saved = await ApiService().saveFavoriteMeta(widget.carId, note: note);
      if (mounted) Navigator.pop(context, saved);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Not', style: AppText.display(size: 18)),
          const SizedBox(height: 4),
          Text('Yalnızca sen görürsün (ör. "hafta sonu bak", "pazarlığa açık").', style: TextStyle(color: c.muted, fontSize: 12.5)),
          const SizedBox(height: 10),
          TextField(
            controller: _controller,
            autofocus: true,
            maxLines: 4,
            maxLength: 300,
            decoration: const InputDecoration(hintText: 'Notunu yaz…'),
          ),
          if (_error != null) Text(_error!, style: TextStyle(color: c.pricey, fontSize: 12.5)),
          const SizedBox(height: 8),
          Row(
            children: [
              if (widget.initial.isNotEmpty)
                TextButton(onPressed: _busy ? null : () => _save(''), child: const Text('Notu sil')),
              const Spacer(),
              FilledButton(onPressed: _busy ? null : () => _save(_controller.text), child: const Text('Kaydet')),
            ],
          ),
        ],
      ),
    );
  }
}

/// Fiyat bildirimi ayarı: her düşüşte / hedef fiyatın altına düşünce / kapalı; e-posta ve mobil bildirim seçimi.
Future<FavoriteMeta?> showFavoriteAlertSheet(
  BuildContext context, {
  required String carId,
  FavoriteMeta? meta,
  int? price,
}) {
  return showModalBottomSheet<FavoriteMeta>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _AlertSheet(carId: carId, initial: meta ?? const FavoriteMeta(), price: price),
  );
}

class _AlertSheet extends StatefulWidget {
  const _AlertSheet({required this.carId, required this.initial, this.price});

  final String carId;
  final FavoriteMeta initial;
  final int? price;

  @override
  State<_AlertSheet> createState() => _AlertSheetState();
}

class _AlertSheetState extends State<_AlertSheet> {
  late String _mode = widget.initial.alertMode;
  late bool _email = widget.initial.alertEmail;
  late bool _push = widget.initial.alertPush;
  late final _below = TextEditingController(text: widget.initial.alertBelow?.toString() ?? '');
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _below.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final target = int.tryParse(_below.text.replaceAll(RegExp(r'[^0-9]'), ''));
    if (_mode == 'below' && (target == null || target <= 0)) {
      setState(() => _error = 'Hedef fiyatı yaz.');
      return;
    }
    if (_mode != 'off' && !_email && !_push) {
      setState(() => _error = 'En az bir bildirim yolu seç.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final saved = await ApiService().saveFavoriteMeta(
        widget.carId,
        alertMode: _mode,
        alertBelow: _mode == 'below' ? target : null,
        clearBelow: _mode != 'below',
        alertEmail: _email,
        alertPush: _push,
      );
      if (mounted) Navigator.pop(context, saved);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _modeTile(String value, String label) => ListTile(
        contentPadding: EdgeInsets.zero,
        dense: true,
        leading: Icon(_mode == value ? Icons.radio_button_checked : Icons.radio_button_unchecked, color: _mode == value ? AppTheme.accent : null),
        title: Text(label),
        onTap: () => setState(() => _mode = value),
      );

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Fiyat bildirimi', style: AppText.display(size: 18)),
            const SizedBox(height: 6),
            _modeTile('any', 'Her fiyat düşüşünde'),
            _modeTile('below', 'Belirlediğim tutarın altına düşünce'),
            if (_mode == 'below') ...[
              TextField(
                controller: _below,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: InputDecoration(
                  hintText: 'Hedef fiyat (₺)',
                  helperText: widget.price != null ? 'Şu anki fiyat: ${FavoriteMeta.moneyText(widget.price!)} ₺' : null,
                  isDense: true,
                ),
              ),
              const SizedBox(height: 4),
            ],
            _modeTile('off', 'Bildirim istemiyorum'),
            if (_mode != 'off') ...[
              const Divider(height: 20),
              Text('Nereden haber verelim?', style: TextStyle(color: c.muted, fontSize: 12.5, fontWeight: FontWeight.w700)),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                title: const Text('E-posta'),
                value: _email,
                onChanged: (v) => setState(() => _email = v),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                title: const Text('Mobil uygulama bildirimi'),
                value: _push,
                onChanged: (v) => setState(() => _push = v),
              ),
            ],
            if (_error != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(_error!, style: TextStyle(color: c.pricey, fontSize: 12.5))),
            const SizedBox(height: 8),
            SizedBox(width: double.infinity, child: FilledButton(onPressed: _busy ? null : _save, child: const Text('Kaydet'))),
          ],
        ),
      ),
    );
  }
}
