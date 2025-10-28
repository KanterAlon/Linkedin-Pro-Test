# Configuración OpenAI para Renderizado HTML

## Resumen de Cambios

Se ha configurado la aplicación para usar **OpenAI API** como servicio principal de renderizado HTML, con **Pollinations.ai** como fallback automático en caso de error.

## Modelo Utilizado

**Modelo Principal: `gpt-4o-mini`**
- **Razón**: Es el modelo más económico de OpenAI actualmente disponible
- **Precio**: $0.15 por 1M tokens (input) / $0.60 por 1M tokens (output)
- **Calidad**: Excelente para generación de HTML y tareas de desarrollo front-end
- **Velocidad**: Rápido y eficiente

## Lógica de Renderizado Implementada

```
1. ¿Existe OPENAI_API_KEY en .env?
   SÍ → Intentar renderizar con OpenAI (gpt-4o-mini)
      ✓ Éxito → Retornar HTML generado
      ✗ Fallo → Continuar a paso 2
   NO → Ir directamente a paso 2

2. Usar Pollinations.ai como fallback
   → Renderizar con Pollinations
   → Retornar HTML generado
```

## Variables de Entorno Requeridas

Agrega las siguientes variables a tu archivo `.env.local`:

```env
# OpenAI API (OBLIGATORIO para usar GPT en renderizado)
OPENAI_API_KEY=tu-clave-api-de-openai-aqui

# Opcionales - Solo si usas una organización/proyecto específico
# OPENAI_ORG_ID=tu-organization-id
# OPENAI_PROJECT_ID=tu-project-id

# Opcional - Cambiar modelo (por defecto: gpt-4o-mini)
# OPENAI_MODEL_HTML=gpt-4o-mini

# Opcional - Cambiar URL base (por defecto: https://api.openai.com/v1)
# OPENAI_BASE_URL=https://api.openai.com/v1

# Opcional - Timeout en ms (por defecto: 60000)
# OPENAI_TIMEOUT_MS=60000
```

## Dónde Obtener tu API Key

1. Ve a [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Inicia sesión con tu cuenta de OpenAI
3. Clic en "Create new secret key"
4. Copia la clave (comienza con `sk-proj-...` o `sk-...`)
5. Pégala en tu `.env.local` como `OPENAI_API_KEY=sk-...`

## Logs de Monitoreo

La aplicación ahora incluye logs detallados en tu terminal:

```
[RENDER-HTML] Intentando con OpenAI API { model: 'gpt-4o-mini' }
[RENDER-HTML] ✓ Renderizado exitoso con OpenAI { model: 'gpt-4o-mini', htmlLength: 5284 }
```

O en caso de fallo:

```
[RENDER-HTML] ✗ Fallo OpenAI, usando Pollinations como fallback { error: 'mensaje de error' }
[RENDER-HTML] Usando Pollinations.ai como servicio de renderizado
[RENDER-HTML] ✓ Renderizado exitoso con Pollinations { htmlLength: 5284 }
```

## Beneficios

✅ **Mejor calidad**: OpenAI GPT-4o-mini ofrece resultados consistentes y de alta calidad  
✅ **Económico**: El modelo más barato disponible (~$0.15/$0.60 por 1M tokens)  
✅ **Confiable**: Fallback automático a Pollinations si OpenAI falla  
✅ **Trazabilidad**: Logs claros indican qué servicio se usó en cada render  
✅ **Sin cambios en UI**: Todo funciona transparentemente para el usuario  

## Próximos Pasos

1. Obtén tu API Key de OpenAI
2. Agrégala a `.env.local` como `OPENAI_API_KEY=...`
3. Reinicia el servidor (`npm run dev`)
4. Prueba renderizando una página
5. Verifica en los logs de terminal que use OpenAI
