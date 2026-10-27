import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/utils/relative_time.dart';
import 'package:otopiyasa/widgets/sheet_insets.dart';

const _emerald = Color(0xFF10B981);
const _amber = Color(0xFFF59E0B);
const _blue = Color(0xFF3B82F6);
const _rose = Color(0xFFF43F5E);
const _purple = Color(0xFF8B5CF6);

class AdminTrafficTab extends StatefulWidget {
  const AdminTrafficTab({super.key});

  @override
  State<AdminTrafficTab> createState() => _AdminTrafficTabState();
}

class _AdminTrafficTabState extends State<AdminTrafficTab> {
  final _api = ApiService();
  final _num = NumberFormat.decimalPattern('tr_TR');

  String _range = '24h';
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _trafficData;

  String _searchQuery = '';
  String _activeFilter = 'all';

  Timer? _autoRefreshTimer;

  @override
  void initState() {
    super.initState();
    _loadTraffic();
    _autoRefreshTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      if (mounted && WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) {
        _loadTraffic(silent: true);
      }
    });
  }

  @override
  void dispose() {
    _autoRefreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadTraffic({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final res = await _api.fetchTrafficStats(range: _range);
      if (mounted) {
        setState(() {
          _trafficData = res;
          _loading = false;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          if (!silent || _trafficData == null) {
            _error = e.toString().replaceFirst('Exception: ', '');
          }
        });
      }
    }
  }

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(' panoya kopyalandı ()'),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _showIpDetailSheet(BuildContext context, String ip) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _IpDetailSheet(ip: ip, api: _api),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    if (_loading && _trafficData == null) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null && _trafficData == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: _rose),
              const SizedBox(height: 12),
              Text(
                'Trafik verileri alınamadı',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white60, fontSize: 13),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => _loadTraffic(),
                icon: const Icon(Icons.refresh),
                label: const Text('Tekrar Dene'),
              ),
            ],
          ),
        ),
      );
    }

    final data = _trafficData ?? {};
    final totalVisits = (data['totalVisits'] as num?)?.toInt() ?? 0;
    final uniqueIps = (data['uniqueIps'] as num?)?.toInt() ?? 0;
    final onlineCount = (data['onlineCount'] as num?)?.toInt() ?? 0;
    final countryCount = (data['countryCount'] as num?)?.toInt() ?? 0;

    final userBreakdown = (data['userBreakdown'] as Map<String, dynamic>?) ?? {};
    final registeredCount = (userBreakdown['registered'] as num?)?.toInt() ?? 0;
    final guestCount = (userBreakdown['guest'] as num?)?.toInt() ?? 0;
    final botCount = (userBreakdown['bot'] as num?)?.toInt() ?? 0;

    final deviceMap = (data['deviceMap'] as Map<String, dynamic>?) ?? {};
    final desktopCount = (deviceMap['desktop'] as num?)?.toInt() ?? 0;
    final mobileCount = (deviceMap['mobile'] as num?)?.toInt() ?? 0;
    final tabletCount = (deviceMap['tablet'] as num?)?.toInt() ?? 0;

    final countries = (data['countries'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final topPages = (data['topPages'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final recentVisitors = (data['recentVisitors'] as List?)?.cast<Map<String, dynamic>>() ?? [];

    final filteredVisitors = recentVisitors.where((v) {
      final isReg = v['isRegistered'] == true;
      final isBot = v['isBot'] == true || v['device'] == 'bot';
      final country = (v['country'] as String? ?? '').toUpperCase();

      if (_activeFilter == 'users' && !isReg) return false;
      if (_activeFilter == 'guests' && (isReg || isBot)) return false;
      if (_activeFilter == 'bots' && !isBot) return false;
      if (_activeFilter == 'foreign' && country == 'TR') return false;

      final q = _searchQuery.toLowerCase().trim();
      if (q.isNotEmpty) {
        final ip = (v['ip'] as String? ?? '').toLowerCase();
        final path = (v['path'] as String? ?? '').toLowerCase();
        final cName = (v['countryName'] as String? ?? '').toLowerCase();
        final city = (v['city'] as String? ?? '').toLowerCase();
        final browser = (v['browser'] as String? ?? '').toLowerCase();
        final os = (v['os'] as String? ?? '').toLowerCase();
        final userEmail = (v['userEmail'] as String? ?? '').toLowerCase();
        final userName = (v['userName'] as String? ?? '').toLowerCase();
        final botName = (v['botName'] as String? ?? '').toLowerCase();

        final match = ip.contains(q) ||
            path.contains(q) ||
            cName.contains(q) ||
            city.contains(q) ||
            browser.contains(q) ||
            os.contains(q) ||
            userEmail.contains(q) ||
            userName.contains(q) ||
            botName.contains(q);

        if (!match) return false;
      }
      return true;
    }).toList();

    return RefreshIndicator(
      onRefresh: () => _loadTraffic(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          _buildHeaderBar(),
          const SizedBox(height: 16),

          Row(
            children: [
              Expanded(
                child: _statCard(
                  title: 'Toplam İstek',
                  value: _num.format(totalVisits),
                  icon: Icons.trending_up,
                  color: _blue,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _statCard(
                  title: 'Tekil IP',
                  value: _num.format(uniqueIps),
                  icon: Icons.fingerprint,
                  color: _purple,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _statCard(
                  title: 'Şu An Çevrim içi',
                  value: _num.format(onlineCount),
                  subtitle: 'Son 5 dk aktif',
                  icon: Icons.bolt,
                  color: _emerald,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _statCard(
                  title: 'Ülke Sayısı',
                  value: _num.format(countryCount),
                  icon: Icons.public,
                  color: _amber,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Ziyaretçi Dağılımı', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _badgeChip(Icons.person, 'Kayıtlı: $registeredCount', _emerald),
                      _badgeChip(Icons.person_outline, 'Misafir: $guestCount', _blue),
                      _badgeChip(Icons.smart_toy_outlined, 'Bot: $botCount', _rose),
                      _badgeChip(Icons.phone_android, 'Mobil: $mobileCount', Colors.orange),
                      _badgeChip(Icons.computer, 'Masaüstü: $desktopCount', Colors.indigo),
                      _badgeChip(Icons.tablet_mac, 'Tablet: $tabletCount', Colors.teal),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          if (countries.isNotEmpty) ...[
            Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          '🌍 En Çok Ziyaret Edilen Ülkeler',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        Text(
                          ' ülke',
                          style: const TextStyle(fontSize: 12, color: Colors.white54),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ...countries.take(6).map((c) {
                      final flag = c['flag'] as String? ?? '🌐';
                      final name = c['countryName'] as String? ?? c['country'] as String? ?? 'Bilinmiyor';
                      final count = (c['count'] as num?)?.toInt() ?? 0;
                      final percent = (c['percentage'] as num?)?.toDouble() ?? 0.0;
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(flag, style: const TextStyle(fontSize: 15)),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    name,
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                Text(
                                  '${_num.format(count)} (%${percent.toStringAsFixed(1)})',
                                  style: const TextStyle(fontSize: 12, color: Colors.white70),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: (percent / 100).clamp(0.01, 1.0),
                                minHeight: 4,
                                backgroundColor: Colors.white12,
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  c['country'] == 'TR' ? _emerald : _blue,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],

          if (topPages.isNotEmpty) ...[
            Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('📄 En Çok Gezilen Sayfalar', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    const SizedBox(height: 10),
                    ...topPages.take(6).map((p) {
                      final path = p['path'] as String? ?? '/';
                      final count = (p['count'] as num?)?.toInt() ?? 0;
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Row(
                          children: [
                            const Icon(Icons.link, size: 16, color: Colors.white54),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                path,
                                style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.white10,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                _num.format(count),
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],

          Row(
            children: [
              const Text('👥 Canlı Ziyaret Akışı', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const Spacer(),
              Text(
                ' / ',
                style: const TextStyle(fontSize: 12, color: Colors.white54),
              ),
            ],
          ),
          const SizedBox(height: 8),

          TextField(
            style: const TextStyle(fontSize: 13),
            decoration: InputDecoration(
              hintText: 'IP, sayfa, kullanıcı, şehir veya bot ara...',
              hintStyle: const TextStyle(color: Colors.white38, fontSize: 13),
              prefixIcon: const Icon(Icons.search, size: 20),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 18),
                      onPressed: () => setState(() => _searchQuery = ''),
                    )
                  : null,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              filled: true,
              fillColor: c.surface2,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide.none,
              ),
            ),
            onChanged: (val) => setState(() => _searchQuery = val),
          ),
          const SizedBox(height: 10),

          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _filterChip('all', 'Tümü', recentVisitors.length),
                const SizedBox(width: 6),
                _filterChip('users', 'Üyeler', registeredCount),
                const SizedBox(width: 6),
                _filterChip('guests', 'Misafirler', guestCount),
                const SizedBox(width: 6),
                _filterChip('bots', 'Botlar', botCount),
                const SizedBox(width: 6),
                _filterChip('foreign', 'Yabancı IP', null),
              ],
            ),
          ),
          const SizedBox(height: 12),

          if (filteredVisitors.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              alignment: Alignment.center,
              child: const Text('Bu filtreye uygun ziyaretçi bulunamadı.', style: TextStyle(color: Colors.white54)),
            )
          else
            ...filteredVisitors.map((v) => _buildVisitorCard(v)),
        ],
      ),
    );
  }

  Widget _buildHeaderBar() {
    final c = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.language, color: _blue, size: 20),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Canlı Trafik & IP Denetimi',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: _emerald.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: _emerald.withValues(alpha: 0.4)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: 7,
                      height: 7,
                      child: DecoratedBox(
                        decoration: BoxDecoration(color: _emerald, shape: BoxShape.circle),
                      ),
                    ),
                    SizedBox(width: 5),
                    Text('Canlı', style: TextStyle(color: _emerald, fontSize: 11, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Ziyaretçi IP adresleri, ülkeler, oturumlar ve gezilen sayfalar.',
            style: TextStyle(color: Colors.white54, fontSize: 11),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _rangeButton('24h', 'Son 24 Saat'),
              const SizedBox(width: 6),
              _rangeButton('7d', 'Son 7 Gün'),
              const SizedBox(width: 6),
              _rangeButton('30d', 'Son 30 Gün'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _rangeButton(String rangeKey, String label) {
    final active = _range == rangeKey;
    return Expanded(
      child: InkWell(
        onTap: () {
          if (_range != rangeKey) {
            setState(() => _range = rangeKey);
            _loadTraffic();
          }
        },
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 7),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: active ? AppTheme.accent : Colors.white.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: active ? FontWeight.bold : FontWeight.normal,
              color: active ? Colors.white : Colors.white70,
            ),
          ),
        ),
      ),
    );
  }

  Widget _statCard({
    required String title,
    required String value,
    String? subtitle,
    required IconData icon,
    required Color color,
  }) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: color),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(fontSize: 11, color: Colors.white60),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(fontSize: 10, color: Colors.white38),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _badgeChip(IconData icon, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _filterChip(String filterKey, String label, int? count) {
    final active = _activeFilter == filterKey;
    return ChoiceChip(
      label: Text(count != null ? ' ()' : label),
      selected: active,
      labelStyle: TextStyle(
        fontSize: 11,
        color: active ? Colors.white : Colors.white70,
        fontWeight: active ? FontWeight.bold : FontWeight.normal,
      ),
      backgroundColor: Colors.white.withValues(alpha: 0.06),
      selectedColor: AppTheme.accent,
      onSelected: (_) => setState(() => _activeFilter = filterKey),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      side: BorderSide.none,
      visualDensity: VisualDensity.compact,
    );
  }

  Widget _buildVisitorCard(Map<String, dynamic> v) {
    final ip = v['ip'] as String? ?? '0.0.0.0';
    final flag = v['flag'] as String? ?? '🌐';
    final countryName = v['countryName'] as String? ?? v['country'] as String? ?? 'Bilinmiyor';
    final city = v['city'] as String?;
    final path = v['path'] as String? ?? '/';
    final device = v['device'] as String? ?? 'other';
    final browser = v['browser'] as String? ?? '';
    final os = v['os'] as String? ?? '';
    final isRegistered = v['isRegistered'] == true;
    final userName = v['userName'] as String?;
    final userEmail = v['userEmail'] as String?;
    final isBot = v['isBot'] == true || device == 'bot';
    final botName = v['botName'] as String?;
    final createdAtStr = v['createdAt'] as String?;
    final createdAt = createdAtStr != null ? DateTime.tryParse(createdAtStr) : null;
    final timeStr = createdAt != null ? relativeTimeTr(createdAt.toLocal()) : '';

    IconData deviceIcon;
    switch (device) {
      case 'mobile':
        deviceIcon = Icons.phone_android;
        break;
      case 'tablet':
        deviceIcon = Icons.tablet_mac;
        break;
      case 'bot':
        deviceIcon = Icons.smart_toy_outlined;
        break;
      default:
        deviceIcon = Icons.computer;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(flag, style: const TextStyle(fontSize: 16)),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    city != null && city.isNotEmpty ? ' ()' : countryName,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (timeStr.isNotEmpty)
                  Text(timeStr, style: const TextStyle(fontSize: 11, color: Colors.white54)),
              ],
            ),
            const SizedBox(height: 8),

            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.fingerprint, size: 14, color: _purple),
                  const SizedBox(width: 6),
                  Text(
                    ip,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                      color: Colors.white,
                    ),
                  ),
                  const Spacer(),
                  InkWell(
                    onTap: () => _copyToClipboard(ip, 'IP adresi'),
                    borderRadius: BorderRadius.circular(4),
                    child: const Padding(
                      padding: EdgeInsets.all(4),
                      child: Icon(Icons.copy, size: 14, color: Colors.white54),
                    ),
                  ),
                  const SizedBox(width: 4),
                  InkWell(
                    onTap: () => _showIpDetailSheet(context, ip),
                    borderRadius: BorderRadius.circular(4),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                      decoration: BoxDecoration(
                        color: _blue.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.history, size: 12, color: _blue),
                          SizedBox(width: 3),
                          Text('Geçmişi Gör', style: TextStyle(fontSize: 10, color: _blue, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),

            Row(
              children: [
                const Icon(Icons.link, size: 14, color: Colors.white54),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    path,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: AppTheme.accent,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            Row(
              children: [
                if (isRegistered) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: _emerald.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: _emerald.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.person, size: 12, color: _emerald),
                        const SizedBox(width: 4),
                        Text(
                          userName ?? userEmail ?? 'Kayıtlı Üye',
                          style: const TextStyle(fontSize: 11, color: _emerald, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                ] else if (isBot) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: _rose.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: _rose.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.smart_toy_outlined, size: 12, color: _rose),
                        const SizedBox(width: 4),
                        Text(
                          botName ?? 'Bot / Tarayıcı',
                          style: const TextStyle(fontSize: 11, color: _rose, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                ] else ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: _blue.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: _blue.withValues(alpha: 0.2)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.person_outline, size: 12, color: _blue),
                        SizedBox(width: 4),
                        Text('Misafir', style: TextStyle(fontSize: 11, color: _blue)),
                      ],
                    ),
                  ),
                ],
                const Spacer(),
                Icon(deviceIcon, size: 13, color: Colors.white38),
                const SizedBox(width: 4),
                Text(
                  [browser, os].where((s) => s.isNotEmpty).join(' / '),
                  style: const TextStyle(fontSize: 10, color: Colors.white38),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _IpDetailSheet extends StatefulWidget {
  final String ip;
  final ApiService api;

  const _IpDetailSheet({required this.ip, required this.api});

  @override
  State<_IpDetailSheet> createState() => _IpDetailSheetState();
}

class _IpDetailSheetState extends State<_IpDetailSheet> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _visits = [];
  String? _firstSeen;
  String? _lastSeen;
  int _totalActions = 0;

  @override
  void initState() {
    super.initState();
    _fetchDetail();
  }

  Future<void> _fetchDetail() async {
    try {
      final res = await widget.api.fetchIpDetail(widget.ip);
      if (mounted) {
        setState(() {
          _visits = (res['visits'] as List?)?.cast<Map<String, dynamic>>() ?? [];
          _firstSeen = res['firstSeen'] as String?;
          _lastSeen = res['lastSeen'] as String?;
          _totalActions = (res['totalActions'] as num?)?.toInt() ?? 0;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceFirst('Exception: ', '');
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF1E293B),
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(16, 12, 16, sheetBottomInset(context) + 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 12),

          Row(
            children: [
              const Icon(Icons.history, color: _blue, size: 22),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('IP Gezinti Geçmişi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    Text(widget.ip, style: const TextStyle(fontFamily: 'monospace', color: Colors.white70, fontSize: 13)),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.copy, size: 18),
                tooltip: 'IP Kopyala',
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: widget.ip));
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('IP panoya kopyalandı ()')),
                  );
                },
              ),
            ],
          ),
          const Divider(height: 20),

          if (_loading)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Text(_error!, style: const TextStyle(color: _rose)),
            )
          else ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _summaryItem('Toplam İstek', '$_totalActions'),
                if (_firstSeen != null)
                  _summaryItem(
                    'İlk Görülme',
                    relativeTimeTr(DateTime.parse(_firstSeen!).toLocal()),
                  ),
                if (_lastSeen != null)
                  _summaryItem(
                    'Son Görülme',
                    relativeTimeTr(DateTime.parse(_lastSeen!).toLocal()),
                  ),
              ],
            ),
            const SizedBox(height: 12),

            ConstrainedBox(
              constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.45),
              child: _visits.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.all(16),
                      child: Text('Kayıt bulunamadı.', style: TextStyle(color: Colors.white54)),
                    )
                  : ListView.separated(
                      shrinkWrap: true,
                      itemCount: _visits.length,
                      separatorBuilder: (context, index) => const Divider(height: 1, color: Colors.white12),
                      itemBuilder: (ctx, i) {
                        final item = _visits[i];
                        final path = item['path'] as String? ?? '/';
                        final timeStr = item['createdAt'] as String?;
                        final dt = timeStr != null ? DateTime.tryParse(timeStr) : null;
                        final relative = dt != null ? relativeTimeTr(dt.toLocal()) : '';
                        final browser = item['browser'] as String? ?? '';
                        final os = item['os'] as String? ?? '';

                        return ListTile(
                          dense: true,
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.timeline, size: 18, color: _blue),
                          title: Text(
                            path,
                            style: const TextStyle(fontFamily: 'monospace', fontSize: 13, fontWeight: FontWeight.w500),
                          ),
                          subtitle: Text(
                            [browser, os].where((s) => s.isNotEmpty).join(' / '),
                            style: const TextStyle(fontSize: 10, color: Colors.white38),
                          ),
                          trailing: Text(relative, style: const TextStyle(fontSize: 11, color: Colors.white54)),
                        );
                      },
                    ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _summaryItem(String label, String value) {
    return Column(
      children: [
        Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: _emerald)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 10, color: Colors.white54)),
      ],
    );
  }
}
