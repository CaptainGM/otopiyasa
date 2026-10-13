import 'package:flutter/widgets.dart';

/// Alt pencerenin (showModalBottomSheet) içeriğinin altında bırakılacak sistem boşluğu: klavye + sistem gezinme çubuğu
/// (3 tuş ya da hareket çubuğu).
///
/// Flutter'ın `useSafeArea: true` ayarı yalnızca üst ve yan kenarı korur (kaynakta `SafeArea(bottom: false)`); alt kenar içerikte
/// karşılanmazsa pencere ekranın dibine kadar uzanır ve "Yeni liste oluştur" gibi düğmeler sistem tuşlarının altında kalır
/// (13 Ekim 2026 şikayeti; Android 15+ ekranı sistem çubuklarının arkasına kadar çizer). Pencere yüksekliği `SafeArea` ile
/// sarılıyorsa bu işleve gerek yoktur.
///
/// Klavye açıkken `MediaQuery.padding.bottom` 0'a iner ve `viewInsets.bottom` klavyeyi karşılar; ikisinin toplamı iki durumda da
/// doğru boşluktur (çubuk ya da klavye, ikisi birden değil).
double sheetBottomInset(BuildContext context) {
  final media = MediaQuery.of(context);
  return media.viewInsets.bottom + media.padding.bottom;
}
