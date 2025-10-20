import Link from "next/link";
import {
  ArrowRight,
  FileText,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import type { Route } from "next";

import { PdfUploader } from "@/components/pdf-uploader";

const features = [
  {
    title: "Portafolio listo en minutos",
    description:
      "Analizamos tu histórico laboral, logros y habilidades para construir un sitio con secciones inteligentes.",
    icon: Sparkles,
  },
  {
    title: "Curaduría automática",
    description:
      "Seleccionamos la información más relevante de tu exportación para resaltar proyectos, certificaciones y recomendaciones.",
    icon: LayoutDashboard,
  },
  {
    title: "Control de privacidad",
    description:
      "Revisa y edita cada bloque antes de publicar. Nada se comparte sin tu aprobación explícita.",
    icon: ShieldCheck,
  },
];

const steps = [
  {
    title: "Exporta tus datos de LinkedIn",
    description:
      "Desde la configuración de privacidad de LinkedIn descarga el archivo completo con tu información profesional.",
  },
  {
    title: "Arrastra el archivo aquí",
    description:
      "Procesamos tu historial y generamos un boceto editable con identidad visual moderna y compatible con SEO.",
  },
  {
    title: "Personaliza y publica",
    description:
      "Añade testimonios, showcase de proyectos y conecta tu dominio en un flujo guiado paso a paso.",
  },
];

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-40">
        <div className="absolute left-1/2 top-24 h-[540px] w-[540px] -translate-x-1/2 rounded-full bg-blue-500/40 blur-3xl" />
        <div className="absolute left-[10%] top-1/3 h-[380px] w-[380px] rounded-full bg-sky-400/30 blur-3xl" />
        <div className="absolute bottom-12 right-16 h-[460px] w-[460px] rounded-full bg-indigo-500/30 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-20 px-6 pb-24 pt-12 sm:px-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-white/10 text-xl font-semibold text-white">
              LP
            </div>
            <div>
              <p className="text-lg font-semibold text-white">LinkedIn Pro Portfolio</p>
              <p className="text-xs text-slate-300">
                Construye tu portafolio con datos reales y en minutos.
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-4 text-sm text-slate-200">
            <Link
              href="#features"
              className="rounded-full px-4 py-2 font-medium transition hover:bg-white/10"
            >
              Características
            </Link>
            <Link
              href="#steps"
              className="rounded-full px-4 py-2 font-medium transition hover:bg-white/10"
            >
              ¿Cómo funciona?
            </Link>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="rounded-full bg-white px-4 py-2 font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100">
                  Iniciar sesión
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </nav>
        </header>

        <main className="grid gap-16 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-20">
          <div className="space-y-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
              Potencia tu marca personal
            </span>
            <div className="space-y-6">
              <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
                Convierte tu perfil de LinkedIn en un portafolio interactivo con IA y diseño profesional.
              </h1>
              <p className="max-w-xl text-lg text-slate-200">
                Sube la exportación oficial de LinkedIn y consigue en segundos un portafolio personalizable con secciones listas para compartir con reclutadores o clientes.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-400">
                    Empieza gratis
                    <ArrowRight className="size-4" />
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Link
                  href={"/dashboard" as Route}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-400"
                >
                  Ir al panel
                  <ArrowRight className="size-4" />
                </Link>
              </SignedIn>
              <Link
                href="#steps"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/10"
              >
                Ver proceso
              </Link>
            </div>

            <div className="grid gap-6 sm:grid-cols-3" id="features">
              {features.map(({ title, description, icon: Icon }) => (
                <div
                  key={title}
                  className="group rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-blue-400/60 hover:bg-blue-500/5"
                >
                  <div className="mb-4 inline-flex rounded-2xl bg-blue-500/10 p-3 text-blue-300">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="text-base font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm text-slate-300">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-[32px] border border-white/10 bg-white/10 p-8 backdrop-blur">
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-white">
                  Sube tu archivo exportado
                </h2>
                <p className="text-sm text-slate-200">
                  Usamos el ZIP o JSON de LinkedIn para generar la estructura inicial de tu portafolio.
                </p>
              </div>
              <PdfUploader />
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
                <p className="flex items-center gap-2 text-slate-200">
                  <FileText className="size-4 text-blue-300" /> Seguridad al primer lugar
                </p>
                <p className="mt-2">
                  Procesamos tu información de manera temporal y cifrada. Puedes eliminarla en cualquier momento desde tu panel.
                </p>
              </div>
            </div>
          </aside>
        </main>

        <section className="rounded-[40px] border border-white/10 bg-slate-950/40 p-10" id="steps">
          <div className="grid gap-10 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="space-y-4">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-white/10 text-base font-semibold text-white">
                  {index + 1}
                </span>
                <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                <p className="text-sm text-slate-300">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="flex flex-col items-center justify-between gap-6 border-t border-white/10 py-8 text-sm text-slate-400 md:flex-row">
          <p>© {new Date().getFullYear()} LinkedIn Pro Portfolio. Todos los derechos reservados.</p>
          <div className="flex items-center gap-6">
            <Link href="mailto:hola@linkedinproport.com" className="transition hover:text-white">
              Contacto
            </Link>
            <Link href="/terminos" className="transition hover:text-white">
              Términos
            </Link>
            <Link href="/privacidad" className="transition hover:text-white">
              Privacidad
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
