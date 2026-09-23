"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function FavoriteButton({ carId }: { carId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    async function loadFavorites() {
      const response = await fetch("/api/auth/me");
      const data = await response.json();
      if (!data.user) {
        setChecked(true);
        return;
      }

      const favResponse = await fetch("/api/favorites");
      if (favResponse.ok) {
        const favData = await favResponse.json();
        const ids = favData.favorites.map((car: { _id: string }) => car._id);
        setIsFavorite(ids.includes(carId));
      }
      setChecked(true);
    }

    loadFavorites();
  }, [carId]);

  async function toggleFavorite() {
    setLoading(true);
    try {
      const response = await fetch("/api/favorites", {
        method: isFavorite ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId }),
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (response.ok) {
        setIsFavorite(!isFavorite);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  if (!checked) return null;

  return (
    <button
      onClick={toggleFavorite}
      disabled={loading}
      className="btn btn-secondary"
    >
      {isFavorite ? "Favoriden çıkar" : "Favorilere ekle"}
    </button>
  );
}
