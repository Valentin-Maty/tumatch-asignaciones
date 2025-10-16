/**
 * Función Serverless - Proxy de Imágenes para Netlify
 * Evita problemas de CORS al servir imágenes externas
 */

exports.handler = async (event, context) => {
    // Headers CORS permitiendo todo origen
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
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
        // Extraer URL de los query parameters
        const params = event.queryStringParameters || {};
        const imageUrl = params.url;

        // Validar que se proporcionó una URL
        if (!imageUrl) {
            console.log('[img-proxy] Error: No se proporcionó URL');
            return {
                statusCode: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'URL de imagen requerida' })
            };
        }

        // Validar que la URL es válida
        let url;
        try {
            url = new URL(imageUrl);
            // Solo permitir http y https
            if (!['http:', 'https:'].includes(url.protocol)) {
                throw new Error('Protocolo no válido');
            }
        } catch (e) {
            console.log('[img-proxy] URL inválida:', imageUrl);
            return {
                statusCode: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'URL inválida' })
            };
        }

        console.log('[img-proxy] Descargando imagen:', imageUrl);

        // Descargar la imagen usando fetch nativo (disponible en Node 18+)
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                'Referer': 'https://cl.fichapublica.com/',
                'Cache-Control': 'no-cache'
            },
            timeout: 10000 // 10 segundos timeout
        });

        // Verificar si la respuesta fue exitosa
        if (!response.ok) {
            console.log('[img-proxy] Error al descargar imagen:', response.status);
            
            // Si es 404 o error, devolver placeholder
            const placeholderUrl = `https://via.placeholder.com/600x400/2a2a2a/ffffff?text=Imagen+No+Disponible`;
            const placeholderResponse = await fetch(placeholderUrl);
            const placeholderBuffer = await placeholderResponse.arrayBuffer();
            
            return {
                statusCode: 200,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'image/png',
                    'Cache-Control': 'public, max-age=3600'
                },
                body: Buffer.from(placeholderBuffer).toString('base64'),
                isBase64Encoded: true
            };
        }

        // Obtener el content-type de la imagen
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        
        // Verificar que sea una imagen
        if (!contentType.startsWith('image/')) {
            console.log('[img-proxy] El contenido no es una imagen:', contentType);
            return {
                statusCode: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'La URL no devuelve una imagen' })
            };
        }

        // Convertir la respuesta a buffer
        const imageBuffer = await response.arrayBuffer();

        // Devolver la imagen
        return {
            statusCode: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400', // Cachear por 24 horas
                'X-Proxied-From': imageUrl
            },
            body: Buffer.from(imageBuffer).toString('base64'),
            isBase64Encoded: true
        };

    } catch (error) {
        console.error('[img-proxy] Error general:', error);
        
        // En caso de error, devolver imagen de error
        const errorImageUrl = 'https://via.placeholder.com/600x400/ff0000/ffffff?text=Error+Cargando+Imagen';
        try {
            const errorResponse = await fetch(errorImageUrl);
            const errorBuffer = await errorResponse.arrayBuffer();
            
            return {
                statusCode: 200,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'image/png',
                    'Cache-Control': 'no-cache'
                },
                body: Buffer.from(errorBuffer).toString('base64'),
                isBase64Encoded: true
            };
        } catch (e) {
            // Si hasta el placeholder falla, devolver error JSON
            return {
                statusCode: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Error interno del servidor' })
            };
        }
    }
};