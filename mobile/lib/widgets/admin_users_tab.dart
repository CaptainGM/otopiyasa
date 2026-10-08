import 'dart:async';

import 'package:flutter/material.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/utils/relative_time.dart';

/// Kullanıcı listesi (yalnızca yönetici): web panelindeki "Kullanıcılar" tablosunun karşılığı. Ad ya da e-postayla
/// aranır, 30'ar kayıt yüklenir. Rol buradan değiştirilemez; yöneticilik yalnızca veritabanına doğrudan yazılarak verilir.
class AdminUsersTab extends StatefulWidget {
  const AdminUsersTab({super.key});

  @override
  State<AdminUsersTab> createState() => _AdminUsersTabState();
}

class _AdminUsersTabState extends State<AdminUsersTab> {
  final _api = ApiService();
  final _search = TextEditingController();
  final _scroll = ScrollController();
  final List<Map<String, dynamic>> _users = [];
  Timer? _debounce;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  int _page = 1;
  int _total = 0;
  int _admins = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 300) _load(more: true);
    });
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load({bool more = false}) async {
    if (more && (_loadingMore || _users.length >= _total)) return;
    setState(() {
      if (more) {
        _loadingMore = true;
      } else {
        _loading = true;
        _page = 1;
        _error = null;
      }
    });
    try {
      final data = await _api.fetchAdminUsers(q: _search.text.trim(), page: more ? _page + 1 : 1);
      if (!mounted) return;
      final items = (data['users'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
      setState(() {
        if (more) {
          _users.addAll(items);
          _page += 1;
        } else {
          _users
            ..clear()
            ..addAll(items);
        }
        _total = (data['total'] as num?)?.toInt() ?? _users.length;
        _admins = (data['admins'] as num?)?.toInt() ?? 0;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: TextField(
            controller: _search,
            decoration: const InputDecoration(hintText: 'Ad ya da e-posta ara…', prefixIcon: Icon(Icons.search)),
            onChanged: (_) {
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 400), () => _load());
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 6),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              _loading ? '…' : '$_total kullanıcı · $_admins yönetici',
              style: AppText.num(size: 12, color: c.muted),
            ),
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? Center(child: Text(_error!, style: TextStyle(color: c.pricey)))
                  : RefreshIndicator(
                      onRefresh: () => _load(),
                      child: ListView.separated(
                        controller: _scroll,
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                        itemCount: _users.length + (_loadingMore ? 1 : 0),
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (context, i) {
                          if (i >= _users.length) {
                            return const Padding(padding: EdgeInsets.all(12), child: Center(child: CircularProgressIndicator()));
                          }
                          return _userCard(_users[i], c);
                        },
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _userCard(Map<String, dynamic> u, AppColors c) {
    final isAdmin = u['role'] == 'admin';
    final business = u['business'] as Map<String, dynamic>?;
    final created = DateTime.tryParse(u['createdAt']?.toString() ?? '');
    final name = (u['name']?.toString() ?? '').trim();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: (isAdmin ? AppTheme.accent : c.surface2).withValues(alpha: isAdmin ? 0.2 : 1),
              child: Text(name.isEmpty ? '?' : name[0].toUpperCase(), style: TextStyle(color: isAdmin ? AppTheme.accent : null, fontWeight: FontWeight.w700)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14))),
                      if (isAdmin) ...[
                        const SizedBox(width: 6),
                        _chip('yönetici', AppTheme.accent),
                      ],
                      if (business != null) ...[
                        const SizedBox(width: 6),
                        _chip(business['status'] == 'approved' ? 'işletme' : 'işletme (${business['status']})', c.fair),
                      ],
                    ],
                  ),
                  Text(u['email']?.toString() ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: c.muted)),
                  const SizedBox(height: 2),
                  Text(
                    '${u['favorites'] ?? 0} favori · ${created == null ? '' : 'kayıt ${relativeTimeTr(created)}'}${u['emailVerified'] == true ? '' : ' · e-posta doğrulanmamış'}',
                    style: TextStyle(fontSize: 11.5, color: c.faint),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _chip(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: color.withValues(alpha: 0.4)),
        ),
        child: Text(text, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
      );
}
