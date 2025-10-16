const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fetch = require('node-fetch');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Endpoint para scraping de imágenes de FichaPublica
app.get('/scrape-image/:propertyId', async (req, res) => {
    try {
        const { propertyId } = req.params;
        const fichaUrl = `https://cl.fichapublica.com/pub/propiedad/${propertyId}`;
        
        console.log(`🔍 Scrapiando: ${fichaUrl}`);
        
        // Método 1: Puppeteer (más confiable para JavaScript dinámico)
        try {
            const browser = await puppeteer.launch({ 
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            await page.goto(fichaUrl, { waitUntil: 'networkidle0', timeout: 10000 });
            
            // Esperar a que las imágenes carguen
            await page.waitForSelector('img', { timeout: 5000 });
            
            // Extraer todas las imágenes
            const images = await page.evaluate(() => {
                const imgs = Array.from(document.querySelectorAll('img'));
                return imgs.map(img => ({
                    src: img.src,
                    dataSrc: img.dataset.src,
                    alt: img.alt,
                    className: img.className
                })).filter(img => 
                    img.src && 
                    (img.src.includes('.jpg') || img.src.includes('.jpeg') || img.src.includes('.png') || img.src.includes('.webp')) &&
                    !img.src.includes('logo') &&
                    !img.src.includes('icon')
                );
            });
            
            await browser.close();
            
            if (images.length > 0) {
                console.log(`✅ Encontradas ${images.length} imágenes`);
                return res.json({
                    success: true,
                    propertyId,
                    mainImage: images[0].src,
                    allImages: images,
                    scrapedAt: new Date().toISOString()
                });
            }
            
        } catch (puppeteerError) {
            console.log('❌ Error con Puppeteer:', puppeteerError.message);
        }
        
        // Método 2: Cheerio + fetch (más rápido pero menos confiable)
        try {
            const response = await fetch(fichaUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const html = await response.text();
            const $ = cheerio.load(html);
            
            // Buscar meta tags
            const ogImage = $('meta[property="og:image"]').attr('content');
            if (ogImage) {
                console.log('✅ Imagen og:image encontrada');
                return res.json({
                    success: true,
                    propertyId,
                    mainImage: ogImage,
                    method: 'meta-tag',
                    scrapedAt: new Date().toISOString()
                });
            }
            
            // Buscar primera imagen válida
            const firstImage = $('img').filter((i, el) => {
                const src = $(el).attr('src');
                return src && 
                       (src.includes('.jpg') || src.includes('.jpeg') || src.includes('.png') || src.includes('.webp')) &&
                       !src.includes('logo') && 
                       !src.includes('icon');
            }).first().attr('src');
            
            if (firstImage) {
                console.log('✅ Primera imagen encontrada');
                return res.json({
                    success: true,
                    propertyId,
                    mainImage: firstImage,
                    method: 'cheerio',
                    scrapedAt: new Date().toISOString()
                });
            }
            
        } catch (fetchError) {
            console.log('❌ Error con fetch:', fetchError.message);
        }
        
        // Si no se encuentra nada
        res.json({
            success: false,
            propertyId,
            error: 'No se encontraron imágenes',
            scrapedAt: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error general:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint de salud
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor de scraping ejecutándose en http://localhost:${PORT}`);
    console.log(`📡 Endpoint: http://localhost:${PORT}/scrape-image/{propertyId}`);
});