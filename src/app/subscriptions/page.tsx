"use client";

import { useState } from "react";
import { SubscriptionForm } from "@/components/SubscriptionForm";
import { SubscriptionList } from "@/components/SubscriptionList";

export default function SubscriptionsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="space-y-6 py-8">
      <h1 className="text-2xl font-bold">Bildirim Abonelikleri</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <SubscriptionForm onCreated={() => setRefreshKey((k) => k + 1)} />
        <div key={refreshKey} className="card p-4">
          <h2 className="font-semibold mb-4">Mevcut Abonelikler</h2>
          <SubscriptionList />
        </div>
      </div>
    </div>
  );
}
