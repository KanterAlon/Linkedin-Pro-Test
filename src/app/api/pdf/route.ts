import { NextRequest, NextResponse } from "next/server";
import { setUserText } from "@/lib/store";
import { reformulateAsProfessionalReport, type ProfileData } from "@/lib/pollinations";
import PDFParser from "pdf2json";

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

    console.log(`📄 Procesando PDF para usuario: ${username}`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extraer texto usando pdf2json
    const pdfParser = new (PDFParser as any)(null, 1);
    
    const text = await new Promise<string>((resolve, reject) => {
      pdfParser.on("pdfParser_dataError", (errData: any) => {
        reject(new Error(errData.parserError));
      });
      
      pdfParser.on("pdfParser_dataReady", () => {
        const rawText = (pdfParser as any).getRawTextContent();
        resolve(rawText);
      });
      
      pdfParser.parseBuffer(buffer);
    });

    const trimmedText = text.trim();
    
    if (!trimmedText) {
      return NextResponse.json({ error: "No se pudo extraer texto del PDF" }, { status: 400 });
    }

    console.log(`✅ Texto extraído (${trimmedText.length} caracteres)`);
    
    // Procesar con IA de Pollinations.ai (GPT-5)
    const pollinationsToken = process.env.POLLINATIONS_API_TOKEN;
    
    if (!pollinationsToken) {
      console.log(`⚠️ POLLINATIONS_API_TOKEN no configurado, se usará acceso sin autenticación`);
    } else {
      console.log(`🔑 Token de Pollinations configurado`);
    }
    
    console.log(`🤖 Procesando con IA (GPT-5)...`);
    
    let profileData: ProfileData | null = null;
    let processedWithAI = false;
    
    try {
      profileData = await reformulateAsProfessionalReport(trimmedText, pollinationsToken);
      console.log(`✨ Datos estructurados por IA - ${profileData.sections.length} secciones`);
      processedWithAI = true;
    } catch (aiError: any) {
      console.error(`⚠️ Error en procesamiento de IA: ${aiError.message}`);
      console.log(`📝 Fallback: usando texto original sin reformular`);
      processedWithAI = false;
    }

    // Convertir a JSON string para almacenar
    const dataToStore = profileData 
      ? JSON.stringify(profileData, null, 2)
      : trimmedText;

    setUserText(username, dataToStore);

    // Sanitizar el username para la URL
    const sanitizedUsername = sanitizeUsername(username);

    console.log(`✅ PDF procesado exitosamente: ${username} -> ${sanitizedUsername}`);
    console.log(`📊 Estado: IA ${processedWithAI ? 'ACTIVADA ✓' : 'DESACTIVADA (fallback)'}`);

    return NextResponse.json({ 
      ok: true, 
      path: `/${sanitizedUsername}`,
      processed_with_ai: processedWithAI,
      sections_count: profileData?.sections.length || 0
    });
  } catch (err: any) {
    console.error(`❌ Error procesando PDF:`, err);
    return NextResponse.json({ error: err?.message || "Error procesando PDF" }, { status: 500 });
  }
}
