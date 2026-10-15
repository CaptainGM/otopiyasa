import 'package:flutter/material.dart';
import 'package:otopiyasa/screens/main_shell.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/services/notification_service.dart';
import 'package:otopiyasa/utils/google_login_link.dart';

/// Google girişinden dönen bağlantıyı karşılar: bileti oturuma çevirir, sonra uygulamaya devam ettirir.
class GoogleLoginReturnScreen extends StatefulWidget {
  const GoogleLoginReturnScreen({super.key, required this.link});

  final GoogleLoginLink link;

  @override
  State<GoogleLoginReturnScreen> createState() => _GoogleLoginReturnScreenState();
}

class _GoogleLoginReturnScreenState extends State<GoogleLoginReturnScreen> {
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _finish());
  }

  Future<void> _finish() async {
    final code = widget.link.code;
    if (code == null) {
      setState(() => _error = googleLoginErrorMessage(widget.link.error));
      return;
    }
    try {
      await ApiService().exchangeGoogleTicket(code);
      NotificationService.instance.startPolling();
      if (!mounted) return;
      _leave();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Google ile giriş yapıldı')),
      );
    } catch (error) {
      if (mounted) setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    }
  }

  /// Uygulama bu bağlantıyla soğuk açıldıysa yığında başka ekran yoktur: ana kabuğa geçilir.
  /// Uygulama zaten açıksa girişin başlatıldığı ekranlara dönülür.
  void _leave() {
    final navigator = Navigator.of(context);
    if (navigator.canPop()) {
      navigator.popUntil((route) => route.isFirst);
    } else {
      navigator.pushReplacement(MaterialPageRoute(builder: (_) => const MainShell()));
    }
  }

  @override
  Widget build(BuildContext context) {
    final error = _error;
    return Scaffold(
      appBar: AppBar(title: const Text('Google ile giriş')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: error == null
              ? const Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(),
                    SizedBox(height: 16),
                    Text('Giriş tamamlanıyor...'),
                  ],
                )
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      error,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.redAccent),
                    ),
                    const SizedBox(height: 16),
                    FilledButton(onPressed: _leave, child: const Text('Ana sayfaya dön')),
                  ],
                ),
        ),
      ),
    );
  }
}
