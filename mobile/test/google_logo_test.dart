import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/widgets/google_logo.dart';

void main() {
  testWidgets('Google logosu verilen boyutta çizilir', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: GoogleLogo(size: 24))));

    final logo = tester.widget<SvgPicture>(find.byType(SvgPicture));
    expect(logo.width, 24);
    expect(logo.height, 24);
  });
}
