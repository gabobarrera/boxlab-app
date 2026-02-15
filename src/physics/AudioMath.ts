import {
    DesignParams,
    SimulationResult,
    BoxType,
    PortType,
    BracingType,
    PanelCut,
    GraphPoint
} from "../types";

export class AudioMath {
    public static calculate(params: DesignParams): SimulationResult {
        const warnings: string[] = [];
        let isPortCollision = false;

        // ... (Cálculos de volúmenes y dimensiones IGUAL que antes) ...
        // COPIA LA PARTE DE "1. Dimensiones Internas" hasta "4. Resultados Volumétricos" de tu archivo anterior.
        // O si prefieres, aquí está resumido lo esencial para que compile:

        const thickCm = params.thickness / 10;
        const Wi = params.width - thickCm * 2;
        const Hi = params.height - thickCm * 2;
        const Di = params.depth - thickCm * 2;
        const grossLiter = (Wi * Hi * Di) / 1000;
        const driverDisp = ((params.driver.sd * 20) / 1000) * 0.4;
        let braceDisp =
            params.bracingType !== BracingType.NONE ? grossLiter * 0.06 : 0;
        let dividerDisp =
            params.boxType === BoxType.BANDPASS_4TH
                ? (Wi * Hi * thickCm) / 1000
                : 0;

        // Puerto (Simplificado para el ejemplo, usa tu lógica completa)
        let calculatedLength = 0;
        let Fb = params.port.tuningFreq;
        let Av = 0;
        let portDisp = 0;

        // Lógica de puerto necesaria para velocidad de aire
        if (params.boxType !== BoxType.SEALED) {
            if (params.port.type === PortType.SLOT)
                Av = params.port.width * params.port.height;
            else Av = Math.PI * Math.pow(params.port.diameter / 2, 2);
            Av *= params.port.count;

            // ... (Tu cálculo de length anterior va aquí) ...
            // Asumimos un length para que funcione el ejemplo si no copiaste todo
            const volForPort = grossLiter - driverDisp - braceDisp;
            const term1 = 34400 * 34400 * Av;
            const term2 = 4 * Math.PI * Math.PI * Fb * Fb * volForPort * 1000;
            calculatedLength = term1 / term2 - 0.732 * Math.sqrt(Av);
            if (calculatedLength < 1) calculatedLength = 1;
            portDisp = (Av * 1.2 * calculatedLength) / 1000;
        }

        const totalDisp = driverDisp + braceDisp + dividerDisp + portDisp;
        const netTotal = grossLiter - totalDisp;
        let c1 = netTotal,
            c2 = 0;

        // 5. GENERACIÓN DE GRÁFICAS (NUEVO)
        const freqResponse: GraphPoint[] = [];
        const coneExcursion: GraphPoint[] = [];
        const portVelocity: GraphPoint[] = [];

        const Fs = params.driver.fs;
        const Xmax = params.driver.xmax;
        const Sd = params.driver.sd; // cm2

        // Simulación de Potencia (Referencia 500W para ver límites)
        const Watts = 500;
        const Volts = Math.sqrt(Watts * 4); // Asumiendo 4 ohm

        for (let f = 10; f <= 150; f++) {
            // Empezamos en 10Hz para ver excursión peligrosa
            // A. RESPUESTA DE FRECUENCIA (Tu lógica anterior)
            let db = 0;
            if (params.boxType === BoxType.PORTED) {
                db = -24 * Math.log10(30 / f);
                const boost = 12 * Math.exp(-Math.pow((f - Fb) / 10, 2));
                db += boost;
            } else {
                // Sealed simple model
                db =
                    20 *
                    Math.log10(
                        Math.pow(f / Fs, 2) /
                            Math.sqrt(
                                Math.pow(Math.pow(f / Fs, 2) - 1, 2) +
                                    Math.pow(f / Fs, 2)
                            )
                    );
            }
            if (db > 12) db = 12; // Clamp visual
            freqResponse.push({ x: f, y: parseFloat(db.toFixed(1)) });

            // B. EXCURSIÓN DE CONO (Modelo de Comportamiento)
            // Física: El movimiento aumenta al bajar la frecuencia (1/f^2).
            // En Ported, el movimiento se detiene en la frecuencia de entonación (Fb).
            let exc = 0;
            const mechanicalLimit = (Volts / (f * 0.1)) * 0.5; // Simplificación base

            if (params.boxType === BoxType.SEALED) {
                // Sellada: Sube constante al bajar Hz
                exc = mechanicalLimit / (1 + Math.pow(f / Fs, 2));
            } else {
                // Porteada: Notch en Fb (El cono casi se detiene)
                // Se dispara peligrosamente debajo de Fb
                const notch = Math.abs(f - Fb) / Fb;
                if (f < Fb)
                    exc = mechanicalLimit * 3; // Peligro debajo de entonación
                else exc = mechanicalLimit * notch;
            }

            // Factor de escala visual para mm
            exc = Math.min(exc * 5, 40);
            coneExcursion.push({ x: f, y: parseFloat(exc.toFixed(1)) });

            // C. VELOCIDAD DE AIRE (Port Velocity)
            // Máxima en Fb
            let vel = 0;
            if (params.boxType !== BoxType.SEALED && Av > 0) {
                // Velocidad inversamente proporcional al área del puerto
                const portFactor = Sd / Av;
                // Pico en Fb
                const resonance = Math.exp(-Math.pow((f - Fb) / 5, 2));
                vel = resonance * portFactor * (Math.sqrt(Watts) / 2);
            }
            portVelocity.push({ x: f, y: parseFloat(vel.toFixed(1)) });
        }

        // Advertencias nuevas basadas en gráficas
        const maxExc = Math.max(...coneExcursion.map(p => p.y));
        const maxVel = Math.max(...portVelocity.map(p => p.y));

        if (maxExc > Xmax)
            warnings.push(
                `¡PELIGRO! Excursión excede Xmax (${Xmax}mm) a alta potencia.`
            );
        if (maxVel > 30)
            warnings.push(
                `Ruido de puerto probable (>30 m/s). Aumenta el diámetro del puerto.`
            );

        // 6. Hoja de Corte (Igual que antes)
        const cuts: PanelCut[] = [];
        cuts.push({
            name: "Sup/Inf",
            width: params.width,
            height: params.depth,
            count: 2
        });
        // ... (resto de cortes)

        return {
            grossVolume: grossLiter,
            netTotal: netTotal,
            chamber1: c1,
            chamber2: c2,
            displacement: {
                driver: driverDisp,
                port: portDisp,
                bracing: braceDisp,
                divider: dividerDisp
            },
            portLength: calculatedLength,
            isPortCollision: isPortCollision,
            warnings: warnings,
            advice: [],
            frequencyResponse: freqResponse,
            coneExcursion: coneExcursion, // DATA NUEVA
            portVelocity: portVelocity, // DATA NUEVA
            cutSheet: cuts
        };
    }

    // ... (getErrorResult igual) ...
    private static getErrorResult(msg: string): SimulationResult {
        return {
            grossVolume: 0,
            netTotal: 0,
            chamber1: 0,
            chamber2: 0,
            portLength: 0,
            isPortCollision: false,
            warnings: [msg],
            advice: [],
            displacement: { driver: 0, port: 0, bracing: 0, divider: 0 },
            frequencyResponse: [],
            coneExcursion: [],
            portVelocity: [],
            cutSheet: []
        };
    }
}
