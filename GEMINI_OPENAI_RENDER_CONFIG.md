# Configuración Multi-Modelo para Renderizado HTML

## Resumen

El sistema ahora soporta **tres opciones** para renderizado HTML con fallback automático:

1. **ChatGPT (OpenAI)** - Modelo principal recomendado
2. **Gemini (Google AI)** - Alternativa de Google
3. **Pollinations.ai** - Fallback automático si ambos fallan

## Selector de Modelo en la UI

En la página principal, ahora puedes elegir el modelo que prefieres para generar el HTML:
- **ChatGPT (OpenAI)**: Usa `gpt-4o-mini` por defecto
- **Gemini (Google AI)**: Usa `gemini-1.5-flash` por defecto

## Modelos Utilizados

### OpenAI: `gpt-4o-mini`
- **Precio**: $0.15 / $0.60 por 1M tokens (input/output)
- **Ventajas**: Rápido, económico, consistente
- **Ideal para**: Uso general

### Gemini: `gemini-1.5-flash`
- **Precio**: $0.075 / $0.30 por 1M tokens (input/output) hasta 128K tokens
- **Ventajas**: Más económico que GPT-4o-mini, contexto largo
- **Ideal para**: Perfiles con mucho contenido, experimentación

## Lógica de Fallback

```
1. Usuario selecciona modelo preferido (OpenAI o Gemini)
   ↓
2. Intentar renderizar con modelo preferido
   ↓ (si falla)
3. Intentar con el modelo alternativo
   ↓ (si también falla)
4. Usar Pollinations.ai como fallback final
   ↓
5. Retornar HTML generado
```

## Variables de Entorno Requeridas

### OpenAI (ChatGPT)
```env
# OBLIGATORIO para usar ChatGPT
OPENAI_API_KEY=sk-proj-tu-clave-aqui

# Opcionales
OPENAI_MODEL_HTML=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TIMEOUT_MS=60000
# OPENAI_ORG_ID=org-xxxxx
# OPENAI_PROJECT_ID=proj-xxxxx
```

### Google Gemini
```env
# OBLIGATORIO para usar Gemini
GEMINI_API_KEY=tu-clave-api-de-gemini-aqui

# Opcionales
GEMINI_MODEL=gemini-1.5-flash
GEMINI_TIMEOUT_MS=60000
```

## Cómo Obtener las API Keys

### OpenAI API Key
1. Ve a [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Inicia sesión
3. Clic en **"Create new secret key"**
4. Copia la clave (comienza con `sk-proj-...` o `sk-...`)
5. Pégala en `.env.local` como `OPENAI_API_KEY=...`

### Gemini API Key
1. Ve a [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Inicia sesión con tu cuenta de Google
3. Clic en **"Get API Key"** o **"Create API Key"**
4. Copia la clave (formato: string alfanumérico)
5. Pégala en `.env.local` como `GEMINI_API_KEY=...`

## Configuración Mínima Recomendada

### Solo OpenAI
```env
OPENAI_API_KEY=sk-proj-...
```

### Solo Gemini
```env
GEMINI_API_KEY=AIza...
```

### Ambos (recomendado para máxima confiabilidad)
```env
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=AIza...
```

## Logs de Monitoreo

El sistema ahora muestra en la terminal qué modelo se está usando y los fallbacks:

**Caso exitoso con modelo preferido:**
```
[RENDER-HTML] Tamaños de prompt { systemPromptChars: 1885, userPromptChars: 1509, preferredModel: 'gemini' }
[RENDER-HTML] Intentando con Gemini API { model: 'gemini-1.5-flash' }
[RENDER-HTML] ✓ Renderizado exitoso con Gemini { model: 'gemini-1.5-flash', htmlLength: 5284, ms: 8123 }
```

**Caso con fallback:**
```
[RENDER-HTML] Tamaños de prompt { systemPromptChars: 1885, userPromptChars: 1509, preferredModel: 'gemini' }
[RENDER-HTML] Intentando con Gemini API { model: 'gemini-1.5-flash' }
[RENDER-HTML] ✗ Fallo Gemini { error: 'GEMINI_API_KEY no configurada' }
[RENDER-HTML] Intentando con OpenAI API { model: 'gpt-4o-mini' }
[RENDER-HTML] ✓ Renderizado exitoso con OpenAI { model: 'gpt-4o-mini', htmlLength: 5284, ms: 12072 }
```

**Caso con fallback final a Pollinations:**
```
[RENDER-HTML] ✗ Fallo Gemini { error: '...' }
[RENDER-HTML] ✗ Fallo OpenAI { error: '...' }
[RENDER-HTML] Usando Pollinations.ai como servicio de renderizado
[RENDER-HTML] ✓ Renderizado exitoso con Pollinations { htmlLength: 5284, ms: 15234 }
```

## Comparación de Costos

Para un perfil típico (~2K tokens input, ~1.5K tokens output):

| Modelo | Input | Output | Total por render |
|--------|-------|--------|------------------|
| **gpt-4o-mini** | $0.0003 | $0.0009 | **~$0.0012** |
| **gemini-1.5-flash** | $0.00015 | $0.00045 | **~$0.0006** |
| **Pollinations** | Gratis | Gratis | **$0** |

*Gemini es ~50% más económico que OpenAI para este caso de uso.*

## Recomendaciones

✅ **Usa OpenAI si**:
- Priorizas consistencia y calidad predecible
- Ya tienes créditos de OpenAI

✅ **Usa Gemini si**:
- Quieres optimizar costos
- Experimentas con nuevos modelos de Google
- Tienes perfiles con mucho contenido (>10K tokens)

✅ **Configura ambos**:
- Para máxima confiabilidad con fallback automático
- El sistema siempre elegirá el modelo que prefieras primero

## Próximos Pasos

1. Decide qué modelo(s) quieres usar
2. Obtén las API keys correspondientes
3. Agrégalas a `.env.local`
4. Reinicia el servidor: `npm run dev`
5. Selecciona el modelo en la UI al subir tu PDF
6. Verifica en los logs de terminal qué modelo se usó

## Troubleshooting

**"GEMINI_API_KEY no configurada"**
- Asegúrate de haber agregado `GEMINI_API_KEY=...` en `.env.local`
- Reinicia el servidor después de agregar la clave

**"OpenAI API error (401)"**
- Tu clave de OpenAI es inválida o expiró
- Genera una nueva en platform.openai.com

**"Gemini API error (403)"**
- Tu clave de Gemini no tiene permisos
- Verifica que la API esté habilitada en Google AI Studio

**Siempre usa Pollinations aunque tengo las claves configuradas**
- Revisa los logs de terminal para ver el error exacto
- Verifica que las claves no tengan espacios o caracteres extra
