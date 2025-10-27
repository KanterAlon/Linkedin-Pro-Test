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
          setError("Debes iniciar sesion para ver tu perfil.");
          return;
        }

        if (response.status === 404) {
          setProfile(null);
          if (showSuccess) {
            setFeedback("Sube tu PDF desde la pagina principal para preparar tu perfil.");
          }
          return;
        }

        const data = (await response.json()) as GetProfileResponse & ApiErrorResponse;

        if (!response.ok) {
          throw new Error(data.error || "No se pudo cargar el perfil");
        }

        setProfile(data.profile);
        if (showSuccess) {
          setFeedback("Perfil sincronizado correctamente.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando el perfil.");
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
        setError("Debes iniciar sesion para preparar tu perfil.");
        return;
      }

      const data = (await response.json()) as EnsureProfileResponse & ApiErrorResponse;

      if (!response.ok) {
        throw new Error(data.error || "No se pudo preparar el perfil");
      }

      setProfile(data.profile);
      setFeedback("Perfil listo. Ahora puedes subir un PDF o trabajar con el agente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error preparando el perfil.");
    } finally {
      setEnsuring(false);
    }
  }, [resetFeedback, user?.id]);

  const handleAugment = useCallback(async () => {
    const trimmed = instructions.trim();
    if (!trimmed) {
      setError("Escribe instrucciones antes de enviar.");
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
        throw new Error("Debes iniciar sesion para usar el agente.");
      }

      const data = (await response.json()) as AugmentResponse & ApiErrorResponse;

      if (!response.ok) {
        throw new Error(data.error || "No se pudo actualizar el JSON");
      }

      setProfile(data.record);
      setInstructions("");
      setFeedback("JSON actualizado. Renderiza la pagina para aplicar los cambios.");

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
      setError(err instanceof Error ? err.message : "Error al interactuar con el agente.");
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
        throw new Error("Debes iniciar sesion para renderizar la pagina.");
      }

      const data = (await response.json()) as RenderResponse & ApiErrorResponse;

      if (!response.ok) {
        throw new Error(data.error || "No se pudo renderizar la pagina");
      }

      setProfile(data.record);
      setFeedback("Pagina renderizada y guardada. Abre la URL publica para revisarla.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error renderizando la pagina.");
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
                ? "Gestiona tu JSON, enriquece las secciones y renderiza la pagina final con un solo clic."
                : "Todavia no hemos procesado ningun PDF para tu cuenta. Sube uno desde la pagina principal o prepara un perfil vacio."}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => loadProfileData(true)}
              disabled={loadingProfile}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/60"
            >
              {loadingProfile ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {loadingProfile ? "Sincronizando..." : "Sincronizar datos"}
            </button>
            <button
              onClick={ensureProfileExists}
              disabled={ensuring}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/60"
            >
              {ensuring ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {ensuring ? "Preparando..." : "Preparar perfil vacio"}
            </button>
            {publicUrl && (
              <Link
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-100 transition hover:border-blue-500/60 hover:bg-blue-500/20"
              >
                Visitar pagina publica
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="flex h-full flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-lg">
          <header>
            <h3 className="text-lg font-semibold text-white">JSON actual en Supabase</h3>
            <p className="text-xs text-slate-400">
              Este es el contenido estructurado que se utiliza para renderizar tu pagina.
            </p>
          </header>
          <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
            {jsonPreview ? (
              <pre className="h-full overflow-auto whitespace-pre-wrap p-4 text-xs text-slate-100">
                {jsonPreview}
              </pre>
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">
                Aun no tenemos JSON generado. Procesa un PDF o usa el agente para crear contenido.
              </div>
            )}
          </div>
        </div>

        <div className="flex h-full flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-lg">
          <header>
            <h3 className="text-lg font-semibold text-white">Previsualizacion del HTML</h3>
            <p className="text-xs text-slate-400">
              Esta es la ultima version renderizada. Vuelve a generar cuando actualices el JSON.
            </p>
          </header>
          <div className="flex-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
            {hasHtml ? (
              <div
                className="h-full overflow-auto px-4 py-6 text-sm"
                dangerouslySetInnerHTML={{ __html: profile?.profile_html ?? "" }}
              />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">
                Aun no has renderizado la pagina. Hazlo desde el paso de renderizado.
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
            <h3 className="text-xl font-semibold text-white">Agente IA para enriquecer tu perfil</h3>
            <p className="text-sm text-slate-400">
              Pega textos, nuevas experiencias o instrucciones detalladas. El agente actualizara el JSON por ti.
            </p>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="flex flex-col gap-4">
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              rows={6}
              placeholder="Ejemplo: agrega una seccion de proyectos con el siguiente texto..."
              className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
            />
            <button
              onClick={handleAugment}
              disabled={augmenting}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              {augmenting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {augmenting ? "Actualizando JSON..." : "Enviar al agente IA"}
            </button>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <h4 className="text-sm font-semibold text-slate-200">Historial reciente</h4>
            <div className="flex max-h-64 flex-col gap-3 overflow-auto pr-1">
              {messages.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No hay mensajes aun. Envia instrucciones para ver los cambios que hace el agente.
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
          <h3 className="text-xl font-semibold text-white">Renderizar pagina final</h3>
          <p className="text-sm text-slate-400">
            Cuando el JSON este listo, genera un nuevo HTML. Puedes anadir indicaciones sobre estilo o estructura.
          </p>
        </header>

        <div className="mt-6 space-y-4">
          <textarea
            value={renderInstructions}
            onChange={(event) => setRenderInstructions(event.target.value)}
            rows={4}
            placeholder="Ejemplo: usa una paleta morada y agrega un llamado a la accion al final..."
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
          />
          <button
            onClick={handleRender}
            disabled={rendering || !hasJson}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {rendering ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {rendering ? "Generando HTML..." : "Renderizar pagina"}
          </button>
          {!hasJson && (
            <p className="text-xs text-slate-400">
              Genera primero el JSON (subiendo un PDF o usando el agente) para poder renderizar.
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
