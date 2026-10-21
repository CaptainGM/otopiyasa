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

/// Tam ekran fotoğraf: normal boyutta sağa-sola kaydırmak sonraki fotoğrafa geçirir; iki parmakla yakınlaştırılmış
/// fotoğrafta kaydırma fotoğrafın içinde gezinir (sayfa değişmez).
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
        ),
      ),
    );
  }
}

class _ZoomablePhoto extends StatefulWidget {
  const _ZoomablePhoto({required this.url, required this.onZoomChanged});

  final String url;
  final ValueChanged<bool> onZoomChanged;

  @override
  State<_ZoomablePhoto> createState() => _ZoomablePhotoState();
}

class _ZoomablePhotoState extends State<_ZoomablePhoto> {
  static const _zoomLevel = 2.5;
  final _controller = TransformationController();
  bool _zoomed = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onTransformChanged);
  }

  @override
  void dispose() {
    _controller.removeListener(_onTransformChanged);
    _controller.dispose();
    super.dispose();
  }

  void _setZoomed(bool zoomed) {
    if (zoomed == _zoomed) return;
    setState(() => _zoomed = zoomed);
    widget.onZoomChanged(zoomed);
  }

  /// Çift dokunuş: dokunulan noktaya yakınlaştırır, yeniden çift dokunuşta eski haline döner. Normal boyutta
  /// InteractiveViewer kullanılmaz: o, tek parmak kaydırmayı kendine alıp sayfa değişimini engelliyordu.
  void _toggleZoom(Offset point) {
    if (_zoomed) {
      _controller.value = Matrix4.identity();
      _setZoomed(false);
      return;
    }
    _controller.value = Matrix4.identity()
      ..translateByDouble(-point.dx * (_zoomLevel - 1), -point.dy * (_zoomLevel - 1), 0, 1)
      ..scaleByDouble(_zoomLevel, _zoomLevel, 1, 1);
    _setZoomed(true);
  }

  /// Parmakla büyütme/küçültme sonunda fotoğraf yine normal boyuttaysa sayfa kaydırması geri gelir.
  void _onTransformChanged() {
    if (_zoomed && _controller.value.getMaxScaleOnAxis() <= 1.01) _setZoomed(false);
  }

  @override
  Widget build(BuildContext context) {
    final photo = SizedBox.expand(child: Center(child: ListingImage(url: widget.url, fit: BoxFit.contain, cacheWidth: null)));
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onDoubleTapDown: (details) => _toggleZoom(details.localPosition),
      onDoubleTap: () {},
      child: _zoomed
          ? InteractiveViewer(transformationController: _controller, minScale: 1, maxScale: 4, child: photo)
          : photo,
    );
  }
}
