import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:otopiyasa/data/tr_geo.dart';
import 'package:otopiyasa/models/sell_estimate.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/widgets/sell_estimate_card.dart';

/// İLAN VER / DÜZENLE — web'deki `/sell` formunun mobil karşılığı.
///
/// Aynı uç noktayı kullanır, aynı kurallara tabidir (fiyat aralığı, yapay zeka
/// denetimi, fotoğraf-marka uyumu). Fotoğraflar web ile AYNI biçimde
/// gönderilir: 1280 px'e küçültülüp `data:image/jpeg;base64,...`
class SellScreen extends StatefulWidget {
  const SellScreen({super.key, this.listingId, this.initial});

  final String? listingId;
  final Map<String, dynamic>? initial;

  @override
  State<SellScreen> createState() => _SellScreenState();
}

class _SellScreenState extends State<SellScreen> {
  final _api = ApiService();
  final _formKey = GlobalKey<FormState>();

  final _brand = TextEditingController();
  final _model = TextEditingController();
  final _year = TextEditingController();
  final _price = TextEditingController();
  final _mileage = TextEditingController();
  final _engine = TextEditingController();
  final _minOffer = TextEditingController();
  final _phone = TextEditingController();
  final _description = TextEditingController();

  String? _province;
  String? _district;
  // Yakıt, vites ve hasar varsayılan almaz: fiyat aralığı yanlış seçimle yanlış araç grubunu kıyaslardı.
  String? _fuel;
  String? _transmission;
  String? _damage;
  String _bodyType = 'Sedan';
  String _color = 'Beyaz';

  final List<String> _images = [];
  bool _saving = false;
  bool _pickingImage = false;

  Timer? _estimateTimer;
  int _estimateSeq = 0;
  String _estimateKey = '';
  SellEstimate? _estimate;
  String? _estimateError;
  bool _estimateLoading = false;

  static const _fuels = ['Benzin', 'Dizel', 'LPG & Benzin', 'Elektrik', 'Hibrit'];
  static const _transmissions = ['Manuel', 'Otomatik'];
  static const _damageOptions = ['orijinal', 'boyali', 'hasarli'];
  static const _damageLabels = {
    'orijinal': 'Hasar kaydı yok, boyasız (orijinal)',
    'boyali': 'Hasar kaydı yok, boyalı veya değişen parça var',
    'hasarli': 'Hasar kaydı var (tramer veya ağır hasar)',
  };
  static const _bodyTypes = [
    'Sedan', 'Hatchback', 'SUV', 'Station Wagon', 'Coupe',
    'Cabrio', 'MPV', 'Pickup', 'Panelvan', 'Belirtilmemiş',
  ];
  static const _colors = [
    'Beyaz', 'Siyah', 'Gri', 'Gümüş Gri', 'Kırmızı', 'Mavi', 'Lacivert',
    'Yeşil', 'Bordo', 'Turuncu', 'Sarı', 'Kahverengi', 'Bej', 'Antrasit',
    'Füme', 'Turkuaz', 'Mor', 'Altın', 'Belirtilmemiş',
  ];

  @override
  void initState() {
    super.initState();
    final init = widget.initial;
    if (init != null) {
      _brand.text = init['brand']?.toString() ?? '';
      _model.text = init['model']?.toString() ?? '';
      _year.text = init['year']?.toString() ?? '';
      _price.text = _group(init['price']?.toString() ?? '');
      _mileage.text = _group(init['mileage']?.toString() ?? '');
      _engine.text = init['engineSize'] == null ? '' : init['engineSize'].toString().replaceAll('.', ',');
      _minOffer.text = _group(init['minOffer']?.toString() ?? '');
      _phone.text = init['contactPhone']?.toString() ?? '';
      _description.text = init['description']?.toString() ?? '';
      final city = init['city']?.toString();
      if (city != null && trProvinces.contains(city)) _province = city;
      _fuel = _pick(init['fuelType'], _fuels);
      _transmission = _pick(init['transmission'], _transmissions);
      _damage = _pick(init['damage'], _damageOptions);
      _bodyType = _pick(init['bodyType'], _bodyTypes) ?? _bodyType;
      _color = _pick(init['color'], _colors) ?? _color;
    }
    for (final c in [_brand, _model, _year, _mileage, _engine]) {
      c.addListener(_onEstimateFieldChanged);
    }
    _price.addListener(_refresh);
    _scheduleEstimate();
  }

  @override
  void dispose() {
    _estimateTimer?.cancel();
    for (final c in [_brand, _model, _year, _price, _mileage, _engine, _minOffer, _phone, _description]) {
      c.dispose();
    }
    super.dispose();
  }

  /// Listede olan değer ise onu, değilse null (eski veya bilinmeyen değer seçili gelmesin).
  String? _pick(dynamic value, List<String> options) {
    final text = value?.toString();
    return text != null && options.contains(text) ? text : null;
  }

  /// "1600000" → "1.600.000" (web'deki formatNumberInput ile aynı davranış).
  String _group(String raw) {
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) return '';
    final buffer = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) buffer.write('.');
      buffer.write(digits[i]);
    }
    return buffer.toString();
  }

  int _num(TextEditingController c) =>
      int.tryParse(c.text.replaceAll(RegExp(r'\D'), '')) ?? 0;

  /// Motor hacmi: "1,6" ya da "1.6" → 1.6. Boş ya da geçersizse null.
  double? _parseEngine(String text) {
    final normalized = text.trim().replaceAll(',', '.');
    if (normalized.isEmpty) return null;
    final value = double.tryParse(normalized);
    if (value == null || value < 0.6 || value > 8) return null;
    return (value * 10).round() / 10;
  }

  bool get _engineValid => _engine.text.trim().isEmpty || _parseEngine(_engine.text) != null;

  bool get _isElectric => _fuel == 'Elektrik';

  void _onEstimateFieldChanged() => setState(_scheduleEstimate);

  void _refresh() {
    if (mounted) setState(() {});
  }

  /// Aralık isteği. Fiyat yoktur: aralık yalnızca araç özelliklerine bağlıdır. Eksikse null.
  Map<String, dynamic>? _estimateRequest() {
    final brand = _brand.text.trim();
    final model = _model.text.trim();
    final year = int.tryParse(_year.text.trim());
    final mileage = _num(_mileage);
    final fuel = _fuel;
    final transmission = _transmission;
    final damage = _damage;
    if (brand.isEmpty || model.isEmpty || year == null || mileage <= 0) return null;
    if (year < 1950 || year > DateTime.now().year + 1) return null;
    if (fuel == null || transmission == null || damage == null || !_engineValid) return null;
    return {
      'brand': brand,
      'model': model,
      'year': year,
      'mileage': mileage,
      'fuelType': fuel,
      'transmission': transmission,
      'engineSize': _isElectric ? null : _parseEngine(_engine.text),
      'damage': damage,
      'excludeId': widget.listingId,
    };
  }

  /// İstek değişince aralığı yeniden ister. Yazarken her tuşta değil, 500 ms sonra; eski yanıt yenisinin yerine geçmez.
  void _scheduleEstimate() {
    final request = _estimateRequest();
    if (request == null) {
      _estimateTimer?.cancel();
      _estimateKey = '';
      _estimate = null;
      _estimateError = null;
      _estimateLoading = false;
      return;
    }
    final key = jsonEncode(request);
    if (key == _estimateKey) return;
    _estimateTimer?.cancel();
    _estimateKey = key;
    _estimate = null;
    _estimateError = null;
    _estimateLoading = true;
    final seq = ++_estimateSeq;
    _estimateTimer = Timer(const Duration(milliseconds: 500), () => _fetchEstimate(request, seq));
  }

  Future<void> _fetchEstimate(Map<String, dynamic> request, int seq) async {
    try {
      final estimate = await _api.estimateSell(request);
      if (!mounted || seq != _estimateSeq) return;
      setState(() {
        _estimate = estimate;
        _estimateLoading = false;
      });
    } catch (e) {
      if (!mounted || seq != _estimateSeq) return;
      setState(() {
        _estimate = null;
        _estimateError = e.toString().replaceFirst('Exception: ', '');
        _estimateLoading = false;
      });
    }
  }

  /// Fotoğrafı 1280 px'e küçültüp data URI'ye çevirir — web ile aynı boyut.
  /// Küçültme şart: ham telefon fotoğrafı 5-10 MB, sunucu gövde sınırını aşar.
  Future<void> _pickImage() async {
    if (_images.length >= 12) return;
    setState(() => _pickingImage = true);
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1280,
        imageQuality: 85,
      );
      if (picked == null) return;

      final bytes = await picked.readAsBytes();
      final decoded = img.decodeImage(bytes);
      if (decoded == null) throw Exception('Fotoğraf okunamadı');

      final resized = decoded.width > 1280
          ? img.copyResize(decoded, width: 1280)
          : decoded;
      final jpeg = img.encodeJpg(resized, quality: 82);
      setState(() => _images.add('data:image/jpeg;base64,${base64Encode(jpeg)}'));
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _pickingImage = false);
    }
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  SellPriceGuard get _guard {
    final price = _num(_price);
    final estimate = _estimate;
    if (estimate == null || price <= 0) return SellPriceGuard.none;
    return sellPriceGuard(price, estimate);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_province == null) {
      _toast('İl seçmelisin');
      return;
    }
    final price = _num(_price);
    final minOffer = _num(_minOffer);
    // Sunucu da doğruluyor ama kullanıcı göndermeden görsün.
    if (minOffer > 0 && minOffer > price) {
      _toast('En düşük teklif, ilan fiyatından yüksek olamaz');
      return;
    }
    final guard = _guard;
    if (guard.level == SellGuardLevel.block) {
      _toast(guard.message ?? 'Fiyatı kontrol et');
      return;
    }

    setState(() => _saving = true);
    try {
      final result = await _api.saveListing(
        listingId: widget.listingId,
        brand: _brand.text.trim(),
        model: _model.text.trim(),
        year: int.tryParse(_year.text.trim()) ?? 0,
        price: price,
        mileage: _num(_mileage),
        city: _province!,
        district: _district ?? '',
        contactPhone: _phone.text.trim(),
        description: _description.text.trim(),
        fuelType: _fuel!,
        transmission: _transmission!,
        bodyType: _bodyType,
        color: _color,
        minOffer: minOffer,
        images: _images,
        damage: _damage,
        engineSize: _isElectric ? null : _parseEngine(_engine.text),
      );

      final status = result['status']?.toString();
      if (!mounted) return;
      if (status == 'rejected') {
        _toast('İlan yayınlanamadı: ${result['reason'] ?? ''}');
      } else {
        _toast(status == 'pending' ? 'İlanın incelemeye alındı' : 'İlanın yayınlandı');
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final districts = _province == null ? <String>[] : trDistrictsOf(_province!);
    final guard = _guard;
    final blocked = guard.level == SellGuardLevel.block;

    return Scaffold(
      appBar: AppBar(title: Text(widget.listingId == null ? 'İlan Ver' : 'İlanı Düzenle')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _text(_brand, 'Marka', required: true),
            _text(_model, 'Model', required: true),
            _text(_year, 'Yıl', keyboard: TextInputType.number, required: true),
            _numberField(_price, 'Fiyat (₺)', required: true),
            _numberField(_mileage, 'Kilometre', required: true),

            _dropdown('İl', _province, trProvinces, (v) {
              setState(() {
                _province = v;
                _district = null; // il değişti → eski ilçe geçersiz
              });
            }, required: true),
            _dropdown(
              'İlçe',
              _district,
              districts,
              districts.isEmpty ? null : (v) => setState(() => _district = v),
            ),

            _dropdown('Yakıt', _fuel, _fuels, (v) => setState(() {
                  _fuel = v;
                  _scheduleEstimate();
                }), required: true),
            _dropdown('Vites', _transmission, _transmissions, (v) => setState(() {
                  _transmission = v;
                  _scheduleEstimate();
                }), required: true),
            if (!_isElectric)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: TextFormField(
                  controller: _engine,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: 'Motor hacmi (litre) — isteğe bağlı',
                    hintText: '1,6',
                    helperText: 'Girilirse benzer ilanlar daha dar seçilir.',
                  ),
                  validator: (v) => _engineValid ? null : '0,6 ile 8,0 litre arasında olmalı',
                ),
              ),
            _dropdown('Hasar durumu', _damage, _damageOptions, (v) => setState(() {
                  _damage = v;
                  _scheduleEstimate();
                }),
                required: true,
                labelFor: (v) => _damageLabels[v] ?? v,
                helper: 'Tramer kaydı da hasar kaydıdır. Emin değilsen tramer kaydını kontrol et.'),

            SellEstimateCard(
              ready: _estimateRequest() != null,
              loading: _estimateLoading,
              error: _estimateError,
              estimate: _estimate,
              damage: _damage,
              guard: guard,
            ),
            const SizedBox(height: 12),

            _dropdown('Kasa tipi', _bodyType, _bodyTypes, (v) => setState(() => _bodyType = v!)),
            _dropdown('Renk', _color, _colors, (v) => setState(() => _color = v!)),

            _text(_phone, 'İletişim telefonu', keyboard: TextInputType.phone, required: true),
            _numberField(_minOffer, 'Kabul ettiğin en düşük teklif (₺) — isteğe bağlı'),
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text(
                'Bu tutarın altındaki teklifler sana ulaşmaz.',
                style: TextStyle(fontSize: 12, color: Colors.white54),
              ),
            ),

            TextFormField(
              controller: _description,
              maxLines: 4,
              decoration: const InputDecoration(labelText: 'Açıklama'),
            ),
            const SizedBox(height: 16),

            Text('Fotoğraflar (${_images.length}/12)',
                style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (var i = 0; i < _images.length; i++)
                  Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.memory(
                          base64Decode(_images[i].split(',').last),
                          width: 90,
                          height: 68,
                          fit: BoxFit.cover,
                        ),
                      ),
                      Positioned(
                        right: 0,
                        top: 0,
                        child: GestureDetector(
                          onTap: () => setState(() => _images.removeAt(i)),
                          child: const CircleAvatar(
                            radius: 11,
                            backgroundColor: Colors.black87,
                            child: Icon(Icons.close, size: 14, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  ),
                if (_images.length < 12)
                  OutlinedButton.icon(
                    onPressed: _pickingImage ? null : _pickImage,
                    icon: const Icon(Icons.add_a_photo),
                    label: Text(_pickingImage ? 'Yükleniyor…' : 'Fotoğraf ekle'),
                  ),
              ],
            ),

            const SizedBox(height: 24),
            FilledButton(
              onPressed: _saving || blocked ? null : _submit,
              child: Text(_saving ? 'Gönderiliyor…' : blocked ? 'Fiyatı düzelt' : 'İlanı yayınla'),
            ),
            const SizedBox(height: 8),
            const Text(
              'İlanın yapay zeka denetiminden geçtikten sonra yayınlanır.',
              style: TextStyle(fontSize: 12, color: Colors.white54),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _text(
    TextEditingController controller,
    String label, {
    TextInputType? keyboard,
    bool required = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboard,
        decoration: InputDecoration(labelText: label),
        validator: required
            ? (v) => (v == null || v.trim().isEmpty) ? 'Zorunlu alan' : null
            : null,
      ),
    );
  }

  /// Yazarken binlik ayraç ekleyen alan (1.600.000).
  Widget _numberField(TextEditingController controller, String label, {bool required = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        decoration: InputDecoration(labelText: label),
        onChanged: (value) {
          final grouped = _group(value);
          controller.value = TextEditingValue(
            text: grouped,
            selection: TextSelection.collapsed(offset: grouped.length),
          );
        },
        validator: required
            ? (v) => (v == null || v.trim().isEmpty) ? 'Zorunlu alan' : null
            : null,
      ),
    );
  }

  Widget _dropdown(
    String label,
    String? value,
    List<String> options,
    void Function(String?)? onChanged, {
    bool required = false,
    String Function(String)? labelFor,
    String? helper,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DropdownButtonFormField<String>(
        initialValue: options.contains(value) ? value : null,
        isExpanded: true,
        hint: required ? const Text('Seçiniz') : null,
        decoration: InputDecoration(labelText: label, helperText: helper, helperMaxLines: 2),
        items: options
            .map((o) => DropdownMenuItem(value: o, child: Text(labelFor?.call(o) ?? o)))
            .toList(),
        onChanged: onChanged,
        validator: required ? (v) => v == null ? 'Zorunlu alan' : null : null,
      ),
    );
  }
}
