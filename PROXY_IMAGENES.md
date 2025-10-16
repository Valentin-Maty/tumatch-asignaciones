# 🖼️ Sistema de Proxy de Imágenes para Netlify

## 📋 Funciones Serverless Creadas

### 1. **img-proxy.js** - Proxy de Imágenes sin CORS
```
/.netlify/functions/img-proxy?url=https://example.com/image.jpg
```

**Características:**
- ✅ Bypassa problemas de CORS
- ✅ Cachea imágenes por 24 horas
- ✅ Fallback a placeholder si hay error
- ✅ Valida que sea una imagen real
- ✅ Headers de seguridad incluidos

### 2. **extract-images.js** - Extractor de Imágenes de FichaPublica
```
/.netlify/functions/extract-images/{propertyId}
```

**Características:**
- ✅ Extrae todas las imágenes de una propiedad
- ✅ Busca en múltiples patrones (Azure Blob, og:image, data-src, etc.)
- ✅ Devuelve URLs con proxy automático
- ✅ Fallback a placeholders de alta calidad

---

## 🚀 Cómo Usar en HTML

### Ejemplo 1: Imagen directa con proxy
```html
<img src="/.netlify/functions/img-proxy?url=https://cl.fichapublica.com/images/foto.jpg" 
     alt="Propiedad" />
```

### Ejemplo 2: JavaScript dinámico
```javascript
// Obtener todas las imágenes de una propiedad
async function loadPropertyImages(propertyId) {
    const response = await fetch(`/.netlify/functions/extract-images/${propertyId}`);
    const data = await response.json();
    
    if (data.success && data.images.length > 0) {
        // Usar la primera imagen
        document.getElementById('property-image').src = data.images[0].proxyUrl;
        
        // O crear galería
        data.images.forEach(img => {
            const imgElement = document.createElement('img');
            imgElement.src = img.proxyUrl;
            imgElement.alt = `Imagen desde ${img.source}`;
            document.getElementById('gallery').appendChild(imgElement);
        });
    }
}

// Llamar la función
loadPropertyImages('2950');
```

---

## 🔧 Funcionamiento Interno

### Flujo de Extracción de Imágenes:
1. **extract-images** recibe propertyId
2. Usa AllOrigins API para obtener HTML de FichaPublica
3. Busca imágenes con múltiples patrones regex:
   - Azure Blob Storage
   - Meta tags og:image
   - Atributos data-src (lazy loading)
   - Tags <img> regulares
   - JSON-LD estructurado
4. Devuelve array de imágenes con URLs de proxy

### Flujo del Proxy:
1. **img-proxy** recibe URL por query string
2. Valida que sea URL válida e imagen
3. Descarga imagen con headers apropiados
4. Devuelve imagen con cache headers
5. Si falla, devuelve placeholder automático

---

## 📱 Integración en tu Aplicación

El HTML ya está actualizado para usar automáticamente:

- **Desarrollo local**: Servidor Node.js (localhost:3001)
- **Producción Netlify**: Funciones serverless con proxy

### Detección automática de entorno:
```javascript
const isProduction = window.location.hostname !== 'localhost';
const apiUrl = isProduction 
    ? '/.netlify/functions/extract-images' 
    : 'http://localhost:3001/scrape-image';
```

---

## 🌐 URLs de Ejemplo

### Extraer imágenes de una propiedad:
```
https://tu-sitio.netlify.app/.netlify/functions/extract-images/2950
```

### Proxy de imagen específica:
```
https://tu-sitio.netlify.app/.netlify/functions/img-proxy?url=https://cl.fichapublica.com/image.jpg
```

---

## 🔒 Seguridad y Límites

- ✅ Solo acepta URLs http/https
- ✅ Valida que el contenido sea imagen
- ✅ Headers CORS configurados
- ✅ Timeout de 10 segundos
- ✅ Cache inteligente para reducir requests

---

## 🚨 Troubleshooting

### Si las imágenes no cargan:
1. Verifica los logs de Netlify Functions
2. Testa las URLs manualmente: `/.netlify/functions/extract-images/2950`
3. Verifica que FichaPublica no esté bloqueando requests

### Fallbacks automáticos:
- Si extracción falla → placeholders de Unsplash
- Si proxy falla → imagen de error generada
- Si función no responde → placeholders locales

---

## 📊 Ventajas del Sistema

✅ **Sin CORS**: Bypassa completamente las restricciones  
✅ **Cacheo**: Reduce llamadas repetidas  
✅ **Fallbacks**: Siempre muestra algo  
✅ **Escalable**: Funciona en Netlify sin configuración  
✅ **Debugging**: Logs detallados en consola  
✅ **Compatible**: Funciona en desarrollo y producción  