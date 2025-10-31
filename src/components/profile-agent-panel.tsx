"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, MessageSquare, RefreshCw, Send, Sparkles } from "lucide-react";

import { useUser } from "@clerk/nextjs";

import type { ProfileData } from "@/lib/pollinations";
import type { UserProfileRow } from "@/lib/store";

type ApiErrorResponse = {
  error?: string;
};

type GetProfileResponse = {
  profile: UserProfileRow | null;
};

type EnsureProfileResponse = {
  profile: UserProfileRow;
  identity?: {
    slug: string;
    username: string;
    email: string | null;
  };
};

type AugmentResponse = {
  ok: boolean;
  profile: ProfileData;
  record: UserProfileRow;
  slug: string;
  username: string;
  path: string;
};

type RenderResponse = {
  ok: boolean;
  html: string;
  record: UserProfileRow;
  slug: string;
  username: string;
  path: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

function buildPublicUrl(
  baseUrl: string | undefined,
  slug: string | null | undefined,
  authHint?: string
): string {
  if (!slug) {
    return "";
  }
  const trimmedBase = baseUrl?.replace(/\/+$/, "") ?? "";
  const suffix = authHint ?? "";
  return trimmedBase ? `${trimmedBase}/${slug}${suffix}` : `/${slug}${suffix}`;
}

function createMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

type ProfileAgentPanelProps = {
  baseUrl?: string;
};

export function ProfileAgentPanel({ baseUrl }: ProfileAgentPanelProps) {
  const { user } = useUser();
  const [profile, setProfile] = useState<UserProfileRow | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [ensuring, setEnsuring] = useState(false);
  const [augmenting, setAugmenting] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [renderInstructions, setRenderInstructions] = useState("");
  const [renderModel, setRenderModel] = useState<"openai" | "gemini">("gemini");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const authHint = useMemo(() => {
    if (!user?.id || !profile?.auth_user_id || profile.auth_user_id !== user.id) {
      return "";
    }
    return `?authId=${encodeURIComponent(user.id)}`;
  }, [profile?.auth_user_id, user?.id]);

  const publicUrl = useMemo(
    () => buildPublicUrl(baseUrl, profile?.slug, authHint || undefined),
    [authHint, baseUrl, profile?.slug]
  );

  const jsonPreview = useMemo(() => {
    if (!profile?.profile_json || typeof profile.profile_json !== "object") {
      return null;
    }
    try {
      return JSON.stringify(profile.profile_json, null, 2);
    } catch {
      return null;
    }
  }, [profile?.profile_json]);

  const hasJson = Boolean(jsonPreview);
  const hasHtml = Boolean(profile?.profile_html);

  const previewSrcDoc = useMemo(() => {
    const html = profile?.profile_html ?? "";
    return `<!doctype html>\n<html lang=\"es\">\n<head>\n<meta charset=\"utf-8\" />\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n<style>html,body{margin:0;padding:0;background:#fff;color:#0f172a}</style>\n<script>window.tailwind=window.tailwind||{};window.tailwind.config={corePlugins:{preflight:false}};<\/script>\n<script src=\"https://cdn.tailwindcss.com\"><\/script>\n</head>\n<body>\n<div id=\"root\">${html}</div>\n</body>\n</html>`;
  }, [profile?.profile_html]);

  const resetFeedback = useCallback(() => {
    setError(null);
    setFeedback(null);
  }, []);

  const loadProfileData = useCallback(
    async (showSuccess = false) => {
      resetFeedback();
      setLoadingProfile(true);

      try {
        const identityQuery = user?.id
          ? `?identityAuthId=${encodeURIComponent(user.id)}`
          : "";
        const response = await fetch(`/api/profile${identityQuery}`, {
          credentials: "include",
        });

        if (response.status === 401) {
          setProfile(null);
          setError("Por favor inicia sesión para ver tu información personal.");
          return;
        }

        if (response.status === 404) {
          setProfile(null);
          if (showSuccess) {
            setFeedback("Comienza subiendo tu CV en PDF desde la página principal para crear tu perfil.");
          }
          return;
        }

        const data = (await response.json()) as GetProfileResponse & ApiErrorResponse;

        if (!response.ok) {
          throw new Error(data.error || "No se pudo cargar tu información");
        }

        setProfile(data.profile);
        if (showSuccess) {
          setFeedback("Perfil sincronizado correctamente.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar tu información.");
      } finally {
        setLoadingProfile(false);
      }
    },
    [resetFeedback, user?.id]
  );

  useEffect(() => {
    void loadProfileData();
  }, [loadProfileData]);

  const ensureProfileExists = useCallback(async () => {
    resetFeedback();
    setEnsuring(true);

    try {
      const payload: Record<string, unknown> = {};
      if (user?.id) {
        payload.identityAuthId = user.id;
      }

      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (response.status === 401) {
        setError("Por favor inicia sesión para configurar tu perfil.");
        return;
      }

      const data = (await response.json()) as EnsureProfileResponse & ApiErrorResponse;

      if (!response.ok) {
        throw new Error(data.error || "No se pudo configurar tu perfil");
      }

      setProfile(data.profile);
      setFeedback("¡Listo! Ahora puedes subir tu CV o comenzar a personalizar tu perfil.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al configurar tu perfil.");
    } finally {
      setEnsuring(false);
    }
  }, [resetFeedback, user?.id]);

  const handleAugment = useCallback(async () => {
    const trimmed = instructions.trim();
    if (!trimmed) {
      setError("Por favor escribe lo que te gustaría modificar en tu perfil.");
      return;
    }

    resetFeedback();
    setAugmenting(true);

    try {
      const body: Record<string, unknown> = { instructions: trimmed };
      if (user?.id) {
        body.identityAuthId = user.id;
      }

      const response = await fetch("/api/profile/augment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        credentials: "include",
      });

      if (response.status === 401) {
        throw new Error("Por favor inicia sesión para usar esta función.");
      }

      const data = (await response.json()) as AugmentResponse & ApiErrorResponse;

      if (!response.ok) {
        throw new Error(data.error || "No se pudo actualizar la información");
      }

      setProfile(data.record);
      setInstructions("");
      setFeedback("¡Cambios guardados! Revisa la vista previa o publica para ver los cambios.");

      const assistantSummary = `Actualice el JSON con ${data.profile.sections.length} secciones.`;
      const timestamp = Date.now();
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "user",
          content: trimmed,
          createdAt: timestamp,
        },
        {
          id: createMessageId(),
          role: "assistant",
          content: assistantSummary,
          createdAt: timestamp + 1,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar tu solicitud.");
    } finally {
      setAugmenting(false);
    }
  }, [instructions, resetFeedback, user?.id]);

  const handleRender = useCallback(async () => {
    resetFeedback();
    setRendering(true);

    try {
      const body: Record<string, unknown> = {
        additionalInstructions: renderInstructions.trim() || undefined,
        renderModel,
      };
      if (user?.id) {
        body.identityAuthId = user.id;
      }

      const response = await fetch("/api/profile/render", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        credentials: "include",
      });

      if (response.status === 401) {
        throw new Error("Por favor inicia sesión para publicar tu perfil.");
      }

      const data = (await response.json()) as RenderResponse & ApiErrorResponse;

      if (!response.ok) {
        throw new Error(data.error || "No se pudo publicar tu perfil");
      }

      setProfile(data.record);
      setFeedback("¡Tu perfil ha sido publicado! Puedes verlo en la URL pública.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al publicar tu perfil.");
    } finally {
      setRendering(false);
    }
  }, [renderInstructions, resetFeedback, user?.id]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-8 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Estado general</p>
            <h2 className="text-2xl font-semibold text-white">
              {profile ? "Perfil sincronizado" : "Sin datos aun"}
            </h2>
            <p className="text-sm text-slate-400">
              {profile
                ? "Administra tu información personal, edita las secciones y actualiza tu perfil web fácilmente."
                : "Comienza subiendo tu CV en PDF desde la página principal para crear tu perfil."}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => loadProfileData(true)}
              disabled={loadingProfile}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/60"
            >
              {loadingProfile ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {loadingProfile ? "Actualizando..." : "Actualizar información"}
            </button>
            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-100 transition hover:border-blue-500/60 hover:bg-blue-500/20"
              >
                Visitar pagina publica
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="flex h-full flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-lg">
          <header>
            <h3 className="text-lg font-semibold text-white">Vista previa de tu perfil</h3>
            <p className="text-xs text-slate-400">
              Así es como se verá tu perfil con los cambios actuales
            </p>
          </header>
          <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            {jsonPreview ? (
              <div className="h-full overflow-auto">
                {(() => {
                  try {
                    const data = JSON.parse(jsonPreview);
                    if (data?.sections?.length > 0) {
                      return (
                        <div className="space-y-4">
                          {data.sections.map((section: any, index: number) => (
                            <div key={index} className="rounded-xl border border-white/10 bg-slate-800/50 p-4 shadow">
                              <h4 className="mb-2 text-sm font-medium text-blue-400">{section.header}</h4>
                              <p className="whitespace-pre-line text-sm text-slate-200">
                                {section.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return (
                      <pre className="h-full overflow-auto whitespace-pre-wrap p-4 text-xs text-slate-100">
                        {jsonPreview}
                      </pre>
                    );
                  } catch (e) {
                    return (
                      <pre className="h-full overflow-auto whitespace-pre-wrap p-4 text-xs text-slate-100">
                        {jsonPreview}
                      </pre>
                    );
                  }
                })()}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">
                Aún no hay información para mostrar. Sube tu CV o comienza a editar tu perfil para ver los cambios aquí.
              </div>
            )}
          </div>
        </div>

        <div className="flex h-full flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-lg">
          <header>
            <h3 className="text-lg font-semibold text-white">Vista previa de la página</h3>
            <p className="text-xs text-slate-400">
              Vista previa de cómo se verá tu perfil web. Actualiza después de hacer cambios.
            </p>
          </header>
          <div className="flex-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
            {hasHtml ? (
              <iframe
                className="block h-[720px] w-full border-0 bg-white"
                srcDoc={previewSrcDoc}
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">
                Aún no has publicado tu perfil. Completa la información y haz clic en 'Publicar perfil'.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-8 shadow-lg">
        <header className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-blue-500/10 text-base font-semibold text-blue-200">
            <MessageSquare className="size-4" />
          </span>
          <div>
            <h3 className="text-xl font-semibold text-white">Asistente de perfil</h3>
            <p className="text-sm text-slate-400">
              Describe los cambios que deseas hacer y nuestro asistente te ayudará a aplicarlos en tu perfil.
            </p>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="flex flex-col gap-4">
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              rows={6}
              placeholder="Por ejemplo: Agrega una sección de experiencia con mi último trabajo en..."
              className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
            />
            <button
              onClick={handleAugment}
              disabled={augmenting}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              {augmenting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {augmenting ? "Procesando..." : "Actualizar perfil"}
            </button>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <h4 className="text-sm font-semibold text-slate-200">Actividad reciente</h4>
            <div className="flex max-h-64 flex-col gap-3 overflow-auto pr-1">
              {messages.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Aquí verás el historial de cambios que realices con la ayuda del asistente.
                </p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-xl px-3 py-2 text-xs ${
                      message.role === "user"
                        ? "bg-blue-500/10 text-blue-100"
                        : "bg-emerald-500/10 text-emerald-100"
                    }`}
                  >
                    <p className="font-semibold uppercase tracking-[0.2em] text-[10px] text-slate-300">
                      {message.role === "user" ? "Tu" : "Agente"}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{message.content}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-8 shadow-lg">
        <header>
          <h3 className="text-xl font-semibold text-white">Publicar tu perfil</h3>
          <p className="text-sm text-slate-400">
            Cuando estés satisfecho con los cambios, publica tu perfil para que sea visible en línea.
          </p>
        </header>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="renderModel" className="mb-2 block text-sm font-medium text-slate-300">
              Estilo de diseño
            </label>
            <select
              id="renderModel"
              value={renderModel}
              onChange={(e) => setRenderModel(e.target.value as "openai" | "gemini")}
              className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            >
              <option value="gemini">Google Gemini (gemini-2.5-pro)</option>
              <option value="openai">OpenAI (gpt-4o-mini)</option>
            </select>
          </div>
          <textarea
            value={renderInstructions}
            onChange={(event) => setRenderInstructions(event.target.value)}
            rows={4}
            placeholder="Por ejemplo: Usa colores profesionales y agrega un botón de contacto..."
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
          />
          <button
            onClick={handleRender}
            disabled={rendering || !hasJson}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {rendering ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {rendering ? "Publicando..." : "Publicar perfil"}
          </button>
          {!hasJson && (
            <p className="text-xs text-slate-400">
              Completa la información de tu perfil antes de publicar.
            </p>
          )}
        </div>
      </section>

      {(error || feedback) && (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            error
              ? "border border-rose-500/30 bg-rose-500/10 text-rose-100"
              : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
          }`}
        >
          {error ?? feedback}
        </div>
      )}
    </div>
  );
}
