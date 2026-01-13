exports.handler = async (event, context) => {
    // Configurar CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Manejar preflight OPTIONS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        // Extraer propertyId de la URL
        const pathParts = event.path.split('/');
        const propertyId = pathParts[pathParts.length - 1];
        
        if (!propertyId || propertyId === 'scrape-image') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Property ID required' })
            };
        }

        console.log(`[Netlify Function] Procesando propiedad: ${propertyId}`);

        // Usar la API de AllOrigins para bypass CORS y obtener el HTML
        const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://www.tumatchpropiedades.cl/propiedad/${propertyId}`)}`;
        
        try {
            const response = await fetch(allOriginsUrl);
            const data = await response.json();
            
            if (data && data.contents) {
                const html = data.contents;
                
                // Buscar URLs de imágenes en el HTML
                // Patrón 1: Buscar blob.core.windows.net
                const blobPattern = /https:\/\/[a-z0-9]+\.blob\.core\.windows\.net\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi;
                const blobMatches = html.match(blobPattern);
                
                if (blobMatches && blobMatches.length > 0) {
                    console.log(`[Netlify Function] Imagen Azure Blob encontrada`);
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            success: true,
                            propertyId,
                            mainImage: blobMatches[0],
                            method: 'azure-blob-pattern',
                            scrapedAt: new Date().toISOString()
                        })
                    };
                }
                
                // Patrón 2: Buscar meta og:image
                const ogPattern = /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i;
                const ogMatch = html.match(ogPattern);
                
                if (ogMatch && ogMatch[1]) {
                    let imageUrl = ogMatch[1];
                    if (!imageUrl.startsWith('http')) {
                        imageUrl = 'https://cl.fichapublica.com' + (imageUrl.startsWith('/') ? '' : '/') + imageUrl;
                    }
                    console.log(`[Netlify Function] Meta og:image encontrada`);
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            success: true,
                            propertyId,
                            mainImage: imageUrl,
                            method: 'og-image',
                            scrapedAt: new Date().toISOString()
                        })
                    };
                }
                
                // Patrón 3: Buscar imágenes con data-src
                const dataSrcPattern = /data-src=["']([^"']+\.(?:jpg|jpeg|png|webp))["']/i;
                const dataSrcMatch = html.match(dataSrcPattern);
                
                if (dataSrcMatch && dataSrcMatch[1]) {
                    let imageUrl = dataSrcMatch[1];
                    if (!imageUrl.startsWith('http')) {
                        imageUrl = 'https://cl.fichapublica.com' + (imageUrl.startsWith('/') ? '' : '/') + imageUrl;
                    }
                    console.log(`[Netlify Function] Imagen data-src encontrada`);
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            success: true,
                            propertyId,
                            mainImage: imageUrl,
                            method: 'data-src',
                            scrapedAt: new Date().toISOString()
                        })
                    };
                }
                
                // Patrón 4: Buscar cualquier imagen .jpg/jpeg en el HTML
                const imgPattern = /(?:src|href)=["']([^"']+\.(?:jpg|jpeg|png|webp))["']/i;
                const imgMatch = html.match(imgPattern);
                
                if (imgMatch && imgMatch[1]) {
                    let imageUrl = imgMatch[1];
                    if (!imageUrl.startsWith('http')) {
                        imageUrl = imageUrl.startsWith('//') 
                            ? 'https:' + imageUrl
                            : 'https://cl.fichapublica.com' + (imageUrl.startsWith('/') ? '' : '/') + imageUrl;
                    }
                    console.log(`[Netlify Function] Imagen genérica encontrada`);
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            success: true,
                            propertyId,
                            mainImage: imageUrl,
                            method: 'generic-img',
                            scrapedAt: new Date().toISOString()
                        })
                    };
                }
            }
        } catch (fetchError) {
            console.error(`[Netlify Function] Error con AllOrigins:`, fetchError.message);
        }

        // Si no encontramos nada, usar imágenes de respaldo de alta calidad
        const fallbackImages = [
            'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&h=400&fit=crop&q=80',
            'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600&h=400&fit=crop&q=80',
            'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=600&h=400&fit=crop&q=80',
            'https://images.unsplash.com/photo-1565953522043-baea26b83b7e?w=600&h=400&fit=crop&q=80',
            'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=400&fit=crop&q=80',
            'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop&q=80',
            'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=400&fit=crop&q=80',
            'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600&h=400&fit=crop&q=80',
            'https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=600&h=400&fit=crop&q=80',
            'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop&q=80'
        ];
        
        // Usar el propertyId para seleccionar consistentemente una imagen
        const imageIndex = parseInt(propertyId) % fallbackImages.length;
        
        console.log(`[Netlify Function] Usando imagen de respaldo`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: false,
                propertyId,
                mainImage: fallbackImages[imageIndex],
                method: 'fallback',
                message: 'No se pudo obtener imagen real, usando placeholder',
                scrapedAt: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('[Netlify Function] Error general:', error);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                propertyId: event.path.split('/').pop(),
                mainImage: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=400&fit=crop&q=80',
                method: 'error-fallback'
            })
        };
    }
};