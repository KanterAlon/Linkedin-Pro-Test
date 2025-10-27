# Opciones de IA para generar la página web desde el JSON de Pollinations

## Contexto actual
- El flujo vigente procesa PDFs en `/api/pdf`, extrae texto con `pdf2json` y lo reformula en JSON estructurado mediante Pollinations.
- Se busca añadir una segunda IA que, a partir del JSON, genere el HTML/CSS de una landing con la información profesional del usuario.

## Requisitos clave
1. Recibir el JSON estructurado devuelto por Pollinations (información estilo LinkedIn).
2. Generar HTML semántico y estilos (idealmente Tailwind-compatible) para desplegar una página personal.
3. Integrarse con Next.js (Node 18+) y convivir con el entorno actual.
4. Controlar costes, asegurar seguridad (XSS), mantener caché y diagnósticos.

## APIs evaluadas

### 1. OpenAI (GPT-4o-mini / GPT-4.1 / o3-mini)
- **Pros:** gran calidad, documentación abundante, SDK oficial `openai` listo para Next.js, control preciso en prompts larga.
- **Contras:** requiere API key, coste medio.
- **Precios aprox. (USD / millón tokens, 2025):**
  - GPT-4o-mini: $0.60 entrada / $1.10 salida.
  - GPT-4.1: $5 entrada / $15 salida.
- **Autenticación:**
  1. Crear cuenta en <https://platform.openai.com/>.
  2. Ir a *API Keys* > *Create new secret key*.
  3. Guardar clave en `.env.local` como `OPENAI_API_KEY` (no versionar).
- **Implementación sugerida:**
  ```ts
  import OpenAI from "openai";

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  export async function generateProfilePage(profileJson: string) {
    const prompt = `
    Eres un desarrollador front-end.
    Usa el JSON (perfil LinkedIn) para crear:
    1. HTML semántico con secciones: Hero, Experiencia, Habilidades, Contacto.
    2. Clases Tailwind (si no hay Tailwind, añade <style> fallback).
    3. Devuelve sólo JSON válido: { "html": "...", "css": "..." }.

    JSON:
    ${profileJson}
    `;

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: "Eres un generador de sitios profesional." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.output_text);
  }
  ```
- **Integración en `/api/pdf`:** después del `reformulateAsProfessionalReport`, invocar `generateProfilePage`, guardar `html/css` (en el store o disco) y servirlo en `/[username]`.
- **Extras:** cachear resultados, loguear consumo de tokens, validar/sanitizar HTML antes de renderizar.

### 2. Anthropic (Claude 3.5 Sonnet / Haiku)
- **Pros:** razonamiento fuerte, estilo natural, buen control de JSON.
- **Contras:** coste similar a OpenAI, SDK menos integrado con Next.js.
- **Uso rápido:**
  - Crear API key en <https://console.anthropic.com/>.
  - Guardar `ANTHROPIC_API_KEY` en `.env.local`.
  - Usar `@anthropic-ai/sdk` (`client.messages.create`).

### 3. Google Gemini 2.0 (Flash / Pro)
- **Pros:** precios bajos en Flash, soporte para function calling.
- **Contras:** requiere configuración de Google Cloud (facturación, IAM). Puede usar Vertex AI para producción.
- **Uso:** habilitar Gemini API, crear key, emplear el paquete `@google/generative-ai`.

### 4. Cohere (Command R+)
- **Pros:** buena generación textual y JSON estructurado, hosting en regiones específicas (compliance).
- **Contras:** menos ejemplos de generación HTML completa.
- **Uso:** <https://dashboard.cohere.com/> para keys, SDK `cohere-ai`.

### 5. Mistral (Large / Small / Codestral)
- **Pros:** Codestral está afinado en generación de código.
- **Contras:** documentación menos extensa, disponibilidad en la plataforma propia.
- **Uso:** API key en <https://console.mistral.ai/>, clients oficiales.

## Recomendación
- **Principal:** OpenAI GPT-4o-mini (o GPT-4.1 si necesitas máxima calidad).
  - Excelente soporte en Node/Next.
  - Buen balance coste-calidad.
  - Puede devolver estructura `{ html, css }` para integrar con tu routing.
- **Plan B:**
  - Mistral Codestral si priorizas generación de código puro.
  - Claude 3.5 Sonnet si prefieres estilo editorial.

## Próximos pasos sugeridos
1. Añadir en `.env.local`:
   ```bash
   OPENAI_API_KEY=tu_api_key
   ```
2. Instalar dependencia:
   ```bash
   npm install openai
   ```
3. Crear helper `src/lib/site-generator.ts` con la función `generateProfilePage` (ver ejemplo arriba).
4. Integrar el helper en `/api/pdf` tras la llamada a Pollinations.
5. Guardar el HTML/CSS generado (por ejemplo con `setUserText` o una nueva estructura en el store).
6. Renderizar la página en `/[username]` usando el HTML y CSS generados (asegurar sanitización o sandbox).
7. Añadir métricas/logging para coste y fallbacks.

## Consideraciones de seguridad y mantenimiento
- **Sanitizar HTML/CSS:** evitar XSS, especialmente si el output se sirve desde `dangerouslySetInnerHTML`.
- **Caching:** cachear o versionar resultados para reducir coste y tiempos si el usuario re-subir el mismo PDF.
- **Fallbacks:** mantener la versión textual (sin IA 2) por si la generación de página falla.
- **Monitorizar tokens:** usar `response.usage` en OpenAI para llevar control.
- **Switch de proveedor:** abstraer la generación en una interfaz (`generateProfilePage`) para cambiar de API fácilmente.

## Apéndice: otras ideas
- Añadir snippets de React/JSX en lugar de HTML plano si el proyecto evoluciona a componentes dinámicos.
- Incluir un “designer prompt” para controlar paleta de colores o layout según la industria del usuario.
- Ofrecer descarga de la landing como ZIP o despliegue directo en Vercel/Netlify vía API.
