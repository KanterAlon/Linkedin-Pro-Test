"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, PlayCircle, Sparkles } from "lucide-react";

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
};

export function ProfileRenderFlow({ initialProfile, isOwner }: ProfileRenderFlowProps) {
  const { user } = useUser();
  const [profile, setProfile] = useState<UserProfileRow>(initialProfile);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const handleRender = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setRendering(true);
    try {
      const payload: Record<string, unknown> = {};
      if (user?.id) {
        payload.identityAuthId = user.id;
      }

      const response = await fetch("/api/profile/render", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as RenderResponse;

      if (!response.ok) {
        throw new Error(data.error || "No se pudo renderizar la pagina");
      }

      setProfile(data.record);
      setSuccess("Pagina renderizada correctamente. Lista para compartir.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al renderizar la pagina";
      setError(message);
    } finally {
      setRendering(false);
    }
  }, []);

  return (
    <div className="space-y-8">
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
              <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/60 p-8 shadow-lg">
                <header className="flex items-center gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-blue-500/10 text-base font-semibold text-blue-200">
                    1
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Revisa los datos extraidos</h2>
                    <p className="text-sm text-slate-300">
                      Asegurate de que el contenido generado a partir de tu PDF sea correcto antes de
                      continuar.
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

              <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/60 p-8 shadow-lg">
                <header className="flex items-center gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-base font-semibold text-emerald-200">
                    2
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Renderiza tu pagina</h2>
                    <p className="text-sm text-slate-300">
                      Genera el HTML con diseno profesional. Podras volver a renderizarla desde el
                      dashboard cuando quieras.
                    </p>
                  </div>
                </header>

                <button
                  onClick={handleRender}
                  disabled={rendering || (!jsonPreview && !pdfPreview)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
                >
                  {rendering ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <PlayCircle className="size-4" />
                  )}
                  {rendering ? "Generando pagina..." : "Continuar y renderizar pagina"}
                </button>

                <p className="text-xs text-slate-400">
                  Guardaremos el resultado en tu cuenta y podras compartirlo en /{profile.slug}.
                </p>
              </section>
            </>
          ) : (
            <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-8 text-center text-sm text-slate-300 shadow-lg">
              <Sparkles className="mx-auto mb-4 size-10 text-slate-500" />
              <p>Esta pagina aun esta en proceso de generacion. Vuelve mas tarde para ver el resultado.</p>
            </section>
          )}
        </>
      )}

      {(error || success) && (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            error
              ? "border border-rose-500/30 bg-rose-500/10 text-rose-100"
              : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
          }`}
        >
          {error ?? success}
        </div>
      )}
    </div>
  );
}
