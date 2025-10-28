"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles, ExternalLink, ArrowLeft } from "lucide-react";

import { useUser } from "@clerk/nextjs";

import type { UserProfileRow } from "@/lib/store";

type RenderResponse = {
  ok: boolean;
  html: string;
  record: UserProfileRow;
  slug: string;
  username: string;
  path: string;
  error?: string;
};

type ProfileRenderFlowProps = {
  initialProfile: UserProfileRow;
  isOwner: boolean;
  pureHtmlMode?: boolean;
};

export function ProfileRenderFlow({ initialProfile, isOwner, pureHtmlMode = false }: ProfileRenderFlowProps) {
  const { user } = useUser();
  const [profile, setProfile] = useState<UserProfileRow>(initialProfile);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mediumUsername, setMediumUsername] = useState<string | null>(null);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [apiMediumInfo, setApiMediumInfo] = useState<{
    provided: boolean;
    username: string | null;
    userId: string | null;
    articlesCount: number;
  } | null>(null);

  async function logToServer(message: string, extra?: Record<string, unknown>) {
    try {
      await fetch("/api/debug/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, extra }),
      });
    } catch {}
  }

  const hasHtml = Boolean(profile.profile_html);

  const jsonPreview = useMemo(() => {
    if (!profile.profile_json || typeof profile.profile_json !== "object") {
      return null;
    }
    try {
      return JSON.stringify(profile.profile_json, null, 2);
    } catch {
      return null;
    }
  }, [profile.profile_json]);

  const pdfPreview = useMemo(() => {
    if (!profile.pdf_raw) {
      return null;
    }
    const trimmed = profile.pdf_raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [profile.pdf_raw]);

  const lastRenderedAt = profile.last_rendered_at
    ? new Date(profile.last_rendered_at).toLocaleString()
    : null;

  const identityAuthId = user?.id ?? null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const m = params.get("medium") || params.get("mediumUsername");
      if (m) setMediumUsername(m);
    } catch {}
  }, []);

  const handleRender = useCallback(async () => {
    setError(null);
    setRendering(true);
    setProgress(0);
    setProgressMessage("Iniciando renderizado...");
    
    try {
      const payload: Record<string, unknown> = {};
      if (identityAuthId) {
        payload.identityAuthId = identityAuthId;
      }
      if (mediumUsername) {
        payload.mediumUsername = mediumUsername;
      }

      const startMsg = mediumUsername
        ? `Iniciando render con Medium: ${mediumUsername}`
        : "Iniciando render sin Medium";
      console.log(startMsg);
      setDebugLines((prev) => [...prev, startMsg]);
      logToServer(startMsg, { mediumUsername });

      // Simular progreso mientras se renderiza
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 500);

      setProgressMessage("Analizando contenido...");
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setProgress(30);
      setProgressMessage("Generando HTML con IA...");
      setDebugLines((prev) => [...prev, "Llamando /api/profile/render..."]);
      logToServer("Llamando /api/profile/render...", { mediumUsername });
      
      const response = await fetch("/api/profile/render", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      
      clearInterval(progressInterval);
      setProgress(95);
      setProgressMessage("Finalizando...");
      
      const data = (await response.json()) as RenderResponse;

      if (!response.ok) {
        throw new Error(data.error || "No se pudo renderizar la pagina");
      }

      const mediumInfo = (data as any)?.medium as
        | { provided: boolean; username: string | null; userId: string | null; articlesCount: number }
        | undefined;
      if (mediumInfo) {
        setApiMediumInfo(mediumInfo);
        const line = `Medium API: provided=${mediumInfo.provided} username=${mediumInfo.username ?? "-"} userId=${mediumInfo.userId ?? "-"} articles=${mediumInfo.articlesCount}`;
        console.log(line);
        setDebugLines((prev) => [...prev, line]);
        logToServer("Medium API result", mediumInfo as any);
      }

      setProgress(100);
      setProgressMessage("¡Completado!");
      
      // Esperar un momento antes de actualizar el perfil para mostrar el 100%
      await new Promise(resolve => setTimeout(resolve, 500));
      setProfile(data.record);
      
      // Recargar la página para mostrar el HTML puro
      window.location.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al renderizar la pagina";
      setError(message);
      setRendering(false);
      setProgress(0);
      logToServer("Render error", { error: message });
    }
  }, [identityAuthId]);

  // Iniciar renderizado automáticamente si es owner y no hay HTML
  useEffect(() => {
    if (isOwner && !hasHtml && !rendering && !error) {
      // Pequeño delay para mejor UX
      const timer = setTimeout(() => {
        handleRender();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOwner, hasHtml, rendering, error, handleRender]);

  // Si pureHtmlMode está activado y hay HTML, mostrar solo el HTML generado por la IA, sin overrides globales
  if (pureHtmlMode && hasHtml) {
    return (
      <>
        <div dangerouslySetInnerHTML={{ __html: profile.profile_html ?? "" }} />
        {/* Controles mínimos, flotantes, no intrusivos */}
        <div className="fixed bottom-4 right-4 z-50 flex gap-2 text-xs">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 font-medium text-white shadow backdrop-blur-sm transition hover:bg-black/70"
            aria-label="Volver"
            title="Volver"
          >
            <ArrowLeft className="size-3" />
            Volver
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 font-medium text-white shadow backdrop-blur-sm transition hover:bg-black/70"
            aria-label="Dashboard"
            title="Dashboard"
          >
            <ExternalLink className="size-3" />
            Dashboard
          </Link>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-8">
      {(mediumUsername || debugLines.length > 0 || apiMediumInfo) && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-xs text-slate-300">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-slate-200">Medium Debug</span>
            <span className="text-slate-400">{mediumUsername ? `@${mediumUsername}` : "sin usuario"}</span>
          </div>
          {apiMediumInfo && (
            <div className="mb-2 grid grid-cols-2 gap-2 text-slate-300">
              <div>provided: {String(apiMediumInfo.provided)}</div>
              <div>articles: {apiMediumInfo.articlesCount}</div>
              <div>userId: {apiMediumInfo.userId ?? "-"}</div>
              <div>username: {apiMediumInfo.username ?? "-"}</div>
            </div>
          )}
          {debugLines.length > 0 && (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap leading-5">{debugLines.join("\n")}</pre>
          )}
        </div>
      )}
      {/* Barra superior con botón Volver (solo en modo normal) */}
      <div className="flex items-center justify-start">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
        >
          <ArrowLeft className="size-4" />
          Volver
        </button>
      </div>
      {hasHtml ? (
        <section className="space-y-6">
          <div className="flex items-center justify-between rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6">
            <div>
              <p className="text-sm font-semibold text-emerald-200">Pagina generada con exito</p>
              {lastRenderedAt && (
                <p className="text-xs text-emerald-100/80">Ultima actualizacion: {lastRenderedAt}</p>
              )}
            </div>
            {isOwner && (
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/40"
                >
                  Ir al dashboard
                </Link>
                <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white">
                  /{profile.slug}
                </span>
              </div>
            )}
          </div>

          <div
            className="rounded-3xl border border-white/10 bg-slate-950/60 p-8 text-slate-100 shadow-2xl"
            dangerouslySetInnerHTML={{ __html: profile.profile_html ?? "" }}
          />
        </section>
      ) : (
        <>
          {isOwner ? (
            <>
              {/* Mostrar datos extraídos */}
              <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/60 p-8 shadow-lg">
                <header className="flex items-center gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-blue-500/10 text-base font-semibold text-blue-200">
                    1
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Datos extraidos</h2>
                    <p className="text-sm text-slate-300">
                      Contenido procesado de tu PDF que será usado para generar tu página.
                    </p>
                  </div>
                </header>

                {jsonPreview ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      JSON estructurado
                    </p>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs text-slate-100">
                      {jsonPreview}
                    </pre>
                  </div>
                ) : pdfPreview ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Texto extraido del PDF
                    </p>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs text-slate-100">
                      {pdfPreview}
                    </pre>
                  </div>
                ) : (
                  <p className="text-sm text-slate-300">
                    Todavia no hay datos procesados. Sube nuevamente tu PDF desde la pagina principal.
                  </p>
                )}
              </section>

              {/* Barra de progreso automática */}
              <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/60 p-8 shadow-lg">
                <header className="flex items-center gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-base font-semibold text-emerald-200">
                    2
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Renderizando tu página</h2>
                    <p className="text-sm text-slate-300">
                      Generando HTML con diseño profesional automáticamente...
                    </p>
                  </div>
                </header>

                {rendering && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">{progressMessage}</span>
                      <span className="font-semibold text-emerald-400">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                      <Loader2 className="size-4 animate-spin" />
                      <span>Esto puede tardar unos segundos...</span>
                    </div>
                  </div>
                )}

                {!rendering && !error && (
                  <div className="flex items-center justify-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-100">
                    <Sparkles className="size-5" />
                    <span>Iniciando renderizado automático...</span>
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-8 text-center text-sm text-slate-300 shadow-lg">
              <Sparkles className="mx-auto mb-4 size-10 text-slate-500" />
              <p>Esta página está en proceso de generación. Vuelve más tarde para ver el resultado.</p>
            </section>
          )}
        </>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}
    </div>
  );
}
