import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';

/// Profil resmi seçici (web'deki pencerenin aynısı): çizim avatarlar (stil + "Karıştır") ya da kendi fotoğrafın.
class AvatarPickerSheet extends StatefulWidget {
  const AvatarPickerSheet({super.key});

  @override
  State<AvatarPickerSheet> createState() => _AvatarPickerSheetState();
}

class _AvatarPickerSheetState extends State<AvatarPickerSheet> {
  static const _styles = [
    ('lorelei', 'Portre'),
    ('notionists', 'Çizim'),
    ('open-peeps', 'Karakter'),
    ('thumbs', 'Sevimli'),
  ];
  static const _gridSize = 12;
  static const _seedCount = 1000;

  final _api = ApiService();
  final _random = Random();
  String _style = 'lorelei';
  late List<int> _seeds = _shuffle();
  String? _selected;
  bool _busy = false;
  String? _error;

  List<int> _shuffle() => List.generate(_gridSize, (_) => _random.nextInt(_seedCount));

  Future<void> _run(Future<void> Function() action, String done) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      if (!mounted) return;
      Navigator.of(context).pop(done);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Fotoğrafı 320 px kareye kırpıp küçültür (sunucu yine 256 px'e yeniden kodlar ve denetler).
  Future<void> _pickPhoto() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1024, imageQuality: 85);
    if (picked == null) return;
    await _run(() async {
      final decoded = img.decodeImage(await picked.readAsBytes());
      if (decoded == null) throw Exception('Fotoğraf okunamadı');
      final side = min(decoded.width, decoded.height);
      final square = img.copyCrop(decoded, x: (decoded.width - side) ~/ 2, y: (decoded.height - side) ~/ 2, width: side, height: side);
      final jpeg = img.encodeJpg(img.copyResize(square, width: 320, height: 320), quality: 85);
      await _api.uploadAvatarPhoto('data:image/jpeg;base64,${base64Encode(jpeg)}');
    }, 'Fotoğrafın denetimden geçti ve kaydedildi');
  }

  @override
  Widget build(BuildContext context) {
    final hasAvatar = _api.currentUser?['avatar'] != null;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Profil resmini düzenle', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                children: [
                  for (final s in _styles)
                    ChoiceChip(
                      label: Text(s.$2),
                      selected: _style == s.$1,
                      onSelected: (_) => setState(() {
                        _style = s.$1;
                        _seeds = _shuffle();
                        _selected = null;
                      }),
                    ),
                  ActionChip(
                    avatar: const Icon(Icons.shuffle, size: 16),
                    label: const Text('Karıştır'),
                    onPressed: () => setState(() {
                      _seeds = _shuffle();
                      _selected = null;
                    }),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 4,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                children: [
                  for (final seed in _seeds)
                    GestureDetector(
                      onTap: () => setState(() => _selected = '$_style.$seed'),
                      child: Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: _selected == '$_style.$seed' ? AppTheme.accent : Colors.transparent, width: 2),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(14),
                          child: Image.network(
                            '${_api.originUrl}/api/avatar/preset/$_style/$seed',
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) => const ColoredBox(color: Color(0x14FFFFFF)),
                            loadingBuilder: (_, child, progress) => progress == null ? child : const ColoredBox(color: Color(0x14FFFFFF)),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: FilledButton(
                      onPressed: _busy || _selected == null ? null : () => _run(() => _api.setAvatarPreset(_selected!), 'Profil resmin güncellendi'),
                      child: Text(_busy ? 'Kaydediliyor...' : 'Bunu kullan'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _busy ? null : _pickPhoto,
                      child: const Text('Fotoğraf yükle'),
                    ),
                  ),
                ],
              ),
              if (hasAvatar)
                TextButton(
                  onPressed: _busy ? null : () => _run(_api.removeAvatar, 'Profil resmi kaldırıldı'),
                  child: const Text('Profil resmini kaldır'),
                ),
              const SizedBox(height: 4),
              const Text(
                'Müstehcen, şiddet içeren, terör/nefret sembolü ya da siyasi içerikli fotoğraflar otomatik denetlenir ve kabul edilmez.',
                style: TextStyle(fontSize: 11, color: Colors.white54),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 13)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
