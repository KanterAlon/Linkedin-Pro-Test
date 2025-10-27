const POLLINATIONS_API_URL = "https://text.pollinations.ai/openai";

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
        const timeout = setTimeout(() => controller.abort(), 30000);

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
    "Eres un desarrollador front-end experto en crear landing pages profesionales.",
    "Recibiras un JSON con secciones de contenido y debes generar HTML usando clases de Tailwind CSS.",
    "La respuesta debe ser un unico fragmento HTML listo para incrustar, sin etiquetas <html> ni <body>.",
    "Usa una paleta elegante y moderna, estructura el contenido con secciones bien diferenciadas.",
    "Incluye un hero con el nombre del profesional si se provee, un indice opcional y secciones bien espaciadas.",
    "No incluyas etiquetas <script> ni estilos in-line extensos, solo clases de Tailwind.",
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
