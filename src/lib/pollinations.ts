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
        (body as Record<string, unknown>).token = token;
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
    "- No inventes informacion",
    "- No omitas datos relevantes",
    "- Devuelve solo el JSON sin texto extra",
  ].join("\n");

  const userPrompt = [
    "Analiza el siguiente texto extraido de un PDF y organiza la informacion en el JSON descrito.",
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
    "Debes actualizar el JSON agregando o modificando secciones segun las instrucciones.",
    "Mantén la estructura exacta { sections: [{ header, text }] }.",
    "No dupliques secciones, fusiona contenidos cuando corresponda.",
    "Devuelve solo el JSON actualizado sin explicaciones adicionales.",
  ].join("\n");

  const userPrompt = [
    "JSON actual:",
    JSON.stringify(currentProfile, null, 2),
    "",
    "Instrucciones del usuario:",
    instructions,
    "",
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
}

export async function renderProfileToHtml(
  profile: ProfileData,
  options: RenderProfileOptions = {},
  token?: string
): Promise<string> {
  const systemPrompt = [
    "Eres un desarrollador front-end experto en crear landing pages profesionales y portafolios.",
    "Recibirás un JSON con secciones de contenido y debes generar HTML usando clases de Tailwind CSS.",
    "Planifica integralmente el diseño de la página basándote en el contenido y el contexto del perfil: define jerarquía visual, layout, ritmo vertical, tipografía y una paleta consistente.",
    "Tienes libertad creativa total para diseñar y componer una página completa desde cero: puedes reordenar, resumir o expandir secciones, crear bloques y layouts originales, y proponer estructura de navegación dentro del fragmento (anclas internas, índice, etc.) siempre que el resultado sea coherente con el perfil.",
    "La respuesta debe ser un único fragmento HTML listo para incrustar, sin etiquetas <html> ni <body>.",
    "Usa una estética elegante y moderna; separa claramente secciones y cuida el espaciado.",
    "Incluye un hero destacado con el nombre del profesional si se provee, y un índice/TOC opcional cuando mejore la exploración.",
    "Optimiza para legibilidad y responsividad (mobile-first).",
    "No incluyas etiquetas <script> ni estilos in-line extensos: solo clases de Tailwind.",
  ].join("\n");

  const parts: string[] = [
    "Genera el HTML para este perfil a partir del JSON:",
    JSON.stringify(profile, null, 2),
  ];

  if (options.username) {
    parts.push("", `Nombre del profesional: ${options.username}`);
  }

  if (options.additionalInstructions) {
    parts.push("", "Instrucciones adicionales:", options.additionalInstructions);
  }

  parts.push("", "Devuelve solo el HTML sin comentarios ni bloques de codigo.");

  if (process.env.OPENAI_API_KEY) {
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
        { role: "user", content: parts.join("\n") },
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
    return normalizeContent(content);
  }

  const requestBody: PollinationsRequest = {
    model: "openai",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: parts.join("\n") },
    ],
    reasoning_effort: "medium",
    private: true,
    stream: false,
  };

  const response = await executePollinationsRequest(requestBody, token);
  return normalizeContent(response);
}
