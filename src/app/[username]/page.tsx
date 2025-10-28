import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Code, FileText, Sparkles } from "lucide-react";

import { ProfileRenderFlow } from "@/components/profile-render-flow";
import { getUserProfile } from "@/lib/store";

export const dynamic = "force-dynamic";

type PageParams = {
  params: Promise<{ username: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UserPage({ params, searchParams }: PageParams) {
  const { username } = await params;
  const query = searchParams ? await searchParams : {};
  const fallbackAuthIdRaw = query.authId;
  const fallbackAuthId =
    typeof fallbackAuthIdRaw === "string" ? fallbackAuthIdRaw.trim() : Array.isArray(fallbackAuthIdRaw) ? fallbackAuthIdRaw[0]?.trim() : undefined;

  const profile = await getUserProfile(username);

  if (!profile) {
    notFound();
  }

  const { userId } = await auth();
  const resolvedAuthId = userId || (fallbackAuthId ?? null);
  const isOwner = Boolean(
    resolvedAuthId && profile.auth_user_id && profile.auth_user_id === resolvedAuthId
  );

  const hasHtml = Boolean(profile.profile_html);

  // Si hay HTML renderizado, mostrarlo puro sin wrapper de LinkedIn Pro
  if (hasHtml) {
    return <ProfileRenderFlow initialProfile={profile} isOwner={isOwner} pureHtmlMode />;
  }

  // Si no hay HTML, mostrar la interfaz de generación
  const hasJson = Boolean(profile.profile_json);
  const StatusIcon = hasJson ? Code : FileText;
  const statusLabel = hasJson
    ? "Datos listos para renderizar"
    : "Texto extraido del PDF";

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="absolute inset-0 -z-10 opacity-30">
        <div className="absolute left-1/3 top-24 h-[400px] w-[400px] rounded-full bg-blue-500/30 blur-3xl" />
        <div className="absolute bottom-32 right-1/4 h-[350px] w-[350px] rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
              <StatusIcon className="size-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{profile.username}</h1>
              <p className="flex items-center gap-2 text-sm text-slate-400">
                <StatusIcon className="size-4" />
                <span>{statusLabel}</span>
              </p>
              {isOwner && (
                <p className="mt-2 text-xs text-slate-400">
                  Generando tu pagina automaticamente...
                </p>
              )}
            </div>
          </div>
          <div className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300">
            /{profile.slug}
          </div>
        </header>

        <ProfileRenderFlow initialProfile={profile} isOwner={isOwner} />
      </div>
    </div>
  );
}
