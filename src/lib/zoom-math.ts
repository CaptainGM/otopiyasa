/**
 * Fotoğraf yakınlaştırma matematiği (saf fonksiyonlar; arayüz bileşeni Lightbox kullanır, testler vitest'te çalışır).
 *
 * Görünüm: ölçek ve öteleme. Koordinatlar alanın (lightbox'taki fotoğraf alanı) merkezine göre piksel cinsindendir ve
 * fotoğraf merkezinden ölçeklenir (CSS transform-origin: center). Bu yüzden odak noktası formülü, bir noktanın ekrandaki
 * yerini sabit tutar: t' = f − k·(f − t), k = yeni ölçek / eski ölçek.
 */

export interface Point {
  x: number;
  y: number;
}

export interface View {
  scale: number;
  x: number;
  y: number;
}

export const MIN_SCALE = 1;
export const MAX_SCALE = 4;
/** Çift dokunuş / çift tık hedefi. */
export const DOUBLE_TAP_SCALE = 2.5;
/** Parmaklar kalktıktan sonra bu değerin altında kalan yakınlaşma normal boyuta döner. */
export const SETTLE_SCALE = 1.05;
/** Düğme ve klavye adımı (+ / −). */
export const BUTTON_STEP = 1.4;

const IDENTITY: View = { scale: 1, x: 0, y: 0 };

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function identityView(): View {
  return IDENTITY;
}

/** Odak noktasını sabit tutarak ölçeği değiştirir (fare tekerleği, düğmeler, çift dokunuş). */
export function zoomAround(view: View, focal: Point, scale: number): View {
  const next = clampScale(scale);
  const k = next / view.scale;
  return {
    scale: next,
    x: focal.x - k * (focal.x - view.x),
    y: focal.y - k * (focal.y - view.y),
  };
}

/**
 * İki parmak: hareket başlangıcındaki görünüm ve parmak aralığı oranına göre yeni görünüm. Parmakların ortası (odak)
 * yerinde kalır, o yüzden pinch sırasında fotoğraf kaymaz.
 */
export function pinchView(base: View, baseFocal: Point, baseSpread: number, focal: Point, spread: number): View {
  if (baseSpread <= 0) return base;
  const scale = clampScale(base.scale * (spread / baseSpread));
  const k = scale / base.scale;
  return {
    scale,
    x: focal.x + k * (base.x - baseFocal.x),
    y: focal.y + k * (base.y - baseFocal.y),
  };
}

/** Tek parmakla gezdirme (yalnızca yakınlaşmışken). */
export function panView(base: View, baseFocal: Point, focal: Point): View {
  return {
    scale: base.scale,
    x: base.x + (focal.x - baseFocal.x),
    y: base.y + (focal.y - baseFocal.y),
  };
}

/**
 * Öteleme sınırı: fotoğrafın kenarı alanın kenarını geçip boşluk göstermesin. image: fotoğrafın ölçeksiz (yerleşik)
 * boyutu, stage: alanın boyutu. Yakınlaşmış fotoğrafta yan siyah boşlukların gezdirilmesini de önler.
 */
export function clampView(view: View, image: { width: number; height: number }, stage: { width: number; height: number }): View {
  const maxX = Math.max(0, (view.scale * image.width - stage.width) / 2);
  const maxY = Math.max(0, (view.scale * image.height - stage.height) / 2);
  return {
    scale: view.scale,
    x: Math.min(maxX, Math.max(-maxX, view.x)),
    y: Math.min(maxY, Math.max(-maxY, view.y)),
  };
}

/** Parmak kalktıktan sonra: çok az yakınlaşmış görünüm normal boyuta döner. */
export function settleView(view: View): View {
  return view.scale < SETTLE_SCALE ? IDENTITY : view;
}

export function spreadOf(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function centroidOf(points: Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}
