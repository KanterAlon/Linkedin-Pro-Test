import { NextRequest, NextResponse } from "next/server";
import { setUserText } from "@/lib/store";
import { reformulateAsProfessionalReport, type ProfileData } from "@/lib/pollinations";
import PDFParser from "pdf2json";

// Barra de progreso precisa y bonita para consola del backend
class ProgressBar {
  private width = 28;
  private startedAt = Date.now();
  private lastRender = 0;
  private isTTY = !!(process.stdout && (process.stdout as any).isTTY && process.stdout.cursorTo);
  private currentPct = 0;

  set(pct: number, message: string) {
    const now = Date.now();
    this.currentPct = Math.max(0, Math.min(100, pct));
    // Limitar renders a ~30fps para no spamear logs
    if (this.isTTY && now - this.lastRender < 33 && this.currentPct < 100) return;
    this.lastRender = now;

    const p = this.currentPct / 100;
    const filled = Math.round(this.width * p);
    const empty = this.width - filled;
    const bar = `${"█".repeat(filled)}${"░".repeat(empty)}`;
    const elapsedMs = now - this.startedAt;
    const elapsed = this.fmtTime(elapsedMs);
    const percent = String(Math.round(this.currentPct)).padStart(3, " ");
    const line = `[${bar}] ${percent}% | ${elapsed} | ${message}`;

    if (this.isTTY) {
      process.stdout.cursorTo!(0);
      process.stdout.write(line);
      if (this.currentPct >= 100) process.stdout.write("\n");
    } else {
      console.log(line);
    }
  }

  done(message = "Completado") {
    this.set(100, `✅ ${message}`);
  }

  private fmtTime(ms: number) {
    const s = Math.floor(ms / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }
}

export const runtime = "nodejs";

function sanitizeUsername(username: string): string {
  // Reemplazar caracteres problemáticos con guiones
  return username.replace(/[^a-zA-Z0-9-_]/g, "-");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const username = String(formData.get("username") || "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo PDF requerido en 'file'" }, { status: 400 });
    }
    if (!username) {
      return NextResponse.json({ error: "'username' es requerido" }, { status: 400 });
    }

    console.log(`📄 Procesando PDF para usuario: ${username}\n`);

    const pb = new ProgressBar();
    pb.set(2, 'Validando entrada...');

    // Etapa 1: Leer el archivo
    pb.set(12, 'Leyendo archivo...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Etapa 2: Iniciar parser de PDF
    pb.set(28, 'Inicializando parser PDF...');
    const pdfParser = new (PDFParser as any)(null, 1);

    const text = await new Promise<string>((resolve, reject) => {
      pdfParser.on("pdfParser_dataError", (errData: any) => {
        pb.set(50, '❌ Error extrayendo texto');
        reject(new Error(errData.parserError));
      });

      // Nota: pdf2json no emite progreso por páginas aquí; marcamos hitos
      pdfParser.on("pdfParser_dataReady", () => {
        pb.set(52, 'Texto extraído del PDF');
        const rawText = (pdfParser as any).getRawTextContent();
        resolve(rawText);
      });

      pb.set(34, 'Parseando PDF...');
      pdfParser.parseBuffer(buffer);
    });

    const trimmedText = text.trim();

    if (!trimmedText) {
      pb.set(50, '❌ No se pudo extraer texto del PDF');
      return NextResponse.json({ error: "No se pudo extraer texto del PDF" }, { status: 400 });
    }

    pb.set(56, `Texto extraído (${trimmedText.length} chars)`);

    // Procesar con IA de Pollinations.ai (GPT-5)
    pb.set(60, 'Preparando procesamiento con IA...');
    const pollinationsToken = process.env.POLLINATIONS_API_TOKEN;
    
    if (!pollinationsToken) {
      console.log(`\n⚠️ POLLINATIONS_API_TOKEN no configurado, se usará acceso sin autenticación`);
    } else {
      console.log(`\n🔑 Token de Pollinations configurado`);
    }

    console.log(`🤖 Procesando con IA (GPT-5)...\n`);

    let profileData: ProfileData | null = null;
    let processedWithAI = false;

    try {
      // Progreso de IA mapeado a 60-95%
      const progressCallback = (progress: number) => {
        const pct = 60 + Math.max(0, Math.min(1, progress)) * 35; // 60 -> 95
        pb.set(pct, `IA: ${Math.round(progress * 100)}%`);
      };

      profileData = await reformulateAsProfessionalReport(trimmedText, pollinationsToken, progressCallback);
      pb.set(97, `IA completada - ${profileData.sections.length} secciones`);
      console.log(`\n✨ Datos estructurados por IA - ${profileData.sections.length} secciones`);
      processedWithAI = true;
    } catch (aiError: any) {
      pb.set(95, `⚠️ Error IA, usando texto original`);
      console.error(`\n⚠️ Error en procesamiento de IA: ${aiError.message}`);
      console.log(`📝 Fallback: usando texto original sin reformular`);
      processedWithAI = false;
    }

    // Convertir a JSON string para almacenar
    const dataToStore = profileData 
      ? JSON.stringify(profileData, null, 2)
      : trimmedText;

    pb.set(98, 'Almacenando resultados...');
    setUserText(username, dataToStore);

    // Sanitizar el username para la URL
    const sanitizedUsername = sanitizeUsername(username);

    console.log(`\n✅ PDF procesado exitosamente: ${username} -> ${sanitizedUsername}`);
    console.log(`📊 Estado: IA ${processedWithAI ? 'ACTIVADA ✓' : 'DESACTIVADA (fallback)'}`);

    pb.done('Proceso finalizado');

    return NextResponse.json({ 
      ok: true, 
      path: `/${sanitizedUsername}`,
      processed_with_ai: processedWithAI,
      sections_count: profileData?.sections.length || 0
    });
  } catch (err: any) {
    console.error(`❌ Error procesando PDF:`, err);
    // Asegurar salto de línea si la barra quedó en la misma línea
    try { if (process.stdout && (process.stdout as any).cursorTo) process.stdout.write('\n'); } catch {}
    return NextResponse.json({ error: err?.message || "Error procesando PDF" }, { status: 500 });
  }
}
