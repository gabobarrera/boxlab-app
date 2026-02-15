export enum BoxType {
    SEALED = 'sealed',
    PORTED = 'ported',
    BANDPASS_4TH = 'bandpass4'
}

export enum PortType {
    CIRCULAR = 'circular',
    SLOT = 'slot',
    AERO_FLARE = 'aero'
}

export enum BracingType {
    NONE = 'none',
    WINDOW = 'window',
    CROSS = 'cross'
}

export interface PortParams {
    type: PortType;
    tuningFreq: number;
    diameter: number;
    width: number;
    height: number;
    count: number;
}

// Datos T/S del Driver
export interface DriverParams {
    name: string;
    fs: number;   // Hz
    qts: number;  // Unitless
    vas: number;  // Liters
    xmax: number; // mm
    sd: number;   // cm2
}

export interface DesignParams {
    width: number;
    height: number;
    depth: number;
    thickness: number; 
    boxType: BoxType;
    bracingType: BracingType;
    driverSize: number;
    driver: DriverParams; // NUEVO
    port: PortParams;
    chamberRatio: number;
    
    // Estados Visuales
    isExploded: boolean; // NUEVO
    isTransparent: boolean; // NUEVO
}

export interface PanelCut {
    name: string;
    width: number;
    height: number;
    count: number;
}

export interface SimulationResult {
    grossVolume: number;
    netTotal: number;
    chamber1: number;
    chamber2: number;
    displacement: {
        driver: number;
        port: number;
        bracing: number;
        divider: number;
    };
    portLength: number;
    isPortCollision: boolean;
    warnings: string[];
    
    // Datos para Gráfica
    frequencyResponse: { hz: number, db: number }[]; // NUEVO
    // Datos para Carpintería
    cutSheet: PanelCut[]; // NUEVO
}
