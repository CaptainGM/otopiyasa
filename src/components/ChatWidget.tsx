"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import {
  availableChatSize,
  clampChatSize,
  DEFAULT_CHAT_SIZE,
  MAX_CHAT_WIDTH,
  CHAT_MARGIN,
} from "@/lib/chat-size";

interface ChatLink {
  href: string;
  label: string;
}
interface ChatCard {
  href: string;
  title: string;
  price: number;
  imageUrl: string;
  subtitle?: string;
}
interface ChatContext {
  carId?: string;
  brand?: string;
}
interface Message {
  role: "user" | "bot";
  text: string;
  link?: ChatLink;
  card?: ChatCard;
}

const GREETING: Message = {
  role: "bot",
  text: "Merhaba! OtoPiyasa asistanıyım. Aşağıdaki hazır seçeneklerden birini seçebilir ya da 'en ucuz BMW' gibi sorular yazabilirsin.",
};

const QUICK_REPLIES = [
  "En ucuz Toyota",
  "Kaç ilan var?",
  "Fiyat tahmini nasıl çalışır?",
  "Piyasa ortalaması nedir?",
  "Favori nasıl eklenir?",
];

const DEFAULT_SIZE = DEFAULT_CHAT_SIZE;

const availableSize = () => availableChatSize(window.innerWidth, window.innerHeight);
const SIZE_STORAGE_KEY = "otopiyasa-chat-size";
const MSG_STORAGE_KEY = "otopiyasa-chat-messages";
const CTX_STORAGE_KEY = "otopiyasa-chat-context";

export function ChatWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const lastContext = useRef<ChatContext | undefined>(undefined);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [maximized, setMaximized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  
  useEffect(() => {
    const available = availableSize();
    try {
      const saved = localStorage.getItem(SIZE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.w === "number" && typeof parsed?.h === "number") {
          setSize(clampChatSize(parsed.w, parsed.h, available));
          return;
        }
      }
      setSize(clampChatSize(DEFAULT_SIZE.w, DEFAULT_SIZE.h, available));
    } catch {
     
      setSize(clampChatSize(DEFAULT_SIZE.w, DEFAULT_SIZE.h, available));
    }
  }, []);

 
  useEffect(() => {
    function onResize() {
      const available = availableSize();
      setSize((current) => clampChatSize(current.w, current.h, available));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  
  useEffect(() => {
    try {
      const savedMsgs = localStorage.getItem(MSG_STORAGE_KEY);
      if (savedMsgs) {
        const parsed = JSON.parse(savedMsgs);
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
      const savedCtx = localStorage.getItem(CTX_STORAGE_KEY);
      if (savedCtx) lastContext.current = JSON.parse(savedCtx);
    } catch {
     
    }
  }, []);

  
  useEffect(() => {
    try {
      localStorage.setItem(MSG_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      
    }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function clearChat() {
    setMessages([GREETING]);
    lastContext.current = undefined;
    try {
      localStorage.removeItem(MSG_STORAGE_KEY);
      localStorage.removeItem(CTX_STORAGE_KEY);
    } catch {
      
    }
  }

  function clampSize(w: number, h: number) {
    return clampChatSize(w, h, availableSize());
  }

  function onResizeStart(e: React.PointerEvent) {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h };

    function onMove(ev: PointerEvent) {
      if (!dragRef.current) return;
      
      const next = clampSize(
        dragRef.current.startW + (dragRef.current.startX - ev.clientX),
        dragRef.current.startH + (dragRef.current.startY - ev.clientY)
      );
      setMaximized(false);
      setSize(next);
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      dragRef.current = null;
      setSize((current) => {
        try {
          localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(current));
        } catch {
          
        }
        return current;
      });
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          context: lastContext.current,
          
          history: messages.map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json();
      const reply = res.ok ? data.reply : data.error || "Bir hata oluştu.";
      
      if (res.ok && data.context) {
        lastContext.current = data.context;
        try {
          localStorage.setItem(CTX_STORAGE_KEY, JSON.stringify(data.context));
        } catch {
          
        }
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: reply,
          link: res.ok ? data.link : undefined,
          card: res.ok ? data.card : undefined,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "Bağlantı hatası, tekrar dener misin?" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div
          className="relative mb-3 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[rgba(12,14,20,0.98)] shadow-2xl backdrop-blur-xl"
          style={
            maximized
              ? {
                  width: `min(${MAX_CHAT_WIDTH}px, calc(100vw - ${CHAT_MARGIN.w}px))`,
                  height: `calc(100vh - ${CHAT_MARGIN.h}px)`,
                }
              : 
                {
                  width: `min(${size.w}px, calc(100vw - ${CHAT_MARGIN.w}px))`,
                  height: `min(${size.h}px, calc(100vh - ${CHAT_MARGIN.h}px))`,
                }
          }
        >
          {/* Sol üst köşeden sürükleyerek boyutlandırma */}
          <div
            onPointerDown={onResizeStart}
            className="absolute left-0 top-0 z-10 h-5 w-5 cursor-nwse-resize"
            title="Sürükleyerek boyutlandır"
            aria-hidden
          >
            <svg width="20" height="20" viewBox="0 0 20 20" className="text-slate-600">
              <path d="M4 9V4h5M4 4l5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <strong className="pl-3 text-sm">OtoPiyasa Asistan</strong>
            <div className="flex items-center gap-2">
              <button
                onClick={clearChat}
                className="text-xs text-slate-400 hover:text-white"
                aria-label="Sohbeti temizle"
                title="Sohbeti temizle (yeni sohbet)"
              >
                Temizle
              </button>
              <button
                onClick={() => setMaximized((v) => !v)}
                className="text-slate-400 hover:text-white"
                aria-label={maximized ? "Küçült" : "Büyüt"}
                title={maximized ? "Küçült" : "Büyüt"}
              >
                {maximized ? "🗗" : "🗖"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white"
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Üstte sabit karşılaştırma kısayolu */}
          <button
            onClick={() => {
              setOpen(false);
              router.push("/compare");
            }}
            className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-left text-sm font-semibold text-amber-200 transition hover:bg-amber-400/15"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M9 5H5v4M15 5h4v4M9 19H5v-4M15 19h4v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Araç karşılaştırma sayfasını aç
          </button>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto bg-amber-500/20 text-amber-100"
                    : "bg-white/5 text-slate-200"
                }`}
              >
                {m.text}
                {m.card && (
                  <button
                    onClick={() => router.push(m.card!.href)}
                    className="mt-2 flex w-full items-center gap-3 overflow-hidden rounded-lg border border-white/10 bg-black/30 p-2 text-left transition hover:border-amber-400/40"
                  >
                    {m.card.imageUrl ? (
                      
                      <img
                        src={m.card.imageUrl}
                        alt={m.card.title}
                        className="h-14 w-20 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-md bg-white/5 text-slate-600">
                        🚗
                      </div>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-100">
                        {m.card.title}
                      </span>
                      {m.card.subtitle && (
                        <span className="block text-[11px] text-slate-500">{m.card.subtitle}</span>
                      )}
                      <span className="mt-0.5 block text-sm font-black text-amber-300">
                        {formatPrice(m.card.price)}
                      </span>
                    </span>
                  </button>
                )}
                {m.link && (
                  <button
                    onClick={() => {
                      
                      router.push(m.link!.href);
                    }}
                    className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-400/20"
                  >
                    {m.link.label}
                  </button>
                )}
              </div>
            ))}
            {loading && <div className="text-xs text-slate-500">Yazıyor...</div>}
          </div>

          {/* Hazır soru butonları */}
          <div className="flex flex-wrap gap-1.5 border-t border-white/10 px-3 pt-2.5">
            {QUICK_REPLIES.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={loading}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 transition hover:border-amber-400/40 hover:text-amber-200 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Bir soru yaz..."
              className="input flex-1 text-sm"
            />
            <button type="submit" disabled={loading} className="btn btn-primary text-sm">
              Gönder
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="btn btn-primary h-14 w-14 rounded-full text-xl shadow-xl"
        aria-label="Asistanı aç/kapat"
      >
        {open ? "✕" : "💬"}
      </button>
    </div>
  );
}
