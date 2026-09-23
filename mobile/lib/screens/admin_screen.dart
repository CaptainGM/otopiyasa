import 'dart:async';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/screens/login_screen.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';

const _emerald = Color(0xFF10B981);
const _roseColor = Color(0xFFF43F5E);

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> with SingleTickerProviderStateMixin {
  final _api = ApiService();
  final _money = NumberFormat.decimalPattern('tr_TR');
  late TabController _tabController;

  Timer? _autoRefreshTimer;
  bool _loading = true;
  String? _error;

  Map<String, dynamic>? _statsData;
  List<Map<String, dynamic>> _reports = [];
  List<Map<String, dynamic>> _business = [];
  List<Map<String, dynamic>> _manualLogs = [];
  String _manualDateFilter = 'all'; // 'all', 'today', 'past'

  // Kontrol paneli parametreleri
  String _selectedSource = 'all';
  int _scrapeLimit = 50;
  bool _isScraping = false;
  String? _scrapeResult;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadAllData();
    // 25 saniyede bir canlı otomatik yenileme
    _autoRefreshTimer = Timer.periodic(const Duration(seconds: 25), (_) {
      if (mounted) _refreshStatsOnly();
    });
  }

  @override
  void dispose() {
    _autoRefreshTimer?.cancel();
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadAllData() async {
    setState(() => _loading = true);
    await Future.wait([
      _refreshStatsOnly(),
      _loadReports(),
      _loadBusiness(),
      _loadManualLogs(),
    ]);
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _loadManualLogs() async {
    try {
      final items = await _api.fetchManualScrapes();
      if (mounted) setState(() => _manualLogs = items);
    } catch (_) {}
  }

  Future<void> _refreshStatsOnly() async {
    try {
      final data = await _api.fetchDaemonStats();
      if (mounted) {
        setState(() {
          _statsData = data;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted && _statsData == null) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    }
  }

  Future<void> _loadReports() async {
    try {
      final items = await _api.fetchAdminReports();
      if (mounted) setState(() => _reports = items);
    } catch (_) {}
  }

  Future<void> _loadBusiness() async {
    try {
      final items = await _api.fetchPendingBusiness();
      if (mounted) setState(() => _business = items);
    } catch (_) {}
  }

  Future<void> _handleResolveReport(String id, String status) async {
    try {
      await _api.resolveReport(id, status);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(status == 'reviewed' ? 'Şikayet incelendi olarak kapatıldı.' : 'Şikayet reddedildi.')),
      );
      _loadReports();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Hata: $e')),
      );
    }
  }

  Future<void> _handleReviewBusiness(String userId, bool approve) async {
    try {
      await _api.reviewBusiness(userId, approve: approve);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(approve ? 'İşletme onaylandı.' : 'İşletme reddedildi.')),
      );
      _loadBusiness();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Hata: $e')),
      );
    }
  }

  Future<void> _triggerManualScrape({String? source, int? limit, String? mode}) async {
    setState(() {
      _isScraping = true;
      _scrapeResult = null;
    });
    try {
      final res = await _api.triggerScrape(
        source: source ?? (_selectedSource == 'all' ? null : _selectedSource),
        limit: limit ?? _scrapeLimit,
        mode: mode,
      );
      if (mounted) {
        setState(() {
          _isScraping = false;
          _scrapeResult = 'Tarama tamamlandı: ${res['message'] ?? 'İşlem bitti.'} (Yeni: +${res['inserted'] ?? 0}, Güncellenen: ${res['updated'] ?? 0})';
        });
        _refreshStatsOnly();
        _loadManualLogs();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isScraping = false;
          _scrapeResult = 'Hata: ${e.toString().replaceFirst('Exception: ', '')}';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final daemon = _statsData?['daemon'] as Map<String, dynamic>?;
    final isOnline = daemon?['isOnline'] == true;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Text('Yönetim Paneli'),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: isOnline ? _emerald.withValues(alpha: 0.2) : Colors.red.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isOnline ? _emerald : Colors.red,
                  width: 1,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: isOnline ? _emerald : Colors.red,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    isOnline ? 'CANLI' : 'DURDU',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: isOnline ? _emerald : Colors.red,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Yenile',
            onPressed: _loadAllData,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          labelColor: AppTheme.accent,
          unselectedLabelColor: Colors.white54,
          indicatorColor: AppTheme.accent,
          tabs: [
            const Tab(icon: Icon(Icons.speed, size: 18), text: 'Bot & Scraper'),
            Tab(
              icon: const Icon(Icons.report_problem_outlined, size: 18),
              text: 'Şikayetler (${_reports.length})',
            ),
            Tab(
              icon: const Icon(Icons.store_mall_directory_outlined, size: 18),
              text: 'İşletmeler (${_business.length})',
            ),
            const Tab(icon: Icon(Icons.tune, size: 18), text: 'Manuel Kontrol'),
          ],
        ),
      ),
      body: _loading && _statsData == null
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _statsData == null
              ? _buildErrorView()
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildDaemonTab(),
                    _buildReportsTab(),
                    _buildBusinessTab(),
                    _buildControlsTab(),
                  ],
                ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.lock_outline, size: 54, color: AppTheme.accent),
            const SizedBox(height: 16),
            const Text(
              'Yönetici Yetkisi Gerekli',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              _error ?? 'Bu panel yalnızca yöneticiler tarafından görüntülenebilir.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white70),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
                _loadAllData();
              },
              icon: const Icon(Icons.login),
              label: const Text('Yönetici Olarak Giriş Yap'),
            ),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // TAB 1: BOT & SCRAPER DURUMU (7/24 DAEMON TAKİBİ)
  // ---------------------------------------------------------------------------
  Widget _buildDaemonTab() {
    final daemon = _statsData?['daemon'] as Map<String, dynamic>? ?? {};
    final today = _statsData?['today'] as Map<String, dynamic>? ?? {};
    final hourly = (_statsData?['hourly'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
    final activeCount = (_statsData?['activeCount'] as num?)?.toInt() ?? 0;
    final archivedCount = (_statsData?['archivedCount'] as num?)?.toInt() ?? 0;

    final isOnline = daemon['isOnline'] == true;
    final currentPhase = daemon['currentPhase']?.toString() ?? 'Aktif Çalışıyor';
    final host = daemon['host']?.toString() ?? 'Oracle Cloud Always Free (Frankfurt VPS)';
    final cycle = daemon['cycle'] ?? 1;
    final memoryMb = daemon['memoryMb'] ?? 52;
    final uptimeSec = (daemon['uptimeSeconds'] as num?)?.toInt() ?? 0;

    final uptimeStr = uptimeSec > 3600
        ? '${uptimeSec ~/ 3600} sa ${(uptimeSec % 3600) ~/ 60} dk'
        : '${uptimeSec ~/ 60} dk ${uptimeSec % 60} sn';

    return RefreshIndicator(
      onRefresh: _loadAllData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // HERO CANLI STATÜ KARTI
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isOnline
                    ? [const Color(0xFF0F382A), const Color(0xFF16251E)]
                    : [const Color(0xFF381515), const Color(0xFF221616)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isOnline ? _emerald.withValues(alpha: 0.3) : Colors.red.withValues(alpha: 0.3),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(
                          isOnline ? Icons.cloud_done : Icons.cloud_off,
                          color: isOnline ? _emerald : Colors.redAccent,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          isOnline ? '7/24 MOTOR KESİNTİSİZ ÇALIŞIYOR' : 'MOTOR DURDURULDU',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.5,
                            color: isOnline ? _emerald : Colors.redAccent,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      'Frankfurt VPS',
                      style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.5)),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  host,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.terminal, size: 16, color: AppTheme.accent),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          currentPhase,
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 12,
                            color: AppTheme.accent,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // 4'LÜ DONANIM & DÖNGÜ METRİK GRID
          Row(
            children: [
              Expanded(child: _metricCard('Tur / Döngü', '#$cycle', Icons.repeat, AppTheme.accent)),
              const SizedBox(width: 8),
              Expanded(child: _metricCard('RAM Tüketimi', '$memoryMb MB', Icons.memory, Colors.lightBlueAccent)),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: _metricCard('Çalışma Süresi', uptimeStr, Icons.timer, Colors.purpleAccent)),
              const SizedBox(width: 8),
              Expanded(child: _metricCard('Kalp Atışı', 'Canlı (15s)', Icons.favorite, _roseColor)),
            ],
          ),
          const SizedBox(height: 20),

          // BUGÜNÜN İSTATİSTİKLERİ BAŞLIK
          const Text(
            'Bugünün İşlem Hacmi',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: _statBox('Taranan İlan', '${today['scanned'] ?? 0}', Colors.blue)),
              const SizedBox(width: 8),
              Expanded(child: _statBox('Yeni Eklenen', '${today['inserted'] ?? 0}', Colors.green)),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: _statBox('Fiyat Güncelleme', '${today['updated'] ?? 0}', Colors.amber)),
              const SizedBox(width: 8),
              Expanded(child: _statBox('Ölü Temizlenen', '${today['deleted'] ?? 0}', Colors.redAccent)),
            ],
          ),
          const SizedBox(height: 20),

          // ENVANTER GENEL BAKIŞ
          const Text(
            'Veritabanı İlan Envanteri',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _inventoryCounter('Aktif Canlı İlanlar', _money.format(activeCount), _emerald),
                      _inventoryCounter('Piyasa Arşivi (Satılan/Kaldırılan)', _money.format(archivedCount), Colors.grey),
                    ],
                  ),
                  const Divider(height: 24),
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      '8 Platformlu Otonom Envanter Havuzu',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white70),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                      children: [
                        _sourceChip('Arabam', const Color(0xFFC41230)),
                        _sourceChip('Otokoç', const Color(0xFF1A237E)),
                        _sourceChip('DOD', const Color(0xFF0277BD)),
                        _sourceChip('İkinciyeni', const Color(0xFF00897B)),
                        _sourceChip('VavaCars', const Color(0xFFFF5000)),
                        _sourceChip('Otoplus', const Color(0xFF00A650)),
                        _sourceChip('Otomerkezi', const Color(0xFF0066CC)),
                        _sourceChip('Carvak', const Color(0xFF6B2D90)),
                      ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // SAATLİK AKTİVİTE GRAFİĞİ
          if (hourly.isNotEmpty) ...[
            const Text(
              'Saatlik Aktivite Grafiği (Son 24 Saat)',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: SizedBox(
                  height: 180,
                  child: _buildHourlyChart(hourly),
                ),
              ),
            ),
          ],
          const SizedBox(height: 24),
          const Divider(height: 32),
          _buildManualScrapeSection(),
        ],
      ),
    );
  }

  Widget _metricCard(String title, String value, IconData icon, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 20, color: color),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontSize: 11, color: Colors.white54),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    value,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statBox(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }

  Widget _inventoryCounter(String label, String value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: Colors.white54)),
        const SizedBox(height: 4),
        Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
      ],
    );
  }

  Widget _sourceChip(String name, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Text(name, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }

  Widget _buildHourlyChart(List<Map<String, dynamic>> hourly) {
    final recent = hourly.take(12).toList().reversed.toList();
    final bars = <BarChartGroupData>[];

    for (var i = 0; i < recent.length; i++) {
      final h = recent[i];
      final scanned = (h['scanned'] as num?)?.toDouble() ?? 0.0;
      bars.add(
        BarChartGroupData(
          x: i,
          barRods: [
            BarChartRodData(
              toY: scanned > 0 ? scanned : 1.0,
              color: AppTheme.accent,
              width: 14,
              borderRadius: BorderRadius.circular(4),
            ),
          ],
        ),
      );
    }

    return BarChart(
      BarChartData(
        barGroups: bars,
        gridData: const FlGridData(show: false),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (val, meta) {
                final idx = val.toInt();
                if (idx < 0 || idx >= recent.length) return const SizedBox.shrink();
                final hour = recent[idx]['hour']?.toString() ?? '';
                return Text('$hour:00', style: const TextStyle(fontSize: 9, color: Colors.white54));
              },
            ),
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // TAB 2: ŞİKAYETLER & RAPORLAR KUYRUĞU
  // ---------------------------------------------------------------------------
  Widget _buildReportsTab() {
    if (_reports.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.check_circle_outline, size: 48, color: _emerald),
            SizedBox(height: 12),
            Text('Bekleyen açık şikayet bulunmuyor.', style: TextStyle(color: Colors.white70)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadReports,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _reports.length,
        itemBuilder: (context, i) {
          final r = _reports[i];
          final id = r['_id']?.toString() ?? '';
          final car = r['car'] as Map<String, dynamic>?;
          final reporter = r['reporter'] as Map<String, dynamic>?;
          final reason = r['reason']?.toString() ?? 'Şikayet';
          final details = r['details']?.toString() ?? '';

          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(reason, style: const TextStyle(fontWeight: FontWeight.bold, color: _roseColor)),
                      Text(
                        reporter?['name']?.toString() ?? 'Kullanıcı',
                        style: const TextStyle(fontSize: 12, color: Colors.white54),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  if (car != null) ...[
                    Text(
                      car['title']?.toString() ?? 'İlan',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      '${car['city'] ?? ''} • ${_money.format(car['price'] ?? 0)} ₺',
                      style: const TextStyle(fontSize: 12, color: AppTheme.accent),
                    ),
                  ],
                  if (details.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(details, style: const TextStyle(fontSize: 12, color: Colors.white70)),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      OutlinedButton(
                        onPressed: () => _handleResolveReport(id, 'dismissed'),
                        child: const Text('Reddet'),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: () => _handleResolveReport(id, 'reviewed'),
                        child: const Text('İncelendi'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // TAB 3: İŞLETME HESABI BAŞVURULARI
  // ---------------------------------------------------------------------------
  Widget _buildBusinessTab() {
    if (_business.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.verified_outlined, size: 48, color: Colors.lightBlueAccent),
            SizedBox(height: 12),
            Text('Bekleyen kurumsal işletme başvurusu yok.', style: TextStyle(color: Colors.white70)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadBusiness,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _business.length,
        itemBuilder: (context, i) {
          final b = _business[i];
          final userId = b['_id']?.toString() ?? '';
          final name = b['name']?.toString() ?? '';
          final email = b['email']?.toString() ?? '';
          final bName = b['businessName']?.toString() ?? 'Galeri';
          final bPhone = b['businessPhone']?.toString() ?? '';

          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(bName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.accent)),
                  const SizedBox(height: 4),
                  Text('Yetkili: $name • $email', style: const TextStyle(fontSize: 12, color: Colors.white70)),
                  if (bPhone.isNotEmpty)
                    Text('Telefon: $bPhone', style: const TextStyle(fontSize: 12, color: Colors.white70)),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      OutlinedButton(
                        onPressed: () => _handleReviewBusiness(userId, false),
                        child: const Text('Reddet', style: TextStyle(color: Colors.redAccent)),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: () => _handleReviewBusiness(userId, true),
                        child: const Text('Onayla'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // TAB 4: MANUEL KONTROL & SCRAPE TETİKLEME
  // ---------------------------------------------------------------------------
  Widget _buildControlsTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildManualScrapeSection(),
      ],
    );
  }

  Widget _buildManualScrapeSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Colors.amber.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.bolt, color: Colors.amber, size: 20),
                ),
                const SizedBox(width: 10),
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Manuel Veri Çekme & Denetim',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      'İstediğin an tekil veya çoklu platformlardan taze ilan topla',
                      style: TextStyle(fontSize: 11, color: Colors.white54),
                    ),
                  ],
                ),
              ],
            ),
            IconButton(
              icon: const Icon(Icons.sync, size: 18),
              tooltip: 'Kayıtları Yenile',
              onPressed: _loadManualLogs,
            ),
          ],
        ),
        const SizedBox(height: 14),

        // BUGÜNÜN MANUEL ÖZETİ (4 KART)
        Builder(
          builder: (context) {
            int tScanned = 0;
            int tInserted = 0;
            int tUpdated = 0;
            int tOps = 0;
            final now = DateTime.now();

            for (final m in _manualLogs) {
              final dStr = m['createdAt']?.toString();
              if (dStr != null) {
                try {
                  final dt = DateTime.parse(dStr).toLocal();
                  if (dt.year == now.year && dt.month == now.month && dt.day == now.day) {
                    tScanned += (m['scanned'] as num? ?? 0).toInt();
                    tInserted += (m['inserted'] as num? ?? 0).toInt();
                    tUpdated += (m['updated'] as num? ?? 0).toInt();
                    tOps += 1;
                  }
                } catch (_) {}
              }
            }

            return Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.amber.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.amber.withValues(alpha: 0.25)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.today, size: 14, color: Colors.amber),
                          SizedBox(width: 6),
                          Text(
                            'Bugünün Manuel Çekim Özeti',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.amber),
                          ),
                        ],
                      ),
                      Text(
                        '$tOps İşlem Yapıldı',
                        style: const TextStyle(fontSize: 11, color: Colors.white70),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(child: _miniTodayStat('Taranan', tScanned.toString(), Colors.white)),
                      const SizedBox(width: 8),
                      Expanded(child: _miniTodayStat('Yeni İlan', '+$tInserted', _emerald)),
                      const SizedBox(width: 8),
                      Expanded(child: _miniTodayStat('Güncellenen', tUpdated.toString(), Colors.lightBlueAccent)),
                    ],
                  ),
                ],
              ),
            );
          },
        ),
        const SizedBox(height: 16),

        // 1. ÇOKLU HIZLI AKSİYONLAR
        const Text(
          '1. ÇOKLU KAYNAK ÇEKİMİ (TAVSİYE EDİLEN)',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.amber, letterSpacing: 0.5),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFE65100),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
              onPressed: _isScraping ? null : () => _triggerManualScrape(source: 'all', limit: 30),
              icon: const Icon(Icons.rocket_launch, size: 16),
              label: const Text('+ 8 Kaynaktan Çek', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            ),
            FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF0277BD),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
              onPressed: _isScraping ? null : () => _triggerManualScrape(mode: 'price-refresh', limit: 20),
              icon: const Icon(Icons.sync_alt, size: 16),
              label: const Text('Fiyatları Eşitle', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            ),
            FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF6A1B9A),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
              onPressed: _isScraping ? null : () => _triggerManualScrape(mode: 'rare-model', limit: 20),
              icon: const Icon(Icons.psychology, size: 16),
              label: const Text('Nadir Modeller (AI)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // 2. TEKİL KURUMSAL KAYNAKLAR
        const Text(
          '2. TEKİL KURUMSAL KAYNAKLAR (8 Platform)',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white70, letterSpacing: 0.5),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            _quickSourceChip('Otokoç 2. El', 'otokoc'),
            _quickSourceChip('DOD', 'dod'),
            _quickSourceChip('İkinciyeni', 'ikinciyeni'),
            _quickSourceChip('VavaCars', 'vavacars'),
            _quickSourceChip('Otoplus', 'otoplus'),
            _quickSourceChip('Otomerkezi', 'otomerkezi'),
            _quickSourceChip('Carvak', 'carvak'),
            _quickSourceChip('Arabam.com', 'arabam'),
          ],
        ),
        const SizedBox(height: 16),

        // 3. ÖZEL PARAMETRELİ TETİKLEME KARTI
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Özel Parametreli Tarama', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: _selectedSource,
                  decoration: const InputDecoration(labelText: 'Platform'),
                  items: const [
                    DropdownMenuItem(value: 'all', child: Text('Tüm Platformlar (8 Kaynak)')),
                    DropdownMenuItem(value: 'otokoc', child: Text('Otokoç 2. El (Koç)')),
                    DropdownMenuItem(value: 'dod', child: Text('DOD (Doğuş)')),
                    DropdownMenuItem(value: 'ikinciyeni', child: Text('İkinciyeni (Anadolu)')),
                    DropdownMenuItem(value: 'vavacars', child: Text('VavaCars')),
                    DropdownMenuItem(value: 'otoplus', child: Text('Otoplus')),
                    DropdownMenuItem(value: 'otomerkezi', child: Text('Otomerkezi')),
                    DropdownMenuItem(value: 'carvak', child: Text('Carvak')),
                    DropdownMenuItem(value: 'arabam', child: Text('Arabam.com')),
                  ],
                  onChanged: (val) => setState(() => _selectedSource = val ?? 'all'),
                ),
                const SizedBox(height: 10),
                TextFormField(
                  initialValue: '$_scrapeLimit',
                  decoration: const InputDecoration(
                    labelText: 'İlan Limiti',
                    helperText: 'Örn: 20 - 50 ilan',
                  ),
                  keyboardType: TextInputType.number,
                  onChanged: (val) => _scrapeLimit = int.tryParse(val) ?? 30,
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _isScraping ? null : () => _triggerManualScrape(),
                    icon: _isScraping
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                          )
                        : const Icon(Icons.play_arrow),
                    label: Text(_isScraping ? 'Taranıyor...' : 'Taramayı Şimdi Başlat'),
                  ),
                ),
                if (_scrapeResult != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppTheme.accent.withValues(alpha: 0.3)),
                    ),
                    child: Text(
                      _scrapeResult!,
                      style: const TextStyle(fontSize: 12, color: AppTheme.accent),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),

        // 4. DENETİM KAYITLARI & TARİH FİLTRESİ
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              '📋 Denetim Kayıtları',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            Row(
              children: [
                _dateFilterChip('Tümü', 'all'),
                const SizedBox(width: 4),
                _dateFilterChip('Bugün', 'today'),
                const SizedBox(width: 4),
                _dateFilterChip('Geçmiş', 'past'),
              ],
            ),
          ],
        ),
        const SizedBox(height: 8),
        Builder(
          builder: (context) {
            final now = DateTime.now();
            final filtered = _manualLogs.where((log) {
              if (_manualDateFilter == 'all') return true;
              final dStr = log['createdAt']?.toString();
              if (dStr == null) return true;
              try {
                final dt = DateTime.parse(dStr).toLocal();
                final isToday = dt.year == now.year && dt.month == now.month && dt.day == now.day;
                return _manualDateFilter == 'today' ? isToday : !isToday;
              } catch (_) {
                return true;
              }
            }).toList();

            if (filtered.isEmpty) {
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Center(
                    child: Text(
                      _manualDateFilter == 'today'
                          ? 'Bugün henüz manuel bir tarama işlemi yapılmadı.'
                          : 'Seçili filtreye uygun denetim kaydı bulunamadı.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.5)),
                    ),
                  ),
                ),
              );
            }

            return Column(
              children: filtered.map((log) {
                final actor = log['actor']?.toString() ?? 'Yönetici';
                final label = log['label']?.toString() ?? 'Manuel Tarama';
                final scanned = log['scanned'] ?? 0;
                final inserted = log['inserted'] ?? 0;
                final updated = log['updated'] ?? 0;
                final durationSec = log['durationSeconds'] ?? 0;
                final dateStr = log['createdAt']?.toString();
                String formattedDate = '';
                if (dateStr != null && dateStr.isNotEmpty) {
                  try {
                    final dt = DateTime.parse(dateStr).toLocal();
                    formattedDate =
                        '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}.${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
                  } catch (_) {
                    formattedDate = dateStr;
                  }
                }

                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () => _showManualLogDetailModal(log),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  label,
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 8),
                              if (formattedDate.isNotEmpty)
                                Text(
                                  formattedDate,
                                  style: const TextStyle(fontSize: 11, color: Colors.white38),
                                ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            runSpacing: 4,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.08),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  actor,
                                  style: const TextStyle(fontSize: 10, color: Colors.white70),
                                ),
                              ),
                              Text(
                                'Taranan: $scanned',
                                style: const TextStyle(fontSize: 11, color: Colors.white60),
                              ),
                              Text(
                                '+$inserted Yeni',
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: _emerald),
                              ),
                              Text(
                                '$updated Güncel',
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.lightBlueAccent),
                              ),
                              Text(
                                '${durationSec}s',
                                style: const TextStyle(fontSize: 11, color: Colors.white38),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.amber.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(4),
                                  border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                                ),
                                child: const Text(
                                  'İncele ➔',
                                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.amber),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            );
          },
        ),
      ],
    );
  }

  Widget _miniTodayStat(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 10, color: Colors.white60)),
          const SizedBox(height: 2),
          Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }

  Widget _dateFilterChip(String label, String filterKey) {
    final isSelected = _manualDateFilter == filterKey;
    return GestureDetector(
      onTap: () => setState(() => _manualDateFilter = filterKey),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? Colors.amber.withValues(alpha: 0.2) : Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: isSelected ? Colors.amber.withValues(alpha: 0.4) : Colors.white.withValues(alpha: 0.1),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            color: isSelected ? Colors.amber : Colors.white60,
          ),
        ),
      ),
    );
  }

  void _showManualLogDetailModal(Map<String, dynamic> log) {
    final label = log['label']?.toString() ?? 'Manuel Tarama Raporu';
    final actor = log['actor']?.toString() ?? 'Yönetici';
    final source = log['source']?.toString() ?? 'all';
    final scanned = log['scanned'] ?? 0;
    final inserted = log['inserted'] ?? 0;
    final updated = log['updated'] ?? 0;
    final durationSec = log['durationSeconds'] ?? 0;
    final message = log['message']?.toString();
    final bySource = log['bySource'] as Map<String, dynamic>?;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.6,
          maxChildSize: 0.9,
          minChildSize: 0.4,
          expand: false,
          builder: (_, scrollController) {
            return ListView(
              controller: scrollController,
              padding: const EdgeInsets.all(20),
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Text(
                  label,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 4),
                Text(
                  'Aktör: $actor • Kaynak: ${source.toUpperCase()}',
                  style: const TextStyle(fontSize: 12, color: Colors.white54),
                ),
                const SizedBox(height: 16),

                // 4 Metrik Kartı
                Row(
                  children: [
                    Expanded(child: _miniTodayStat('Taranan', '$scanned', Colors.white)),
                    const SizedBox(width: 8),
                    Expanded(child: _miniTodayStat('Yeni İlan', '+$inserted', _emerald)),
                    const SizedBox(width: 8),
                    Expanded(child: _miniTodayStat('Güncellenen', '$updated', Colors.lightBlueAccent)),
                    const SizedBox(width: 8),
                    Expanded(child: _miniTodayStat('Süre', '${durationSec}s', Colors.purpleAccent)),
                  ],
                ),
                const SizedBox(height: 20),

                // Kaynak Dağılımı
                const Text(
                  'Kaynak Dağılımı',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white70),
                ),
                const SizedBox(height: 8),
                if (bySource == null || bySource.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'Bu işlem tek bir kaynak ($source) üzerinden tamamlandı.',
                      style: const TextStyle(fontSize: 12, color: Colors.white54),
                    ),
                  )
                else
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: bySource.entries.map((entry) {
                      final sKey = entry.key;
                      final sData = entry.value as Map<String, dynamic>?;
                      final fetched = sData?['fetched'] ?? sData?['scanned'] ?? 0;
                      final saved = sData?['saved'] ?? sData?['inserted'] ?? 0;

                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.06),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(sKey.toUpperCase(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.amber)),
                            const SizedBox(height: 4),
                            Text('Çekilen: $fetched  |  DB: +$saved', style: const TextStyle(fontSize: 11, color: Colors.white70)),
                          ],
                        ),
                      );
                    }).toList(),
                  ),

                if (message != null && message.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  const Text(
                    'Sistem Mesajı',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white70),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(message, style: const TextStyle(fontSize: 12, color: Colors.white70)),
                  ),
                ],
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Kapat'),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _quickSourceChip(String label, String source) {
    return ActionChip(
      avatar: const Icon(Icons.arrow_forward, size: 14),
      label: Text(label, style: const TextStyle(fontSize: 11)),
      onPressed: _isScraping ? null : () => _triggerManualScrape(source: source, limit: 20),
    );
  }
}
