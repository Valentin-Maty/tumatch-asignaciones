const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de CORS
app.use(cors());
app.use(express.json());

// Servir archivos estáticos
app.use(express.static('.'));

// Configuración de Google Sheets
const SPREADSHEET_ID = '1X7cbk_fD5mGTXxs1cOa4tCxeXBrpiNWV4sEJnBRwVUM';
const SHEET_NAME = 'Hoja 25'; // Nombre de la hoja específica
const RANGE = 'A:I'; // Rango de columnas a leer

// Cache de datos
let cachedData = [];
let lastUpdate = null;

// Función para autenticación con Google Sheets
async function authenticateGoogle() {
    try {
        // Opción 1: Usando API Key (para hojas públicas)
        if (process.env.GOOGLE_API_KEY) {
            return google.sheets({
                version: 'v4',
                auth: process.env.GOOGLE_API_KEY
            });
        }
        
        // Opción 2: Usando Service Account (más seguro)
        if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            const auth = new google.auth.GoogleAuth({
                keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
            });
            
            const client = await auth.getClient();
            return google.sheets({ version: 'v4', auth: client });
        }
        
        // Opción 3: Sin autenticación (solo para hojas públicas)
        return google.sheets({
            version: 'v4',
            auth: null
        });
    } catch (error) {
        console.error('Error en autenticación:', error);
        throw error;
    }
}

// Función para obtener datos de Google Sheets
async function fetchSheetData() {
    try {
        console.log('📊 Obteniendo datos de Google Sheets...');
        const sheets = await authenticateGoogle();
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!${RANGE}`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('⚠️ No se encontraron datos');
            return [];
        }

        // Procesar los datos (saltar encabezado)
        const processedData = [];
        
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            
            // Mapeo de columnas según tu hoja:
            // A: Conv, B: 2Clics, C: Operador, D: Correo, E: Corredor, F: TL, G: Referido, H: Firma, I: Estado
            const codigo = row[1] || ''; // Columna B: 2Clics
            const corredor = row[4] || ''; // Columna E: Corredor a cargo
            const referido = row[6] || ''; // Columna G: Referido
            const firmaOrden = row[7] || ''; // Columna H: Firma de Orden
            const estado = row[8] || ''; // Columna I: Estado
            
            if (!codigo || !corredor) continue;
            
            // Determinar si es referido TuMatch
            const isTM = referido.toLowerCase().includes('francisco') && 
                         referido.toLowerCase().includes('garcia');
            
            processedData.push({
                id: i,
                codigo: codigo.trim(),
                corredor: corredor.trim(),
                referido: isTM ? 'TuMatch' : (referido.trim() || ''),
                firmaOrden: firmaOrden.trim() || 'Pendiente',
                estado: estado.trim() || 'Activo',
                isTM: isTM
            });
        }
        
        // Actualizar cache
        cachedData = processedData;
        lastUpdate = new Date();
        
        console.log(`✅ ${processedData.length} propiedades cargadas`);
        return processedData;
        
    } catch (error) {
        console.error('❌ Error al obtener datos:', error.message);
        // Si hay datos en cache, devolverlos
        if (cachedData.length > 0) {
            console.log('📦 Usando datos en cache');
            return cachedData;
        }
        throw error;
    }
}

// Endpoint para obtener propiedades
app.get('/api/propiedades', async (req, res) => {
    try {
        // Si no hay cache o es muy antiguo, actualizar
        if (!cachedData.length || !lastUpdate || 
            (new Date() - lastUpdate > 30000)) { // 30 segundos
            await fetchSheetData();
        }
        
        res.json({
            success: true,
            data: cachedData,
            total: cachedData.length,
            lastUpdate: lastUpdate,
            tmCount: cachedData.filter(p => p.isTM).length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error al obtener propiedades',
            message: error.message
        });
    }
});

// Endpoint para obtener estadísticas
app.get('/api/estadisticas', (req, res) => {
    const stats = {
        total: cachedData.length,
        tmCount: cachedData.filter(p => p.isTM).length,
        corredores: [...new Set(cachedData.map(p => p.corredor))].length,
        pendientes: cachedData.filter(p => p.firmaOrden === 'Pendiente').length,
        lastUpdate: lastUpdate
    };
    
    res.json({
        success: true,
        data: stats
    });
});

// Endpoint para buscar propiedades
app.get('/api/buscar', (req, res) => {
    const { q, corredor } = req.query;
    let filtered = [...cachedData];
    
    // Filtrar por búsqueda
    if (q) {
        const searchTerm = q.toLowerCase();
        filtered = filtered.filter(prop => 
            prop.corredor.toLowerCase().includes(searchTerm) ||
            prop.codigo.toLowerCase().includes(searchTerm)
        );
    }
    
    // Filtrar por corredor
    if (corredor) {
        filtered = filtered.filter(prop => prop.corredor === corredor);
    }
    
    res.json({
        success: true,
        data: filtered,
        total: filtered.length
    });
});

// Endpoint para obtener lista de corredores
app.get('/api/corredores', (req, res) => {
    const corredores = [...new Set(cachedData.map(p => p.corredor))].sort();
    
    res.json({
        success: true,
        data: corredores
    });
});

// Actualización automática cada 30 segundos
cron.schedule('*/30 * * * * *', async () => {
    console.log('🔄 Actualizando datos automáticamente...');
    await fetchSheetData();
});

// Endpoint de salud
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        uptime: process.uptime(),
        lastUpdate: lastUpdate,
        dataCount: cachedData.length
    });
});

// Inicializar servidor
app.listen(PORT, async () => {
    console.log(`
╔═══════════════════════════════════════════╗
║   🏠 TuMatch Backend - v1.0.0            ║
║   📡 Servidor corriendo en puerto ${PORT}    ║
║   🔗 http://localhost:${PORT}              ║
╚═══════════════════════════════════════════╝
    `);
    
    // Cargar datos inicialmente
    console.log('🚀 Cargando datos iniciales...');
    await fetchSheetData();
});