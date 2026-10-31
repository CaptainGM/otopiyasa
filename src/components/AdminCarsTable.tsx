"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminDeleteCarButton } from "@/components/AdminDeleteCarButton";
import { SourceBadge } from "@/components/SourceBadge";
import { formatPrice } from "@/lib/utils";
import type { ListingSource } from "@/types";

interface AdminCarItem {
  _id: string;
  title: string;
  price: number;
  city: string;
  sourceSite?: string;
  externalId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function AdminCarsTable() {
  const [cars, setCars] = useState<AdminCarItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/listings?limit=40")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.cars) setCars(data.cars);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Son İşlem Gören İlanlar ({cars.length})</h2>
          <p className="text-xs text-slate-400">
            Scraper tarafından en son taranan, fiyatı veya detayları güncellenen canlı ilanlar.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 py-6 animate-pulse">
          <div className="h-10 rounded bg-white/5" />
          <div className="h-10 rounded bg-white/5" />
          <div className="h-10 rounded bg-white/5" />
        </div>
      ) : cars.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Kayıtlı aktif ilan bulunamadı.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="p-2.5">İlan</th>
                <th className="p-2.5">Kaynak</th>
                <th className="p-2.5">Fiyat</th>
                <th className="p-2.5">Şehir</th>
                <th className="p-2.5">Son Tarama / İşlem</th>
                <th className="p-2.5">İlk Kayıt</th>
                <th className="p-2.5" />
              </tr>
            </thead>
            <tbody>
              {cars.map((car) => (
                <tr key={car._id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                  <td className="max-w-72 p-2.5">
                    <Link
                      href={`/cars/${car._id}`}
                      className="line-clamp-1 font-medium hover:text-amber-300"
                    >
                      {car.title}
                    </Link>
                    {car.externalId?.startsWith("demo-") && (
                      <span className="text-[10px] font-bold uppercase text-slate-500">
                        demo
                      </span>
                    )}
                  </td>
                  <td className="p-2.5">
                    <SourceBadge source={(car.sourceSite || "demo") as ListingSource} />
                  </td>
                  <td className="p-2.5 font-semibold">{formatPrice(car.price)}</td>
                  <td className="p-2.5 text-slate-400">{car.city}</td>
                  <td className="p-2.5 font-medium text-emerald-400">
                    {car.updatedAt
                      ? new Date(car.updatedAt).toLocaleString("tr-TR", {
                          timeZone: "Europe/Istanbul",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </td>
                  <td className="p-2.5 text-slate-500 text-xs">
                    {car.createdAt
                      ? new Date(car.createdAt).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })
                      : "-"}
                  </td>
                  <td className="p-2.5 text-right">
                    <AdminDeleteCarButton carId={car._id} title={car.title} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
