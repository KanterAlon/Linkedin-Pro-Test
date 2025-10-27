# LinkedIn Pro Portfolio

Aplicacion Next.js 15 que convierte la exportacion de datos de LinkedIn en un portafolio profesional generado con IA. Toda la informacion (JSON estructurado y HTML renderizado) se almacena en Supabase para servir una URL publica por usuario.

## Requisitos

- Node.js 20 o superior y npm 10.
- Proyecto de Supabase configurado.
- Cuenta en Clerk (obligatoria: la app usa Clerk para autenticar y generar el slug).
- Token de Pollinations.ai (opcional, mejora la calidad de la IA).

## Variables de entorno

Guarda los valores en `.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder
CLERK_SECRET_KEY=sk_test_placeholder
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key

# Opcional: si falta se intenta el flujo sin token
POLLINATIONS_API_TOKEN=your-pollinations-token
```

> La aplicacion usa exclusivamente `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. El script `schema.sql` abre las politicas de Supabase para que el rol `anon` pueda escribir; por eso es importante exponer los endpoints solo desde tu backend o agregar autenticacion propia.

## Base de datos (Supabase)

1. Ejecuta `supabase/schema.sql` en el editor SQL o via `psql`.
2. El script:
   - Habilita `pgcrypto`.
  - Crea `public.user_profiles` (con `auth_user_id text` + indice unico condicional).
   - Declara indices y trigger para `updated_at`.
   - Configura RLS abierta para `anon` (pensada para escenarios sin service key).

Campos principales:

- `username` / `slug`: nombre publico y slug para la URL.
- `pdf_raw`: texto plano extraido del PDF original.
- `profile_json`: JSON estructurado (secciones con header/text).
- `profile_html`: HTML con Tailwind generado por IA.
- `last_enriched_at`, `last_rendered_at`: marcas de tiempo.

## Instalacion

```bash
npm install
```

## Scripts

- `npm run dev` - Entorno de desarrollo con Turbopack.
- `npm run build` - Compila para produccion.
- `npm run start` - Arranca el servidor en modo produccion.
- `npm run lint` - Ejecuta ESLint.

## Flujo end-to-end

1. **Autenticación con Clerk**  
   - Todas las APIs requieren sesion iniciada. El backend deriva `username`, `slug` y `auth_user_id` a partir del usuario autenticado. Ya no se pide un slug manual.

2. **Subida del PDF** (`POST /api/pdf`)  
   - Extrae texto via `pdf2json` y, si hay token, genera un JSON inicial con Pollinations.  
   - Guarda texto y JSON en Supabase, reinicia el HTML previo y redirige a `/{slug}`.

3. **Revisión y renderizado inicial** (`/{slug}` + `POST /api/profile/render`)  
   - La página del slug muestra primero el texto/JSON extraído y un botón “Continuar y renderizar”.  
   - Al confirmar, se llama a `render`, se genera el HTML tailwind y se persiste.

4. **Agente IA** (`POST /api/profile/augment`)  
   - Desde el dashboard puedes pegar nuevos textos o instrucciones.  
   - El agente actualiza el JSON (y deja el HTML pendiente de regenerar).

5. **Dashboard** (`/dashboard`)  
   - Carga el perfil del usuario autenticado automáticamente (sin pedir slug).  
   - Muestra JSON, previsualización HTML, historial tipo chat del agente y acciones de render.

## Estructura relevante

- `src/app/api/profile/route.ts` - Consultar o preparar un perfil por username.
- `src/app/api/pdf/route.ts` - Procesa el PDF y almacena texto/JSON.
- `src/app/api/profile/augment/route.ts` - Agente IA para enriquecer el JSON.
- `src/app/api/profile/render/route.ts` - Renderiza la pagina con Tailwind.
- `src/app/[username]/page.tsx` - Pagina publica con flujo guiado de renderizado.
- `src/components/profile-render-flow.tsx` - Multistep client component para revisar y renderizar.
- `src/app/dashboard/page.tsx` y `src/components/profile-agent-panel.tsx` - Panel con agente IA y previsualizacion.
- `src/lib/pollinations.ts` - Cliente Pollinations con reintentos y prompts.
- `src/lib/store.ts` - Capa de persistencia en Supabase.

## Notas operativas

- Si solo usas la anon key, cualquier cliente que la obtenga podria modificar `user_profiles`; no compartas la clave publica y canaliza todas las operaciones a traves de tus APIs.
- Cada subida de PDF reinicia `profile_html` para forzar un render posterior con el nuevo contenido.
- Pollinations puede fallar; se captura el error y se guarda solo el texto plano.
- Puedes renderizar tantas veces como quieras: cada llamada reemplaza el HTML y conserva el slug.

## Tareas futuras sugeridas

- Endurecer las politicas RLS por usuario cuando se disponga de la service key.
- Versionar el HTML para mantener historicos de renderizados.
- Anadir pruebas automatizadas y monitorizacion de respuestas IA invalidas.
