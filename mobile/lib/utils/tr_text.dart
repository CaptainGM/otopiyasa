/// Türkçe büyük harf: Dart'ın toUpperCase'i "i"yi "I" yapar ("DEĞERINDE"); burada "İ" olur ("DEĞERİNDE").
String trUpper(String text) => text.replaceAll('i', 'İ').replaceAll('ı', 'I').toUpperCase();
