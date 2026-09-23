import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:otopiyasa/data/tr_geo.dart';
import 'package:otopiyasa/services/api_service.dart';

/// İLAN VER / DÜZENLE — web'deki `/sell` formunun mobil karşılığı.
///
/// Aynı uç noktayı kullanır, aynı kurallara tabidir (fiyat tabanı, yapay zeka
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
  final _minOffer = TextEditingController();
  final _phone = TextEditingController();
  final _description = TextEditingController();

  String? _province;
  String? _district;
  String _fuel = 'Benzin';
  String _transmission = 'Manuel';
  String _bodyType = 'Sedan';
  String _color = 'Beyaz';

  final List<String> _images = [];
  bool _saving = false;
  bool _pickingImage = false;

  static const _fuels = ['Benzin', 'Dizel', 'LPG & Benzin', 'Elektrik', 'Hibrit'];
  static const _transmissions = ['Manuel', 'Otomatik', 'Yarı Otomatik'];
  static const _bodyTypes = [
    'Sedan', 'Hatchback', 'SUV', 'Station Wagon', 'Coupe',
    'Cabrio', 'MPV', 'Pickup', 'Belirtilmemiş',
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
      _minOffer.text = _group(init['minOffer']?.toString() ?? '');
      _phone.text = init['contactPhone']?.toString() ?? '';
      _description.text = init['description']?.toString() ?? '';
      final city = init['city']?.toString();
      if (city != null && trProvinces.contains(city)) _province = city;
    }
  }

  @override
  void dispose() {
    for (final c in [_brand, _model, _year, _price, _mileage, _minOffer, _phone, _description]) {
      c.dispose();
    }
    super.dispose();
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
        fuelType: _fuel,
        transmission: _transmission,
        bodyType: _bodyType,
        color: _color,
        minOffer: minOffer,
        images: _images,
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
            }),
            _dropdown(
              'İlçe',
              _district,
              districts,
              districts.isEmpty ? null : (v) => setState(() => _district = v),
            ),

            _dropdown('Yakıt', _fuel, _fuels, (v) => setState(() => _fuel = v!)),
            _dropdown('Vites', _transmission, _transmissions,
                (v) => setState(() => _transmission = v!)),
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
              onPressed: _saving ? null : _submit,
              child: Text(_saving ? 'Gönderiliyor…' : 'İlanı yayınla'),
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
    void Function(String?)? onChanged,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DropdownButtonFormField<String>(
        initialValue: options.contains(value) ? value : null,
        decoration: InputDecoration(labelText: label),
        items: options.map((o) => DropdownMenuItem(value: o, child: Text(o))).toList(),
        onChanged: onChanged,
      ),
    );
  }
}
