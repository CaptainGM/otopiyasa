import 'package:flutter/material.dart';
import 'package:otopiyasa/services/api_service.dart';

/// Profil rozeti: sunucunun verdiği avatar adresi (hazır çizim ya da yüklenen fotoğraf), yoksa baş harfler.
class UserAvatar extends StatelessWidget {
  const UserAvatar({super.key, required this.name, required this.avatar, this.size = 44});

  final String name;
  final Map<dynamic, dynamic>? avatar;
  final double size;

  String get _initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    return parts.take(2).map((p) => p.characters.first).join().toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(size * 0.28);
    final path = avatar?['url']?.toString();
    final fallback = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        borderRadius: radius,
        gradient: const LinearGradient(colors: [Color(0xFFFBBF24), Color(0xFFF97316)], begin: Alignment.topLeft, end: Alignment.bottomRight),
      ),
      child: Text(_initials, style: TextStyle(fontSize: size * 0.38, fontWeight: FontWeight.w900, color: const Color(0xFF221202))),
    );
    if (path == null || path.isEmpty) return fallback;
    return ClipRRect(
      borderRadius: radius,
      child: Image.network(
        ApiService().originUrl + path,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => fallback,
        loadingBuilder: (_, child, progress) => progress == null ? child : SizedBox(width: size, height: size, child: const ColoredBox(color: Color(0x14FFFFFF))),
      ),
    );
  }
}
