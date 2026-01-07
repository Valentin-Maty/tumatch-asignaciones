export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    try {
        const xmlUrl = 'https://2clicsalmcl.blob.core.windows.net/chile/xml/proppit/feed.xml';
        const response = await fetch(xmlUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const xmlText = await response.text();
        
        res.setHeader('Content-Type', 'application/xml');
        res.status(200).send(xmlText);
    } catch (error) {
        console.error('Error fetching XML:', error);
        res.status(500).json({ error: 'Failed to fetch XML', details: error.message });
    }
}