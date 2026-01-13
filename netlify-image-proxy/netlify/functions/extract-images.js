/**
 * Función Serverless para extraer imágenes de FichaPublica
 * 
 * Esta función obtiene el HTML de una ficha de FichaPublica y extrae
 * todas las URLs de imágenes que encuentra.
 * 
 * Uso: /.netlify/functions/extract-images?propertyId=2950
 */

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // Headers CORS
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Manejar preflight OPTIONS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    try {
        // Extraer propertyId de los query parameters
        const { propertyId } = event.queryStringParameters || {};
        
        if (!propertyId) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ 
                    error: 'Parámetro "propertyId" requerido',
                    ejemplo: '/.netlify/functions/extract-images?propertyId=2950'
                })
            };
        }

        console.log(`[extract-images] Procesando propiedad: ${propertyId}`);
        
        const fichaUrl = `https://www.tumatchpropiedades.cl/propiedad/${propertyId}`;
        
        // Usar AllOrigins para obtener el HTML y evitar CORS
        const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(fichaUrl)}`;
        
        console.log('[extract-images] Obteniendo HTML via AllOrigins...');
        
        const response = await fetch(allOriginsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });
        
        if (!response.ok) {
            throw new Error(`Error al obtener HTML: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data || !data.contents) {
            throw new Error('No se pudo obtener el contenido HTML');
        }

        const html = data.contents;
        console.log('[extract-images] HTML obtenido, buscando imágenes...');
        
        const images = [];
        const seenUrls = new Set();

        // PATRÓN 1: Buscar específicamente imágenes con class="img_property_full"
        const imgPropertyFullPattern = /<img[^>]*class=["'][^"']*img_property_full[^"']*["'][^>]*src=["']([^"']+)["'][^>]*>/gi;
        let match;
        while ((match = imgPropertyFullPattern.exec(html)) !== null) {
            const imageUrl = match[1];
            if (!seenUrls.has(imageUrl)) {
                seenUrls.add(imageUrl);
                images.push({
                    url: imageUrl,
                    source: 'img_property_full',
                    proxyUrl: `/.netlify/functions/img-proxy?url=${encodeURIComponent(imageUrl)}`
                });
            }
        }

        // PATRÓN 2: Buscar imágenes de Azure Blob Storage (blob.core.windows.net)
        const azureBlobPattern = /https:\/\/[a-z0-9]+\.blob\.core\.windows\.net\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp)/gi;
        const azureMatches = html.matchAll(azureBlobPattern);
        for (const match of azureMatches) {
            const imageUrl = match[0];
            if (!seenUrls.has(imageUrl)) {
                seenUrls.add(imageUrl);
                images.push({
                    url: imageUrl,
                    source: 'azure-blob',
                    proxyUrl: `/.netlify/functions/img-proxy?url=${encodeURIComponent(imageUrl)}`
                });
            }
        }

        // PATRÓN 3: Meta tag og:image
        const ogImagePattern = /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i;
        const ogMatch = html.match(ogImagePattern);
        if (ogMatch && ogMatch[1]) {
            let imageUrl = ogMatch[1];
            if (!imageUrl.startsWith('http')) {
                imageUrl = 'https://cl.fichapublica.com' + (imageUrl.startsWith('/') ? '' : '/') + imageUrl;
            }
            if (!seenUrls.has(imageUrl)) {
                seenUrls.add(imageUrl);
                images.push({
                    url: imageUrl,
                    source: 'og-image',
                    proxyUrl: `/.netlify/functions/img-proxy?url=${encodeURIComponent(imageUrl)}`
                });
            }
        }

        // PATRÓN 4: Cualquier imagen en tags <img> que contenga extensiones válidas
        const generalImgPattern = /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp))["'][^>]*>/gi;
        const generalMatches = html.matchAll(generalImgPattern);
        for (const match of generalMatches) {
            let imageUrl = match[1];
            
            // Filtrar logos, iconos y elementos de UI
            if (imageUrl.includes('logo') || 
                imageUrl.includes('icon') || 
                imageUrl.includes('avatar') ||
                imageUrl.includes('btn_') ||
                imageUrl.includes('button')) {
                continue;
            }
            
            // Completar URL relativa
            if (!imageUrl.startsWith('http')) {
                imageUrl = imageUrl.startsWith('//') 
                    ? 'https:' + imageUrl
                    : 'https://cl.fichapublica.com' + (imageUrl.startsWith('/') ? '' : '/') + imageUrl;
            }
            
            if (!seenUrls.has(imageUrl)) {
                seenUrls.add(imageUrl);
                images.push({
                    url: imageUrl,
                    source: 'general-img',
                    proxyUrl: `/.netlify/functions/img-proxy?url=${encodeURIComponent(imageUrl)}`
                });
            }
        }

        // Filtrar y ordenar imágenes (priorizar img_property_full y azure-blob)
        const priorityOrder = ['img_property_full', 'azure-blob', 'og-image', 'general-img'];
        images.sort((a, b) => {
            const priorityA = priorityOrder.indexOf(a.source);
            const priorityB = priorityOrder.indexOf(b.source);
            return priorityA - priorityB;
        });

        console.log(`[extract-images] Encontradas ${images.length} imágenes`);
        
        // Log de debug de las imágenes encontradas
        images.forEach((img, index) => {
            console.log(`[extract-images] ${index + 1}. ${img.source}: ${img.url.substring(0, 80)}...`);
        });

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                propertyId,
                fichaUrl,
                totalImages: images.length,
                images: images,
                mainImage: images.length > 0 ? images[0] : null,
                extractedAt: new Date().toISOString(),
                debug: {
                    htmlLength: html.length,
                    searchPatterns: [
                        'img_property_full',
                        'azure-blob', 
                        'og-image',
                        'general-img'
                    ]
                }
            })
        };

    } catch (error) {
        console.error('[extract-images] Error:', error);
        
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: error.message,
                propertyId: event.queryStringParameters?.propertyId || 'unknown',
                images: [],
                mainImage: null
            })
        };
    }
};