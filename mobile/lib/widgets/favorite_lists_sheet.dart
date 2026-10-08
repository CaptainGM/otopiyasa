import 'package:flutter/material.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';

/// Bir ilanı kullanıcının favori gruplarına (sedan, SUV...) ekleyip çıkaran alt sayfa. Gruba eklenen ilan favorilere de
/// girer. Her değişiklikten sonra güncel grup listesi [onChanged] ile bildirilir.
Future<void> showFavoriteListsSheet(
  BuildContext context, {
  required String carId,
  required List<FavoriteList> lists,
  required ValueChanged<List<FavoriteList>> onChanged,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _FavoriteListsSheet(carId: carId, initial: lists, onChanged: onChanged),
  );
}

class _FavoriteListsSheet extends StatefulWidget {
  const _FavoriteListsSheet({required this.carId, required this.initial, required this.onChanged});

  final String carId;
  final List<FavoriteList> initial;
  final ValueChanged<List<FavoriteList>> onChanged;

  @override
  State<_FavoriteListsSheet> createState() => _FavoriteListsSheetState();
}

class _FavoriteListsSheetState extends State<_FavoriteListsSheet> {
  static const _maxLists = 20;

  final _api = ApiService();
  final _nameController = TextEditingController();
  late List<FavoriteList> _lists = widget.initial;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _run(Future<List<FavoriteList>> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final updated = await action();
      if (!mounted) return;
      setState(() => _lists = updated);
      widget.onChanged(updated);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _create() async {
    final name = _nameController.text.trim();
    if (name.isEmpty || _busy) return;
    await _run(() => _api.createFavoriteList(name, carId: widget.carId));
    if (_error == null) _nameController.clear();
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + bottomInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Favori grupları', style: AppText.display(size: 18)),
          const SizedBox(height: 4),
          Text(
            'İlanı bir ya da birkaç gruba ekle. Gruba eklenen ilan favorilerine de girer.',
            style: TextStyle(color: c.muted, fontSize: 12.5, height: 1.35),
          ),
          const SizedBox(height: 8),
          if (_lists.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Text('Henüz grubun yok. Aşağıdan ilk grubunu aç (ör. Sedan, SUV).', style: TextStyle(color: c.muted)),
            )
          else
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  for (final list in _lists)
                    CheckboxListTile(
                      value: list.contains(widget.carId),
                      onChanged: _busy
                          ? null
                          : (value) => _run(() => _api.setCarInFavoriteList(list.id, widget.carId, add: value ?? false)),
                      title: Text(list.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                      secondary: Text('${list.carIds.length}', style: TextStyle(color: c.muted)),
                      controlAffinity: ListTileControlAffinity.leading,
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                    ),
                ],
              ),
            ),
          const SizedBox(height: 8),
          if (_lists.length < _maxLists)
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _nameController,
                    maxLength: 40,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _create(),
                    decoration: const InputDecoration(
                      hintText: 'Yeni grup adı',
                      counterText: '',
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _busy ? null : _create,
                  child: const Text('Oluştur'),
                ),
              ],
            )
          else
            Text('En fazla $_maxLists grup açılabilir.', style: TextStyle(color: c.muted, fontSize: 12.5)),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: TextStyle(color: c.pricey, fontSize: 12.5)),
          ],
        ],
      ),
    );
  }
}
