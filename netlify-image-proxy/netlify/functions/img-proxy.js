/**
 * Función Serverless para Netlify - Proxy de Imágenes
 * 
 * Esta función actúa como proxy para servir imágenes externas,
 * evitando problemas de CORS y hotlink protection.
 * 
 * Uso: /.netlify/functions/img-proxy?url=https://ejemplo.com/imagen.jpg
 */

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // Headers CORS para permitir acceso desde cualquier origen
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // Manejar preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    try {
        // Extraer la URL de la imagen de los query parameters
        const { url } = event.queryStringParameters || {};

        // Validar que se proporcionó una URL
        if (!url) {
            console.log('[img-proxy] Error: No se proporcionó URL');
            return {
                statusCode: 400,
                headers: { 
                    ...corsHeaders, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                    error: 'Parámetro "url" requerido',
                    ejemplo: '/.netlify/functions/img-proxy?url=https://ejemplo.com/imagen.jpg'
                })
            };
        }

        // Validar que la URL sea válida
        let targetUrl;
        try {
            targetUrl = new URL(url);
            // Solo permitir http y https
            if (!['http:', 'https:'].includes(targetUrl.protocol)) {
                throw new Error('Protocolo no válido');
            }
        } catch (e) {
            console.log('[img-proxy] URL inválida:', url);
            return {
                statusCode: 400,
                headers: { 
                    ...corsHeaders, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                    error: 'URL inválida',
                    url: url
                })
            };
        }

        console.log('[img-proxy] Descargando imagen:', url);

        // Hacer fetch a la imagen con headers que simulan un navegador real
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://cl.fichapublica.com/',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site',
                'Cache-Control': 'no-cache'
            },
            timeout: 15000 // 15 segundos timeout
        });

        // Verificar si la respuesta fue exitosa
        if (!response.ok) {
            console.log('[img-proxy] Error al descargar:', response.status, response.statusText);
            
            // Crear imagen de error simple (SVG)
            const errorSvg = `
                <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100%" height="100%" fill="#f3f4f6"/>
                    <text x="50%" y="40%" text-anchor="middle" font-family="Arial" font-size="16" fill="#6b7280">
                        Error ${response.status}
                    </text>
                    <text x="50%" y="60%" text-anchor="middle" font-family="Arial" font-size="14" fill="#9ca3af">
                        Imagen no disponible
                    </text>
                    <text x="50%" y="80%" text-anchor="middle" font-family="Arial" font-size="12" fill="#d1d5db">
                        🖼️
                    </text>
                </svg>
            `;
            
            return {
                statusCode: 200, // Devolver 200 para que la imagen se muestre
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'image/svg+xml',
                    'Cache-Control': 'no-cache'
                },
                body: errorSvg
            };
        }

        // Obtener el content-type original de la imagen
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        // Verificar que realmente sea una imagen
        if (!contentType.startsWith('image/')) {
            console.log('[img-proxy] El contenido no es una imagen:', contentType);
            
            return {
                statusCode: 400,
                headers: { 
                    ...corsHeaders, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                    error: 'La URL no devuelve una imagen',
                    contentType: contentType,
                    url: url
                })
            };
        }

        // Obtener el buffer de la imagen
        const imageBuffer = await response.buffer();
        
        console.log('[img-proxy] Imagen descargada exitosamente:', {
            url: url,
            contentType: contentType,
            size: `${Math.round(imageBuffer.length / 1024)}KB`
        });

        // Devolver la imagen con headers apropiados
        return {
            statusCode: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400', // Cache por 24 horas
                'X-Proxied-From': url,
                'Content-Length': imageBuffer.length.toString()
            },
            body: imageBuffer.toString('base64'),
            isBase64Encoded: true
        };

    } catch (error) {
        console.error('[img-proxy] Error general:', error);
        
        // SVG de error general
        const errorSvg = `
            <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="#fef2f2"/>
                <text x="50%" y="40%" text-anchor="middle" font-family="Arial" font-size="16" fill="#dc2626">
                    Error del Servidor
                </text>
                <text x="50%" y="60%" text-anchor="middle" font-family="Arial" font-size="14" fill="#b91c1c">
                    No se pudo cargar la imagen
                </text>
                <text x="50%" y="80%" text-anchor="middle" font-family="Arial" font-size="12" fill="#f87171">
                    ❌
                </text>
            </svg>
        `;
        
        return {
            statusCode: 200, // Devolver 200 para mostrar el error
            headers: {
                ...corsHeaders,
                'Content-Type': 'image/svg+xml',
                'Cache-Control': 'no-cache'
            },
            body: errorSvg
        };
    }
};