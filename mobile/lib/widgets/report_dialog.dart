import 'package:flutter/material.dart';

/// İlan ya da teklif sohbeti şikayeti için ortak diyalog.
/// Web'deki ReportListingButton/ReportChatButton ile aynı sebep listeleri.
Future<void> showReportDialog(
  BuildContext context, {
  required Map<String, String> reasons,
  required Future<void> Function(String reason, String note) onSubmit,
}) async {
  var reason = reasons.keys.first;
  final noteController = TextEditingController();
  var busy = false;

  await showDialog<void>(
    context: context,
    builder: (dialogContext) => StatefulBuilder(
      builder: (dialogContext, setState) => AlertDialog(
        title: const Text('Bildir'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DropdownButtonFormField<String>(
              initialValue: reason,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Sebep'),
              items: reasons.entries
                  .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                  .toList(),
              onChanged: (value) => setState(() => reason = value ?? reason),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: noteController,
              maxLines: 2,
              maxLength: 500,
              decoration: const InputDecoration(
                labelText: 'Açıklama (opsiyonel)',
                alignLabelWithHint: true,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: busy ? null : () => Navigator.pop(dialogContext),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: busy
                ? null
                : () async {
                    setState(() => busy = true);
                    try {
                      await onSubmit(reason, noteController.text.trim());
                      if (dialogContext.mounted) Navigator.pop(dialogContext);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Bildirimin için teşekkürler, ekip inceleyecek.')),
                        );
                      }
                    } catch (e) {
                      setState(() => busy = false);
                      if (dialogContext.mounted) {
                        ScaffoldMessenger.of(dialogContext).showSnackBar(
                          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
                        );
                      }
                    }
                  },
            child: Text(busy ? 'Gönderiliyor…' : 'Gönder'),
          ),
        ],
      ),
    ),
  );
}

const listingReportReasons = {
  'satildi': 'İlan satılmış / artık mevcut değil',
  'yanlis-bilgi': 'Bilgiler yanlış veya yanıltıcı',
  'dolandiricilik': 'Dolandırıcılık şüphesi',
  'uygunsuz': 'Uygunsuz / alakasız içerik',
  'diger': 'Diğer',
};

const chatReportReasons = {
  'kufur-hakaret': 'Küfür / hakaret',
  'dolandiricilik': 'Dolandırıcılık şüphesi',
  'uygunsuz': 'Uygunsuz içerik',
  'diger': 'Diğer',
};
