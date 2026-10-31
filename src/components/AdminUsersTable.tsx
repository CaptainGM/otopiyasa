"use client";

import { useEffect, useState } from "react";
import { RemoveAvatarButton } from "@/components/RemoveAvatarButton";

interface AdminUserItem {
  _id: string;
  name: string;
  email: string;
  role?: string;
  favorites?: unknown[];
  createdAt?: string;
  avatarType?: string | null;
}

export function AdminUsersTable({ initialCount }: { initialCount?: number }) {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(initialCount || 0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadUsers(q = "") {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}&page=1`);
      if (res.ok) {
        const data = await res.json();
        if (data.users) {
          setUsers(
            data.users.map((u: any) => ({
              _id: String(u._id),
              name: u.name,
              email: u.email,
              role: u.role,
              favorites: u.favorites,
              createdAt: u.createdAt,
              avatarType: u.avatarType,
            }))
          );
        }
        if (typeof data.total === "number") {
          setTotalCount(data.total);
        }
      }
    } catch {
      // sessiz yakala
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Kullanıcılar ({totalCount})</h2>
        <div className="relative min-w-[220px]">
          <input
            type="text"
            placeholder="Kullanıcı veya e-posta ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadUsers(search);
            }}
            className="w-full rounded-xl bg-slate-900/90 border border-slate-700/60 px-3.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                loadUsers("");
              }}
              className="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-slate-200"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 py-6 animate-pulse">
          <div className="h-10 rounded bg-white/5" />
          <div className="h-10 rounded bg-white/5" />
          <div className="h-10 rounded bg-white/5" />
        </div>
      ) : users.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Kullanıcı bulunamadı.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="p-2.5">Ad</th>
                <th className="p-2.5">E-posta</th>
                <th className="p-2.5">Rol</th>
                <th className="p-2.5">Favori</th>
                <th className="p-2.5">Kayıt</th>
                <th className="p-2.5">Fotoğraf</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="border-b border-white/5">
                  <td className="p-2.5 font-medium">{user.name}</td>
                  <td className="p-2.5 text-slate-400">{user.email}</td>
                  <td className="p-2.5">
                    {user.role === "admin" ? (
                      <span className="badge badge-accent">admin</span>
                    ) : (
                      <span className="badge">kullanıcı</span>
                    )}
                  </td>
                  <td className="p-2.5">{user.favorites?.length || 0}</td>
                  <td className="p-2.5 text-slate-500">
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })
                      : "-"}
                  </td>
                  <td className="p-2.5">
                    {user.avatarType === "photo" ? (
                      <RemoveAvatarButton userId={user._id} />
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
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
