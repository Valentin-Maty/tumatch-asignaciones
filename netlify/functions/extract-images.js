/**
 * Función para extraer URLs de imágenes de FichaPublica
 * Usa AllOrigins para evitar CORS y extraer todas las imágenes de una propiedad
 */

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // Extraer propertyId de la ruta
        const pathParts = event.path.split('/');
        const propertyId = pathParts[pathParts.length - 1];
        
        if (!propertyId || propertyId === 'extract-images') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'ID de propiedad requerido' })
            };
        }

        console.log(`[extract-images] Extrayendo imágenes para propiedad: ${propertyId}`);
        
        const fichaUrl = `https://cl.fichapublica.com/pub/propiedad/${propertyId}`;
        
        // Usar AllOrigins para obtener el HTML
        const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(fichaUrl)}`;
        
        const response = await fetch(allOriginsUrl);
        const data = await response.json();
        
        if (!data || !data.contents) {
            throw new Error('No se pudo obtener el contenido');
        }

        const html = data.contents;
        const images = [];
        const seenUrls = new Set();

        // Patrón 1: Imágenes de Azure Blob Storage (más común en sitios chilenos)
        const azurePattern = /https?:\/\/[a-z0-9]+\.blob\.core\.windows\.net\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp)/gi;
        const azureMatches = html.matchAll(azurePattern);
        for (const match of azureMatches) {
            if (!seenUrls.has(match[0])) {
                seenUrls.add(match[0]);
                images.push({
                    url: match[0],
                    source: 'azure-blob',
                    proxyUrl: `/.netlify/functions/img-proxy?url=${encodeURIComponent(match[0])}`
                });
            }
        }

        // Patrón 2: Meta og:image
        const ogPattern = /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i;
        const ogMatch = html.match(ogPattern);
        if (ogMatch && ogMatch[1]) {
            let imageUrl = ogMatch[1];
            if (!imageUrl.startsWith('http')) {
                imageUrl = 'https://cl.fichapublica.com' + (imageUrl.startsWith('/') ? '' : '/') + imageUrl;
            }
            if (!seenUrls.has(imageUrl)) {
                seenUrls.add(imageUrl);
                images.push({
                    url: imageUrl,
                    source: 'og-meta',
                    proxyUrl: `/.netlify/functions/img-proxy?url=${encodeURIComponent(imageUrl)}`
                });
            }
        }

        // Patrón 3: Imágenes con data-src (lazy loading)
        const dataSrcPattern = /data-src=["']([^"']+\.(?:jpg|jpeg|png|webp))["']/gi;
        const dataSrcMatches = html.matchAll(dataSrcPattern);
        for (const match of dataSrcMatches) {
            let imageUrl = match[1];
            if (!imageUrl.startsWith('http')) {
                imageUrl = imageUrl.startsWith('//') 
                    ? 'https:' + imageUrl
                    : 'https://cl.fichapublica.com' + (imageUrl.startsWith('/') ? '' : '/') + imageUrl;
            }
            if (!seenUrls.has(imageUrl)) {
                seenUrls.add(imageUrl);
                images.push({
                    url: imageUrl,
                    source: 'data-src',
                    proxyUrl: `/.netlify/functions/img-proxy?url=${encodeURIComponent(imageUrl)}`
                });
            }
        }

        // Patrón 4: Imágenes regulares con src
        const srcPattern = /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp))["']/gi;
        const srcMatches = html.matchAll(srcPattern);
        for (const match of srcMatches) {
            let imageUrl = match[1];
            // Filtrar logos y iconos
            if (imageUrl.includes('logo') || imageUrl.includes('icon') || imageUrl.includes('avatar')) {
                continue;
            }
            if (!imageUrl.startsWith('http')) {
                imageUrl = imageUrl.startsWith('//') 
                    ? 'https:' + imageUrl
                    : 'https://cl.fichapublica.com' + (imageUrl.startsWith('/') ? '' : '/') + imageUrl;
            }
            if (!seenUrls.has(imageUrl)) {
                seenUrls.add(imageUrl);
                images.push({
                    url: imageUrl,
                    source: 'img-src',
                    proxyUrl: `/.netlify/functions/img-proxy?url=${encodeURIComponent(imageUrl)}`
                });
            }
        }

        // Patrón 5: URLs en JSON-LD
        const jsonLdPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
        const jsonLdMatches = html.matchAll(jsonLdPattern);
        for (const match of jsonLdMatches) {
            try {
                const jsonData = JSON.parse(match[1]);
                const extractImagesFromJson = (obj) => {
                    if (typeof obj === 'string' && obj.match(/\.(jpg|jpeg|png|webp)/i)) {
                        if (!obj.startsWith('http')) {
                            obj = 'https://cl.fichapublica.com' + (obj.startsWith('/') ? '' : '/') + obj;
                        }
                        if (!seenUrls.has(obj)) {
                            seenUrls.add(obj);
                            images.push({
                                url: obj,
                                source: 'json-ld',
                                proxyUrl: `/.netlify/functions/img-proxy?url=${encodeURIComponent(obj)}`
                            });
                        }
                    } else if (Array.isArray(obj)) {
                        obj.forEach(extractImagesFromJson);
                    } else if (obj && typeof obj === 'object') {
                        Object.values(obj).forEach(extractImagesFromJson);
                    }
                };
                extractImagesFromJson(jsonData);
            } catch (e) {
                // Ignorar JSON inválido
            }
        }

        console.log(`[extract-images] Encontradas ${images.length} imágenes`);

        // Si no se encontraron imágenes, usar placeholders
        if (images.length === 0) {
            const placeholders = [
                'https://images.unsplash.com/photo-1568605114967-8130f3a36994',
                'https://images.unsplash.com/photo-1570129477492-45c003edd2be',
                'https://images.unsplash.com/photo-1554995207-c18c203602cb'
            ];
            
            const selectedPlaceholder = placeholders[parseInt(propertyId) % placeholders.length];
            images.push({
                url: `${selectedPlaceholder}?w=600&h=400&fit=crop&q=80`,
                source: 'placeholder',
                proxyUrl: `/.netlify/functions/img-proxy?url=${encodeURIComponent(`${selectedPlaceholder}?w=600&h=400&fit=crop&q=80`)}`
            });
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                propertyId,
                fichaUrl,
                totalImages: images.length,
                images: images,
                mainImage: images[0]?.proxyUrl || null,
                extractedAt: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('[extract-images] Error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                images: [],
                mainImage: null
            })
        };
    }
};