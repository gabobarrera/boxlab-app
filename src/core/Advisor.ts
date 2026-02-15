import { DesignParams, SimulationResult, Advice, BoxType } from "../types";

export class Advisor {
    public static analyze(
        params: DesignParams,
        result: SimulationResult
    ): Advice[] {
        const advice: Advice[] = [];

        // 1. REGLAS POR APLICACIÓN
        if (params.application === "car_audio") {
            if (
                params.boxType === BoxType.PORTED &&
                params.port.tuningFreq < 32
            ) {
                advice.push({
                    level: "warning",
                    message:
                        "Car Audio: Sintonizar bajo 32Hz pierde eficiencia. Sube a 34-38Hz."
                });
            }
            if (params.boxType === BoxType.SEALED) {
                advice.push({
                    level: "info",
                    message:
                        "Sellada: Gran control, pero requiere más potencia para SPL."
                });
            }
        } else if (params.application === "hifi_home") {
            if (
                params.boxType === BoxType.PORTED &&
                params.port.tuningFreq > 40
            ) {
                advice.push({
                    level: "info",
                    message:
                        "Hi-Fi: Sintonía alta (>40Hz). ¿Buscas bajos profundos? Baja a 30-35Hz."
                });
            }
        } else if (params.application === "studio") {
            const peak = Math.max(...result.frequencyResponse.map(p => p.db));
            if (peak > 3)
                advice.push({
                    level: "warning",
                    message:
                        "Respuesta no plana (+3dB). Reduce volumen o baja sintonía."
                });
        } else if (params.application === "pa_live") {
            if (params.thickness < 25 && result.netTotal > 80)
                advice.push({
                    level: "error",
                    message: "PA Live: Usa madera de 25mm para cajas grandes."
                });
        }

        // 2. REGLAS POR FORMATO
        if (params.speakerType === "soundbar") {
            if (params.depth > 20)
                advice.push({
                    level: "info",
                    message:
                        "Soundbar: Profundidad > 20cm puede ser incómoda en pared."
                });
            if (params.boxType === BoxType.PORTED)
                advice.push({
                    level: "warning",
                    message:
                        "Soundbar: Puerto puede generar ruido. Considera Sellada o Radiador Pasivo."
                });
        } else if (params.speakerType === "tower") {
            if (params.height < 80)
                advice.push({
                    level: "info",
                    message: "Altura baja para Torre. ¿Formato Bookshelf?"
                });
            if (params.bracingType === "none")
                advice.push({
                    level: "error",
                    message: "Torre: Obligatorio usar refuerzos internos."
                });
        }

        // 3. REGLAS FÍSICAS
        if (result.portLength > params.depth - 5) {
            advice.push({
                level: "error",
                message:
                    "Puerto demasiado largo. Usa un codo (L) o aumenta profundidad."
            });
        }

        return advice;
    }
}
