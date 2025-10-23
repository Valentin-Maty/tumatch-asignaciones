// Función para Vercel - obtener XML feed
// Esta función funciona como alternativa a Netlify Functions

export default async function handler(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Cache-Control');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    try {
        console.log('[Vercel API] Iniciando descarga XML feed...');
        console.log('[Vercel API] Método:', req.method);
        console.log('[Vercel API] Headers recibidos:', req.headers);
        
        const xmlUrl = 'https://2clicsalmcl.blob.core.windows.net/chile/xml/proppit/feed.xml';
        console.log('[Vercel API] Descargando desde:', xmlUrl);
        
        const response = await fetch(xmlUrl, {
            headers: {
                'User-Agent': 'TuMatch-Portal/1.0',
                'Accept': 'application/xml, text/xml, */*'
            }
        });
        
        console.log('[Vercel API] Respuesta del XML:', {
            status: response.status,
            ok: response.ok,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
        });
        
        if (!response.ok) {
            throw new Error(`Error descargando XML: ${response.status} ${response.statusText}`);
        }
        
        const xmlText = await response.text();
        
        console.log('[Vercel API] XML descargado:', {
            length: xmlText.length,
            sizeKB: Math.round(xmlText.length / 1024),
            preview: xmlText.substring(0, 100)
        });
        
        if (!xmlText || xmlText.length < 1000) {
            throw new Error(`XML vacío o muy pequeño: ${xmlText.length} caracteres`);
        }
        
        // Verificar que es XML válido
        if (!xmlText.includes('<?xml') && !xmlText.includes('<listing>')) {
            throw new Error('Contenido no parece ser XML válido');
        }
        
        console.log(`[Vercel API] ✅ XML validado y enviado: ${Math.round(xmlText.length / 1024)} KB`);
        
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache 1 hora
        res.status(200).send(xmlText);
        
    } catch (error) {
        console.error('[Vercel API] ❌ Error completo:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ 
            error: 'Error obteniendo XML feed',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
}