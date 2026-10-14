import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/services/recently_viewed_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  final api = ApiService();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    api.currentUser = null;
  });

  test('misafir ve hesap listeleri ayrıdır; hesap değişince önceki hesabın listesi görünmez', () async {
    await RecentlyViewedStore.record('a');
    expect(await RecentlyViewedStore.list(), ['a']);

    api.currentUser = {'_id': 'u1', 'role': 'user'};
    expect(await RecentlyViewedStore.list(), isEmpty);
    await RecentlyViewedStore.record('b');
    expect(await RecentlyViewedStore.list(), ['b']);

    api.currentUser = {'_id': 'u2', 'role': 'user'};
    expect(await RecentlyViewedStore.list(), isEmpty);

    api.currentUser = null;
    expect(await RecentlyViewedStore.list(), ['a']);
  });

  test('en yeni başta, en fazla 12 kayıt; tekrar bakılan ilan en öne gelir', () async {
    api.currentUser = {'_id': 'u1'};
    for (var i = 0; i < 13; i++) {
      await RecentlyViewedStore.record('car$i');
    }
    final ids = await RecentlyViewedStore.list();
    expect(ids.length, 12);
    expect(ids.first, 'car12');
    expect(ids.contains('car0'), isFalse);

    await RecentlyViewedStore.record('car5');
    expect((await RecentlyViewedStore.list()).first, 'car5');
    expect((await RecentlyViewedStore.list()).length, 12);
  });

  test('eski ortak anahtar ilk okumada silinir ve hiçbir hesaba aktarılmaz', () async {
    SharedPreferences.setMockInitialValues({'otopiyasa:recently-viewed': ['eski']});
    api.currentUser = {'_id': 'u1'};
    expect(await RecentlyViewedStore.list(), isEmpty);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.containsKey('otopiyasa:recently-viewed'), isFalse);
  });

  test('her kayıt değişiklik sayacını artırır (ana sayfadaki şerit bunu dinler)', () async {
    final before = RecentlyViewedStore.changes.value;
    await RecentlyViewedStore.record('x');
    expect(RecentlyViewedStore.changes.value, before + 1);
  });
}
