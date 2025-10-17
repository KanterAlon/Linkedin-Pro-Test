# LinkedIn Pro Portfolio

Aplicación Next.js 15 (App Router) que transforma la exportación de datos de LinkedIn en un portafolio profesional editable. Incluye Tailwind CSS v4, autenticación con Clerk y una experiencia de subida drag & drop para iniciar el flujo de creación.

## Requisitos previos

- Node.js 20 o superior
- npm 10 (instalado por defecto con Node)
- Cuenta en [Clerk](https://clerk.com/) para obtener las llaves de autenticación

## Configuración de entorno

El repositorio incluye un archivo `.env` con valores de ejemplo que se versiona para facilitar el arranque local. Antes de ejecutar la aplicación, reemplaza los valores por tus llaves reales de Clerk.

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder
CLERK_SECRET_KEY=sk_test_placeholder
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Para mantener seguras las credenciales definitivas, usa el archivo `.env.secrets` (excluido del control de versiones) y define ahí las llaves que no deban compartirse.

## Instalación

```bash
npm install
```

## Scripts disponibles

- `npm run dev`: inicia el entorno de desarrollo con Turbopack.
- `npm run build`: genera el build de producción.
- `npm run start`: levanta el servidor de producción.
- `npm run lint`: ejecuta ESLint con la configuración oficial de Next.js.

## Estructura principal

- `src/app/page.tsx`: página de marketing con el dropzone para cargar el archivo exportado desde LinkedIn.
- `src/components/upload-dropzone.tsx`: componente cliente que gestiona la carga drag & drop con validaciones de tamaño y tipo.
- `src/app/layout.tsx`: configuración global, fuentes y proveedor de Clerk.
- `src/middleware.ts`: middleware de Clerk con rutas públicas configuradas.

## Próximos pasos sugeridos

- Implementar el procesamiento real del archivo exportado de LinkedIn.
- Crear el panel autenticado (`/dashboard`) para editar y publicar el portafolio.
- Añadir pruebas automatizadas para los flujos críticos.
