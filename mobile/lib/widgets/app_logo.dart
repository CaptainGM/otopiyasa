import 'package:flutter/material.dart';
import 'package:otopiyasa/theme/app_theme.dart';

class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: compact ? 34 : 42,
          height: compact ? 34 : 42,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: const LinearGradient(
              colors: [AppTheme.accent, AppTheme.accent2],
            ),
          ),
          child: const Icon(Icons.directions_car_filled, color: Color(0xFF041018)),
        ),
        if (!compact) ...[
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              RichText(
                text: const TextSpan(
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white),
                  children: [
                    TextSpan(text: 'Oto'),
                    TextSpan(text: 'Piyasa', style: TextStyle(color: AppTheme.accent)),
                  ],
                ),
              ),
              Text(
                'İlan fiyat istihbaratı',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.45),
                  fontSize: 10,
                  letterSpacing: 1.4,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
