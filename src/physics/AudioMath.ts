import { DesignParams, SimulationResult, BoxType, PortType, BracingType, PanelCut } from '../types';

export class AudioMath {
    public static calculate(params: DesignParams): SimulationResult {
        const warnings: string[] = [];
        let isPortCollision = false;
        
        // 1. Dimensiones Internas
        const thickCm = params.thickness / 10;
        const Wi = params.width - (thickCm * 2);
        const Hi = params.height - (thickCm * 2);
        const Di = params.depth - (thickCm * 2);

        if (Wi <= 0 || Hi <= 0 || Di <= 0) return this.getErrorResult("Dimensiones inválidas");

        const grossLiter = (Wi * Hi * Di) / 1000;
        
        // Desplazamientos
        // Usar datos T/S reales para estimar motor si es posible, sino genérico
        const driverDisp = (params.driver.sd * 20) / 1000 * 0.4; // Estimación basada en cono
        
        let braceDisp = 0;
        if (params.bracingType !== BracingType.NONE) braceDisp = grossLiter * 0.06;

        let dividerDisp = 0;
        if (params.boxType === BoxType.BANDPASS_4TH) dividerDisp = (Wi * Hi * thickCm) / 1000;

        // Puerto
        let portDisp = 0;
        let calculatedLength = 0;
        let volumeForPort = grossLiter - driverDisp - braceDisp - dividerDisp;
        
        if (params.boxType === BoxType.BANDPASS_4TH) volumeForPort *= (1 - params.chamberRatio);

        let Fb = 0;
        let Qtc = 0.707; // Default sealed
        
        if (params.boxType !== BoxType.SEALED) {
            let Av = 0;
            if (params.port.type === PortType.SLOT) Av = params.port.width * params.port.height;
            else Av = Math.PI * Math.pow(params.port.diameter / 2, 2);
            Av *= params.port.count;

            if (Av > 0) {
                const c = 34400;
                Fb = params.port.tuningFreq;
                const Vb_cm3 = volumeForPort * 1000;

                const term1 = (Math.pow(c, 2) * Av);
                const term2 = (4 * Math.pow(Math.PI, 2) * Math.pow(Fb, 2) * Vb_cm3);
                
                let k = 0.732;
                if (params.port.type === PortType.SLOT) k = 0.6;
                if (params.port.type === PortType.AERO_FLARE) k = 0.85;

                const endCorrection = k * Math.sqrt(Av);
                calculatedLength = (term1 / term2) - endCorrection;
                if (calculatedLength < 1) calculatedLength = 1;

                const limitDepth = params.boxType === BoxType.BANDPASS_4TH ? (Di * (1-params.chamberRatio)) : Di;
                if (calculatedLength > (limitDepth - 5)) {
                    isPortCollision = true;
                    warnings.push(`¡CRÍTICO! Puerto choca con fondo.`);
                }
                const wallFactor = params.port.type === PortType.AERO_FLARE ? 1.4 : 1.2;
                portDisp = (Av * wallFactor * calculatedLength) / 1000;
            }
        }

        // Resultados Volumétricos
        const totalDisp = driverDisp + braceDisp + dividerDisp + portDisp;
        const netTotal = grossLiter - totalDisp;
        let c1 = netTotal, c2 = 0;
        if (params.boxType === BoxType.BANDPASS_4TH) {
            const avail = grossLiter - totalDisp;
            c1 = avail * params.chamberRatio;
            c2 = avail * (1 - params.chamberRatio);
        }

        // --- CÁLCULO DE CURVA DE RESPUESTA (SIMPLIFICADO) ---
        // Modelo matemático básico de función de transferencia
        const freqResponse: { hz: number, db: number }[] = [];
        const Vb = c1; // Litros cámara principal
        const Fs = params.driver.fs;
        const Qts = params.driver.qts;
        const Vas = params.driver.vas;
        
        // Simulación básica 20Hz - 150Hz
        for(let f=20; f<=150; f+=2) {
            let db = 0;
            const f_ratio = f / Fs;
            
            if (params.boxType === BoxType.SEALED) {
                // Sealed Transfer Function approx
                const alpha = Vas / Vb;
                const Qtc = Qts * Math.sqrt(1 + alpha);
                const Fc = Fs * Math.sqrt(1 + alpha);
                const f_n = f / Fc;
                // Magnitude calculation
                const mag = Math.pow(f_n, 4) / (Math.pow((1 - Math.pow(f_n, 2)), 2) + Math.pow(f_n / Qtc, 2));
                db = 10 * Math.log10(mag);
                
            } else if (params.boxType === BoxType.PORTED) {
                // Ported Transfer Function (H_bp approx)
                // Usamos un modelo simplificado de ganancia por puerto alrededor de Fb
                // DB gain por puerto
                const portGain = (Math.pow(f/Fb, 4)) / (Math.pow(1-(f/Fb)*(f/Fb), 2));
                // Combinado con roll-off natural
                db = -24 * Math.log10(30/f); // High pass filter approx
                // Boost en sintonía
                const boost = 12 * Math.exp(-Math.pow((f - Fb)/10, 2)); 
                db += boost;
                if(db > 6) db = 6; // Limitador físico simple
            } 
            // Bandpass omitido por complejidad matemática, usar Ported como base
            freqResponse.push({ hz: f, db: parseFloat(db.toFixed(1)) });
        }

        // --- HOJA DE CORTE (CUT SHEET) ---
        const cuts: PanelCut[] = [];
        // Top & Bottom
        cuts.push({ name: "Superior/Inferior", width: params.width, height: params.depth, count: 2 });
        // Sides (descontando grosor top/bottom)
        cuts.push({ name: "Laterales", width: params.depth, height: params.height - (thickCm*2), count: 2 });
        // Front & Back (descontando todo)
        cuts.push({ name: "Frente/Trasera", width: params.width - (thickCm*2), height: params.height - (thickCm*2), count: 2 });

        return {
            grossVolume: grossLiter,
            netTotal: netTotal,
            chamber1: Math.max(0, c1),
            chamber2: Math.max(0, c2),
            displacement: { driver: driverDisp, port: portDisp, bracing: braceDisp, divider: dividerDisp },
            portLength: calculatedLength,
            isPortCollision: isPortCollision,
            warnings: warnings,
            frequencyResponse: freqResponse,
            cutSheet: cuts
        };
    }

    private static getErrorResult(msg: string): SimulationResult {
        return { 
            grossVolume:0, netTotal:0, chamber1:0, chamber2:0, portLength:0, isPortCollision: false, warnings:[msg], 
            displacement:{driver:0, port:0, bracing:0, divider:0},
            frequencyResponse: [], cutSheet: []
        };
    }
}
