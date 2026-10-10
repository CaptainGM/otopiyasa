import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/services/device_abi.dart';

void main() {
  group('pickAbi', () {
    test('desteklenen mimariyi seçer', () {
      expect(pickAbi(['arm64-v8a']), 'arm64-v8a');
      expect(pickAbi(['armeabi-v7a']), 'armeabi-v7a');
    });

    test('öncelik sırasına uyar (ilk uyan kazanır)', () {
      expect(pickAbi(['arm64-v8a', 'armeabi-v7a']), 'arm64-v8a');
      expect(pickAbi(['armeabi-v7a', 'arm64-v8a']), 'armeabi-v7a');
    });

    test('bize uymayan mimaride null döner (evrensel paket istenir)', () {
      expect(pickAbi(['x86_64', 'x86']), isNull);
      expect(pickAbi(const []), isNull);
      expect(pickAbi(null), isNull);
    });

    test('uygun olanı atlayıp ilk desteklenene düşer', () {
      expect(pickAbi(['x86_64', 'armeabi-v7a']), 'armeabi-v7a');
    });
  });
}
