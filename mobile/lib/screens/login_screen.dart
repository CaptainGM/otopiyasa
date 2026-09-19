import 'package:flutter/material.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/services/notification_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/widgets/app_logo.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _api = ApiService();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _nameController = TextEditingController();
  bool _loading = false;
  String? _error;
  /// Kayıt kipinde ad alanı ve şifre kuralları gösterilir.
  bool _registerMode = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _submit({required bool register}) async {
    setState(() {
      _loading = true;
      _error = null;
    });

    if (register && _nameController.text.trim().isEmpty) {
      setState(() {
        _error = 'Ad soyad zorunludur';
        _loading = false;
      });
      return;
    }
    if (register && _passwordController.text != _confirmPasswordController.text) {
      setState(() {
        _error = 'Şifreler birbiriyle eşleşmiyor';
        _loading = false;
      });
      return;
    }

    try {
      await _api.auth(
        register: register,
        email: _emailController.text.trim(),
        password: _passwordController.text,
        // Ad artık kullanıcıdan alınıyor; sabit "Mobil Kullanıcı" yazıyordu ve
        // ilanlarda/tekliflerde herkes aynı isimle görünüyordu.
        name: register ? _nameController.text.trim() : null,
      );
      // Girişten sonra bildirim yoklaması başlasın.
      NotificationService.instance.startPolling();
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(register ? 'Kayıt başarılı' : 'Giriş başarılı')),
        );
      }
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Hesap')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const AppLogo(),
          const SizedBox(height: 24),
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: false, label: Text('Giriş Yap')),
              ButtonSegment(value: true, label: Text('Kayıt Ol')),
            ],
            selected: {_registerMode},
            onSelectionChanged: (s) => setState(() {
              _registerMode = s.first;
              _error = null;
            }),
          ),
          const SizedBox(height: 16),
          if (_registerMode) ...[
            TextField(
              controller: _nameController,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Ad Soyad'),
            ),
            const SizedBox(height: 12),
          ],
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'E-posta'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _passwordController,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Şifre'),
          ),
          if (_registerMode) ...[
            const SizedBox(height: 12),
            TextField(
              controller: _confirmPasswordController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Şifre (tekrar)'),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Colors.redAccent)),
          ],
          const SizedBox(height: 20),
          if (_registerMode)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Şifre en az 8 karakter olmalı; büyük harf, küçük harf, rakam ve '
                'özel karakter içermeli.',
                style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 12),
              ),
            ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _loading ? null : () => _submit(register: _registerMode),
            style: FilledButton.styleFrom(
              backgroundColor: AppTheme.accent,
              foregroundColor: const Color(0xFF041018),
              minimumSize: const Size.fromHeight(48),
            ),
            child: Text(_loading
                ? 'Bekleyin...'
                : (_registerMode ? 'Hesap Oluştur' : 'Giriş Yap')),
          ),
          const SizedBox(height: 16),
          Text(
            _registerMode
                ? 'Kayıttan sonra e-postana doğrulama bağlantısı gönderilir; '
                  'giriş yapabilmek için ona tıklaman gerekir.'
                : 'Şifreni unuttuysan otopiyasa.app üzerinden sıfırlayabilirsin.',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 12),
          ),
        ],
      ),
    );
  }
}
