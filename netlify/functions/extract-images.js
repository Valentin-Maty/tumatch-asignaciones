/**
 * Función Serverless para extraer imágenes específicas de FichaPublica
 * 
 * Busca específicamente el patrón Angular:
 * <img _ngcontent-ng-c2394620781="" class="img_property_full ng-tns-c2394620781-0" src="https://2clicsalmcl.blob.core.windows.net/...">
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
        console.log('[extract-images] HTML obtenido, buscando imágenes Angular...');
        
        const images = [];
        const seenUrls = new Set();

        // PATRÓN ESPECÍFICO ANGULAR: img_property_full con atributos _ngcontent
        // Buscar: <img _ngcontent-ng-c2394620781="" class="img_property_full ng-tns-c2394620781-0" src="https://2clicsalmcl.blob.core.windows.net/...">
        
        console.log('[extract-images] Buscando patrón Angular específico...');
        
        // Patrón 1: Búsqueda específica Angular
        const angularImgPattern = /<img[^>]*_ngcontent[^>]*class=["'][^"']*img_property_full[^"']*["'][^>]*src=["']([^"']+)["']/gi;
        
        let match;
        while ((match = angularImgPattern.exec(html)) !== null) {
            const imageUrl = match[1];
            console.log('[extract-images] ✅ Imagen Angular encontrada:', imageUrl);
            
            if (!seenUrls.has(imageUrl) && imageUrl.includes('blob.core.windows.net')) {
                seenUrls.add(imageUrl);
                images.push({
                    url: imageUrl,
                    source: 'angular-img_property_full',
                    proxyUrl: `/.netlify/functions/img-proxy?url=${encodeURIComponent(imageUrl)}`
                });
            }
        }

        // Patrón 2: Búsqueda simplificada de class="img_property_full"
        console.log('[extract-images] Buscando img_property_full simplificado...');
        
        const simpleImgPattern = /class=["'][^"']*img_property_full[^"']*["'][^>]*src=["']([^"']+)["']/gi;
        while ((match = simpleImgPattern.exec(html)) !== null) {
            const imageUrl = match[1];
            console.log('[extract-images] ✅ Imagen img_property_full encontrada:', imageUrl);
            
            if (!seenUrls.has(imageUrl) && imageUrl.includes('blob.core.windows.net')) {
                seenUrls.add(imageUrl);
                images.push({
                    url: imageUrl,
                    source: 'img_property_full_simple',
                    proxyUrl: `/.netlify/functions/img-proxy?url=${encodeURIComponent(imageUrl)}`
                });
            }
        }

        // Patrón 3: Búsqueda directa de URLs de Azure Blob (2clicsalmcl.blob.core.windows.net)
        console.log('[extract-images] Buscando URLs de Azure Blob directamente...');
        
        const azureBlobPattern = /https:\/\/2clicsalmcl\.blob\.core\.windows\.net\/chile\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp)/gi;
        const azureMatches = html.matchAll(azureBlobPattern);
        
        for (const blobMatch of azureMatches) {
            const imageUrl = blobMatch[0];
            console.log('[extract-images] ✅ Azure Blob encontrada:', imageUrl);
            
            if (!seenUrls.has(imageUrl)) {
                seenUrls.add(imageUrl);
                images.push({
                    url: imageUrl,
                    source: 'azure-blob-direct',
                    proxyUrl: `/.netlify/functions/img-proxy?url=${encodeURIComponent(imageUrl)}`
                });
            }
        }

        // Patrón 4: Búsqueda inversa - encontrar src con blob.core.windows.net
        console.log('[extract-images] Búsqueda inversa por src...');
        
        const srcBlobPattern = /src=["'](https:\/\/[^"']*blob\.core\.windows\.net[^"']+\.(?:jpg|jpeg|png|webp))["']/gi;
        while ((match = srcBlobPattern.exec(html)) !== null) {
            const imageUrl = match[1];
            console.log('[extract-images] ✅ Src Blob encontrada:', imageUrl);
            
            if (!seenUrls.has(imageUrl)) {
                seenUrls.add(imageUrl);
                images.push({
                    url: imageUrl,
                    source: 'src-blob-inverse',
                    proxyUrl: `/.netlify/functions/img-proxy?url=${encodeURIComponent(imageUrl)}`
                });
            }
        }

        console.log(`[extract-images] Total encontradas: ${images.length} imágenes`);
        
        // Log detallado para debug
        images.forEach((img, index) => {
            console.log(`[extract-images] ${index + 1}. [${img.source}] ${img.url.substring(0, 100)}...`);
        });

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: images.length > 0,
                propertyId,
                fichaUrl,
                totalImages: images.length,
                images: images,
                mainImage: images.length > 0 ? images[0] : null,
                extractedAt: new Date().toISOString(),
                message: images.length === 0 ? 'No se encontraron imágenes con el patrón Angular especificado' : undefined,
                debug: {
                    htmlLength: html.length,
                    searchPatterns: [
                        'angular-img_property_full',
                        'img_property_full_simple',
                        'azure-blob-direct',
                        'src-blob-inverse'
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