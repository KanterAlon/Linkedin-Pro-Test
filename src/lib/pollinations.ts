const POLLINATIONS_API_URL = "https://text.pollinations.ai/openai";
// Timeout configurable (ms) para la petición a Pollinations. Default: 60s
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.POLLINATIONS_TIMEOUT_MS || "60000", 10);
// Permitir desactivar verificación TLS solo si el entorno lo pide explícitamente (solo dev)
const INSECURE_TLS = process.env.POLLINATIONS_TLS_INSECURE === '1';
let warnedInsecureTls = false;

// Si está activado en env y no es producción, desactivar verificación TLS a nivel global
if (INSECURE_TLS && process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  if (!warnedInsecureTls) {
    console.warn('⚠️ TLS verification global desactivada para Pollinations (solo dev). Usa POLLINATIONS_TLS_INSECURE=0 para restaurar.');
    warnedInsecureTls = true;
  }
}

export interface PollinationsMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PollinationsRequest {
  model: string;
  messages: PollinationsMessage[];
  temperature?: number;
  reasoning_effort?: "minimal" | "low" | "medium" | "high";
  private?: boolean;
  stream?: boolean;
  response_format?: { type: "json_object" };
}

export interface ProfileSection {
  header: string;
  text: string;
}

export interface ProfileData {
  sections: ProfileSection[];
}

interface PollinationsResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1500;

// No-op function for progress updates
const updateProgress = (_progress: number, _message: string) => {
  // This is a no-op implementation that does nothing
  // Replace with actual progress update logic if needed
  console.log(`Progress: ${_progress * 100}% - ${_message}`);
};

const OPENAI_API_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_TIMEOUT_MS = Number.parseInt(process.env.OPENAI_TIMEOUT_MS || "60000", 10);
const OPENAI_MODEL_HTML = process.env.OPENAI_MODEL_HTML || "gpt-4o-mini";
const OPENAI_ORG_ID = process.env.OPENAI_ORG_ID;
const OPENAI_PROJECT_ID = process.env.OPENAI_PROJECT_ID;

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_TIMEOUT_MS = Number.parseInt(process.env.GEMINI_TIMEOUT_MS || "60000", 10);
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeContent(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }
  return trimmed;
}

async function executePollinationsRequest(
  requestBody: PollinationsRequest,
  token?: string
): Promise<string> {
  const strategies: Array<{
    name: string;
    apply: (headers: Record<string, string>, body: PollinationsRequest) => void;
    requiresToken?: boolean;
  }> = [];

  if (token) {
    strategies.push({
      name: "authenticated header",
      requiresToken: true,
      apply: (headers) => {
        headers.Authorization = `Bearer ${token}`;
      },
    });
    strategies.push({
      name: "token in body",
      requiresToken: true,
      apply: (_, body) => {
        (body as unknown as Record<string, unknown>).token = token;
      },
    });
  }

  strategies.push({
    name: "no token",
    apply: () => {},
  });

  let lastError: unknown = null;

  for (const strategy of strategies) {
    if (strategy.requiresToken && !token) {
      continue;
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const bodyToSend: PollinationsRequest = JSON.parse(JSON.stringify(requestBody));

      try {
        strategy.apply(headers, bodyToSend);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch(POLLINATIONS_API_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(bodyToSend),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorText = await response.text();

          if (response.status === 400) {
            throw new Error(`Configuracion invalida: ${errorText}`);
          }

          if ((response.status === 401 || response.status === 403) && strategy.requiresToken) {
            lastError = new Error(`Autenticacion fallida: ${errorText}`);
            break;
          }

          if (response.status === 502 || response.status === 503) {
            throw new Error(`Servicio temporalmente no disponible (${response.status})`);
          }

          throw new Error(`Pollinations API error (${response.status}): ${errorText}`);
        }

        updateProgress(0.7 + (0.2 * (attempt-1)/MAX_RETRIES), 'Recibiendo respuesta de la API...');
        const data: PollinationsResponse = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content || !content.trim()) {
          throw new Error("La IA devolvio una respuesta vacia");
        }

        return normalizeContent(content);
      } catch (error) {
        lastError = error;

        if (error instanceof Error && error.message.includes("Configuracion invalida")) {
          throw error;
        }

        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY * Math.pow(2, attempt - 1));
        }
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Error desconocido al llamar a Pollinations");
}

function parseProfileData(content: string): ProfileData {
  try {
    const parsed = JSON.parse(content) as ProfileData;

    if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      throw new Error("El JSON no contiene secciones");
    }

    for (const section of parsed.sections) {
      if (typeof section.header !== "string" || typeof section.text !== "string") {
        throw new Error("Una o mas secciones tienen estructura invalida");
      }
    }

    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    throw new Error(`Error parseando respuesta JSON: ${message}`);
  }
}

export async function reformulateAsProfessionalReport(
  extractedText: string,
  token?: string
): Promise<ProfileData> {
  const systemPrompt = [
    "Eres un asistente experto en analisis y estructuracion de informacion profesional.",
    "",
    "Tu tarea es:",
    "1. Analizar la informacion proporcionada por el usuario",
    "2. Identificar y organizar el contenido en secciones relevantes",
    "3. Reformular cada seccion con redaccion profesional, clara y coherente",
    "4. Devolver UNICAMENTE un objeto JSON valido con la siguiente estructura exacta:",
    "",
    "{",
    '  "sections": [',
    '    {"header": "Nombre de la seccion", "text": "Contenido reformulado..."}',
    '  ]',
    "}",
    "",
    "Reglas:",
    "- La fuente puede combinar TEXTO extraido del PDF y datos de Medium (p.ej., publicaciones destacadas).",
    "- Integra coherentemente la informacion de Medium en el JSON (por ejemplo, una seccion de 'Articulos destacados' o 'Publicaciones'), sin duplicar y manteniendo consistencia.",
    "- No inventes informacion",
    "- No omitas datos relevantes",
    "- Devuelve solo el JSON sin texto extra",
  ].join("\n");

  const userPrompt = [
    "Analiza el siguiente texto combinado (PDF y, si esta disponible, datos provenientes de Medium) y organiza la informacion en el JSON descrito.",
    "Si hay publicaciones/articulos de Medium, incluyelos en una seccion adecuada (p.ej., 'Articulos destacados'), resumiendo titulos y enlazando cuando sea posible.",
    "Devuelve UNICAMENTE el JSON valido.",
    "---",
    extractedText,
    "---",
  ].join("\n");

  const requestBody: PollinationsRequest = {
    model: "openai",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    reasoning_effort: "medium",
    private: true,
    stream: false,
    response_format: { type: "json_object" },
  };

  const response = await executePollinationsRequest(requestBody, token);
  return parseProfileData(response);
}

export async function augmentProfileWithInstructions(
  currentProfile: ProfileData,
  instructions: string,
  token?: string
): Promise<ProfileData> {
  const systemPrompt = [
    "Eres un asistente especializado en mantener un JSON de perfil profesional.",
    "Recibes un JSON existente y nuevas instrucciones del usuario.",
    "REGLA CRÍTICA: El JSON existente NO PUEDE SER MODIFICADO ni eliminado. Solo puedes AGREGAR nuevas secciones según las instrucciones del usuario.",
    "Si el usuario pide agregar información, crea NUEVAS secciones sin tocar las existentes.",
    "Si el usuario pide modificar algo que ya existe, crea una sección adicional complementaria sin alterar la original.",
    "Mantén la estructura exacta { sections: [{ header, text }] }.",
    "No dupliques secciones con el mismo header.",
    "Devuelve solo el JSON actualizado sin explicaciones adicionales.",
  ].join("\n");

  const userPrompt = [
    "JSON ACTUAL (NO MODIFICAR - SOLO AGREGAR):",
    "```json",
    JSON.stringify(currentProfile, null, 2),
    "```",
    "",
    "Instrucciones del usuario para AGREGAR al JSON:",
    instructions,
    "",
    "IMPORTANTE: Devuelve el JSON completo incluyendo TODAS las secciones originales sin cambios + las nuevas secciones que agregues según las instrucciones.",
    "Devuelve UNICAMENTE el JSON actualizado con formato valido.",
  ].join("\n");

  const requestBody: PollinationsRequest = {
    model: "openai",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    reasoning_effort: "medium",
    private: true,
    stream: false,
    response_format: { type: "json_object" },
  };

  const response = await executePollinationsRequest(requestBody, token);
  return parseProfileData(response);
}

export interface RenderProfileOptions {
  username?: string;
  additionalInstructions?: string;
  preferredModel?: "openai" | "gemini";
  previousHtml?: string;
}

export async function renderProfileToHtml(
  profile: ProfileData,
  options: RenderProfileOptions = {},
  token?: string
): Promise<string> {
  const systemPrompt = [
    "Eres un desarrollador front-end experto en crear landing pages y portafolios profesionales de nivel premium.",
    "Recibirás un JSON con secciones de contenido y debes generar el HTML de TODA la página usando exclusivamente clases de Tailwind CSS.",
    "Debes planificar y diseñar la página COMPLETA, no un simple maquetado: define estructura, navegación interna (anclas si aplica), hero, secciones, CTAs y footer.",
    "estilandolo completamente con tailwind y que quede los estilos finalizados y perfectos",
    "Estilo: extremadamente moderno, limpio y profesional. Usa tipografías legibles, grids fluidos, cards bien espaciadas, bordes sutiles y, si aplica, gradientes suaves o glass sutil (sin animaciones).",
    "Accesibilidad/legibilidad: garantiza alto contraste entre texto y fondo en todas las secciones. Evita texto blanco sobre fondo blanco o texto oscuro sobre fondo oscuro. Asegura tamaños y pesos de fuente adecuados.",
    "Debes establecer EXPLÍCITAMENTE el color de fondo del contenedor raíz y el color de texto con clases de Tailwind (por ejemplo: <div class=\"min-h-screen bg-white text-slate-900\"> ... o <div class=\"min-h-screen bg-slate-950 text-slate-100\"> ...).",
    "Paleta por defecto si no se especifica: tema claro con contenedor raíz <div class=\"min-h-screen bg-white text-slate-900\">... donde todo el contenido vive dentro.",
    "Si el usuario indica una paleta o color dominante (p.ej., morado/purple/violeta), DEBES aplicarlo estrictamente en el contenedor raíz y en los componentes clave usando utilidades Tailwind (bg-*, text-*, from-*, to-*).",
    "Puedes reordenar, resumir o expandir secciones para mejorar la narrativa, manteniendo coherencia con el perfil.",
    "Restricciones: SALIDA ESTRICTA = SOLO HTML con clases de Tailwind.",
    "Prohibido: Markdown (```), JSON, CSS externo o inline extensivo, <style>, <script>, frameworks o componentes.",
    "No incluyas etiquetas <html> ni <body>. Solo el fragmento HTML incrustable.",
    "Entrega: devuelve un único fragmento HTML listo para incrustar, sin comentarios.",
  ].join("\n");

  const parts: string[] = [
    "Genera el HTML para este perfil a partir del JSON:",
    JSON.stringify(profile, null, 2),
    "",
    "Debes USAR EXCLUSIVAMENTE clases de Tailwind para todos los estilos (layout, tipografia, espaciados, colores, bordes, sombras).",
    "Elige la PALETA DE COLORES de la pagina basandote en el JSON del perfil (profesion, industria, tono y palabras clave). Aplica esa paleta de forma consistente en fondo, texto, acentos, bordes y botones usando utilidades Tailwind (bg-*, text-*, from-*, to-*, border-*).",
    "Si el perfil sugiere un estilo sobrio/profesional (p. ej., backend/empresa/finanzas), usa escala slate/neutral con acentos blue/indigo/emerald. Si sugiere creativo/marketing/diseño, usa acentos purple/fuchsia/rose. Si sugiere salud/edu/verde, usa teal/emerald/sky. Asegura siempre alto contraste.",
  ];

  console.log("[RENDER-HTML] Preparando prompt HTML", {
    sections: Array.isArray(profile.sections) ? profile.sections.length : 0,
    hasUsername: Boolean(options.username),
    additionalInstructionsLength: options.additionalInstructions?.length ?? 0,
  });

  if (options.username) {
    parts.push("", `Nombre del profesional: ${options.username}`);
  }

  if (options.previousHtml) {
    parts.push(
      "",
      "HTML PREVIO (ya generado anteriormente):",
      "```html",
      options.previousHtml,
      "```",
      "",
      "INSTRUCCIONES PARA RE-RENDERIZADO:",
      "- Solo puedes usar clases de Tailwind CSS (bg-*, text-*, border-*, etc.) para todos los estilos.",
      "- NO puedes usar <style>, <script>, CSS personalizado o frameworks diferentes a Tailwind.",
      "- Si el usuario proporciona instrucciones adicionales, modifica el HTML previo según esas indicaciones manteniendo exclusivamente clases Tailwind.",
      "- Si no hay instrucciones adicionales, puedes mejorar el diseño manteniendo la estructura y contenido existente, pero siempre usando solo clases Tailwind."
    );
  }

  if (options.additionalInstructions) {
    parts.push("", "Instrucciones adicionales:", options.additionalInstructions);
    try {
      const txt = options.additionalInstructions.toLowerCase();
      const wantsPurple = /(morado|violeta|purple|lila|magenta)/.test(txt);
      if (wantsPurple) {
        parts.push(
          "",
          "Preferencia de paleta detectada: morado/purple.",
          "APLICA ESTA PALETA de forma consistente en el contenedor raíz y componentes clave usando Tailwind:",
          "- Contenedor raíz: usa bg-purple-950 text-purple-50 (tema oscuro) o bg-purple-50 text-slate-900 (tema claro) con contraste alto.",
          "- Acentos y bordes: usa escalas de purple (p. ej., from-purple-600 to-fuchsia-600, border-purple-300/40).",
          "- Botones/CTAs: variantes sólidas y sutiles en purple con hover seguro.",
        );
        console.log("[RENDER-HTML] Paleta solicitada detectada", { palette: "purple" });
      }
    } catch {}
  }

  parts.push(
    "",
    "IMPORTANTE: Devuelve ÚNICAMENTE HTML con clases de Tailwind.",
    "No devuelvas Markdown, ni bloques ``` ni JSON, ni <style>/<script>.",
    "No incluyas <html> ni <body>."
  );

  const userContent = parts.join("\n");
  console.log("[RENDER-HTML] Tamaños de prompt", {
    systemPromptChars: systemPrompt.length,
    userPromptChars: userContent.length,
    preferredModel: options.preferredModel ?? "auto",
  });

  // Helper: Intentar renderizado con OpenAI
  const tryOpenAI = async (): Promise<string> => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY no configurada");
    }
    const t0 = Date.now();
    console.log("[RENDER-HTML] Intentando con OpenAI API", { model: OPENAI_MODEL_HTML });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    };
    if (OPENAI_ORG_ID) headers["OpenAI-Organization"] = OPENAI_ORG_ID as string;
    if (OPENAI_PROJECT_ID) headers["OpenAI-Project"] = OPENAI_PROJECT_ID as string;

    const body = {
      model: OPENAI_MODEL_HTML,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
    };

    const res = await fetch(`${OPENAI_API_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    const content = data?.choices?.[0]?.message?.content as string | undefined;
    if (!content || !content.trim()) {
      throw new Error("La IA devolvio una respuesta vacia");
    }
    const dt = Date.now() - t0;
    console.log("[RENDER-HTML] ✓ Renderizado exitoso con OpenAI", { model: OPENAI_MODEL_HTML, htmlLength: content.length, ms: dt });
    return normalizeContent(content);
  };

  // Helper: Intentar renderizado con Gemini
  const tryGemini = async (): Promise<string> => {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY no configurada");
    }
    const t0 = Date.now();
    console.log("[RENDER-HTML] Intentando con Gemini API", { model: GEMINI_MODEL });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n${userContent}` }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    };

    const res = await fetch(
      `${GEMINI_API_URL}/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
    if (!content || !content.trim()) {
      throw new Error("La IA devolvio una respuesta vacia");
    }
    const dt = Date.now() - t0;
    console.log("[RENDER-HTML] ✓ Renderizado exitoso con Gemini", { model: GEMINI_MODEL, htmlLength: content.length, ms: dt });
    return normalizeContent(content);
  };

  // Helper: Fallback final a Pollinations
  const tryPollinations = async (): Promise<string> => {
    console.log("[RENDER-HTML] Usando Pollinations.ai como servicio de renderizado");
    const requestBody: PollinationsRequest = {
      model: "openai",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      reasoning_effort: "medium",
      private: true,
      stream: false,
    };

    const t1 = Date.now();
    const response = await executePollinationsRequest(requestBody, token);
    const dt2 = Date.now() - t1;
    console.log("[RENDER-HTML] ✓ Renderizado exitoso con Pollinations", { htmlLength: response.length, ms: dt2 });
    return normalizeContent(response);
  };

  // Lógica de prioridades basada en modelo preferido
  const preferred = options.preferredModel;
  const models: Array<{ name: string; fn: () => Promise<string> }> = [];

  if (preferred === "gemini") {
    models.push({ name: "Gemini", fn: tryGemini });
    models.push({ name: "OpenAI", fn: tryOpenAI });
  } else if (preferred === "openai") {
    models.push({ name: "OpenAI", fn: tryOpenAI });
    models.push({ name: "Gemini", fn: tryGemini });
  } else {
    // Auto: priorizar OpenAI si está disponible, luego Gemini
    if (process.env.OPENAI_API_KEY) models.push({ name: "OpenAI", fn: tryOpenAI });
    if (process.env.GEMINI_API_KEY) models.push({ name: "Gemini", fn: tryGemini });
  }

  // Intentar con cada modelo en orden
  for (const { name, fn } of models) {
    try {
      return await fn();
    } catch (error) {
      console.warn(`[RENDER-HTML] ✗ Fallo ${name}`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Fallback final: Pollinations
  return await tryPollinations();
}
