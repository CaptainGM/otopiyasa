import 'package:flutter/material.dart';
import 'package:otopiyasa/models/account.dart';
import 'package:otopiyasa/services/api_service.dart';

/// PROFİL — hesap bilgisi, şifre değiştirme ve kayıtlı aramalar (fiyat alarmı).
///
/// Web'deki `/profile` + `/subscriptions` sayfalarının birleşimi; mobilde iki
/// ayrı ekran yerine tek yerde toplandı çünkü ikisi de kısa.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _api = ApiService();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _searchBrand = TextEditingController();
  final _searchModel = TextEditingController();
  final _searchMaxPrice = TextEditingController();
  final _searchTargetAvg = TextEditingController();
  final _businessName = TextEditingController();
  final _businessPhone = TextEditingController();
  final _newEmail = TextEditingController();
  final _emailCode = TextEditingController();

  late Future<List<SavedSearch>> _searches;
  bool _busy = false;
  bool _businessBusy = false;
  bool _emailBusy = false;

  /// idle | awaiting-current | awaiting-new
  String _emailStage = 'idle';
  String? _emailMessage;

  @override
  void initState() {
    super.initState();
    _searches = _api.fetchSubscriptions().catchError((_) => <SavedSearch>[]);
    // businessStatus login anında gelmemiş olabilir — profil açılışında tazele.
    _api.me().then((user) {
      if (user != null && mounted) setState(() => _api.currentUser = user);
    });
  }

  @override
  void dispose() {
    for (final c in [
      _current,
      _next,
      _searchBrand,
      _searchModel,
      _searchMaxPrice,
      _searchTargetAvg,
      _businessName,
      _businessPhone,
      _newEmail,
      _emailCode,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  void _reloadSearches() {
    setState(() => _searches = _api.fetchSubscriptions().catchError((_) => <SavedSearch>[]));
  }

  Future<void> _changePassword() async {
    if (_current.text.isEmpty || _next.text.isEmpty) {
      _toast('İki alanı da doldur');
      return;
    }
    setState(() => _busy = true);
    try {
      await _api.changePassword(
        currentPassword: _current.text,
        newPassword: _next.text,
      );
      _current.clear();
      _next.clear();
      _toast('Şifren güncellendi');
    } catch (e) {
      // Sunucu şifre politikasını da burada bildiriyor (8+ karakter, büyük/küçük…)
      _toast(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addSearch() async {
    final brand = _searchBrand.text.trim();
    final email = _api.currentUser?['email']?.toString() ?? '';
    final targetAvg = int.tryParse(_searchTargetAvg.text.replaceAll(RegExp(r'\D'), ''));
    if (brand.isEmpty) {
      _toast('Marka gir');
      return;
    }
    if (targetAvg != null && brand.isEmpty) {
      _toast('Ortalama fiyat alarmı için marka gerekli');
      return;
    }
    setState(() => _busy = true);
    try {
      await _api.createSubscription(
        email: email,
        brand: brand,
        model: _searchModel.text.trim(),
        maxPrice: int.tryParse(_searchMaxPrice.text.replaceAll(RegExp(r'\D'), '')),
        targetAvgPrice: targetAvg,
      );
      _searchBrand.clear();
      _searchModel.clear();
      _searchMaxPrice.clear();
      _searchTargetAvg.clear();
      _reloadSearches();
      _toast('Kayıtlı arama eklendi');
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _requestBusiness() async {
    final name = _businessName.text.trim();
    final phone = _businessPhone.text.trim();
    if (name.length < 2) {
      _toast('Firma adı gir');
      return;
    }
    setState(() => _businessBusy = true);
    try {
      await _api.requestBusiness(businessName: name, businessPhone: phone);
      _businessName.clear();
      _businessPhone.clear();
      _toast('Başvurun alındı, onaylanınca haber vereceğiz.');
      setState(() {});
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _businessBusy = false);
    }
  }

  Future<void> _startEmailChange() async {
    final newEmail = _newEmail.text.trim();
    if (newEmail.isEmpty) {
      _toast('Yeni e-posta adresini gir');
      return;
    }
    setState(() => _emailBusy = true);
    try {
      final res = await _api.startEmailChange(newEmail);
      setState(() {
        _emailStage = 'awaiting-current';
        _emailMessage = res['message']?.toString();
      });
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _emailBusy = false);
    }
  }

  Future<void> _verifyCurrentCode() async {
    final code = _emailCode.text.trim();
    if (code.isEmpty) return;
    setState(() => _emailBusy = true);
    try {
      final res = await _api.verifyCurrentEmailCode(code);
      _emailCode.clear();
      setState(() {
        _emailStage = 'awaiting-new';
        _emailMessage = res['message']?.toString();
      });
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _emailBusy = false);
    }
  }

  Future<void> _verifyNewCode() async {
    final code = _emailCode.text.trim();
    if (code.isEmpty) return;
    setState(() => _emailBusy = true);
    try {
      await _api.verifyNewEmailCode(code);
      _emailCode.clear();
      _newEmail.clear();
      setState(() {
        _emailStage = 'idle';
        _emailMessage = null;
      });
      _toast('E-posta adresin güncellendi');
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _emailBusy = false);
    }
  }

  Future<void> _cancelEmailChange() async {
    await _api.cancelEmailChange().catchError((_) {});
    _emailCode.clear();
    if (mounted) {
      setState(() {
        _emailStage = 'idle';
        _emailMessage = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = _api.currentUser;

    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              leading: const CircleAvatar(child: Icon(Icons.person)),
              title: Text(user?['name']?.toString() ?? 'Hesabım'),
              subtitle: Text(user?['email']?.toString() ?? ''),
            ),
          ),

          const SizedBox(height: 24),
          const Text('Şifre değiştir', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          TextField(
            controller: _current,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Mevcut şifre'),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _next,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Yeni şifre'),
          ),
          const SizedBox(height: 6),
          const Text(
            'En az 8 karakter; büyük harf, küçük harf, rakam ve özel karakter içermeli.',
            style: TextStyle(fontSize: 12, color: Colors.white54),
          ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _busy ? null : _changePassword,
            child: const Text('Şifreyi güncelle'),
          ),

          const SizedBox(height: 32),
          _emailChangeSection(),

          const SizedBox(height: 32),
          _businessSection(),

          const SizedBox(height: 32),
          const Text('Kayıtlı aramalar', style: TextStyle(fontWeight: FontWeight.bold)),
          const Text(
            'Aradığın araç yayına girdiğinde e-posta göndeririz.',
            style: TextStyle(fontSize: 12, color: Colors.white54),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchBrand,
                  decoration: const InputDecoration(labelText: 'Marka'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _searchModel,
                  decoration: const InputDecoration(labelText: 'Model (opsiyonel)'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _searchMaxPrice,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Bu tutarın altında yeni ilan gelince haber ver (₺)'),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _searchTargetAvg,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Piyasa ortalaması bu tutarın altına düşünce haber ver (₺)',
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'İkinci alan segment fiyat alarmıdır: markanın (model verirsen o modelin) '
            'güncel piyasa ortalaması bu tutarın altına inince e-posta gönderilir.',
            style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5)),
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton.icon(
              onPressed: _busy ? null : _addSearch,
              icon: const Icon(Icons.add),
              label: const Text('Alarm ekle'),
            ),
          ),
          const SizedBox(height: 8),
          FutureBuilder<List<SavedSearch>>(
            future: _searches,
            builder: (context, snapshot) {
              final items = snapshot.data ?? [];
              if (items.isEmpty) {
                return const Text('Kayıtlı araman yok.',
                    style: TextStyle(fontSize: 12, color: Colors.white54));
              }
              return Column(
                children: items
                    .map(
                      (s) => ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        title: Text([
                          s.brand,
                          if (s.model.isNotEmpty) s.model,
                          if (s.targetAvgPrice != null)
                            'ortalama ≤ ${s.targetAvgPrice} ₺'
                          else if (s.maxPrice != null)
                            '≤ ${s.maxPrice} ₺',
                        ].join(' • ')),
                        trailing: IconButton(
                          icon: const Icon(Icons.delete_outline),
                          onPressed: () async {
                            try {
                              await _api.deleteSubscription(s.id);
                              _reloadSearches();
                            } catch (e) {
                              _toast(e.toString().replaceFirst('Exception: ', ''));
                            }
                          },
                        ),
                      ),
                    )
                    .toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _emailChangeSection() {
    final currentEmail = _api.currentUser?['email']?.toString() ?? '';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('E-posta değiştir', style: TextStyle(fontWeight: FontWeight.bold)),
        const Text(
          'Telefon doğrulaması olmadığı için önce mevcut, sonra yeni adresine kod göndeririz.',
          style: TextStyle(fontSize: 12, color: Colors.white54),
        ),
        const SizedBox(height: 8),
        if (_emailStage == 'idle') ...[
          Text('Mevcut: $currentEmail', style: const TextStyle(fontSize: 12, color: Colors.white54)),
          const SizedBox(height: 8),
          TextField(
            controller: _newEmail,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Yeni e-posta'),
          ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _emailBusy ? null : _startEmailChange,
            child: Text(_emailBusy ? 'Gönderiliyor…' : 'Kod gönder'),
          ),
        ] else ...[
          if (_emailMessage != null) ...[
            Text(_emailMessage!, style: const TextStyle(fontSize: 12)),
            const SizedBox(height: 8),
          ],
          TextField(
            controller: _emailCode,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Doğrulama kodu'),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              FilledButton(
                onPressed: _emailBusy
                    ? null
                    : (_emailStage == 'awaiting-current' ? _verifyCurrentCode : _verifyNewCode),
                child: Text(_emailBusy ? '…' : 'Doğrula'),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: _emailBusy ? null : _cancelEmailChange,
                child: const Text('Vazgeç'),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _businessSection() {
    final user = _api.currentUser;
    final status = user?['businessStatus']?.toString() ?? 'none';
    final businessName = user?['businessName']?.toString() ?? '';
    final rejectionReason = user?['businessRejectionReason']?.toString() ?? '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('İşletme hesabı', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        if (status == 'approved')
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.green.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.green.withValues(alpha: 0.25)),
            ),
            child: Text('İşletme hesabın onaylı: $businessName', style: const TextStyle(fontSize: 13)),
          )
        else if (status == 'pending')
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.amber.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.amber.withValues(alpha: 0.25)),
            ),
            child: const Text('Başvurun inceleniyor.', style: TextStyle(fontSize: 13)),
          )
        else ...[
          if (status == 'rejected' && rejectionReason.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text('Reddedildi: $rejectionReason', style: const TextStyle(fontSize: 12, color: Colors.redAccent)),
            ),
          TextField(
            controller: _businessName,
            decoration: const InputDecoration(labelText: 'Firma adı'),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _businessPhone,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'İşletme telefonu'),
          ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _businessBusy ? null : _requestBusiness,
            child: Text(_businessBusy ? 'Gönderiliyor…' : 'İşletme hesabı için başvur'),
          ),
        ],
      ],
    );
  }
}
