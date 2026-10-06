"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useViewer } from "@/components/useViewer";
import { Icon } from "@/components/Icon";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ReportListingButton } from "@/components/ReportListingButton";
import { OfferBox } from "@/components/OfferBox";
import { QuestionsSection } from "@/components/QuestionsSection";

/**
 * İLAN SAYFASININ KİŞİYE ÖZEL PARÇALARI
 *
 * İlan sayfası herkes için aynı HTML olarak önbellekte durur (Vercel'de her ziyaret sunucuda yeniden
 * çizildiği için CPU/aktarım limiti bitiyordu). Giriş yapmış kişiye, ilan sahibine ve yöneticiye göre
 * değişen küçük parçalar burada, sayfa açıldıktan sonra tarayıcıda belirlenir.
 */

type OwnerInfo = { isOwner: boolean; offerCount: number; contactPhone?: string };

const ownerInfoCache = new Map<string, Promise<OwnerInfo>>();

/** Üye ilanında ziyaretçi ilanın sahibi mi? Yalnızca girişliyse ve üye ilanıysa sorulur. */
function useOwnerInfo(carId: string, enabled: boolean): OwnerInfo | null {
  const { viewer, ready } = useViewer();
  const [info, setInfo] = useState<OwnerInfo | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (!enabled || !viewer) {
      setInfo({ isOwner: false, offerCount: 0 });
      return;
    }
    let active = true;
    if (!ownerInfoCache.has(carId)) {
      ownerInfoCache.set(
        carId,
        fetch(`/api/cars/${carId}/viewer`, { credentials: "same-origin", cache: "no-store" })
          .then((r) => (r.ok ? r.json() : { isOwner: false, offerCount: 0 }))
          .catch(() => ({ isOwner: false, offerCount: 0 }))
      );
    }
    void ownerInfoCache.get(carId)!.then((value) => active && setInfo(value));
    return () => {
      active = false;
    };
  }, [carId, enabled, ready, viewer]);
  return info;
}

export function FavoriteOrLogin({ carId }: { carId: string }) {
  const { viewer, ready } = useViewer();
  if (ready && viewer) return <FavoriteButton carId={carId} />;
  return (
    <Link href={`/login?next=/cars/${carId}`} className="btn btn-secondary">
      <Icon name="heart" size={16} />
      Favori için giriş yap
    </Link>
  );
}

export function ViewerReportButton({ carId }: { carId: string }) {
  const { viewer } = useViewer();
  return <ReportListingButton carId={carId} loggedIn={!!viewer} />;
}

export function SellerPhoneNote({ carId }: { carId: string }) {
  const info = useOwnerInfo(carId, true);
  if (info?.isOwner && info.contactPhone) {
    return (
      <a href={`tel:${info.contactPhone.replace(/\s/g, "")}`} className="text-lg font-black text-[var(--text)] hover:text-amber-300">
        {info.contactPhone}
        <span className="ml-2 align-middle text-xs font-normal text-slate-400">(yalnızca sen görüyorsun)</span>
      </a>
    );
  }
  return (
    <p className="text-sm text-slate-300">
      Telefon numarası gizli. Teklifin <strong>kabul edilirse</strong> satıcının numarasını sohbette görebilirsin.
    </p>
  );
}

export function ViewerOfferBox({ carId, listingPrice, minOffer }: { carId: string; listingPrice: number; minOffer: number }) {
  const { viewer, ready } = useViewer();
  const info = useOwnerInfo(carId, true);
  if (!ready || !info) return null;
  return (
    <OfferBox
      carId={carId}
      listingPrice={listingPrice}
      minOffer={minOffer}
      isOwner={info.isOwner}
      loggedIn={!!viewer}
      offerCount={info.offerCount}
    />
  );
}

export function ViewerQuestions({ carId }: { carId: string }) {
  const { viewer, ready } = useViewer();
  const info = useOwnerInfo(carId, true);
  if (!ready || !info) return null;
  return <QuestionsSection carId={carId} isOwner={info.isOwner} loggedIn={!!viewer} />;
}

/**
 * Görüntülenme sayacı: sayfa önbellekten geldiği için sunucuda artırılamaz; tarayıcı bir kez bildirir.
 * JavaScript çalıştırmayan botlar sayılmaz (eskiden her bot ziyareti sayacı artırıyordu).
 */
export function ViewCounter({ carId }: { carId: string }) {
  useEffect(() => {
    const key = `op_viewed_${carId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // yoksay
    }
    void fetch(`/api/cars/${carId}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [carId]);
  return null;
}

/**
 * Herkese açık olmayan ilan (arşivde, satıldı, onay bekliyor, reddedildi): ortak sayfada içerik gösterilmez.
 * Giriş yapmış kişi önizleme sayfasına yönlendirilir; orada sunucu sahibi/yönetici mi diye bakar.
 */
export function RestrictedListingGate({ carId }: { carId: string }) {
  const { viewer, ready } = useViewer();
  const router = useRouter();
  useEffect(() => {
    if (ready && viewer) router.replace(`/cars/${carId}/onizleme`);
  }, [carId, ready, router, viewer]);
  if (!ready || viewer) {
    return <p className="py-16 text-center text-slate-400">Yükleniyor…</p>;
  }
  return (
    <div className="card mx-auto my-10 max-w-lg p-8 text-center">
      <h1 className="text-xl font-bold">Bu ilan şu an yayında değil</h1>
      <p className="mt-2 text-sm text-slate-400">İlan kaldırılmış, satılmış ya da henüz onaylanmamış olabilir.</p>
      <Link href="/" className="btn btn-primary mt-5 inline-block">
        İlanlara dön
      </Link>
    </div>
  );
}
