import 'package:flutter/material.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';

/// ŞİFREMİ UNUTTUM — web'deki `/forgot-password` + `/reset-password` akışının uygulama içi hali.
/// Web e-postaya bağlantı gönderir; burada uygulamadan çıkmamak için 6 haneli kod gönderilir.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, this.initialEmail = ''});

  final String initialEmail;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _api = ApiService();
  late final TextEditingController _email = TextEditingController(text: widget.initialEmail);
  final _code = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();

  bool _codeSent = false;
  bool _busy = false;
  String? _error;
  String? _info;

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  String _clean(Object e) => e.toString().replaceFirst('Exception: ', '');

  Future<void> _sendCode() async {
    final email = _email.text.trim();
    if (email.isEmpty) {
      setState(() => _error = 'E-posta adresini gir');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final message = await _api.requestPasswordResetCode(email);
      if (!mounted) return;
      setState(() {
        _codeSent = true;
        _info = message;
      });
    } catch (e) {
      if (mounted) setState(() => _error = _clean(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reset() async {
    if (_code.text.trim().length != 6) {
      setState(() => _error = 'E-postandaki 6 haneli kodu gir');
      return;
    }
    if (_password.text != _confirm.text) {
      setState(() => _error = 'Şifreler birbiriyle eşleşmiyor');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final message = await _api.resetPasswordWithCode(
        email: _email.text.trim(),
        code: _code.text.trim(),
        newPassword: _password.text,
      );
      if (!mounted) return;
      Navigator.of(context).pop(message);
    } catch (e) {
      if (mounted) setState(() => _error = _clean(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final faint = TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 12);
    return Scaffold(
      appBar: AppBar(title: const Text('Şifremi unuttum')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            _codeSent
                ? 'E-postana 6 haneli bir kod gönderdik. Kodu ve yeni şifreni gir.'
                : 'E-posta adresini gir, sana 6 haneli bir sıfırlama kodu gönderelim.',
            style: const TextStyle(fontSize: 14),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _email,
            enabled: !_codeSent,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'E-posta'),
          ),
          if (_codeSent) ...[
            const SizedBox(height: 12),
            TextField(
              controller: _code,
              keyboardType: TextInputType.number,
              maxLength: 6,
              decoration: const InputDecoration(labelText: 'Sıfırlama kodu', counterText: ''),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Yeni şifre'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _confirm,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Yeni şifre (tekrar)'),
            ),
            const SizedBox(height: 6),
            Text(
              'En az 8 karakter; büyük harf, küçük harf, rakam ve özel karakter içermeli. '
              'Şifre değişince tüm cihazlardaki oturumlar kapanır.',
              style: faint,
            ),
          ],
          if (_info != null && _codeSent) ...[
            const SizedBox(height: 12),
            Text(_info!, style: const TextStyle(color: Colors.greenAccent, fontSize: 12)),
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Colors.redAccent)),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy ? null : (_codeSent ? _reset : _sendCode),
            style: FilledButton.styleFrom(
              backgroundColor: AppTheme.accent,
              foregroundColor: const Color(0xFF041018),
              minimumSize: const Size.fromHeight(48),
            ),
            child: Text(_busy ? 'Bekleyin...' : (_codeSent ? 'Şifreyi güncelle' : 'Kod gönder')),
          ),
          if (_codeSent)
            TextButton(
              onPressed: _busy ? null : _sendCode,
              child: const Text('Kodu tekrar gönder'),
            ),
        ],
      ),
    );
  }
}
