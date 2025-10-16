const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');
const fetch = require('node-fetch');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Cache simple para evitar múltiples solicitudes
const imageCache = new Map();

// Endpoint para scraping de imágenes de FichaPublica
app.get('/scrape-image/:propertyId', async (req, res) => {
    try {
        const { propertyId } = req.params;
        
        // Verificar caché
        if (imageCache.has(propertyId)) {
            const cached = imageCache.get(propertyId);
            if (Date.now() - cached.timestamp < 3600000) { // 1 hora de caché
                return res.json(cached.data);
            }
        }
        
        const fichaUrl = `https://cl.fichapublica.com/pub/propiedad/${propertyId}`;
        
        console.log(`🔍 Buscando imagen para propiedad: ${propertyId}`);
        
        try {
            const response = await fetch(fichaUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Cache-Control': 'max-age=0'
                }
            });
            
            const html = await response.text();
            const $ = cheerio.load(html);
            
            // Buscar diferentes posibles ubicaciones de imágenes
            let mainImage = null;
            
            // 1. Meta tag og:image (más confiable)
            mainImage = $('meta[property="og:image"]').attr('content');
            
            // 2. Buscar en el carrusel principal
            if (!mainImage) {
                mainImage = $('.carousel-item img, .swiper-slide img, .property-image img').first().attr('src');
            }
            
            // 3. Buscar cualquier imagen con blob.core.windows.net
            if (!mainImage) {
                $('img').each((i, elem) => {
                    const src = $(elem).attr('src') || $(elem).attr('data-src');
                    if (src && src.includes('blob.core.windows.net') && src.includes('property-images')) {
                        mainImage = src;
                        return false; // break
                    }
                });
            }
            
            // 4. Buscar en scripts JSON-LD
            if (!mainImage) {
                $('script[type="application/ld+json"]').each((i, elem) => {
                    try {
                        const jsonData = JSON.parse($(elem).html());
                        if (jsonData.image) {
                            mainImage = Array.isArray(jsonData.image) ? jsonData.image[0] : jsonData.image;
                            return false;
                        }
                    } catch (e) {}
                });
            }
            
            // 5. Buscar la primera imagen JPG/JPEG válida
            if (!mainImage) {
                $('img').each((i, elem) => {
                    const src = $(elem).attr('src') || $(elem).attr('data-src');
                    if (src && (src.includes('.jpg') || src.includes('.jpeg') || src.includes('.webp')) 
                        && !src.includes('logo') && !src.includes('icon') && !src.includes('avatar')) {
                        mainImage = src;
                        return false;
                    }
                });
            }
            
            if (mainImage) {
                // Asegurar URL completa
                if (mainImage.startsWith('//')) {
                    mainImage = 'https:' + mainImage;
                } else if (mainImage.startsWith('/')) {
                    mainImage = 'https://cl.fichapublica.com' + mainImage;
                }
                
                const responseData = {
                    success: true,
                    propertyId,
                    mainImage,
                    method: 'cheerio',
                    scrapedAt: new Date().toISOString()
                };
                
                // Guardar en caché
                imageCache.set(propertyId, {
                    data: responseData,
                    timestamp: Date.now()
                });
                
                console.log(`✅ Imagen encontrada para ${propertyId}`);
                return res.json(responseData);
            }
            
        } catch (fetchError) {
            console.log('❌ Error al obtener página:', fetchError.message);
        }
        
        // Si no se encuentra nada, devolver placeholder específico
        const placeholderData = {
            success: false,
            propertyId,
            mainImage: `https://via.placeholder.com/400x300/1a1a1a/ffffff?text=Propiedad+${propertyId}`,
            error: 'No se pudo obtener imagen',
            scrapedAt: new Date().toISOString()
        };
        
        res.json(placeholderData);
        
    } catch (error) {
        console.error('❌ Error general:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            mainImage: 'https://via.placeholder.com/400x300/1a1a1a/ffffff?text=Error'
        });
    }
});

// Endpoint de salud
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        cacheSize: imageCache.size
    });
});

// Endpoint raíz
app.get('/', (req, res) => {
    res.send(`
        <h1>🕷️ Servidor de Scraping Activo</h1>
        <p>Endpoints disponibles:</p>
        <ul>
            <li>GET /health - Estado del servidor</li>
            <li>GET /scrape-image/{propertyId} - Obtener imagen de propiedad</li>
        </ul>
        <p>Ejemplo: <a href="/scrape-image/2950">/scrape-image/2950</a></p>
    `);
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor de scraping ejecutándose en http://localhost:${PORT}`);
    console.log(`📡 Endpoint: http://localhost:${PORT}/scrape-image/{propertyId}`);
    console.log(`🔧 Prueba: http://localhost:${PORT}/health`);
});