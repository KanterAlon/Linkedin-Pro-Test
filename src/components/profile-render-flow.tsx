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

  // Si pureHtmlMode está activado y hay HTML, mostrarlo sin ningún wrapper
  if (pureHtmlMode && hasHtml) {
    return (
      <>
        {/* Reset de estilos globales del body para mostrar HTML puro */}
        <style jsx global>{`
          body {
            background: white !important;
            color: inherit !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        `}</style>
        {isOwner && (
          <div className="fixed bottom-6 right-6 z-50 flex gap-3">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 rounded-full border border-white/20 bg-slate-900/90 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:border-white/40 hover:bg-slate-800"
            >
              <ArrowLeft className="size-4" />
              Volver
            </button>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-full border border-white/20 bg-slate-900/90 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:border-white/40 hover:bg-slate-800"
            >
              <ExternalLink className="size-4" />
              Dashboard
            </Link>
          </div>
        )}
        <div dangerouslySetInnerHTML={{ __html: profile.profile_html ?? "" }} />
      </>
    );
  }

  return (
    <div className="space-y-8">
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
            className="rounded-3xl border border-white/10 bg-slate-950/60 p-8 shadow-2xl"
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
