import { notFound } from "next/navigation";
import { getUserText } from "@/lib/store";
import { FileText, Sparkles, Code } from "lucide-react";

export default async function UserPage({ 
  params 
}: { 
  params: Promise<{ username: string }> 
}) {
  const { username } = await params;
  
  console.log(`🔍 Buscando texto para usuario: ${username}`);
  
  const rawText = getUserText(username);

  console.log(`📄 Texto encontrado: ${rawText ? 'SÍ' : 'NO'}`);

  if (!rawText) {
    console.log(`❌ Usuario no encontrado: ${username}`);
    notFound();
  }

  // Verificar si es JSON válido (procesado por IA)
  let isJson = false;
  try {
    JSON.parse(rawText);
    isJson = true;
  } catch {
    // No es JSON válido
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Background Effects */}
      <div className="absolute inset-0 -z-10 opacity-30">
        <div className="absolute left-1/3 top-24 h-[400px] w-[400px] rounded-full bg-blue-500/30 blur-3xl" />
        <div className="absolute bottom-32 right-1/4 h-[350px] w-[350px] rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        {/* Header */}
        <header className="mb-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
              {isJson ? <Code className="size-6" /> : <FileText className="size-6" />}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{username}</h1>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Sparkles className="size-4" />
                <span>
                  {isJson 
                    ? "Datos JSON generados con IA (GPT-5)"
                    : "Contenido extraído del PDF"
                  }
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <article className="rounded-3xl border border-white/10 bg-slate-950/60 p-8 backdrop-blur-sm shadow-2xl">
          <pre className="text-sm text-slate-100 leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono">
            {rawText}
          </pre>
        </article>

        {/* Footer Info */}
        <footer className="mt-8 text-center text-sm text-slate-400">
          <p>
            {isJson 
              ? "Estos datos JSON fueron generados automáticamente desde un PDF usando inteligencia artificial."
              : "Este contenido fue extraído automáticamente desde un PDF."
            }
          </p>
        </footer>
      </div>
    </div>
  );
}
