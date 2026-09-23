"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  /** Hata yakalandığında render edilecek fallback UI. */
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — render sırasında oluşan hataları yakalar ve
 * uygulamanın tamamen beyaz ekran vermesini önler. Layout seviyesinde
 * sarmalayarak tüm sayfalarda otomatik çalışır.
 *
 * Bilinen kısıt: Error boundary'ler yalnızca render/lifecycle hatalarını
 * yakalar; event handler'lardaki hataları yakalamaz (bunlar zaten try/catch
 * ile ele alınıyor).
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary yakaladı:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            padding: "2rem",
            margin: "2rem auto",
            maxWidth: 600,
            borderRadius: 16,
            background: "rgba(248, 113, 113, 0.08)",
            border: "1px solid rgba(248, 113, 113, 0.25)",
            color: "#fca5a5",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 8 }}>
            Bir şeyler ters gitti
          </h2>
          <p style={{ fontSize: "0.9rem", opacity: 0.8, marginBottom: 16 }}>
            {this.state.error?.message || "Beklenmeyen bir hata oluştu."}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: 10,
              border: "1px solid rgba(248, 113, 113, 0.35)",
              background: "rgba(248, 113, 113, 0.15)",
              color: "#fca5a5",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.85rem",
            }}
          >
            Sayfayı yenile
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
