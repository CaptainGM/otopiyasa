import 'package:flutter/material.dart';
import 'package:otopiyasa/widgets/listing_image.dart';

/// İlan fotoğrafını tam ekran açar. Kart ve detay sayfası bunu kullanır; açılış fotoğrafı dokunulan sıradır.
void openPhotoViewer(BuildContext context, List<String> images, {int initialIndex = 0}) {
  final urls = images.where((url) => url.isNotEmpty).toList();
  if (urls.isEmpty) return;
  Navigator.of(context).push(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => PhotoViewerScreen(images: urls, initialIndex: initialIndex.clamp(0, urls.length - 1)),
    ),
  );
}

/// Tam ekran fotoğraf. Normal boyutta sağa-sola kaydırmak sonraki fotoğrafa geçirir. İki parmakla yakınlaştırılır ve
/// uzaklaştırılır; yakınlaşmışken tek parmakla gezdirilir. Çift dokunuş yerinde büyütüp geri alır.
class PhotoViewerScreen extends StatefulWidget {
  const PhotoViewerScreen({super.key, required this.images, this.initialIndex = 0});

  final List<String> images;
  final int initialIndex;

  @override
  State<PhotoViewerScreen> createState() => _PhotoViewerScreenState();
}

class _PhotoViewerScreenState extends State<PhotoViewerScreen> {
  late final PageController _pages = PageController(initialPage: widget.initialIndex);
  late int _index = widget.initialIndex;
  // Sayfa kaydırması kapalıyken (iki parmak ya da yakınlaşmış fotoğraf) hareket fotoğrafa gider.
  bool _zoomed = false;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.images.length;
    return Scaffold(
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        title: total > 1 ? Text('${_index + 1} / $total', style: const TextStyle(fontWeight: FontWeight.w700)) : null,
      ),
      body: PageView.builder(
        controller: _pages,
        physics: _zoomed ? const NeverScrollableScrollPhysics() : const PageScrollPhysics(),
        itemCount: total,
        onPageChanged: (i) => setState(() => _index = i),
        itemBuilder: (context, i) => _ZoomablePhoto(
          url: widget.images[i],
          onZoomChanged: (zoomed) {
            if (zoomed != _zoomed) setState(() => _zoomed = zoomed);
          },
          // İkinci parmak indiğinde yarım kalmış sayfa kaydırması iptal edilir (PageView, parmaklar aynı anda değilse
          // ilk parmağın hareketiyle zaten kaymaya başlamış olabilir).
          onPinchStart: () => _pages.jumpToPage(_index),
        ),
      ),
    );
  }
}

class _ZoomablePhoto extends StatefulWidget {
  const _ZoomablePhoto({required this.url, required this.onZoomChanged, required this.onPinchStart});

  final String url;
  final ValueChanged<bool> onZoomChanged;
  final VoidCallback onPinchStart;

  @override
  State<_ZoomablePhoto> createState() => _ZoomablePhotoState();
}

class _ZoomablePhotoState extends State<_ZoomablePhoto> {
  static const _maxScale = 4.0;
  static const _doubleTapScale = 2.5;
  // Parmaklar kalktığında bu değerin altında kalan yakınlaştırma normal boyuta döner.
  static const _settleScale = 1.05;

  final _pointers = <int, Offset>{};
  double _scale = 1;
  // Öteleme, fotoğrafın sol üst köşesine göre (Transform bu köşeden ölçeklenir).
  Offset _translation = Offset.zero;
  // Hareket başlangıcındaki taban değerler: her olayda bunlardan yeniden hesaplanır, böylece birikmiş hata olmaz.
  double _baseScale = 1;
  Offset _baseTranslation = Offset.zero;
  Offset _baseFocal = Offset.zero;
  double _baseSpread = 0;
  bool _active = false;

  Size get _viewport => (context.findRenderObject() as RenderBox?)?.size ?? Size.zero;

  Offset get _focal {
    var sum = Offset.zero;
    for (final point in _pointers.values) {
      sum += point;
    }
    return sum / _pointers.length.toDouble();
  }

  double get _spread {
    if (_pointers.length < 2) return 0;
    final points = _pointers.values.toList();
    return (points[0] - points[1]).distance;
  }

  void _rebase() {
    _baseScale = _scale;
    _baseTranslation = _translation;
    _baseFocal = _focal;
    _baseSpread = _spread;
  }

  /// Öteleme sınırı: fotoğrafın kenarı ekranın kenarını geçip boşluk göstermesin.
  Offset _clamped(Offset translation, double scale) {
    final size = _viewport;
    return Offset(
      translation.dx.clamp(size.width * (1 - scale), 0.0).toDouble(),
      translation.dy.clamp(size.height * (1 - scale), 0.0).toDouble(),
    );
  }

  void _set(double scale, Offset translation) {
    setState(() {
      _scale = scale;
      _translation = _clamped(translation, scale);
    });
    _notify();
  }

  /// Sayfa kaydırması kapalı olmalı mı: iki parmak basılıysa ya da fotoğraf yakınlaşmışsa.
  void _notify() {
    final active = _pointers.length >= 2 || _scale > 1.01;
    if (active == _active) return;
    _active = active;
    widget.onZoomChanged(active);
  }

  void _onPointerDown(PointerDownEvent event) {
    _pointers[event.pointer] = event.localPosition;
    if (_pointers.length == 2) widget.onPinchStart();
    _rebase();
    _notify();
  }

  void _onPointerMove(PointerMoveEvent event) {
    if (!_pointers.containsKey(event.pointer)) return;
    _pointers[event.pointer] = event.localPosition;
    if (_pointers.length >= 2) {
      if (_baseSpread <= 0) return;
      final scale = (_baseScale * (_spread / _baseSpread)).clamp(1.0, _maxScale).toDouble();
      // Odak noktası (iki parmağın ortası) yerinde kalsın: t' = f + k·(t − f₀).
      final k = scale / _baseScale;
      _set(scale, _focal + (_baseTranslation - _baseFocal) * k);
    } else if (_baseScale > 1.01) {
      // Tek parmak: yalnızca yakınlaşmışken gezdirir; normal boyutta kaydırma sayfaya kalır.
      _set(_baseScale, _baseTranslation + (_focal - _baseFocal));
    }
  }

  void _onPointerUp(PointerEvent event) {
    if (_pointers.remove(event.pointer) == null) return;
    if (_pointers.isEmpty) {
      if (_scale < _settleScale) {
        _set(1, Offset.zero);
      } else {
        _notify();
      }
    } else {
      // Bir parmak kalktığında kalan parmaklarla yeniden taban alınır; görüntü zıplamaz.
      _rebase();
      _notify();
    }
  }

  /// Çift dokunuş: dokunulan noktada yakınlaştırır, yeniden çift dokunuşta eski haline döner.
  void _toggleZoom(Offset point) {
    if (_scale > 1.01) {
      _set(1, Offset.zero);
      return;
    }
    // Noktanın altındaki fotoğraf yerinde kalsın: t = p·(1 − k).
    _set(_doubleTapScale, point * (1 - _doubleTapScale));
  }

  @override
  Widget build(BuildContext context) {
    final photo = SizedBox.expand(child: Center(child: ListingImage(url: widget.url, fit: BoxFit.contain, cacheWidth: null)));
    final matrix = Matrix4.identity()
      ..setEntry(0, 0, _scale)
      ..setEntry(1, 1, _scale)
      ..setEntry(0, 3, _translation.dx)
      ..setEntry(1, 3, _translation.dy);
    // Dinleyici ve çift dokunuş dedektörü dönüşümün DIŞINDA: yerel koordinatlar her zaman ekrana göredir.
    return Listener(
      behavior: HitTestBehavior.opaque,
      onPointerDown: _onPointerDown,
      onPointerMove: _onPointerMove,
      onPointerUp: _onPointerUp,
      onPointerCancel: _onPointerUp,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onDoubleTapDown: (details) => _toggleZoom(details.localPosition),
        onDoubleTap: () {},
        child: ClipRect(
          child: Transform(key: const ValueKey('zoom-transform'), transform: matrix, child: photo),
        ),
      ),
    );
  }
}
