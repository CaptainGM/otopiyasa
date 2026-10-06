import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/utils/relative_time.dart';

/// Evdeki bilgisayarda arka planda çalışan Arabam bekçisinin durumu, günlük özeti ve (güne dokununca)
/// saat saat dökümü — web yönetim panelindeki "Arabam Bekçisi" bölümünün mobil karşılığı
/// (bkz. src/components/HomeWatcherPanel.tsx). Bekçi dakikada bir sinyal verir; sinyal 3 dakikadan
/// eskiyse "Kapalı" görünür (bilgisayar kapalı ya da uykuda).
class HomeWatcherCard extends StatefulWidget {
  const HomeWatcherCard({super.key});

  @override
  State<HomeWatcherCard> createState() => _HomeWatcherCardState();
}

class _HomeWatcherCardState extends State<HomeWatcherCard> {
  static const _emerald = Color(0xFF10B981);
  static const _rose = Color(0xFFF43F5E);
  static const _amber = Color(0xFFF5B942);
  static const _sky = Color(0xFF7DD3FC);

  final _api = ApiService();
  final _nf = NumberFormat.decimalPattern('tr_TR');
  Map<String, dynamic>? _data;
  String? _error;
  String? _openDate;
  List<Map<String, dynamic>>? _hours;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await _api.fetchHomeWatcher();
      if (mounted) {
        setState(() {
          _data = data;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted && _data == null)
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _toggleDay(String date) async {
    if (_openDate == date) {
      setState(() => _openDate = null);
      return;
    }
    setState(() {
      _openDate = date;
      _hours = null;
    });
    try {
      final hours = await _api.fetchHomeWatcherHours(date);
      if (mounted && _openDate == date) setState(() => _hours = hours);
    } catch (_) {
      if (mounted && _openDate == date) setState(() => _hours = []);
    }
  }

  String _n(Object? v) => _nf.format((v as num?) ?? 0);

  /// 4500 sn → "1 sa 15 dk", 700 sn → "12 dk", 0 → "—".
  String _duration(Object? seconds) {
    final s = ((seconds as num?) ?? 0).toInt();
    final minutes = (s / 60).round();
    if (minutes <= 0) return s > 0 ? '<1 dk' : '—';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    return h > 0 ? '$h sa${m > 0 ? ' $m dk' : ''}' : '$m dk';
  }

  Color _stateColor(String state) => state == 'online'
      ? _emerald
      : (state == 'paused' ? _amber : Colors.white54);

  String _dayLabel(String dateStr) {
    final now = DateTime.now().toUtc().add(const Duration(hours: 3));
    String fmt(DateTime d) => DateFormat('dd.MM.yyyy').format(d);
    if (dateStr == fmt(now)) return '$dateStr (bugün)';
    if (dateStr == fmt(now.subtract(const Duration(days: 1))))
      return '$dateStr (dün)';
    return dateStr;
  }

  Widget _tile(String label, String value, {Color? color}) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white12),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w900,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 10.5, color: Colors.white54),
            ),
          ],
        ),
      ),
    );
  }

  /// Bekçinin henüz hiç kontrol etmediği ilanların sayfalı listesi.
  void _openUnverifiedSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.8,
        maxChildSize: 0.95,
        builder: (_, controller) =>
            _UnverifiedList(api: _api, scrollController: controller),
      ),
    );
  }

  /// Saat satırına dokununca o saatte arşive giden ve eklenen ilanların listesi.
  void _openHourSheet(String date, int hour, int archived, int inserted) {
    final label = '$date ${hour.toString().padLeft(2, '0')}:00';
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        maxChildSize: 0.95,
        builder: (_, controller) => ListView(
          controller: controller,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          children: [
            Text(
              label,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            if (archived > 0)
              _itemSection(
                'Arşive giden ($archived)',
                _rose,
                date,
                hour,
                'archived',
              ),
            if (inserted > 0)
              _itemSection(
                'Yeni eklenen ($inserted)',
                _sky,
                date,
                hour,
                'inserted',
              ),
          ],
        ),
      ),
    );
  }

  /// Arşive giden ilanın sebebi (yeni eklenenlerde yok).
  String _reasonOf(String kind, Map<String, dynamic> it) {
    final reason = it['removedReason']?.toString() ?? '';
    return kind == 'archived' && reason.isNotEmpty ? ' · $reason' : '';
  }

  Widget _itemSection(
    String title,
    Color color,
    String date,
    int hour,
    String kind,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 14),
        Text(
          title,
          style: TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
        const SizedBox(height: 4),
        FutureBuilder<List<Map<String, dynamic>>>(
          future: _api.fetchHomeWatcherItems(date, hour, kind),
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Padding(
                padding: EdgeInsets.all(12),
                child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
              );
            }
            final items = snap.data ?? [];
            if (items.isEmpty) {
              return const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  'Kayıt bulunamadı.',
                  style: TextStyle(fontSize: 12, color: Colors.white54),
                ),
              );
            }
            return Column(
              children: [
                for (final it in items)
                  ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      '${it['brand'] ?? ''} ${it['model'] ?? ''} ${it['year'] ?? ''} — ${it['title'] ?? ''}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12.5),
                    ),
                    subtitle: Text(
                      '${_n(it['price'])} TL${_reasonOf(kind, it)}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11,
                        color: Colors.white54,
                      ),
                    ),
                    trailing: (it['listingUrl']?.toString() ?? '').isEmpty
                        ? null
                        : const Icon(
                            Icons.open_in_new,
                            size: 16,
                            color: Colors.white54,
                          ),
                    onTap: () {
                      final url = Uri.tryParse(
                        it['listingUrl']?.toString() ?? '',
                      );
                      if (url != null) {
                        launchUrl(url, mode: LaunchMode.externalApplication);
                      }
                    },
                  ),
              ],
            );
          },
        ),
      ],
    );
  }

  Widget _hoursList() {
    final hours = _hours;
    // Bugün için içinde bulunulan saatten sonrası "çalışmadı" değil "henüz gelmedi".
    final trNow = DateTime.now().toUtc().add(const Duration(hours: 3));
    final isToday = _openDate == DateFormat('dd.MM.yyyy').format(trNow);
    if (hours == null) {
      return const Padding(
        padding: EdgeInsets.all(12),
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    final maxChecked = hours.fold<int>(
      1,
      (m, h) => ((h['checked'] as num?)?.toInt() ?? 0) > m
          ? (h['checked'] as num).toInt()
          : m,
    );
    return Container(
      margin: const EdgeInsets.only(top: 4, bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          for (final h in hours)
            Builder(
              builder: (context) {
                final checked = (h['checked'] as num?)?.toInt() ?? 0;
                final idle =
                    checked == 0 && ((h['batches'] as num?)?.toInt() ?? 0) == 0;
                final hour = (h['hour'] as num?)?.toInt() ?? 0;
                final future = isToday && hour > trNow.hour;
                final blocked = (h['blocked'] as num?)?.toInt() ?? 0;
                final paused = (h['pausedMinutes'] as num?)?.toInt() ?? 0;
                final archived = (h['archived'] as num?)?.toInt() ?? 0;
                final inserted = (h['inserted'] as num?)?.toInt() ?? 0;
                final canOpen = !future && (archived > 0 || inserted > 0);
                return InkWell(
                  onTap: canOpen
                      ? () =>
                            _openHourSheet(_openDate!, hour, archived, inserted)
                      : null,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2.5),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 38,
                          child: Text(
                            '${hour.toString().padLeft(2, '0')}:00',
                            style: const TextStyle(
                              fontSize: 11,
                              color: Colors.white54,
                            ),
                          ),
                        ),
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(3),
                            child: LinearProgressIndicator(
                              value: idle ? 0 : checked / maxChecked,
                              minHeight: 8,
                              backgroundColor: Colors.white10,
                              color: _emerald.withValues(alpha: 0.75),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 104,
                          child: future
                              ? const Text(
                                  'henüz gelmedi',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.white12,
                                  ),
                                )
                              : idle
                              ? const Text(
                                  'çalışmadı',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.white30,
                                  ),
                                )
                              : Text.rich(
                                  TextSpan(
                                    style: const TextStyle(fontSize: 11),
                                    children: [
                                      TextSpan(
                                        text: '$checked',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                      TextSpan(
                                        text: ' · ${_n(h['alive'])}c',
                                        style: const TextStyle(color: _emerald),
                                      ),
                                      TextSpan(
                                        text: ' · ${_n(h['archived'])}a',
                                        style: const TextStyle(color: _rose),
                                      ),
                                      if (((h['inserted'] as num?) ?? 0) > 0)
                                        TextSpan(
                                          text: ' · ${_n(h['inserted'])}y',
                                          style: const TextStyle(color: _sky),
                                        ),
                                      if (blocked > 0)
                                        TextSpan(
                                          text: ' · ${blocked}e',
                                          style: const TextStyle(color: _amber),
                                        ),
                                      if (paused > 0)
                                        TextSpan(
                                          text: ' · ${paused}dk',
                                          style: const TextStyle(color: _amber),
                                        ),
                                    ],
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          const SizedBox(height: 4),
          const Text(
            'c: canlı · a: arşive taşınan · y: yeni eklenen · e: engel · dk: mola\n(arşiv ya da yeni olan satıra dokun → ilanları gör)',
            style: TextStyle(fontSize: 10, color: Colors.white38),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    final watcher = data?['watcher'] as Map<String, dynamic>? ?? {};
    final today = data?['today'] as Map<String, dynamic>? ?? {};
    final queue = data?['queue'] as Map<String, dynamic>? ?? {};
    final days = (data?['days'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
    final estimate = queue['estimate'] as Map<String, dynamic>?;
    final state = watcher['state']?.toString() ?? 'offline';
    final lastBeat = DateTime.tryParse(
      watcher['lastHeartbeat']?.toString() ?? '',
    );
    final phase = watcher['phase']?.toString() ?? '';
    final host = watcher['host']?.toString() ?? '';
    final gap = (watcher['gapSeconds'] as num?)?.toDouble();
    final color = _stateColor(state);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '🏠 Arabam Bekçisi (ev bilgisayarı)',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: _error != null && data == null
                ? Text(_error!, style: const TextStyle(color: Colors.redAccent))
                : data == null
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(12),
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: color.withValues(alpha: 0.14),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: color.withValues(alpha: 0.5),
                              ),
                            ),
                            child: Text(
                              '${state == 'online' ? '● ' : (state == 'paused' ? '⏸ ' : '○ ')}${watcher['label'] ?? ''}',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: color,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      if (phase.isNotEmpty)
                        Text(phase, style: const TextStyle(fontSize: 13)),
                      Text(
                        [
                          if (host.isNotEmpty) host,
                          lastBeat != null
                              ? 'son sinyal ${relativeTimeTr(lastBeat)}'
                              : 'henüz hiç sinyal gelmedi',
                          if (state != 'offline' && gap != null && gap > 0)
                            'ilanlar arası ~${gap.round()} sn',
                        ].join(' · '),
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.white54,
                        ),
                      ),
                      if (lastBeat == null)
                        const Padding(
                          padding: EdgeInsets.only(top: 4),
                          child: Text(
                            'Kurmak için proje klasöründe arabam-bekci-kur.bat dosyasına çift tıkla.',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.white38,
                            ),
                          ),
                        ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          _tile('Kontrol', _n(today['checked'])),
                          const SizedBox(width: 6),
                          _tile('Canlı', _n(today['alive']), color: _emerald),
                          const SizedBox(width: 6),
                          _tile('Arşive', _n(today['archived']), color: _rose),
                          const SizedBox(width: 6),
                          _tile('Yeni', _n(today['inserted']), color: _sky),
                          const SizedBox(width: 6),
                          _tile('Engel', _n(today['blocked']), color: _amber),
                        ],
                      ),
                      const SizedBox(height: 10),
                      InkWell(
                        borderRadius: BorderRadius.circular(8),
                        onTap: _openUnverifiedSheet,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  'Hiç doğrulanmamış: ${_n(queue['neverVerified'])} / ${_n(queue['active'])} aktif ilan · son 24 saatte doğrulanan: ${_n(queue['verifiedLast24h'])}',
                                  style: const TextStyle(fontSize: 12.5),
                                ),
                              ),
                              const Icon(
                                Icons.chevron_right,
                                size: 18,
                                color: _amber,
                              ),
                            ],
                          ),
                        ),
                      ),
                      const Text(
                        'Dokun → kontrol edilmemiş ilanların listesi',
                        style: TextStyle(fontSize: 11, color: Colors.white38),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        estimate != null
                            ? 'Son günlerin hızıyla (saatte ~${_n(estimate['perActiveHour'])} ilan) yaklaşık ${_n(estimate['activeHoursNeeded'])} çalışma saati gerekiyor.'
                            : 'Tahmin için bekçinin biraz çalışması gerekiyor.',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.white54,
                        ),
                      ),
                      const SizedBox(height: 14),
                      const Text(
                        'Günlük özet (güne dokun → saat saat)',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 6),
                      if (days.isEmpty)
                        const Text(
                          'Henüz kayıt yok.',
                          style: TextStyle(fontSize: 12, color: Colors.white54),
                        )
                      else
                        for (final d in days) ...[
                          InkWell(
                            borderRadius: BorderRadius.circular(8),
                            onTap: () => _toggleDay(d['dateStr'].toString()),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                vertical: 8,
                                horizontal: 2,
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    _openDate == d['dateStr']
                                        ? Icons.expand_more
                                        : Icons.chevron_right,
                                    size: 18,
                                    color: Colors.white54,
                                  ),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      _dayLabel(d['dateStr'].toString()),
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                  Text.rich(
                                    TextSpan(
                                      style: const TextStyle(fontSize: 12),
                                      children: [
                                        TextSpan(
                                          text: _n(d['checked']),
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                        TextSpan(
                                          text: ' kontrol · ',
                                          style: const TextStyle(
                                            color: Colors.white54,
                                          ),
                                        ),
                                        TextSpan(
                                          text: _duration(d['activeSeconds']),
                                          style: const TextStyle(
                                            color: Colors.white70,
                                          ),
                                        ),
                                        TextSpan(
                                          text: ' · ${_n(d['archived'])}a',
                                          style: const TextStyle(color: _rose),
                                        ),
                                        TextSpan(
                                          text: ' · ${_n(d['inserted'])}y',
                                          style: const TextStyle(color: _sky),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          if (_openDate == d['dateStr']) _hoursList(),
                          const Divider(height: 1, color: Colors.white10),
                        ],
                      if ((watcher['recentLogs'] as List<dynamic>? ?? [])
                          .isNotEmpty) ...[
                        const SizedBox(height: 10),
                        ExpansionTile(
                          tilePadding: EdgeInsets.zero,
                          title: const Text(
                            'Son günlük satırları',
                            style: TextStyle(fontSize: 13),
                          ),
                          children: [
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.black38,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                (watcher['recentLogs'] as List<dynamic>).join(
                                  '\n',
                                ),
                                style: const TextStyle(
                                  fontSize: 10.5,
                                  fontFamily: 'monospace',
                                  height: 1.35,
                                  color: Colors.white70,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
          ),
        ),
      ],
    );
  }
}

/// Bekçinin henüz hiç doğrulamadığı Arabam ilanları: sayfa sayfa yüklenir, ilana dokununca kaynağı açılır.
class _UnverifiedList extends StatefulWidget {
  const _UnverifiedList({required this.api, required this.scrollController});

  final ApiService api;
  final ScrollController scrollController;

  @override
  State<_UnverifiedList> createState() => _UnverifiedListState();
}

class _UnverifiedListState extends State<_UnverifiedList> {
  final _nf = NumberFormat.decimalPattern('tr_TR');
  final List<Map<String, dynamic>> _items = [];
  int _total = 0;
  int _page = 0;
  int _totalPages = 1;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadMore();
  }

  Future<void> _loadMore() async {
    if (_loading || _page >= _totalPages) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final body = await widget.api.fetchUnverifiedListings(_page + 1);
      final items = (body['items'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>();
      if (!mounted) return;
      setState(() {
        _items.addAll(items);
        _page = (body['page'] as num?)?.toInt() ?? _page + 1;
        _totalPages = (body['totalPages'] as num?)?.toInt() ?? 1;
        _total = (body['total'] as num?)?.toInt() ?? _items.length;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  String _lastTry(Object? value) {
    final at = DateTime.tryParse(value?.toString() ?? '');
    return at == null ? 'hiç denenmedi' : 'denendi ${relativeTimeTr(at)}';
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      controller: widget.scrollController,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      children: [
        Text(
          'Kontrol edilmemiş ilanlar (${_nf.format(_total)})',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 2),
        const Text(
          'Bekçi sırayla kontrol ettikçe buradan düşer.',
          style: TextStyle(fontSize: 12, color: Colors.white54),
        ),
        const SizedBox(height: 8),
        for (final it in _items)
          ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            title: Text(
              '${it['brand'] ?? ''} ${it['model'] ?? ''} ${it['year'] ?? ''} — ${it['title'] ?? ''}',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12.5),
            ),
            subtitle: Text(
              '${_nf.format((it['price'] as num?) ?? 0)} TL · ${it['city'] ?? ''} · ${it['statusText'] ?? _lastTry(it['lastVerifyAttemptAt'])}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 11, color: Colors.white54),
            ),
            trailing: (it['listingUrl']?.toString() ?? '').isEmpty
                ? null
                : const Icon(
                    Icons.open_in_new,
                    size: 16,
                    color: Colors.white54,
                  ),
            onTap: () {
              final url = Uri.tryParse(it['listingUrl']?.toString() ?? '');
              if (url != null) {
                launchUrl(url, mode: LaunchMode.externalApplication);
              }
            },
          ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              _error!,
              style: const TextStyle(color: Colors.redAccent, fontSize: 12),
            ),
          ),
        if (_loading)
          const Padding(
            padding: EdgeInsets.all(12),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          )
        else if (_page < _totalPages)
          TextButton(
            onPressed: _loadMore,
            child: const Text('Daha fazla göster'),
          )
        else if (_items.isEmpty && _error == null)
          const Padding(
            padding: EdgeInsets.all(12),
            child: Text(
              'Kontrol bekleyen ilan kalmadı.',
              style: TextStyle(fontSize: 12, color: Colors.white54),
            ),
          ),
      ],
    );
  }
}
