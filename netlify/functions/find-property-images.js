/**
 * Función para encontrar imágenes de propiedades en Azure Blob Storage
 * Usa patrones conocidos y prueba diferentes combinaciones
 */

const fetch = require('node-fetch');

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

        console.log(`[find-property-images] Buscando imágenes para propiedad: ${propertyId}`);

        const foundImages = [];
        
        // Patrón base: https://2clicsalmcl.blob.core.windows.net/chile/216/property-images/YEAR/MONTH/GUID.jpeg
        const baseUrl = 'https://2clicsalmcl.blob.core.windows.net/chile/216/property-images';
        
        // Probar diferentes años y meses (empezando por los más recientes)
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        
        const yearsToTry = [currentYear, currentYear - 1];
        const monthsToTry = [currentMonth, currentMonth - 1, currentMonth - 2, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
        
        // Solo usar GUIDs conocidos para propiedades específicas
        const knownPropertyGUIDs = {
            '2950': [
                'f23b1e02-83a2-4d1c-9d9b-2c77cee47ddc',
                '4b48e910-f106-4b56-a4c0-130de3c676a8'
            ]
            // Agregar más propiedades solo cuando sepamos sus GUIDs reales
        };
        
        // Si no tenemos GUIDs conocidos para esta propiedad, no buscar
        if (!knownPropertyGUIDs[propertyId]) {
            console.log(`[find-property-images] No hay GUIDs conocidos para propiedad ${propertyId}`);
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    propertyId,
                    totalImages: 0,
                    images: [],
                    mainImage: null,
                    tested: 0,
                    searchedAt: new Date().toISOString(),
                    message: `No hay imágenes conocidas para la propiedad ${propertyId}`
                })
            };
        }
        
        const allGUIDs = knownPropertyGUIDs[propertyId];
        const seenUrls = new Set();
        
        // Función para probar si una imagen existe
        async function testImageExists(url) {
            try {
                const response = await fetch(url, { 
                    method: 'HEAD',
                    timeout: 3000
                });
                return response.ok;
            } catch (error) {
                return false;
            }
        }
        
        // Probar diferentes combinaciones
        console.log(`[find-property-images] Probando ${yearsToTry.length} años x ${monthsToTry.length} meses x ${allGUIDs.length} GUIDs`);
        
        let tested = 0;
        const maxTests = 50; // Limitar para evitar timeout
        
        for (const year of yearsToTry) {
            for (const month of monthsToTry) {
                for (const guid of allGUIDs) {
                    if (tested >= maxTests) break;
                    
                    const imageUrl = `${baseUrl}/${year}/${month}/${guid}.jpeg`;
                    
                    console.log(`[find-property-images] Probando: ${imageUrl}`);
                    
                    const exists = await testImageExists(imageUrl);
                    tested++;
                    
                    if (exists && !seenUrls.has(imageUrl)) {
                        console.log(`[find-property-images] ✅ Imagen encontrada: ${imageUrl}`);
                        seenUrls.add(imageUrl);
                        foundImages.push({
                            url: imageUrl,
                            proxyUrl: `/.netlify/functions/img-proxy?url=${encodeURIComponent(imageUrl)}`,
                            year: year,
                            month: month,
                            guid: guid,
                            found: true
                        });
                    }
                    
                    if (tested >= maxTests) break;
                }
                if (tested >= maxTests) break;
            }
            if (tested >= maxTests) break;
        }
        
        console.log(`[find-property-images] Pruebas completadas: ${tested}, Imágenes encontradas: ${foundImages.length}`);
        
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: foundImages.length > 0,
                propertyId,
                totalImages: foundImages.length,
                images: foundImages,
                mainImage: foundImages.length > 0 ? foundImages[0] : null,
                tested: tested,
                searchedAt: new Date().toISOString(),
                message: foundImages.length === 0 ? 'No se encontraron imágenes en Azure Blob Storage' : undefined
            })
        };

    } catch (error) {
        console.error('[find-property-images] Error:', error);
        
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: error.message,
                propertyId: event.queryStringParameters?.propertyId || 'unknown'
            })
        };
    }
};