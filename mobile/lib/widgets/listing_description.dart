import 'package:flutter/material.dart';

class ListingDescription extends StatefulWidget {
  const ListingDescription({super.key, required this.value});

  final String value;

  @override
  State<ListingDescription> createState() => _ListingDescriptionState();
}

class _ListingDescriptionState extends State<ListingDescription> {
  bool _expanded = false;

  String _format(String value) => value
      .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'</p\s*>', caseSensitive: false), '\n\n')
      .replaceAll(RegExp(r'<[^>]*>'), ' ')
      .replaceAll(RegExp(r'&nbsp;|&#160;', caseSensitive: false), ' ')
      .replaceAll(RegExp(r'&amp;', caseSensitive: false), '&')
      .replaceAll(RegExp(r'&quot;', caseSensitive: false), '"')
      .replaceAll(RegExp(r'&#39;|&apos;', caseSensitive: false), "'")
      .replaceAll(RegExp(r'\r\n?'), '\n')
      .replaceAll(RegExp(r'[ \t]+\n'), '\n')
      .replaceAll(RegExp(r'\n[ \t]+'), '\n')
      .replaceAll(RegExp(r'[ \t]{2,}'), ' ')
      .replaceAll(RegExp(r'\n{3,}'), '\n\n')
      .trim();

  @override
  Widget build(BuildContext context) {
    final description = _format(widget.value);
    if (description.isEmpty) return const SizedBox.shrink();

    final canExpand = description.length > 500;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.035),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'İlan açıklaması',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          Text(
            description,
            maxLines: canExpand && !_expanded ? 8 : null,
            overflow: canExpand && !_expanded
                ? TextOverflow.ellipsis
                : TextOverflow.visible,
            style: const TextStyle(height: 1.55, color: Colors.white70),
          ),
          if (canExpand)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () => setState(() => _expanded = !_expanded),
                child: Text(
                  _expanded ? 'Daha az göster' : 'Açıklamanın tamamını gör',
                ),
              ),
            ),
        ],
      ),
    );
  }
}
