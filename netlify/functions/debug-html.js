/**
 * Función de DEBUG para ver el HTML real de FichaPublica
 * Esto nos ayudará a entender la estructura exacta
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

        const fichaUrl = `https://cl.fichapublica.com/pub/propiedad/${propertyId}`;
        const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(fichaUrl)}`;
        
        const response = await fetch(allOriginsUrl);
        const data = await response.json();
        
        if (!data || !data.contents) {
            throw new Error('No se pudo obtener HTML');
        }

        const html = data.contents;
        
        // Buscar todas las imágenes en el HTML
        const allImages = [];
        const imgPattern = /<img[^>]+>/gi;
        let match;
        
        while ((match = imgPattern.exec(html)) !== null) {
            allImages.push(match[0]);
        }
        
        // Buscar específicamente patrones que contengan "blob.core.windows.net"
        const blobImages = allImages.filter(img => img.includes('blob.core.windows.net'));
        
        // Buscar img_property_full
        const propertyFullImages = allImages.filter(img => img.includes('img_property_full'));
        
        // Buscar cualquier imagen con 2clicsalmcl
        const clicsImages = allImages.filter(img => img.includes('2clicsalmcl'));
        
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                propertyId,
                fichaUrl,
                htmlLength: html.length,
                totalImgTags: allImages.length,
                
                // Mostrar primeras 5 imágenes completas
                sampleImages: allImages.slice(0, 5),
                
                // Imágenes que contienen blob
                blobImages: blobImages,
                blobCount: blobImages.length,
                
                // Imágenes con img_property_full
                propertyFullImages: propertyFullImages,
                propertyFullCount: propertyFullImages.length,
                
                // Imágenes con 2clicsalmcl
                clicsImages: clicsImages,
                clicsCount: clicsImages.length,
                
                // Buscar texto específico para debug
                containsAngular: html.includes('_ngcontent'),
                containsImgPropertyFull: html.includes('img_property_full'),
                contains2clics: html.includes('2clicsalmcl'),
                containsBlobCore: html.includes('blob.core.windows.net'),
                
                extractedAt: new Date().toISOString()
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: error.message,
                stack: error.stack
            })
        };
    }
};