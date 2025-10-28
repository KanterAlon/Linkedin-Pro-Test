# MediumAPI (Unofficial) — Guía de Integración

Esta guía explica qué es MediumAPI (no oficial), cómo autenticarte, los endpoints más usados, y cómo integrarlo en un proyecto con ejemplos en cURL, JavaScript/Node.js y Python.

Fuentes oficiales:
- Sitio: https://mediumapi.com/
- Documentación: https://docs.mediumapi.com/
- FAQ + SDKs: https://mediumapi.com/frequently-asked-questions.html


## Resumen
- MediumAPI es una API no oficial para obtener datos públicos de Medium.
- Permite obtener información de usuarios, publicaciones, artículos, listas y feeds de la plataforma.
- La autenticación se realiza con una API Key de RapidAPI.

Plan gratuito: 150 llamadas/mes (ver precios y límites actuales en: http://hub.mediumapi.com/pricing).


## Autenticación
MediumAPI se usa con una clave de RapidAPI.
- Obtén tu API key: suscríbete en RapidAPI al listado “Unofficial Medium API” (http://hub.mediumapi.com/) y copia tu `X-RapidAPI-Key`.
- Agrega a tus requests el header `X-RapidAPI-Key`.
- En muchos clientes de RapidAPI también se requiere `X-RapidAPI-Host` (lo verás en el panel de RapidAPI para cada endpoint). Usa exactamente el host que te indique RapidAPI.

Ejemplo de headers (revísalos en tu panel de RapidAPI, pueden variar según el host):
- `X-RapidAPI-Key: <TU_API_KEY>`
- `X-RapidAPI-Host: <TU_RAPIDAPI_HOST>`


## Base URL y Esquema
Los endpoints están documentados en https://docs.mediumapi.com/ y se agrupan por recursos:
- user
- article
- publication
- platform
- list
- search

Cada endpoint incluye ruta, parámetros y ejemplos de respuesta en la documentación oficial.


## Endpoints comunes (mapeo por recurso)
Consulta la documentación para los parámetros exactos y ejemplos de respuesta.

- user
  - Obtener `user_id` por `username`
  - Información del usuario
  - Artículos del usuario
  - Top artículos del usuario
  - Followers / Following
  - Publications del usuario
  - Lists del usuario
  - Interests / Books

- article
  - Información de artículo
  - Contenido (estructurado)
  - Markdown del artículo
  - HTML del artículo
  - Assets del artículo
  - Respuestas, Fans
  - Artículos relacionados / recomendados

- publication
  - Obtener `publication_id` por slug
  - Información de publication
  - Artículos de la publication
  - Newsletter de la publication

- platform
  - Recommended feed por tag
  - Top feeds (por tag/mode)
  - Top writers (por topic)
  - Latest posts (por topic)
  - Related/Root/Tag info
  - Recommended users/lists
  - Archived articles (por tag)

- list
  - Info de lista, artículos de la lista, respuestas

- search
  - Buscar usuarios, artículos, publicaciones, listas y tags por query


## Ejemplos de uso

> Nota: Sustituye `<TU_API_KEY>` y `<TU_RAPIDAPI_HOST>` por los valores que te provee RapidAPI. Ajusta la `baseURL`/ruta según la documentación de cada endpoint en https://docs.mediumapi.com/.

### cURL — Obtener user_id por username
```bash
curl -G \
  -H "X-RapidAPI-Key: <TU_API_KEY>" \
  -H "X-RapidAPI-Host: <TU_RAPIDAPI_HOST>" \
  --data-urlencode "username=<username>" \
  "https://<TU_RAPIDAPI_HOST>/user/id_for/<username>"
```

### JavaScript (Node.js, fetch) — Info de un usuario
```js
import fetch from "node-fetch";

const RAPID_API_KEY = process.env.RAPID_API_KEY;
const RAPID_API_HOST = process.env.RAPID_API_HOST; // provisto por RapidAPI

async function getUserInfo(userId) {
  const url = `https://${RAPID_API_HOST}/user/${userId}`;
  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": RAPID_API_KEY,
      "X-RapidAPI-Host": RAPID_API_HOST,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MediumAPI error ${res.status}: ${text}`);
  }
  return res.json();
}

getUserInfo("<user_id>")
  .then(console.log)
  .catch(console.error);
```

### JavaScript (axios) — Artículos de un usuario
```js
import axios from "axios";

const client = axios.create({
  baseURL: `https://${process.env.RAPID_API_HOST}`,
  headers: {
    "X-RapidAPI-Key": process.env.RAPID_API_KEY,
    "X-RapidAPI-Host": process.env.RAPID_API_HOST,
  },
});

async function getUserArticles(userId) {
  const { data } = await client.get(`/user/${userId}/articles`);
  return data;
}

getUserArticles("<user_id>")
  .then(console.log)
  .catch(console.error);
```

### Python (requests) — HTML de un artículo
```python
import os
import requests

RAPID_API_KEY = os.environ.get("RAPID_API_KEY")
RAPID_API_HOST = os.environ.get("RAPID_API_HOST")

url = f"https://{RAPID_API_HOST}/article/<article_id>/html"
headers = {
    "X-RapidAPI-Key": RAPID_API_KEY,
    "X-RapidAPI-Host": RAPID_API_HOST,
}

resp = requests.get(url, headers=headers)
resp.raise_for_status()
print(resp.json())
```


## Variables de entorno sugeridas
Añade a tu `.env.local` o variables de entorno del servidor:
```
# MediumAPI (RapidAPI)
RAPID_API_KEY=tu_clave_rapidapi
RAPID_API_HOST=el_host_provisto_por_rapidapi
```


## Buenas prácticas
- Revisa límites y precios: el plan gratuito ofrece 150 llamadas/mes (puede cambiar).
- Implementa caching en tu app para evitar sobrepasar el rate limit.
- Maneja errores y reintentos con backoff exponencial.
- Respeta los Términos de Servicio de Medium y RapidAPI.
- Usa paginación cuando esté disponible.


## SDKs y herramientas
- Python SDK oficial (open-source):
  - GitHub: https://github.com/weeping-angel/medium-api
  - Docs: https://medium-api.rtfd.io
  - PyPI: https://pypi.org/project/medium-api
- JavaScript (NPM):
  - GitHub: https://github.com/weeping-angel/medium-api-js
  - NPM: https://www.npmjs.com/package/medium-api-js
- .NET (comunidad):
  - GitHub: https://github.com/martinstm/medium-dotnet-sdk
  - NuGet: https://www.nuget.org/packages/Medium.Client/


## Troubleshooting
- 401/403: verifica que `X-RapidAPI-Key` y `X-RapidAPI-Host` sean correctos y que tu suscripción esté activa.
- 404: confirma IDs/username/slug; algunos endpoints requieren obtener primero IDs con endpoints previos (p.ej., `publication_id` por slug).
- 429: límite de tasa alcanzado, implementa caching y espera antes de reintentar.
- Estructuras de respuesta: consulta ejemplos en https://docs.mediumapi.com/ para cada endpoint.

---

Si quieres, puedo adaptar esta guía a tu código (Next.js/Node) y crear un pequeño cliente de servicio con funciones tipadas para los endpoints que más vayas a usar.
