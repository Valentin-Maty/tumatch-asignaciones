/**
 * Función para mostrar el HTML completo de FichaPublica
 * Para análisis y debugging
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

        const fichaUrl = `https://www.tumatchpropiedades.cl/propiedad/${propertyId}`;
        const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(fichaUrl)}`;
        
        console.log(`[show-html] Obteniendo HTML completo para propiedad: ${propertyId}`);
        
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
        
        // Análisis básico
        const analysis = {
            htmlLength: html.length,
            containsAngular: html.includes('_ngcontent'),
            containsImgPropertyFull: html.includes('img_property_full'),
            contains2clics: html.includes('2clicsalmcl'),
            containsBlobCore: html.includes('blob.core.windows.net'),
            containsJavaScript: html.includes('<script'),
            containsReact: html.includes('React') || html.includes('react'),
            containsVue: html.includes('Vue') || html.includes('vue'),
            
            // Contar elementos
            totalImgTags: (html.match(/<img[^>]*>/gi) || []).length,
            totalScriptTags: (html.match(/<script[^>]*>/gi) || []).length,
            totalDivTags: (html.match(/<div[^>]*>/gi) || []).length,
            
            // Buscar posibles patrones de URLs
            blobUrls: html.match(/https:\/\/[^"'\s]*blob\.core\.windows\.net[^"'\s]*/gi) || [],
            imageUrls: html.match(/https:\/\/[^"'\s]*\.(jpg|jpeg|png|webp|gif)[^"'\s]*/gi) || [],
            
            // Buscar posibles identificadores
            guidPatterns: html.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || []
        };

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                propertyId,
                fichaUrl,
                html: html, // HTML completo
                analysis: analysis,
                extractedAt: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('[show-html] Error:', error);
        
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