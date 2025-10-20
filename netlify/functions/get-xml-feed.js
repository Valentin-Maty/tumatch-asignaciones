/**
 * Función para obtener el XML feed de propiedades
 * Evita problemas de CORS al descargar desde el frontend
 */

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/xml'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    try {
        console.log('[get-xml-feed] Descargando XML feed...');
        
        const xmlUrl = 'https://2clicsalmcl.blob.core.windows.net/chile/xml/proppit/feed.xml';
        
        const response = await fetch(xmlUrl, {
            headers: {
                'User-Agent': 'TuMatch-Portal/1.0',
                'Accept': 'application/xml, text/xml, */*'
            },
            timeout: 30000
        });
        
        if (!response.ok) {
            throw new Error(`Error descargando XML: ${response.status}`);
        }
        
        const xmlText = await response.text();
        
        if (!xmlText || xmlText.length < 1000) {
            throw new Error('XML vacío o muy pequeño');
        }
        
        console.log(`[get-xml-feed] XML descargado: ${Math.round(xmlText.length / 1024)} KB`);
        
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: xmlText
        };

    } catch (error) {
        console.error('[get-xml-feed] Error:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};