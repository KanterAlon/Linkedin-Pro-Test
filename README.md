# LinkedIn Pro Portfolio

Aplicacion Next.js 15 que transforma la exportacion de datos de LinkedIn en un portafolio profesional. Utiliza Clerk para autenticacion, Supabase para persistencia y Pollinations.ai para organizar y renderizar informacion con IA.

## Resumen de actualizaciones recientes

- **Identidad centralizada:** El backend obtiene `username`, `slug` y `auth_user_id` a partir de la identidad de Clerk. Si `currentUser` no esta disponible (por ejemplo, falta `CLERK_SECRET_KEY` en el servidor), el cliente envia un `identityAuthId` que permite concluir el flujo igualmente.
- **Logs detallados:** Los handlers `/api/pdf`, `/api/profile/augment` y `/api/profile/render` escriben trazas explicitas (prefijos `[PDF]`, `[AUGMENT]`, `[RENDER]`) con informacion sobre identidad, tamanos de texto, llamadas a Pollinations y estado final en Supabase.
- **Flujo guiado:** La pagina publica `/[slug]` detecta al propietario via query-string (`?authId=`) y ofrece un flujo en dos pasos (revisar datos -> renderizar HTML). El dashboard incorpora historial estilo chat y todos los fetch usan `credentials: "include"`.
- **Experiencia de subida:** El uploader vincula automaticamente la identidad del usuario, comparte los campos con el backend y muestra mensajes claros si falta iniciar sesion.

## Requisitos y entorno

- Node.js >= 20 y npm >= 10.
- Proyecto de Supabase con la tabla `public.user_profiles`.
- Cuenta en Clerk (obligatoria). Se recomienda contar con `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY`.
- Token de Pollinations.ai (opcional pero recomendado para obtener mejor calidad en el contenido generado).

### Variables de entorno (`.env.local`)

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder
CLERK_SECRET_KEY=sk_test_placeholder
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key

# Opcional: el servicio intenta operar sin el token, pero puedes llegar a limites mas rapido.
POLLINATIONS_API_TOKEN=your-pollinations-token
```

> Este proyecto solo usa la anon key de Supabase. No expongas la clave y canaliza toda la escritura/lectura a traves de tu backend.

## Base de datos

Ejecuta `supabase/schema.sql` para crear/actualizar la tabla `public.user_profiles`:

- `auth_user_id` esta definido como `text` y cuenta con indice unico condicional para evitar duplicados.
- Hay un trigger que mantiene `updated_at`.
- Las politicas RLS permiten operar con la anon key durante el desarrollo; en produccion deberias reforzarlas.

Campos principales:

- `username`, `slug`: nombre publico y slug de la pagina.
- `pdf_raw`: texto limpio extraido del PDF.
- `profile_json`: JSON estructurado de secciones.
- `profile_html`: HTML generado con IA listo para servir.
- `last_enriched_at`, `last_rendered_at`: marcadores para auditoria.

## Scripts

```bash
npm install
npm run dev        # Desarrollo con Turbopack
npm run build      # Compilacion para produccion
npm run start      # Servidor en modo produccion
npm run lint       # ESLint
```

## Flujo end-to-end

1. **Sesion con Clerk**
   - El usuario inicia sesion desde la home (`SignInButton`). Los fetch del cliente siempre incluyen `credentials: "include"` y el `identityAuthId` en body/query.

2. **Subida del PDF (`POST /api/pdf`)**
   - El uploader envia el archivo + identidad derivada (username, slug, authUserId, email).
   - El backend registra logs indicando la procedencia de la identidad y si se pudo resolver via Clerk.
   - Se extrae texto con `pdf2json`. Si hay token, se llama a `reformulateAsProfessionalReport` de Pollinations. Los logs reportan caracteres enviados, cantidad de secciones devueltas y si se guardo con exito.
   - Se persiste en Supabase (`pdf_raw`, `profile_json`, HTML reseteado). La respuesta devuelve `/slug` y, si se uso fallback, agrega `?authId=...`.

3. **Revision y render inicial (`/{slug}` + `POST /api/profile/render`)**
   - La pagina publica verifica si el visitante es propietario via Clerk o query-string.
   - Se muestran los datos estructurados antes de renderizar. Al pulsar “Continuar y renderizar pagina”, el handler reconstruye el JSON (si falta) y llama a `renderProfileToHtml`. Los logs indican tamanio del HTML y guardado en Supabase.

4. **Agente IA (`POST /api/profile/augment`)**
   - El dashboard ofrece un textarea para instrucciones. El backend escribe logs con el tamanio de la instruccion, secciones antes/despues y si Pollinations respondio correctamente.
   - Si no hay JSON, se reconstruye a partir de `pdf_raw` y se actualiza Supabase sin modificar el HTML.

5. **Dashboard (`/dashboard`)**
   - Carga el perfil del usuario logueado, muestra JSON y HTML actual, y conserva historial estilo chat.
   - Los botones “Sincronizar datos”, “Preparar perfil vacio”, “Actualizar JSON con IA” y “Renderizar pagina” invocan los endpoints anteriores (con logs ya descritos).

## Pollinations.ai

- Cliente central: `src/lib/pollinations.ts`.
- `reformulateAsProfessionalReport`: convierte texto plano en un JSON `{ sections: [{ header, text }] }`.
- `augmentProfileWithInstructions`: fusiona JSON actual con nuevas instrucciones.
- `renderProfileToHtml`: genera un fragmento HTML Tailwind listo para incrustar.
- El cliente implementa reintentos, `AbortController`, estrategias autenticadas/no autenticadas y normalizacion de codigo.

### Monitoreo con logs

| Prefijo | Contenido clave                                                                          |
|---------|-------------------------------------------------------------------------------------------|
| `[PDF]` | Identidad resuelta, longitud del texto extraido, resultado de Pollinations y guardado.   |
| `[AUGMENT]` | Longitud de instrucciones, reconstruccion desde PDF si faltaba JSON, secciones nuevas. |
| `[RENDER]` | Validaciones previas, reconstruccion de JSON, longitud del HTML generado y persistencia. |

Los logs se imprimen en consola del servidor y permiten seguir paso a paso el pipeline.

## Estructura relevante

- `src/app/api/pdf/route.ts` – Procesa el PDF, invoca Pollinations y guarda el perfil.
- `src/app/api/profile/route.ts` – Obtiene o crea el perfil del usuario autenticado.
- `src/app/api/profile/augment/route.ts` – Agente IA para enriquecer el JSON.
- `src/app/api/profile/render/route.ts` – Genera el HTML final.
- `src/app/[slug]/page.tsx` – Pagina publica con flujo guiado.
- `src/components/profile-render-flow.tsx` – Lado cliente del flujo de renderizado.
- `src/app/dashboard/page.tsx` + `src/components/profile-agent-panel.tsx` – Panel administrativo con agente IA y previsualizacion.
- `src/lib/store.ts` – Acceso tipado a Supabase.
- `src/lib/pollinations.ts` – Cliente Pollinations con reintentos y prompts.

## Notas operativas

- Mantén tus claves de Supabase y Pollinations fuera de clientes no confiables.
- Cada subida de PDF reinicia el HTML para que el siguiente render refleje la informacion mas reciente.
- Si Pollinations falla, se guarda igualmente el texto crudo y los logs muestran el motivo.
- Puedes re-renderizar sin limite: solo la ultima version queda publicada.

## Roadmap sugerido

- Reforzar politicas RLS cuando se cuente con service key y un backend propio que firme las peticiones.
- Versionar el HTML para conservar historicos de cada render.
- Agregar pruebas automatizadas (unitarias e integracion) que cubran flujo completo y controlen regresiones.

Consulta `POLLINATIONS_SETUP.md` para detalles adicionales sobre la integracion con Pollinations (prompting, estrategias de autenticacion y ejemplos de logs).
