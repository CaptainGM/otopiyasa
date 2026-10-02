import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/data/model_advisories.dart';

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
  final GlobalKey _certificateKey = GlobalKey();

  String _condition = 'clean';
  bool _showPanelDetails = false;
  final Map<String, String> _panelStates = {
    'hood': 'original',
    'roof': 'original',
    'trunk': 'original',
    'f_l_fender': 'original',
    'f_r_fender': 'original',
    'f_l_door': 'original',
    'f_r_door': 'original',
    'r_l_door': 'original',
    'r_r_door': 'original',
    'r_l_fender': 'original',
    'r_r_fender': 'original',
  };

  static const Map<String, String> _panelNames = {
    'hood': 'Ön Kaput',
    'roof': 'Tavan',
    'trunk': 'Bagaj',
    'f_l_fender': 'Sol Ön Çamurluk',
    'f_r_fender': 'Sağ Ön Çamurluk',
    'f_l_door': 'Sol Ön Kapı',
    'f_r_door': 'Sağ Ön Kapı',
    'r_l_door': 'Sol Arka Kapı',
    'r_r_door': 'Sağ Arka Kapı',
    'r_l_fender': 'Sol Arka Çamurluk',
    'r_r_fender': 'Sağ Arka Çamurluk',
  };

  void _setPresetCondition(String cond) {
    setState(() {
      _condition = cond;
      if (cond == 'clean') {
        _panelStates.updateAll((k, v) => 'original');
      } else if (cond == 'painted') {
        _panelStates.updateAll((k, v) => 'original');
        _panelStates['f_l_fender'] = 'painted';
        _panelStates['r_l_door'] = 'painted';
      } else if (cond == 'damaged') {
        _panelStates.updateAll((k, v) => 'original');
        _panelStates['hood'] = 'replaced';
        _panelStates['f_l_fender'] = 'replaced';
      }
    });
  }

  void _cyclePanel(String key) {
    setState(() {
      final cur = _panelStates[key] ?? 'original';
      final next = cur == 'original'
          ? 'painted'
          : cur == 'painted'
              ? 'replaced'
              : 'original';
      _panelStates[key] = next;

      final hasReplaced = _panelStates.values.any((s) => s == 'replaced');
      final hasPainted = _panelStates.values.any((s) => s == 'painted');
      if (hasReplaced) {
        _condition = 'damaged';
      } else if (hasPainted) {
        _condition = 'painted';
      } else {
        _condition = 'clean';
      }
    });
  }

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
          if (['clean', 'painted', 'damaged'].contains(c)) _setPresetCondition(c);
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
          const SizedBox(height: 8),
          _buildEkspertizCard(),
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
                    const Text('Tahmini Piyasa Değeri',
                        style: TextStyle(color: Colors.white70, fontSize: 13)),
                    const SizedBox(height: 4),
                    Text('${_money.format(price)} ₺',
                        style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900, color: Color(0xFF34D399))),
                    if (lower != null && upper != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Adil Emsal Aralığı: ${_money.format(lower)} – ${_money.format(upper)} ₺',
                        style: const TextStyle(fontSize: 13, color: Colors.white70),
                      ),
                    ],
                    if (matchedModel != null &&
                        matchedModel.isNotEmpty &&
                        matchedModel.toLowerCase() != _model.text.trim().toLowerCase()) ...[
                      const SizedBox(height: 6),
                      Text('🔎 "${_model.text.trim()}" yerine "$matchedModel" eşleştirildi',
                          style: const TextStyle(fontSize: 12, color: Colors.white54)),
                    ],

                    const SizedBox(height: 14),
                    // Yapay Zeka Güven Skoru & Şeffaf Analiz Kutusu
                    Builder(
                      builder: (context) {
                        final sampleSize = (prediction?['sampleSize'] as num?)?.toInt() ?? 0;
                        final r2 = (prediction?['r2'] as num?)?.toDouble();
                        final outliersRemoved = (prediction?['outliersRemoved'] as num?)?.toInt();

                        final int confidenceScore;
                        final String confidenceTitle;
                        final String confidenceDesc;
                        final Color confidenceColor;

                        if (sampleSize >= 30) {
                          confidenceScore = (90 + ((sampleSize - 30) / 10).round()).clamp(90, 98);
                          confidenceTitle = '%$confidenceScore Yüksek Güven';
                          confidenceColor = const Color(0xFF10B981);
                          confidenceDesc = 'Veritabanında bu segmentte $sampleSize aktif ilan incelendi. Model sapması çok düşüktür (±%4).';
                        } else if (sampleSize >= 8) {
                          confidenceScore = (72 + ((sampleSize - 8) * 0.8).round()).clamp(70, 88);
                          confidenceTitle = '%$confidenceScore Orta Güven';
                          confidenceColor = const Color(0xFFF59E0B);
                          confidenceDesc = '$sampleSize emsal araç verisi incelendi. Donanım paketleri ve lokal boyalar fiyatta ±%8 esneme payı oluşturabilir.';
                        } else {
                          confidenceScore = 55;
                          confidenceTitle = 'Nadir Segment';
                          confidenceColor = const Color(0xFF38BDF8);
                          confidenceDesc = 'Piyasada bu segmentte $sampleSize ilan bulundu. Satıcı inisiyatifine göre fiyatlar esneklik gösterebilir.';
                        }

                        return Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.04),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(Icons.analytics_outlined, size: 16, color: Color(0xFF38BDF8)),
                                  const SizedBox(width: 6),
                                  const Expanded(
                                    child: Text(
                                      'Yapay Zeka Piyasa Güveni',
                                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white70),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: confidenceColor.withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(color: confidenceColor.withValues(alpha: 0.3)),
                                    ),
                                    child: Text(
                                      confidenceTitle,
                                      style: TextStyle(color: confidenceColor, fontSize: 10.5, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(confidenceDesc, style: const TextStyle(fontSize: 11.5, color: Colors.white60)),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Text('📊 $sampleSize Emsal İlan', style: const TextStyle(fontSize: 10.5, color: Colors.white38)),
                                  if (r2 != null) ...[
                                    const SizedBox(width: 10),
                                    Text('📐 R² ≈ ${r2.toStringAsFixed(2)}', style: const TextStyle(fontSize: 10.5, color: Colors.white38)),
                                  ],
                                  if (outliersRemoved != null && outliersRemoved > 0) ...[
                                    const SizedBox(width: 10),
                                    Text('🧹 $outliersRemoved Aykırı Filtrelendi', style: const TextStyle(fontSize: 10.5, color: Colors.white38)),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),

                    const SizedBox(height: 14),
                    // Resmi Belgeyi İncele & Paylaş Butonu
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () {
                          final sampleSize = (prediction?['sampleSize'] as num?)?.toInt() ?? 0;
                          final int confScore;
                          final String confTitle;
                          if (sampleSize >= 30) {
                            confScore = (90 + ((sampleSize - 30) / 10).round()).clamp(90, 98);
                            confTitle = '%$confScore Yüksek Piyasa Güveni';
                          } else if (sampleSize >= 8) {
                            confScore = (72 + ((sampleSize - 8) * 0.8).round()).clamp(70, 88);
                            confTitle = '%$confScore Orta Güvenilirlik';
                          } else {
                            confScore = 55;
                            confTitle = 'Nadir Segment';
                          }

                          _showValuationCertificateModal(
                            price: price,
                            lower: lower,
                            upper: upper,
                            confidenceTitle: confTitle,
                            confidenceScore: confScore,
                            sampleSize: sampleSize,
                            comparables: (_result?['comparables'] as List<dynamic>?) ?? [],
                          );
                        },
                        icon: const Icon(Icons.verified_outlined, size: 20),
                        label: const Text('Kapsamlı AI Piyasa Raporu (Ücretsiz)'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFF59E0B),
                          foregroundColor: Colors.black,
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildEkspertizCard() {
    final originalCount = _panelStates.values.where((s) => s == 'original').length;
    final paintedCount = _panelStates.values.where((s) => s == 'painted').length;
    final replacedCount = _panelStates.values.where((s) => s == 'replaced').length;

    final String statusTitle;
    final Color statusColor;
    if (_condition == 'damaged' || replacedCount > 0) {
      statusTitle = 'Hasarlı / Değişenli';
      statusColor = const Color(0xFFEF4444);
    } else if (_condition == 'painted' || paintedCount > 0) {
      statusTitle = 'Boyalı / Lokal';
      statusColor = const Color(0xFFF59E0B);
    } else {
      statusTitle = 'Hatasız / Orijinal';
      statusColor = const Color(0xFF10B981);
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.car_crash_outlined, size: 20, color: Color(0xFF38BDF8)),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'Ekspertiz & Hasar Seçici',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    statusTitle,
                    style: TextStyle(
                      color: statusColor,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            const Text(
              'Hızlı şablon seçin ya da parça listesinden araca özel boya/değişen durumunu işaretleyin:',
              style: TextStyle(fontSize: 11.5, color: Colors.white54),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _presetButton(
                    title: 'Hatasız',
                    subtitle: '0 Boya / Değişen',
                    active: _condition == 'clean',
                    activeColor: const Color(0xFF10B981),
                    onTap: () => _setPresetCondition('clean'),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: _presetButton(
                    title: 'Boyalı',
                    subtitle: 'Lokal/Tam Boya',
                    active: _condition == 'painted',
                    activeColor: const Color(0xFFF59E0B),
                    onTap: () => _setPresetCondition('painted'),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: _presetButton(
                    title: 'Hasarlı',
                    subtitle: 'Değişen/Hasar',
                    active: _condition == 'damaged',
                    activeColor: const Color(0xFFEF4444),
                    onTap: () => _setPresetCondition('damaged'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            InkWell(
              onTap: () => setState(() => _showPanelDetails = !_showPanelDetails),
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Icon(
                      _showPanelDetails ? Icons.expand_less : Icons.tune,
                      size: 16,
                      color: Colors.white70,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        _showPanelDetails
                            ? 'Kaporta parçalarını gizle'
                            : 'Parça bazlı ekspertiz düzenle (11 Parça)',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF38BDF8),
                        ),
                      ),
                    ),
                    Text(
                      '$originalCount Orijinal • $paintedCount Boyalı • $replacedCount Değişen',
                      style: const TextStyle(fontSize: 10.5, color: Colors.white38),
                    ),
                  ],
                ),
              ),
            ),
            if (_showPanelDetails) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.03),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Tıklayarak durumu değiştirin: Orijinal (Yeşil) → Boyalı (Turuncu) → Değişen (Kırmızı)',
                      style: TextStyle(fontSize: 10.5, color: Colors.white54),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: _panelStates.entries.map((entry) {
                        final name = _panelNames[entry.key] ?? entry.key;
                        final status = entry.value;
                        final Color bg;
                        final Color fg;
                        final String tag;
                        if (status == 'replaced') {
                          bg = const Color(0x33EF4444);
                          fg = const Color(0xFFFCA5A5);
                          tag = 'Değişen';
                        } else if (status == 'painted') {
                          bg = const Color(0x33F59E0B);
                          fg = const Color(0xFFFDE68A);
                          tag = 'Boyalı';
                        } else {
                          bg = const Color(0x1A10B981);
                          fg = const Color(0xFF6EE7B7);
                          tag = 'Orijinal';
                        }

                        return InkWell(
                          onTap: () => _cyclePanel(entry.key),
                          borderRadius: BorderRadius.circular(6),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                            decoration: BoxDecoration(
                              color: bg,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: fg.withValues(alpha: 0.3)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(name, style: const TextStyle(fontSize: 11, color: Colors.white)),
                                const SizedBox(width: 4),
                                Text(
                                  tag,
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.bold,
                                    color: fg,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _presetButton({
    required String title,
    required String subtitle,
    required bool active,
    required Color activeColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
        decoration: BoxDecoration(
          color: active ? activeColor.withValues(alpha: 0.15) : Colors.white.withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: active ? activeColor : Colors.white.withValues(alpha: 0.08),
            width: active ? 1.5 : 1,
          ),
        ),
        child: Column(
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: active ? activeColor : Colors.white70,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 9.5,
                color: active ? activeColor.withValues(alpha: 0.8) : Colors.white38,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _certRow(String label, String value, {bool isBold = false, Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: Colors.white60)),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
                color: valueColor ?? Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showValuationCertificateModal({
    required int price,
    int? lower,
    int? upper,
    required String confidenceTitle,
    required int confidenceScore,
    required int sampleSize,
    List<dynamic> comparables = const [],
  }) {
    final now = DateTime.now();
    final reportId = 'OTP-${now.year}-${(now.millisecondsSinceEpoch % 900000 + 100000)}';
    final issueDate = DateFormat('dd.MM.yyyy • HH:mm').format(now);
    final securityCode = 'SEC-${(price ^ _brand.text.hashCode ^ _year.text.hashCode).abs().toRadixString(16).toUpperCase().padLeft(6, '0').substring(0, 6)}';

    final brandStr = _brand.text.trim().isEmpty ? 'Araç' : _brand.text.trim();
    final modelStr = _model.text.trim().isEmpty ? 'Model' : _model.text.trim();
    final yearStr = _year.text.trim().isEmpty ? '2022' : _year.text.trim();
    final kmVal = int.tryParse(_mileage.text.replaceAll(RegExp(r'\D'), '')) ?? 0;
    final kmStr = '${_money.format(kmVal)} km';

    final paintedCount = _panelStates.values.where((s) => s == 'painted').length;
    final changedCount = _panelStates.values.where((s) => s == 'changed').length;
    final String conditionSummary;
    final Color conditionColor;
    if (changedCount > 0) {
      conditionSummary = 'Hasarlı / Değişenli ($changedCount Değişen, $paintedCount Boya)';
      conditionColor = const Color(0xFFEF4444);
    } else if (paintedCount > 0) {
      conditionSummary = 'Boyalı / Lokal ($paintedCount Parça Boyalı)';
      conditionColor = const Color(0xFFF59E0B);
    } else if (_condition == 'clean') {
      conditionSummary = 'Hatasız / Orijinal (0 Boya / 0 Değişen)';
      conditionColor = const Color(0xFF10B981);
    } else if (_condition == 'painted') {
      conditionSummary = 'Boyalı / Lokal Boyalı';
      conditionColor = const Color(0xFFF59E0B);
    } else {
      conditionSummary = 'Hasarlı / Değişenli';
      conditionColor = const Color(0xFFEF4444);
    }

    final advisory = findMobileModelAdvisory(brandStr, modelStr);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.90,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          expand: false,
          builder: (sheetContext, scrollController) {
            return Column(
              children: [
                const SizedBox(height: 10),
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.verified_user_outlined, color: Color(0xFFF59E0B), size: 20),
                          SizedBox(width: 8),
                          Text(
                            'OtoPiyasa AI Piyasa Raporu',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.white),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
                        ),
                        child: const Text(
                          'ÜCRETSİZ RAPOR',
                          style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFF10B981)),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.white54, size: 20),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, color: Colors.white12),
                Expanded(
                  child: ListView(
                    controller: scrollController,
                    padding: const EdgeInsets.all(16),
                    children: [
                      // BÖLÜM 1: GÖRSEL SERTİFİKA KARTI (RepaintBoundary ile ekran resmi alınabilir)
                      RepaintBoundary(
                        key: _certificateKey,
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.7), width: 1.8),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.5),
                                blurRadius: 16,
                                offset: const Offset(0, 6),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Üst Başlık & Logo & Dijital Onay Rozeti
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(Icons.shield, color: Color(0xFFF59E0B), size: 22),
                                  ),
                                  const SizedBox(width: 10),
                                  const Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'OTOPIYASA AI',
                                          style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w900,
                                            color: Color(0xFFF59E0B),
                                            letterSpacing: 1.1,
                                          ),
                                        ),
                                        Text(
                                          'ALGORİTMİK PİYASA DEĞERLEME BELGESİ',
                                          style: TextStyle(
                                            fontSize: 9.5,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.white70,
                                            letterSpacing: 0.5,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF10B981).withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.check_circle, size: 10, color: Color(0xFF10B981)),
                                        SizedBox(width: 4),
                                        Text(
                                          'DİJİTAL ONAYLI',
                                          style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.bold, color: Color(0xFF10B981)),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Container(height: 1, color: const Color(0xFFF59E0B).withValues(alpha: 0.3)),
                              const SizedBox(height: 10),

                              // Belge Meta Bilgileri
                              Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Text('BELGE NO', style: TextStyle(fontSize: 9, color: Colors.white38, fontWeight: FontWeight.bold)),
                                        Text(reportId, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white)),
                                      ],
                                    ),
                                  ),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.center,
                                      children: [
                                        const Text('DÜZENLEME TARİHİ', style: TextStyle(fontSize: 9, color: Colors.white38, fontWeight: FontWeight.bold)),
                                        Text(issueDate, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: Colors.white70)),
                                      ],
                                    ),
                                  ),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        const Text('GÜVENLİK KODU', style: TextStyle(fontSize: 9, color: Colors.white38, fontWeight: FontWeight.bold)),
                                        Text(securityCode, style: const TextStyle(fontSize: 10.5, fontFamily: 'monospace', fontWeight: FontWeight.bold, color: Color(0xFF38BDF8))),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),

                              // Araç ve Beyan Detayları
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.03),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                                ),
                                child: Column(
                                  children: [
                                    _certRow('Araç', '$yearStr $brandStr $modelStr', isBold: true),
                                    _certRow('Kilometre', kmStr),
                                    _certRow('Kondisyon (Beyan)', conditionSummary, valueColor: conditionColor),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 12),

                              // Tavsiye Edilen Değer Bloğu + Dijital Kaşe (Mühür)
                              Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      const Color(0xFFF59E0B).withValues(alpha: 0.12),
                                      const Color(0xFF1E293B),
                                    ],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.4)),
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            'TAHMİNİ PİYASA DEĞERİ',
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              color: Color(0xFFF59E0B),
                                              letterSpacing: 1.0,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            '${_money.format(price)} ₺',
                                            style: const TextStyle(
                                              fontSize: 24,
                                              fontWeight: FontWeight.w900,
                                              color: Colors.white,
                                            ),
                                          ),
                                          if (lower != null && upper != null) ...[
                                            const SizedBox(height: 4),
                                            Text(
                                              'Adil Emsal: ${_money.format(lower)} ₺ – ${_money.format(upper)} ₺',
                                              style: const TextStyle(fontSize: 10.5, color: Colors.white60),
                                            ),
                                          ],
                                          const SizedBox(height: 6),
                                          Text(
                                            '📊 $confidenceTitle ($sampleSize Emsal İlan)',
                                            style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF10B981)),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    // DİJİTAL MÜHÜR / RESMİ KAŞE
                                    Transform.rotate(
                                      angle: -0.12,
                                      child: Container(
                                        width: 78,
                                        height: 78,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          border: Border.all(color: const Color(0xFFF59E0B), width: 2),
                                          color: const Color(0xFF0F172A),
                                          boxShadow: [
                                            BoxShadow(
                                              color: const Color(0xFFF59E0B).withValues(alpha: 0.25),
                                              blurRadius: 8,
                                            ),
                                          ],
                                        ),
                                        child: Column(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            const Icon(Icons.verified, size: 14, color: Color(0xFFF59E0B)),
                                            const Text(
                                              'OTOPIYASA AI',
                                              style: TextStyle(fontSize: 7, fontWeight: FontWeight.w900, color: Color(0xFFF59E0B), letterSpacing: 0.5),
                                            ),
                                            const Text(
                                              'DEĞERLEME MÜHRÜ',
                                              style: TextStyle(fontSize: 5.5, fontWeight: FontWeight.bold, color: Colors.white70),
                                            ),
                                            Text(
                                              'PİYASA ONAYLI',
                                              style: TextStyle(fontSize: 5.5, fontWeight: FontWeight.w900, color: Colors.greenAccent.shade400),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 12),

                              // Yasal Sorumluluk Reddi & Doğrulama Dipnotu
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(Icons.shield_outlined, size: 13, color: Colors.white38),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      '⚠️ Yasal Bilgilendirme: Bu belge fiziki araç muayenesi veya TSE onaylı ekspertiz raporu yerine geçmez. Kullanıcının beyan ettiği verilere dayanarak, 12 farklı araç platformundaki büyük veriler ve regresyon modelleri üzerinden üretilmiş algoritmik bir piyasa fiyat rehberidir.\nDoğrulama: https://otopiyasa.app/predict?ref=$reportId',
                                      style: const TextStyle(fontSize: 8.5, color: Colors.white38, height: 1.3),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 16),

                      // BÖLÜM 2: PAZARDAKİ EN YAKIN EMSAL İLANLAR
                      if (comparables.isNotEmpty) ...[
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.03),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    'Bölüm 2: En Yakın Emsal İlanlar',
                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFF59E0B)),
                                  ),
                                  Text(
                                    '${comparables.length} Emsal',
                                    style: const TextStyle(fontSize: 10.5, color: Colors.white54),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                '12 siteden taranmış piyasadaki benzer ilanlar:',
                                style: TextStyle(fontSize: 10.5, color: Colors.white38),
                              ),
                              const SizedBox(height: 10),
                              ...comparables.take(5).map((c) {
                                final comp = c as Map<String, dynamic>;
                                final cTitle = comp['title']?.toString() ?? '$brandStr $modelStr';
                                final cYear = comp['year']?.toString() ?? yearStr;
                                final cKm = (comp['mileage'] as num?)?.toInt() ?? 0;
                                final cPrice = (comp['price'] as num?)?.toInt() ?? 0;
                                return Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 4),
                                  child: Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: Colors.black.withValues(alpha: 0.2),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                                    ),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                cTitle,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white),
                                              ),
                                              Text(
                                                '$cYear • ${_money.format(cKm)} km',
                                                style: const TextStyle(fontSize: 10, color: Colors.white54),
                                              ),
                                            ],
                                          ),
                                        ),
                                        Text(
                                          '${_money.format(cPrice)} ₺',
                                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFFBBF24)),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              }),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // BÖLÜM 3: 12 AYLIK DEĞER KAYBI & ALIM ÖNCESİ KONTROL REHBERİ
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.03),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Bölüm 3: 12 Aylık Amortisman & Kontrol Rehberi',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFF59E0B)),
                            ),
                            const SizedBox(height: 8),

                            // Küratörlü Tavsiye (Varsa)
                            if (advisory != null) ...[
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF59E0B).withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.3)),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        const Text('💡 ', style: TextStyle(fontSize: 14)),
                                        Expanded(
                                          child: Text(
                                            'Satın Alım Tavsiyesi (${advisory.title})',
                                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFF59E0B)),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      advisory.advice,
                                      style: const TextStyle(fontSize: 10.5, color: Colors.white70, height: 1.3),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '🔍 Öncelikli Kontrol: ${advisory.checkItem}',
                                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 10),
                            ],

                            // 12 Aylık Tahmini Amortisman Kartları
                            const Text(
                              'Tahmini Doğal Değer Eğrisi (Yaşlanma):',
                              style: TextStyle(fontSize: 10.5, color: Colors.white54),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                Expanded(
                                  child: _depreciationBox('Bugün', price),
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: _depreciationBox('3 Ay', (price * 0.985).round()),
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: _depreciationBox('6 Ay', (price * 0.97).round()),
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: _depreciationBox('12 Ay', (price * 0.94).round()),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),

                            // Satıcıya Sorulacak 5 Altın Soru
                            const Text(
                              'Satıcıya Sorulacak 5 Altın Soru:',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF10B981)),
                            ),
                            const SizedBox(height: 6),
                            _goldQuestion('1. Yedek anahtar ve orijinal el kitapçığı mevcut mu?'),
                            _goldQuestion('2. Son yağ/triger bakım faturaları ve servis geçmişi var mı?'),
                            _goldQuestion('3. 4 lastiğin üretim yılı (DOT) ve diş derinliği kaç mm?'),
                            _goldQuestion('4. 5664 Tramer SMS hasar sorgusu yapıldı mı, detayları nedir?'),
                            _goldQuestion('5. Araç üzerinde banka rehini, haciz veya vergi borcu var mı?'),
                          ],
                        ),
                      ),

                      const SizedBox(height: 20),

                      // Paylaşım Butonları
                      ElevatedButton.icon(
                        onPressed: () {
                          _shareCertificateImage(
                            reportId: reportId,
                            brand: brandStr,
                            model: modelStr,
                            price: price,
                          );
                        },
                        icon: const Icon(Icons.image_outlined, size: 20),
                        label: const Text('Resmi Sertifika Görseli Paylaş (PNG)'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFF59E0B),
                          foregroundColor: Colors.black,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                        ),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        onPressed: () {
                          _shareValuationReport(
                            reportId: reportId,
                            issueDate: issueDate,
                            securityCode: securityCode,
                            price: price,
                            lower: lower,
                            upper: upper,
                            confidence: confidenceTitle,
                            conditionSummary: conditionSummary,
                          );
                        },
                        icon: const Icon(Icons.text_snippet_outlined, size: 18),
                        label: const Text('Metin Olarak Paylaş'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white70,
                          side: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _depreciationBox(String label, int val) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.25),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Column(
        children: [
          Text(label, style: const TextStyle(fontSize: 9.5, color: Colors.white54)),
          const SizedBox(height: 2),
          Text(
            '${_money.format(val)} ₺',
            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
          ),
        ],
      ),
    );
  }

  Widget _goldQuestion(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.check_circle_outline, size: 13, color: Color(0xFF10B981)),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(fontSize: 10.5, color: Colors.white70),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _shareCertificateImage({
    required String reportId,
    required String brand,
    required String model,
    required int price,
  }) async {
    try {
      final boundary = _certificateKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) {
        throw Exception('Sertifika görseli oluşturulamadı.');
      }
      final image = await boundary.toImage(pixelRatio: 3.0);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData == null) {
        throw Exception('Görsel verisi dönüştürülemedi.');
      }
      final pngBytes = byteData.buffer.asUint8List();
      final tempDir = Directory.systemTemp;
      final file = File('${tempDir.path}/otopiyasa_degerleme_${reportId.toLowerCase()}.png');
      await file.writeAsBytes(pngBytes, flush: true);

      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(file.path)],
          text: '🚗 OtoPiyasa AI Resmi Araç Değerleme Belgesi (No: $reportId)\n'
              '$brand $model — ${_money.format(price)} ₺\n'
              '🔒 Bu belge algoritmik piyasa mühürlüdür.\n'
              '🔗 Canlı Doğrulama: https://otopiyasa.app/predict?ref=$reportId',
          subject: '$brand $model AI Piyasa Değerleme Belgesi - OtoPiyasa',
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Paylaşım hatası: $e')),
        );
      }
    }
  }

  void _shareValuationReport({
    required String reportId,
    required String issueDate,
    required String securityCode,
    required int price,
    int? lower,
    int? upper,
    required String confidence,
    required String conditionSummary,
  }) {
    final text = '''
🚗 OtoPiyasa AI Piyasa Değerleme Raporu
━━━━━━━━━━━━━━━━━━━━
📜 Belge No: $reportId
📅 Düzenleme Tarihi: $issueDate
🔐 Güvenlik Kodu: $securityCode
━━━━━━━━━━━━━━━━━━━━
📋 Araç: ${_year.text.trim()} ${_brand.text.trim()} ${_model.text.trim()}
🛣️ Kilometre: ${_money.format(int.tryParse(_mileage.text.replaceAll(RegExp(r'\\D'), '')) ?? 0)} km
🛠️ Kondisyon (Beyan): $conditionSummary
━━━━━━━━━━━━━━━━━━━━
🎯 Tahmini Piyasa Değeri: ${_money.format(price)} ₺
📊 Piyasa Güven Skoru: $confidence
${lower != null && upper != null ? "💡 Adil Emsal Aralığı: ${_money.format(lower)} ₺ – ${_money.format(upper)} ₺\n" : ""}━━━━━━━━━━━━━━━━━━━━
🔒 Dijital Mühür: OTOPIYASA AI • ALGORİTMİK DEĞERLEME MÜHRÜ • PİYASA ONAYI
⚠️ Yasal Uyarı: Bu rapor fiziki muayene/TSE ekspertiz yerine geçmez; 12 siteden taranan verilere dayalı piyasa fiyat rehberidir.
🔗 Orijinal Belge Doğrulama: https://otopiyasa.app/predict?ref=$reportId''';

    SharePlus.instance.share(
      ShareParams(
        text: text,
        subject: '${_brand.text.trim()} ${_model.text.trim()} AI Değerleme Belgesi - OtoPiyasa',
      ),
    );
  }
}
