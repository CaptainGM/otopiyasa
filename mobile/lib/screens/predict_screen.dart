import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/services/api_service.dart';

/// FİYAT TAHMİNİ — web'deki `/predict` sayfasının mobil karşılığı.
///
/// Model sunucuda (log-fiyat regresyonu, marka+model havuzlaması); burada
/// yalnızca giriş alınıp sonuç gösteriliyor. Sunucu tahminin yanında güven
/// aralığı, yıllık değer kaybı ve emsal ilanları da döndürüyor.
class PredictScreen extends StatefulWidget {
  const PredictScreen({super.key});

  @override
  State<PredictScreen> createState() => _PredictScreenState();
}

class _PredictScreenState extends State<PredictScreen> {
  final _api = ApiService();
  final _brand = TextEditingController();
  final _model = TextEditingController();
  final _year = TextEditingController();
  final _mileage = TextEditingController();
  final _money = NumberFormat.decimalPattern('tr_TR');

  String _condition = 'clean';
  Map<String, dynamic>? _result;
  bool _loading = false;
  String? _error;

  bool _photoLoading = false;
  final List<String> _photoPreviews = [];
  String? _photoNote;
  String? _photoError;

  @override
  void dispose() {
    for (final c in [_brand, _model, _year, _mileage]) {
      c.dispose();
    }
    super.dispose();
  }

  /// Fotoğraftan otomatik doldurma — web'deki handlePhoto ile aynı akış:
  /// 1024px'e küçült, Gemini Vision'a gönder, marka/model/yıl/durumu doldur.
  Future<void> _pickPhotos() async {
    final picked = await ImagePicker().pickMultiImage(limit: 6, imageQuality: 85);
    if (picked.isEmpty) return;

    setState(() {
      _photoError = null;
      _photoNote = null;
      _photoLoading = true;
      _photoPreviews.clear();
    });

    try {
      final images = <Map<String, String>>[];
      for (final file in picked) {
        final bytes = await file.readAsBytes();
        final decoded = img.decodeImage(bytes);
        if (decoded == null) continue;
        final resized = decoded.width > 1024 ? img.copyResize(decoded, width: 1024) : decoded;
        final jpeg = img.encodeJpg(resized, quality: 85);
        final base64 = base64Encode(jpeg);
        images.add({'image': base64, 'mimeType': 'image/jpeg'});
        _photoPreviews.add(base64);
      }

      final analysis = await _api.analyzeCarPhoto(images);
      if (analysis == null) throw Exception('Fotoğraf analiz edilemedi.');

      setState(() {
        if (analysis['brand'] != null) _brand.text = analysis['brand'].toString();
        if (analysis['model'] != null) _model.text = analysis['model'].toString();
        if (analysis['year'] is num) _year.text = (analysis['year'] as num).toInt().toString();
        if (analysis['condition'] != null) {
          final c = analysis['condition'].toString();
          if (['clean', 'painted', 'damaged'].contains(c)) _condition = c;
        }
        final note = analysis['note']?.toString() ?? '';
        final damageNote = analysis['damageNote']?.toString();
        _photoNote = [note, if (damageNote != null && damageNote.isNotEmpty) 'Hasar: $damageNote']
            .where((s) => s.isNotEmpty)
            .join(' ');
      });
    } catch (e) {
      setState(() => _photoError = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _photoLoading = false);
    }
  }

  Future<void> _predict() async {
    setState(() {
      _loading = true;
      _error = null;
      _result = null;
    });
    try {
      final result = await _api.predictPrice(
        brand: _brand.text.trim(),
        model: _model.text.trim(),
        year: int.tryParse(_year.text.trim()) ?? 0,
        mileage: int.tryParse(_mileage.text.replaceAll(RegExp(r'\D'), '')) ?? 0,
        condition: _condition,
      );
      setState(() => _result = result);
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final prediction = _result?['prediction'] as Map<String, dynamic>? ?? _result;
    final price = (prediction?['predictedPrice'] as num?)?.toInt();
    final lower = (prediction?['lowerBound'] as num?)?.toInt();
    final upper = (prediction?['upperBound'] as num?)?.toInt();
    final matchedModel = prediction?['matchedModel']?.toString();

    return Scaffold(
      appBar: AppBar(title: const Text('Fiyat Tahmini')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Text('📸', style: TextStyle(fontSize: 18)),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Fotoğrafla otomatik doldur',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Araç fotoğrafı yükle — AI markayı, modeli ve hasar durumunu tanıyıp formu doldursun '
                    '(en fazla 6 fotoğraf, farklı açılar daha isabetli olur).',
                    style: TextStyle(fontSize: 11.5, color: Colors.white54),
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: _photoLoading ? null : _pickPhotos,
                    icon: const Icon(Icons.add_a_photo_outlined),
                    label: Text(_photoLoading ? 'Analiz ediliyor…' : 'Fotoğraf(lar) seç'),
                  ),
                  if (_photoPreviews.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 56,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _photoPreviews.length,
                        separatorBuilder: (_, _) => const SizedBox(width: 6),
                        itemBuilder: (_, i) => ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.memory(base64Decode(_photoPreviews[i]), width: 56, height: 56, fit: BoxFit.cover),
                        ),
                      ),
                    ),
                  ],
                  if (_photoNote != null && _photoNote!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text('🤖 $_photoNote', style: const TextStyle(fontSize: 12, color: Colors.amberAccent)),
                  ],
                  if (_photoError != null) ...[
                    const SizedBox(height: 8),
                    Text(_photoError!, style: const TextStyle(fontSize: 12, color: Colors.redAccent)),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _brand,
            decoration: const InputDecoration(labelText: 'Marka'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _model,
            decoration: const InputDecoration(labelText: 'Model'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _year,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Yıl'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _mileage,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Kilometre'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _condition,
            decoration: const InputDecoration(labelText: 'Durum'),
            items: const [
              DropdownMenuItem(value: 'clean', child: Text('Hatasız / orijinal')),
              DropdownMenuItem(value: 'painted', child: Text('Boyalı')),
              DropdownMenuItem(value: 'damaged', child: Text('Hasar kaydı var')),
            ],
            onChanged: (v) => setState(() => _condition = v ?? 'clean'),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _loading ? null : _predict,
            child: Text(_loading ? 'Hesaplanıyor…' : 'Tahmin et'),
          ),

          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(_error!, style: const TextStyle(color: Colors.redAccent)),
          ],

          if (price != null) ...[
            const SizedBox(height: 24),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Tahmini değer',
                        style: TextStyle(color: Colors.white70, fontSize: 13)),
                    const SizedBox(height: 4),
                    Text('${_money.format(price)} ₺',
                        style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900)),
                    if (lower != null && upper != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Tahmini aralık: ${_money.format(lower)} – ${_money.format(upper)} ₺',
                        style: const TextStyle(fontSize: 13, color: Colors.white60),
                      ),
                    ],
                    if (matchedModel != null &&
                        matchedModel.isNotEmpty &&
                        matchedModel.toLowerCase() != _model.text.trim().toLowerCase()) ...[
                      const SizedBox(height: 6),
                      Text('🔎 "${_model.text.trim()}" yerine "$matchedModel" eşleştirildi',
                          style: const TextStyle(fontSize: 12, color: Colors.white54)),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
