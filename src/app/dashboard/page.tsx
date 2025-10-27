import { ProfileAgentPanel } from "@/components/profile-agent-panel";

export default function DashboardPage() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="absolute inset-0 -z-10 opacity-40">
        <div className="absolute left-1/2 top-24 h-[540px] w-[540px] -translate-x-1/2 rounded-full bg-blue-500/40 blur-3xl" />
        <div className="absolute left-[10%] top-1/3 h-[380px] w-[380px] rounded-full bg-sky-400/30 blur-3xl" />
        <div className="absolute bottom-12 right-16 h-[460px] w-[460px] rounded-full bg-indigo-500/30 blur-3xl" />
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 pb-24 pt-12 sm:px-10">
        <header className="space-y-2 text-white">
          <h1 className="text-3xl font-semibold">Panel de control</h1>
          <p className="text-sm text-slate-300">
            Gestiona el JSON del perfil, agrega nueva informacion y renderiza la pagina publica con IA.
          </p>
        </header>

        <ProfileAgentPanel baseUrl={baseUrl} />
      </div>
    </div>
  );
}
