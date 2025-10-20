# Configuración de Pollinations.ai GPT-5

## 📋 Descripción

Este proyecto integra la API de Pollinations.ai con GPT-5 para procesar automáticamente los textos extraídos de PDFs y convertirlos en informes profesionales.

## 🔑 Configuración del Token

### 1. Agregar el token a `.env.local`

Abre o crea el archivo `.env.local` en la raíz del proyecto y agrega:

```env
POLLINATIONS_API_TOKEN=41pFdZ31flrAPI4u
```

### 2. Reiniciar el servidor de desarrollo

Después de agregar la variable de entorno:

```bash
npm run dev
```

## 🚀 Cómo Funciona

1. **Extracción**: El usuario sube un PDF
2. **Procesamiento**: El texto se extrae usando `pdf2json`
3. **IA GPT-5**: El texto se envía a Pollinations.ai (modelo `openai` / `gpt-5-mini`)
4. **Reformulación**: La IA convierte el texto en un informe profesional formal
5. **Almacenamiento**: El resultado se guarda en el sistema de archivos
6. **Visualización**: El usuario ve el informe procesado en su página

## 📚 Características de la Integración

### Modelo Utilizado
- **Modelo**: `openai` (alias: `gpt-5-mini`)
- **Razonamiento**: `medium` (balance entre calidad y velocidad)
- **Privacidad**: `private: true` (no aparece en feed público)
- **Temperatura**: Valor por defecto `1` (GPT-5 solo acepta este valor)

### Prompt del Sistema
El sistema está configurado para:
- ✅ Reformular sin alterar el contenido esencial
- ✅ Mantener precisión de datos
- ✅ Crear estructura profesional con secciones
- ✅ Usar lenguaje formal y técnico
- ❌ NO añadir información inexistente
- ❌ NO omitir datos importantes

### Sistema Robusto de Reintentos
La integración incluye mecanismos avanzados de recuperación:

#### ✅ Reintentos Automáticos
- **3 intentos** con exponential backoff (2s, 4s, 8s)
- Timeout de **30 segundos** por intento
- Logs detallados de cada intento

#### 🔄 Estrategias de Autenticación
Si falla con token:
1. Primero intenta **con autenticación** (Bearer token)
2. Si falla, intenta **sin autenticación** (modo anónimo)
3. Ambas estrategias tienen 3 reintentos cada una

#### 🛡️ Fallback Automático
Si todos los intentos fallan:
- ✅ El sistema usa automáticamente el texto original extraído
- ✅ El usuario siempre recibe contenido (con o sin IA)
- ✅ Los errores se registran detalladamente en la consola
- ✅ El campo `processed_with_ai` indica si se usó IA

## 🔧 Archivos Principales

### `src/lib/pollinations.ts`
Contiene la función principal de integración:
```typescript
reformulateAsProfessionalReport(extractedText, token)
```

### `src/app/api/pdf/route.ts`
API Route que procesa:
1. Recibe el PDF
2. Extrae el texto
3. Llama a la IA
4. Guarda el resultado

### `src/app/[username]/page.tsx`
Página que muestra el informe procesado con diseño profesional.

## 📖 Documentación Oficial

- **Pollinations.ai Docs**: https://github.com/pollinations/pollinations/blob/master/APIDOCS.md
- **Auth Dashboard**: https://auth.pollinations.ai

## 💡 Beneficios del Token

Con token registrado obtienes:
- ⚡ Menor latencia (3-5 segundos vs 15 segundos)
- 📈 Mayor límite de requests
- 🎯 Acceso prioritario a modelos avanzados
- 🔒 Soporte profesional

## 🐛 Troubleshooting

### ✅ Error 400: "temperature does not support 0.7" - RESUELTO
**Síntoma**: `Unsupported value: 'temperature' does not support 0.7 with this model`

**Causa**: GPT-5 solo acepta el valor por defecto de `temperature: 1`

**Solución implementada**:
- ✅ Se removió el parámetro `temperature` del request
- ✅ La API usa automáticamente el valor por defecto (1)
- ✅ Errores 400 ya no causan reintentos innecesarios
- ✅ El sistema detecta errores de configuración y aborta inmediatamente

**Estado**: Este error está completamente solucionado en el código actual.

---

### Error 502: "Bad Gateway"
**Síntoma**: `Pollinations API error (502): 502 Bad Gateway`

**Causas posibles**:
- La API de Pollinations.ai está temporalmente sobrecargada
- Problemas con Cloudflare (proxy delante del servicio)
- Mantenimiento del servicio

**Solución automática implementada**:
- ✅ El sistema intenta **3 veces** con delays crecientes
- ✅ Luego intenta sin autenticación (otras 3 veces)
- ✅ Si todo falla, usa el texto original (fallback)
- ⏱️ Espera total máxima: ~30 segundos

**Qué hacer**:
1. Esperar unos minutos y volver a intentar
2. Revisar status en: https://github.com/pollinations/pollinations/issues
3. El sistema funcionará igual usando el texto original

---

### Error: "Pollinations API error (401)"
- Verifica que `POLLINATIONS_API_TOKEN` esté correctamente configurado en `.env.local`
- Asegúrate de haber reiniciado el servidor después de agregar la variable
- El sistema intentará automáticamente sin token si falla la autenticación

---

### Error: "No se pudo extraer texto del PDF"
- Verifica que el PDF no esté protegido o encriptado
- Prueba con otro archivo PDF
- Algunos PDFs escaneados pueden no tener texto extraíble

---

### El texto no se reformula
- Revisa la consola del servidor para ver logs detallados
- Busca líneas con 🔄, ❌, ⚠️ para entender qué pasó
- Si hay error, el sistema usa el texto original como fallback
- Verifica el campo `processed_with_ai` en la respuesta JSON

---

### Logs de Ejemplo (Exitoso)
```
📄 Procesando PDF para usuario: usuario-test
✅ Texto extraído (1200 caracteres)
🔑 Token de Pollinations configurado
🤖 Procesando con IA (GPT-5)...
🔄 Intentando con autenticación...
  Intento 1/3 con autenticación...
  ✅ Éxito con autenticación
✨ Texto reformulado por IA exitosamente (2400 caracteres)
✅ PDF procesado exitosamente: usuario-test -> usuario-test
📊 Estado: IA ACTIVADA ✓
```

### Logs de Ejemplo (Con Fallback)
```
📄 Procesando PDF para usuario: usuario-test
✅ Texto extraído (1200 caracteres)
🔑 Token de Pollinations configurado
🤖 Procesando con IA (GPT-5)...
🔄 Intentando con autenticación...
  Intento 1/3 con autenticación...
  ❌ Error en intento 1: Servicio temporalmente no disponible (502)
  ⏳ Esperando 2000ms antes de reintentar...
  Intento 2/3 con autenticación...
  ❌ Error en intento 2: Servicio temporalmente no disponible (502)
  ⏳ Esperando 4000ms antes de reintentar...
  Intento 3/3 con autenticación...
  ❌ Error en intento 3: Servicio temporalmente no disponible (502)
🔄 Intentando sin autenticación...
  [... más intentos ...]
❌ Todos los intentos fallaron
⚠️ Error en procesamiento de IA: [error message]
📝 Fallback: usando texto original sin reformular
✅ PDF procesado exitosamente: usuario-test -> usuario-test
📊 Estado: IA DESACTIVADA (fallback)
```
