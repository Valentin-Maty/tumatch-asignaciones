/**
 * Función para obtener imágenes de propiedades desde el XML feed
 * Fuente: https://2clicsalmcl.blob.core.windows.net/chile/xml/proppit/feed.xml
 */

const fetch = require('node-fetch');

// Cache para el XML parseado (5 minutos)
let xmlCache = {
    data: null,
    timestamp: 0,
    ttl: 5 * 60 * 1000 // 5 minutos
};

exports.handler = async (event, context) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    try {
        const { propertyId } = event.queryStringParameters || {};
        
        if (!propertyId) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'propertyId requerido' })
            };
        }

        console.log(`[get-xml-images] Buscando imágenes para propiedad: ${propertyId}`);

        // Verificar cache
        const now = Date.now();
        let xmlText;
        
        if (xmlCache.data && (now - xmlCache.timestamp < xmlCache.ttl)) {
            console.log('[get-xml-images] Usando XML desde cache');
            xmlText = xmlCache.data;
        } else {
            console.log('[get-xml-images] Descargando XML feed...');
            const xmlUrl = 'https://2clicsalmcl.blob.core.windows.net/chile/xml/proppit/feed.xml';
            
            const response = await fetch(xmlUrl, {
                headers: {
                    'Accept': 'application/xml, text/xml',
                    'User-Agent': 'TuMatch-Portal/1.0'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Error descargando XML: ${response.status}`);
            }
            
            xmlText = await response.text();
            
            // Actualizar cache
            xmlCache.data = xmlText;
            xmlCache.timestamp = now;
            console.log('[get-xml-images] XML actualizado en cache');
        }

        // Parsear XML manualmente para encontrar la propiedad
        // Buscar el property con el ID correcto
        const propertyRegex = new RegExp(`<property[^>]*>.*?<id[^>]*>\\s*${propertyId}\\s*</id>.*?</property>`, 'gsi');
        const propertyMatch = xmlText.match(propertyRegex);
        
        if (!propertyMatch) {
            console.log(`[get-xml-images] Propiedad ${propertyId} no encontrada en XML`);
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    propertyId,
                    message: 'Propiedad no encontrada en el feed XML',
                    images: []
                })
            };
        }

        const propertyXml = propertyMatch[0];
        
        // Extraer todas las imágenes de la propiedad
        const imageRegex = /<image>([^<]+)<\/image>/gi;
        const imageMatches = [...propertyXml.matchAll(imageRegex)];
        
        const images = imageMatches.map((match, index) => {
            const imageUrl = match[1].trim();
            return {
                url: imageUrl,
                proxyUrl: `/.netlify/functions/img-proxy?url=${encodeURIComponent(imageUrl)}`,
                index: index + 1,
                found: true
            };
        });

        // También buscar imagen principal si existe
        const mainImageRegex = /<main_image>([^<]+)<\/main_image>/i;
        const mainImageMatch = propertyXml.match(mainImageRegex);
        
        if (mainImageMatch && !images.some(img => img.url === mainImageMatch[1].trim())) {
            images.unshift({
                url: mainImageMatch[1].trim(),
                proxyUrl: `/.netlify/functions/img-proxy?url=${encodeURIComponent(mainImageMatch[1].trim())}`,
                index: 0,
                isMain: true,
                found: true
            });
        }

        console.log(`[get-xml-images] Encontradas ${images.length} imágenes para propiedad ${propertyId}`);

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: images.length > 0,
                propertyId,
                totalImages: images.length,
                images: images,
                mainImage: images.length > 0 ? images[0] : null,
                source: 'xml-feed',
                extractedAt: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('[get-xml-images] Error:', error);
        
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: error.message,
                propertyId: event.queryStringParameters?.propertyId || 'unknown',
                source: 'xml-feed'
            })
        };
    }
};