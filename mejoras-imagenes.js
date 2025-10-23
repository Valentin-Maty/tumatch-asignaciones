// Script de mejoras para carga de imágenes
// Insertar este código en el index.html para mejorar la detección de imágenes

// Estrategias adicionales para encontrar imágenes
const ImageStrategies = {
    // Cache de resultados para evitar búsquedas repetidas
    cache: new Map(),
    
    // Estrategia de normalización mejorada
    normalizeCode(codigo) {
        const normalized = [];
        
        // 1. Extraer solo números
        const numbers = codigo.match(/\d+/g);
        if (numbers) {
            numbers.forEach(num => {
                normalized.push(num);
                normalized.push(num.padStart(4, '0')); // Con ceros
                normalized.push(num.replace(/^0+/, '')); // Sin ceros
            });
        }
        
        // 2. Variaciones de formato TU
        if (/TU/i.test(codigo)) {
            const tuNumber = codigo.match(/TU\s*-?\s*(\d+)/i);
            if (tuNumber) {
                normalized.push(tuNumber[1]);
                normalized.push(tuNumber[1].padStart(4, '0'));
            }
        }
        
        // 3. Código completo sin espacios ni guiones
        normalized.push(codigo.replace(/[\s-]/g, ''));
        
        // 4. Solo la parte numérica al final
        const endNumber = codigo.match(/(\d+)$/);
        if (endNumber) {
            normalized.push(endNumber[1]);
        }
        
        return [...new Set(normalized)];
    },
    
    // Búsqueda fuzzy mejorada
    async findFuzzyMatch(codigo, propertiesMap) {
        const availableIds = Array.from(propertiesMap.keys());
        const normalized = this.normalizeCode(codigo);
        
        // Búsqueda por similitud de strings
        for (const normalizedCode of normalized) {
            // Coincidencias que contengan el código
            const containsMatches = availableIds.filter(id => 
                id.includes(normalizedCode) || normalizedCode.includes(id)
            );
            
            if (containsMatches.length > 0) {
                return {
                    found: true,
                    referenceId: containsMatches[0],
                    images: propertiesMap.get(containsMatches[0]),
                    method: 'fuzzy-contains',
                    allMatches: containsMatches
                };
            }
            
            // Búsqueda por distancia de Levenshtein (para códigos similares)
            const similarMatches = availableIds.filter(id => {
                const distance = this.levenshteinDistance(normalizedCode, id);
                return distance <= 2 && distance > 0; // Máximo 2 caracteres de diferencia
            });
            
            if (similarMatches.length > 0) {
                return {
                    found: true,
                    referenceId: similarMatches[0],
                    images: propertiesMap.get(similarMatches[0]),
                    method: 'fuzzy-similar',
                    distance: this.levenshteinDistance(normalizedCode, similarMatches[0])
                };
            }
        }
        
        return { found: false };
    },
    
    // Calcular distancia de Levenshtein
    levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
        
        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
        
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }
        
        return matrix[str2.length][str1.length];
    },
    
    // Función principal mejorada de búsqueda
    async findImage(codigo, propertiesMap) {
        // Verificar cache primero
        if (this.cache.has(codigo)) {
            return this.cache.get(codigo);
        }
        
        // 1. Búsqueda exacta con normalizaciones
        const normalized = this.normalizeCode(codigo);
        
        for (const normalizedCode of normalized) {
            if (propertiesMap.has(normalizedCode)) {
                const result = {
                    found: true,
                    referenceId: normalizedCode,
                    images: propertiesMap.get(normalizedCode),
                    method: 'exact-normalized'
                };
                this.cache.set(codigo, result);
                return result;
            }
        }
        
        // 2. Búsqueda fuzzy
        const fuzzyResult = await this.findFuzzyMatch(codigo, propertiesMap);
        if (fuzzyResult.found) {
            this.cache.set(codigo, fuzzyResult);
            return fuzzyResult;
        }
        
        // 3. No encontrado
        const notFoundResult = { found: false, codigo, searchedIds: normalized };
        this.cache.set(codigo, notFoundResult);
        return notFoundResult;
    }
};

// Función de retry para imágenes que fallan al cargar
const ImageRetry = {
    failedImages: new Map(),
    maxRetries: 3,
    
    async retryFailedImage(container, originalUrl, codigo) {
        const failCount = this.failedImages.get(originalUrl) || 0;
        
        if (failCount >= this.maxRetries) {
            console.log(`❌ Máximo de intentos alcanzado para ${codigo}`);
            return false;
        }
        
        this.failedImages.set(originalUrl, failCount + 1);
        
        // Esperar un poco antes de reintentar
        await new Promise(resolve => setTimeout(resolve, 1000 * (failCount + 1)));
        
        console.log(`🔄 Reintentando imagen ${failCount + 1}/${this.maxRetries} para ${codigo}`);
        
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                // Imagen cargada exitosamente
                img.className = 'absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110';
                img.alt = `Propiedad ${codigo}`;
                
                // Limpiar contenido anterior y agregar imagen
                container.innerHTML = '';
                container.appendChild(img);
                
                // Agregar overlay de gradiente
                const overlay = document.createElement('div');
                overlay.className = 'absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent';
                container.appendChild(overlay);
                
                this.failedImages.delete(originalUrl); // Limpiar del registro de fallos
                resolve(true);
            };
            
            img.onerror = () => {
                console.log(`❌ Fallo al reintentar imagen para ${codigo}`);
                resolve(false);
            };
            
            img.src = originalUrl;
        });
    }
};

// Sistema de preload para imágenes críticas
const ImagePreloader = {
    preloadQueue: [],
    isPreloading: false,
    
    // Agregar imágenes a la cola de precarga
    addToQueue(imageUrls) {
        this.preloadQueue.push(...imageUrls);
        if (!this.isPreloading) {
            this.startPreloading();
        }
    },
    
    // Iniciar precarga de imágenes
    async startPreloading() {
        if (this.isPreloading || this.preloadQueue.length === 0) return;
        
        this.isPreloading = true;
        console.log(`🚀 Iniciando precarga de ${this.preloadQueue.length} imágenes`);
        
        while (this.preloadQueue.length > 0) {
            const imageUrl = this.preloadQueue.shift();
            
            try {
                await this.preloadImage(imageUrl);
            } catch (error) {
                console.log(`⚠️ Error precargando imagen: ${error.message}`);
            }
            
            // Pequeña pausa para no sobrecargar
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        this.isPreloading = false;
        console.log('✅ Precarga de imágenes completada');
    },
    
    // Precargar una imagen individual
    preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(url);
            img.onerror = () => reject(new Error(`Failed to preload ${url}`));
            img.src = url;
        });
    }
};

// Monitor de rendimiento de carga de imágenes
const ImagePerformanceMonitor = {
    stats: {
        totalAttempts: 0,
        successful: 0,
        failed: 0,
        retries: 0,
        avgLoadTime: 0,
        loadTimes: []
    },
    
    startTimer() {
        return Date.now();
    },
    
    recordSuccess(startTime) {
        const loadTime = Date.now() - startTime;
        this.stats.totalAttempts++;
        this.stats.successful++;
        this.stats.loadTimes.push(loadTime);
        this.updateAverage();
        
        console.log(`⏱️ Imagen cargada en ${loadTime}ms`);
    },
    
    recordFailure() {
        this.stats.totalAttempts++;
        this.stats.failed++;
    },
    
    recordRetry() {
        this.stats.retries++;
    },
    
    updateAverage() {
        if (this.stats.loadTimes.length > 0) {
            this.stats.avgLoadTime = this.stats.loadTimes.reduce((a, b) => a + b, 0) / this.stats.loadTimes.length;
        }
    },
    
    getReport() {
        const successRate = this.stats.totalAttempts > 0 ? 
            (this.stats.successful / this.stats.totalAttempts * 100).toFixed(1) : 0;
        
        return {
            ...this.stats,
            successRate: successRate + '%',
            avgLoadTime: Math.round(this.stats.avgLoadTime) + 'ms'
        };
    },
    
    logReport() {
        const report = this.getReport();
        console.log('📊 Reporte de rendimiento de imágenes:', report);
        return report;
    }
};

// Función mejorada de carga de imagen individual
async function tryLoadImageEnhanced(container, imageUrl, codigo) {
    const timer = ImagePerformanceMonitor.startTimer();
    
    return new Promise(async (resolve) => {
        try {
            const img = new Image();
            
            img.onload = () => {
                // Limpiar contenido anterior
                container.innerHTML = '';
                
                // Configurar imagen
                img.className = 'absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110';
                img.alt = `Propiedad ${codigo}`;
                
                // Agregar imagen al contenedor
                container.appendChild(img);
                
                // Agregar overlay de gradiente
                const overlay = document.createElement('div');
                overlay.className = 'absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent';
                container.appendChild(overlay);
                
                ImagePerformanceMonitor.recordSuccess(timer);
                resolve(true);
            };
            
            img.onerror = async () => {
                ImagePerformanceMonitor.recordFailure();
                
                // Intentar retry
                ImagePerformanceMonitor.recordRetry();
                const retrySuccess = await ImageRetry.retryFailedImage(container, imageUrl, codigo);
                
                if (!retrySuccess) {
                    // Si el retry falla, intentar encontrar imagen alternativa
                    console.log(`🔄 Buscando imagen alternativa para ${codigo}`);
                    // Aquí podrías implementar lógica adicional para encontrar imágenes alternativas
                }
                
                resolve(retrySuccess);
            };
            
            // Configurar timeout para evitar cuelgues
            setTimeout(() => {
                if (!img.complete) {
                    img.src = ''; // Cancelar carga
                    ImagePerformanceMonitor.recordFailure();
                    resolve(false);
                }
            }, 10000); // 10 segundos timeout
            
            img.src = imageUrl;
            
        } catch (error) {
            console.error(`❌ Error cargando imagen para ${codigo}:`, error);
            ImagePerformanceMonitor.recordFailure();
            resolve(false);
        }
    });
}

// Exportar funciones para uso global
if (typeof window !== 'undefined') {
    window.ImageStrategies = ImageStrategies;
    window.ImageRetry = ImageRetry;
    window.ImagePreloader = ImagePreloader;
    window.ImagePerformanceMonitor = ImagePerformanceMonitor;
    window.tryLoadImageEnhanced = tryLoadImageEnhanced;
}

// Función de inicialización para integrar con el sistema existente
function initializeImageEnhancements() {
    console.log('🚀 Inicializando mejoras de imágenes');
    
    // Reemplazar la función original de búsqueda de imágenes
    if (typeof window.getPropertyImage === 'function') {
        const originalGetPropertyImage = window.getPropertyImage;
        
        window.getPropertyImage = async function(codigo) {
            // Primero intentar con la función original
            const originalResult = await originalGetPropertyImage(codigo);
            
            if (originalResult) {
                return originalResult;
            }
            
            // Si falla, usar las estrategias mejoradas
            console.log(`🔍 Usando estrategias mejoradas para: ${codigo}`);
            const enhancedResult = await ImageStrategies.findImage(codigo, xmlCache.propertiesMap);
            
            if (enhancedResult.found) {
                console.log(`✅ Imagen encontrada con estrategia mejorada: ${enhancedResult.method}`);
                return enhancedResult.images[0];
            }
            
            return null;
        };
    }
    
    // Reemplazar la función de carga de imagen
    if (typeof window.tryLoadImage === 'function') {
        window.tryLoadImage = tryLoadImageEnhanced;
    }
    
    console.log('✅ Mejoras de imágenes inicializadas');
}

// Auto-inicializar si se incluye en HTML
if (typeof window !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeImageEnhancements);
} else if (typeof window !== 'undefined') {
    initializeImageEnhancements();
}