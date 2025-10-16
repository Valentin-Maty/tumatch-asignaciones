# 🕷️ Servidor de Web Scraping para FichaPublica

## 📋 Requisitos Previos

1. **Instalar Node.js** desde https://nodejs.org/
2. **Abrir terminal** en la carpeta del proyecto

## 🚀 Instalación y Ejecución

### Paso 1: Instalar dependencias
```bash
npm install
```

### Paso 2: Ejecutar el servidor
```bash
npm start
```

El servidor se ejecutará en: `http://localhost:3001`

## 🔧 Cómo Funciona

### Endpoint Principal
```
GET http://localhost:3001/scrape-image/{PROPERTY_ID}
```

**Ejemplo:**
```
http://localhost:3001/scrape-image/2950
```

### Respuesta JSON
```json
{
  "success": true,
  "propertyId": "2950",
  "mainImage": "https://2clicsalmcl.blob.core.windows.net/chile/216/property-images/2025/9/f23b1e02-83a2-4d1c-9d9b-2c77cee47ddc.jpeg",
  "method": "puppeteer",
  "scrapedAt": "2025-01-16T20:30:45.123Z"
}
```

## 🔍 Métodos de Scraping

1. **Puppeteer (Recomendado):** Renderiza JavaScript y extrae imágenes dinámicas
2. **Cheerio + Fetch:** Más rápido, analiza HTML estático y meta tags

## 🐛 Troubleshooting

### Error: "puppeteer no instala"
```bash
npm install puppeteer --unsafe-perm=true --allow-root
```

### Error: "Puerto ocupado"
Cambia el puerto en `scraper-server.js`:
```javascript
const PORT = 3002; // Cambiar número
```

### Error: "Cannot find module"
```bash
npm install
```

## 🧪 Probar el Servidor

### Verificar que funcione:
```
http://localhost:3001/health
```

### Probar scraping:
```
http://localhost:3001/scrape-image/2950
```

## 📝 Notas Importantes

- El servidor debe estar ejecutándose para que funcione el scraping
- Puppeteer descarga Chrome automáticamente (~170MB)
- Las imágenes se extraen en tiempo real desde FichaPublica
- Si FichaPublica bloquea, el servidor seguirá intentando con diferentes métodos