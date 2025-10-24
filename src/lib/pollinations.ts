/**
 * Cliente para la API de Pollinations.ai
 * Documentación: https://github.com/pollinations/pollinations/blob/master/APIDOCS.md
 */

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

export interface PollinationsResponse {
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
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Espera un tiempo especificado (para retry logic)
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reformula un texto extraído de un PDF como un informe formal profesional
 * utilizando GPT-5 de Pollinations.ai con retry logic
 * Retorna los datos estructurados en formato JSON
 */
export async function reformulateAsProfessionalReport(
  extractedText: string,
  token?: string,
  progressCallback?: (progress: number) => void
): Promise<ProfileData> {
  
  const updateProgress = (progress: number, message: string) => {
    if (progressCallback) progressCallback(progress);
    console.log(`[Progreso ${Math.round(progress * 100)}%] ${message}`);
  };
  const systemPrompt = `Eres un asistente experto en análisis y estructuración de información profesional.

Tu tarea es:
1. Analizar la información proporcionada por el usuario
2. Identificar y organizar el contenido en secciones relevantes
3. Reformular cada sección con redacción profesional, clara y coherente
4. Devolver ÚNICAMENTE un objeto JSON válido con la siguiente estructura exacta:

{
  "sections": [
    {"header": "Nombre de la sección", "text": "Contenido reformulado..."},
    {"header": "Otra sección", "text": "Más contenido..."}
  ]
}

Secciones comunes a identificar (incluir solo las que tengan información):
- Sobre mí / Perfil profesional
- Experiencia laboral / Experiencia
- Educación / Formación académica
- Habilidades / Competencias
- Certificaciones
- Proyectos
- Idiomas
- Premios y reconocimientos

REGLAS IMPORTANTES:
- NO añadas información que no esté presente en el texto original
- NO omitas información importante del texto original
- MANTÉN la precisión y veracidad de todos los datos
- Devuelve SOLO el JSON, sin texto adicional antes o después
- Asegúrate de que el JSON sea válido y parseable`;

  const userPrompt = `Analiza el siguiente texto extraído de un PDF y organízalo en secciones estructuradas. Devuelve ÚNICAMENTE un JSON válido con el formato especificado:

---
${extractedText}
---

Recuerda: devuelve SOLO el objeto JSON, nada más.`;

  const requestBody: PollinationsRequest = {
    model: "openai", // GPT-5 mini (el más avanzado disponible)
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    // GPT-5 solo acepta temperature: 1 (valor por defecto)
    // No incluimos temperature para usar el valor por defecto
    reasoning_effort: "medium", // Balance entre calidad y velocidad
    private: true, // No aparecer en el feed público
    stream: false,
    response_format: { type: "json_object" }, // Forzar respuesta en JSON
  };

  const maxRetries = 3;
  const retryDelay = 2000; // 2 segundos inicial
  let lastError: Error | null = null;

  // Actualizar progreso inicial
  updateProgress(0.1, 'Preparando solicitud a la API...');
  
  // Intentar con token primero, luego sin token
  const authStrategies = [
    { useToken: true, name: "con autenticación" },
    { useToken: false, name: "sin autenticación" },
  ];

  for (const strategy of authStrategies) {
    // Solo intentar con token si está disponible
    if (strategy.useToken && !token) continue;

    updateProgress(0.2, `Intentando conexión ${strategy.name}...`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        let bodyToSend = { ...requestBody };

        // Aplicar estrategia de autenticación
        if (strategy.useToken && token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        updateProgress(0.2 + (0.2 * (attempt-1)/maxRetries), 
          `Intento ${attempt}/${maxRetries} ${strategy.name}...`
        );

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS); // Timeout configurable por env

        updateProgress(0.4 + (0.3 * (attempt-1)/maxRetries), 'Enviando solicitud a la API...');
        // Si se pide explícitamente y no es producción, desactivar verificación TLS (solo para entornos con MITM/proxy)
        if (INSECURE_TLS && process.env.NODE_ENV !== 'production') {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
          if (!warnedInsecureTls) {
            console.warn('⚠️ TLS verification desactivada para Pollinations (solo dev). Usa POLLINATIONS_TLS_INSECURE=0 para restaurar.');
            warnedInsecureTls = true;
          }
        }

        const response = await fetch(POLLINATIONS_API_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(bodyToSend),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorText = await response.text();
          
          // Si es 400 (Bad Request), no reintentar - es un error de configuración
          if (response.status === 400) {
            console.error(`  🚫 Error 400 (configuración inválida): ${errorText.substring(0, 200)}...`);
            throw new Error(`Configuración inválida: ${errorText}`);
          }
          
          // Si es 502/503, reintentar
          if (response.status === 502 || response.status === 503) {
            throw new Error(`Servicio temporalmente no disponible (${response.status})`);
          }
          
          // Si es 401/403 con token, probar sin token
          if ((response.status === 401 || response.status === 403) && strategy.useToken) {
            console.log(`  ⚠️ Error de autenticación, probando sin token...`);
            break; // Salir del loop de reintentos e intentar siguiente estrategia
          }

          throw new Error(
            `Pollinations API error (${response.status}): ${errorText}`
          );
        }

        updateProgress(0.7 + (0.2 * (attempt-1)/maxRetries), 'Recibiendo respuesta de la API...');
        const data: PollinationsResponse = await response.json();

        if (!data.choices || data.choices.length === 0) {
          throw new Error("No se recibió respuesta de la IA");
        }

        const reformulatedText = data.choices[0].message.content;

        if (!reformulatedText || reformulatedText.trim().length === 0) {
          throw new Error("La IA devolvió un texto vacío");
        }

        updateProgress(0.9 + (0.1 * (attempt-1)/maxRetries), 'Procesando respuesta...');
        
        // Intentar extraer el JSON de la respuesta
        let jsonResponse: any;
        try {
          jsonResponse = JSON.parse(reformulatedText.trim());
          
          // Validar la estructura de la respuesta
          updateProgress(0.98, 'Validando datos...');
          if (!jsonResponse || !Array.isArray(jsonResponse.sections)) {
            throw new Error("Formato de respuesta inesperado de la API");
          }
          
          if (jsonResponse.sections.length === 0) {
            throw new Error("El JSON no contiene secciones");
          }
          
          // Validar cada sección
          for (const section of jsonResponse.sections) {
            if (!section.header || !section.text) {
              throw new Error("Una o más secciones tienen estructura inválida");
            }
          }
          
          console.log(`  ✅ Éxito ${strategy.name} - ${jsonResponse.sections.length} secciones extraídas`);
        } catch (parseError: any) {
          console.error(`  ❌ Error parseando JSON: ${parseError.message}`);
          console.error(`  Respuesta recibida: ${reformulatedText.substring(0, 200)}...`);
          throw new Error(`Error parseando respuesta JSON: ${parseError.message}`);
        }

        updateProgress(1.0, 'Procesamiento completado con éxito');
        return jsonResponse as ProfileData;
      } catch (error: any) {
        lastError = error;
        // Logs enriquecidos para diagnosticar 'fetch failed' (errores de red/TLS/DNS)
        const extra: Record<string, any> = {};
        try {
          extra.name = error?.name;
          extra.code = (error as any)?.code || (error?.cause && (error.cause as any).code);
          extra.errno = (error as any)?.errno;
          extra.syscall = (error as any)?.syscall;
          extra.type = (error as any)?.type;
          if (error?.cause) {
            extra.cause = {
              name: (error.cause as any)?.name,
              code: (error.cause as any)?.code,
              errno: (error.cause as any)?.errno,
              syscall: (error.cause as any)?.syscall,
              message: (error.cause as any)?.message,
            };
          }
        } catch {}
        if (Object.keys(extra).length) {
          console.error("  🔎 Detalles del error de red:", extra);
        }
        
        // Si es un error 400, no tiene sentido reintentar
        if (error.message && error.message.includes("Configuración inválida")) {
          console.error(`  ⛔ Error de configuración detectado - abortando reintentos`);
          throw error; // Lanzar inmediatamente sin más intentos
        }
        
        // Si es timeout o red
        if (error.name === "AbortError") {
          console.error(`  ⏱️ Timeout en intento ${attempt}`);
        } else {
          console.error(`  ❌ Error en intento ${attempt}: ${error.message}`);
        }

        // Si no es el último intento, esperar antes de reintentar
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`  ⏳ Esperando ${delay}ms antes de reintentar...`);
          await sleep(delay);
        }
      }
    }
  }

  // Si llegamos aquí, todos los intentos fallaron
  console.error("❌ Todos los intentos fallaron");
  throw lastError || new Error("Error desconocido al llamar a Pollinations.ai");
}
