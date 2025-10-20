/**
 * Cliente para la API de Pollinations.ai
 * Documentación: https://github.com/pollinations/pollinations/blob/master/APIDOCS.md
 */

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
  token?: string
): Promise<ProfileData> {
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

  // Intentar con token primero, luego sin token
  const authStrategies = [
    { useToken: true, name: "con autenticación" },
    { useToken: false, name: "sin autenticación" },
  ];

  for (const strategy of authStrategies) {
    // Solo intentar con token si está disponible
    if (strategy.useToken && !token) continue;

    console.log(`🔄 Intentando ${strategy.name}...`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        let bodyToSend = { ...requestBody };

        // Aplicar estrategia de autenticación
        if (strategy.useToken && token) {
          headers["Authorization"] = `Bearer ${token}`;
          (bodyToSend as any).token = token;
        }

        console.log(
          `  Intento ${attempt}/${maxRetries} ${strategy.name}...`
        );

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout

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

        const data: PollinationsResponse = await response.json();

        if (!data.choices || data.choices.length === 0) {
          throw new Error("No se recibió respuesta de la IA");
        }

        const reformulatedText = data.choices[0].message.content;

        if (!reformulatedText || reformulatedText.trim().length === 0) {
          throw new Error("La IA devolvió un texto vacío");
        }

        // Parsear el JSON retornado
        let profileData: ProfileData;
        try {
          profileData = JSON.parse(reformulatedText.trim());
          
          // Validar que tenga la estructura correcta
          if (!profileData.sections || !Array.isArray(profileData.sections)) {
            throw new Error("El JSON no tiene la estructura esperada");
          }
          
          if (profileData.sections.length === 0) {
            throw new Error("El JSON no contiene secciones");
          }
          
          // Validar cada sección
          for (const section of profileData.sections) {
            if (!section.header || !section.text) {
              throw new Error("Una o más secciones tienen estructura inválida");
            }
          }
          
          console.log(`  ✅ Éxito ${strategy.name} - ${profileData.sections.length} secciones extraídas`);
        } catch (parseError: any) {
          console.error(`  ❌ Error parseando JSON: ${parseError.message}`);
          console.error(`  Respuesta recibida: ${reformulatedText.substring(0, 200)}...`);
          throw new Error(`Error parseando respuesta JSON: ${parseError.message}`);
        }

        return profileData;
      } catch (error: any) {
        lastError = error;
        
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
