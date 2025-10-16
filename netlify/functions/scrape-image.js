const cheerio = require('cheerio');
const fetch = require('node-fetch');

// Cache en memoria para las funciones
const imageCache = new Map();

exports.handler = async (event, context) => {
    // Configurar CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Manejar preflight OPTIONS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        // Extraer propertyId de la URL
        const pathParts = event.path.split('/');
        const propertyId = pathParts[pathParts.length - 1];
        
        if (!propertyId || propertyId === 'scrape-image') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Property ID required' })
            };
        }

        // Verificar caché
        if (imageCache.has(propertyId)) {
            const cached = imageCache.get(propertyId);
            if (Date.now() - cached.timestamp < 3600000) { // 1 hora
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(cached.data)
                };
            }
        }

        const fichaUrl = `https://cl.fichapublica.com/pub/propiedad/${propertyId}`;
        console.log(`Scraping: ${fichaUrl}`);

        const response = await fetch(fichaUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });

        const html = await response.text();
        const $ = cheerio.load(html);

        let mainImage = null;

        // 1. Meta tag og:image
        mainImage = $('meta[property="og:image"]').attr('content');

        // 2. Buscar imágenes con blob.core.windows.net
        if (!mainImage) {
            $('img').each((i, elem) => {
                const src = $(elem).attr('src') || $(elem).attr('data-src');
                if (src && src.includes('blob.core.windows.net')) {
                    mainImage = src;
                    return false;
                }
            });
        }

        // 3. Primera imagen válida
        if (!mainImage) {
            $('img').each((i, elem) => {
                const src = $(elem).attr('src') || $(elem).attr('data-src');
                if (src && (src.includes('.jpg') || src.includes('.jpeg')) && !src.includes('logo')) {
                    mainImage = src;
                    return false;
                }
            });
        }

        // Asegurar URL completa
        if (mainImage) {
            if (mainImage.startsWith('//')) {
                mainImage = 'https:' + mainImage;
            } else if (mainImage.startsWith('/')) {
                mainImage = 'https://cl.fichapublica.com' + mainImage;
            }

            const responseData = {
                success: true,
                propertyId,
                mainImage,
                method: 'netlify-function',
                scrapedAt: new Date().toISOString()
            };

            // Guardar en caché
            imageCache.set(propertyId, {
                data: responseData,
                timestamp: Date.now()
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(responseData)
            };
        }

        // No se encontró imagen
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: false,
                propertyId,
                mainImage: `https://via.placeholder.com/400x300/1a1a1a/ffffff?text=Propiedad+${propertyId}`,
                error: 'No image found'
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                mainImage: 'https://via.placeholder.com/400x300/1a1a1a/ffffff?text=Error'
            })
        };
    }
};