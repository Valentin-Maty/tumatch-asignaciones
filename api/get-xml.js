// Función para Vercel - obtener XML feed
// Esta función funciona como alternativa a Netlify Functions

export default async function handler(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    try {
        console.log('[Vercel API] Obteniendo XML feed...');
        
        const xmlUrl = 'https://2clicsalmcl.blob.core.windows.net/chile/xml/proppit/feed.xml';
        
        const response = await fetch(xmlUrl, {
            headers: {
                'User-Agent': 'TuMatch-Portal/1.0',
                'Accept': 'application/xml, text/xml, */*'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error descargando XML: ${response.status}`);
        }
        
        const xmlText = await response.text();
        
        if (!xmlText || xmlText.length < 1000) {
            throw new Error('XML vacío o muy pequeño');
        }
        
        console.log(`[Vercel API] XML obtenido: ${Math.round(xmlText.length / 1024)} KB`);
        
        res.setHeader('Content-Type', 'application/xml');
        res.status(200).send(xmlText);
        
    } catch (error) {
        console.error('[Vercel API] Error:', error);
        res.status(500).json({ 
            error: 'Error obteniendo XML feed',
            details: error.message 
        });
    }
}