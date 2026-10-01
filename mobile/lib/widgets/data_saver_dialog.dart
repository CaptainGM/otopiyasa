import 'package:flutter/material.dart';
import 'package:otopiyasa/services/data_saver.dart';

String dataSaverLabel(DataSaverMode mode) {
  switch (mode) {
    case DataSaverMode.auto:
      return 'Otomatik (hücresel veride)';
    case DataSaverMode.on:
      return 'Her zaman açık';
    case DataSaverMode.off:
      return 'Kapalı';
  }
}

/// Veri tasarrufu seçimi: küçük fotoğraflar hücresel veride otomatik, istenirse her zaman ya da hiç.
Future<void> showDataSaverDialog(BuildContext context) {
  return showDialog<void>(
    context: context,
    builder: (context) => ValueListenableBuilder<DataSaverMode>(
      valueListenable: DataSaver.instance.mode,
      builder: (context, current, _) => AlertDialog(
        title: const Text('Veri tasarrufu'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Açıkken ilan fotoğrafları küçük boyutta iner: listede ~10 KB, galeride ~90 KB '
              '(normalde ~50 KB ve ~270 KB). Fotoğraflar biraz daha az keskin görünür.',
              style: TextStyle(fontSize: 12.5, color: Colors.white70),
            ),
            const SizedBox(height: 8),
            RadioGroup<DataSaverMode>(
              groupValue: current,
              onChanged: (value) {
                if (value != null) DataSaver.instance.setMode(value);
              },
              child: Column(
                children: [
                  for (final mode in DataSaverMode.values)
                    RadioListTile<DataSaverMode>(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      title: Text(dataSaverLabel(mode)),
                      value: mode,
                    ),
                ],
              ),
            ),
          ],
        ),
        actions: [TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Tamam'))],
      ),
    ),
  );
}
