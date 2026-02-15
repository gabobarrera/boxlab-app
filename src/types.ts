// --- ENUMS (Opciones Fijas) ---

export enum BoxType {
    SEALED = 'sealed',           // Suspensión Acústica
    PORTED = 'ported',           // Bass Reflex
    BANDPASS_4TH = 'bandpass4'   // Paso de Banda 4to Orden
}

export enum PortType {
    CIRCULAR = 'circular',       // Tubo PVC estándar
    SLOT = 'slot',               // Ranura de madera
    AERO_FLARE = 'aero'          // Aeroport (Con boquilla)
}

export enum BracingType {
    NONE = 'none',               // Caja vacía
    WINDOW = 'window',           // Refuerzo tipo ventana
    CROSS = 'cross'              // Matriz cruzada
}

// --- CONTEXTO DEL PROYECTO (Wizard) ---
export type ApplicationType = 'car_audio' | 'hifi_home' | 'studio' | 'pa_live';
export type SpeakerType = 'subwoofer_box' | 'tower' | 'bookshelf' | 'soundbar';

// --- COMPONENTES ---

export interface PortParams {
    type: PortType;
    tuningFreq: number; // Hz (Fb)
    diameter: number;   // cm (Solo circular/aero)
    width: number;      // cm (Solo slot)
    height: number;     // cm (Solo slot)
    count: number;      // Cantidad de puertos
}

export interface DriverParams {
    name: string;
    fs: number;   // Frecuencia de resonancia (Hz)
    qts: number;  // Factor Q total
    vas: number;  // Volumen equivalente (L)
    xmax: number; // Excursión lineal máxima (mm)
    sd: number;   // Área del cono (cm2)
}

// --- ESTADO PRINCIPAL (Lo que el usuario edita) ---

export interface DesignParams {
    // Contexto (Definido por el Wizard)
    application: ApplicationType;
    speakerType: SpeakerType;

    // Dimensiones Externas (cm)
    width: number;
    height: number;
    depth: number;
    thickness: number; // mm (Grosor madera)
    
    // Configuración Acústica
    boxType: BoxType;
    bracingType: BracingType;
    driverSize: number; // Pulgadas (Visualización 3D)
    driver: DriverParams;
    port: PortParams;
    chamberRatio: number; // 0.0 - 1.0 (Para Bandpass)
    
    // Estados Visuales (3D)
    isExploded: boolean;
    isTransparent: boolean;
    isSolid: boolean;
}

// --- RESULTADOS DE SIMULACIÓN (Salida del Motor Matemático) ---

export interface PanelCut {
    name: string;
    width: number;
    height: number;
    count: number;
}

export interface Advice {
    level: 'info' | 'warning' | 'error';
    message: string;
}

// Estructura para puntos de gráficas (Chart.js)
export interface GraphPoint {
    x: number; // Eje X (Hz)
    y: number; // Eje Y (dB, mm, m/s)
}

export interface SimulationResult {
    // Volúmenes (Litros)
    grossVolume: number;
    netTotal: number;
    chamber1: number; // Trasera o Sellada
    chamber2: number; // Delantera o Porteada
    
    // Desplazamientos (Litros que restan)
    displacement: { 
        driver: number; 
        port: number; 
        bracing: number; 
        divider: number; 
    };
    
    // Datos de Puerto
    portLength: number; // cm
    isPortCollision: boolean; // ¿Choca con el fondo?
    
    // Diagnóstico
    warnings: string[]; // Alertas Físicas (Rojo)
    advice: Advice[];   // Consejos Inteligentes (Azul/Amarillo)
    
    // --- DATOS PARA GRÁFICAS ---
    frequencyResponse: GraphPoint[]; // Respuesta (dB)
    coneExcursion: GraphPoint[];     // Movimiento Cono (mm)
    portVelocity: GraphPoint[];      // Velocidad Aire (m/s)
    
    // Carpintería
    cutSheet: PanelCut[];
}
