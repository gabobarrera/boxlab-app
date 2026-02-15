import "./style.css";
import "flowbite";
import Chart from "chart.js/auto";
import { AcousticView } from "./core/AcousticView";
import { appState } from "./core/State";
import { DRIVER_DATABASE } from "./data/drivers";
import {
    BoxType,
    PortType,
    BracingType,
    ApplicationType,
    SpeakerType
} from "./types";

// --- ESTADO GLOBAL UI ---
let isAppActive = false;
let tempApp: ApplicationType = "car_audio";
let currentGraph: "freq" | "exc" | "vel" = "freq"; // Tipo de gráfica actual

// --- INICIALIZAR MOTOR 3D ---
const container = document.getElementById("canvas-container");
const view = new AcousticView(container!);

// --- REFERENCIAS DOM ---
const hero = document.getElementById("hero-section");
const wizard = document.getElementById("project-wizard");
const appUI = document.getElementById("app-interface");
const step1 = document.getElementById("step-1");
const step2 = document.getElementById("step-2");

// ==========================================
// 1. NAVEGACIÓN Y TRANSICIONES (WIZARD)
// ==========================================

// De Hero -> Wizard
document.getElementById("start-btn")?.addEventListener("click", () => {
    hero?.classList.remove("visible-panel");
    hero?.classList.add("hidden-panel");

    // Efecto visual de explosión al iniciar
    appState.update({ isExploded: true });

    setTimeout(() => {
        wizard?.classList.remove("hidden-panel");
        wizard?.classList.add("visible-panel");
    }, 500);
});

// Wizard Paso 1: Selección de Aplicación
(window as any).selectApp = (app: ApplicationType) => {
    tempApp = app;
    step1?.classList.add("hidden");
    step2?.classList.remove("hidden");
    step2?.classList.add("animate-in", "fade-in", "slide-in-from-right");
};

// Wizard Paso 2: Selección de Speaker -> IR A APP
(window as any).selectSpeaker = (sp: SpeakerType) => {
    // Configurar proyecto base
    appState.setProjectContext(tempApp, sp);
    appState.update({ isExploded: false }); // Re-armar caja

    // Ocultar Wizard
    wizard?.classList.remove("visible-panel");
    wizard?.classList.add("hidden-panel");

    // Mostrar App
    setTimeout(() => {
        appUI?.classList.remove("hidden-panel");
        appUI?.classList.add("visible-panel");

        // ACTIVAR CENTRADO INTELIGENTE (Mover caja a la derecha)
        view.setCenterOffset(true);
    }, 500);

    isAppActive = true;
};

// De App -> Home (Salir)
document.getElementById("btn-home")?.addEventListener("click", () => {
    isAppActive = false;
    view.setCenterOffset(false); // Resetear centrado (volver al medio)

    appUI?.classList.remove("visible-panel");
    appUI?.classList.add("hidden-panel");

    setTimeout(() => {
        // Reset Wizard para la próxima vez
        step1?.classList.remove("hidden");
        step2?.classList.add("hidden");

        // Mostrar Hero
        hero?.classList.remove("hidden-panel");
        hero?.classList.add("visible-panel");
    }, 500);
});

// ==========================================
// 2. CONFIGURACIÓN DE GRÁFICAS (CHART.JS)
// ==========================================

const ctx = (
    document.getElementById("freq-chart") as HTMLCanvasElement
).getContext("2d");

const chart = new Chart(ctx!, {
    type: "line",
    data: {
        labels: [],
        datasets: [
            // Dataset 0: La Curva Principal
            {
                label: "Data",
                data: [],
                borderColor: "#C5A96E",
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
                fill: true,
                backgroundColor: "rgba(197, 169, 110, 0.1)"
            },
            // Dataset 1: Línea de Límite (Roja Punteada)
            {
                label: "Limit",
                data: [],
                borderColor: "#FF0000",
                borderWidth: 1,
                borderDash: [5, 5], // Línea punteada
                pointRadius: 0,
                fill: false,
                tension: 0
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: {
                grid: { color: "#333" },
                ticks: { color: "#888", font: { size: 10 } },
                beginAtZero: false
            },
            x: {
                display: true,
                grid: { color: "#222" },
                ticks: { color: "#666", font: { size: 9 }, maxTicksLimit: 10 }
            }
        },
        animation: { duration: 0 } // Desactivar animación para respuesta instantánea
    }
});

// Función Global para cambiar tipo de gráfica
(window as any).setGraph = (type: "freq" | "exc" | "vel") => {
    currentGraph = type;

    // Actualizar estilos de los botones (Feedback visual)
    const btns = { freq: "btn-g-freq", exc: "btn-g-exc", vel: "btn-g-vel" };
    Object.keys(btns).forEach(k => {
        const el = document.getElementById(btns[k as keyof typeof btns]);
        if (k === type) {
            el?.classList.remove("text-gray-500");
            el?.classList.add("text-[#C5A96E]", "border-b", "border-[#C5A96E]");
        } else {
            el?.classList.add("text-gray-500");
            el?.classList.remove(
                "text-[#C5A96E]",
                "border-b",
                "border-[#C5A96E]"
            );
        }
    });

    // Forzar actualización de la UI con los datos actuales
    appState.update({});
};

// ==========================================
// 3. ENLACE DE DATOS (BINDING)
// ==========================================

// Sincronizar Sliders <-> Inputs Numéricos
function sync(
    sliderId: string,
    numberId: string,
    field: string,
    isPort = false
) {
    const s = document.getElementById(sliderId) as HTMLInputElement;
    const n = document.getElementById(numberId) as HTMLInputElement;

    const updateState = (val: number) => {
        if (isPort) appState.updatePort({ [field]: val });
        else appState.update({ [field]: val } as any);
    };

    s?.addEventListener("input", e =>
        updateState(+(e.target as HTMLInputElement).value)
    );
    n?.addEventListener("input", e =>
        updateState(+(e.target as HTMLInputElement).value)
    );

    // Suscribirse para actualizar valores si cambian desde otro lado (ej. presets)
    appState.subscribe(p => {
        const val = isPort ? (p.port as any)[field] : (p as any)[field];
        if (document.activeElement !== s) s.value = val;
        if (document.activeElement !== n) n.value = val;
    });
}

// Inicializar todos los controles
sync("slider-width", "num-width", "width");
sync("slider-height", "num-height", "height");
sync("slider-depth", "num-depth", "depth");
sync("slider-diam", "num-diam", "diameter", true);
sync("slider-p-width", "num-p-width", "width", true);
sync("slider-p-height", "num-p-height", "height", true);

// Dropdown Drivers
const dSel = document.getElementById("sel-driver") as HTMLSelectElement;
DRIVER_DATABASE.forEach((d, i) => {
    const o = document.createElement("option");
    o.value = i.toString();
    o.text = d.name;
    dSel.appendChild(o);
});
dSel.addEventListener("change", e =>
    appState.updateDriver(
        DRIVER_DATABASE[+(e.target as HTMLSelectElement).value]
    )
);

// Otros controles
document
    .getElementById("sel-box-type")
    ?.addEventListener("change", e =>
        appState.update({
            boxType: (e.target as HTMLSelectElement).value as BoxType
        })
    );
document
    .getElementById("sel-bracing")
    ?.addEventListener("change", e =>
        appState.update({
            bracingType: (e.target as HTMLSelectElement).value as BracingType
        })
    );
document
    .getElementById("sel-port-type")
    ?.addEventListener("change", e =>
        appState.updatePort({
            type: (e.target as HTMLSelectElement).value as PortType
        })
    );
document
    .getElementById("in-freq")
    ?.addEventListener("input", e =>
        appState.updatePort({
            tuningFreq: +(e.target as HTMLInputElement).value
        })
    );

// Botones 3D
document
    .getElementById("btn-explode")
    ?.addEventListener("click", () =>
        appState.update({ isExploded: !appState.current.isExploded })
    );
document
    .getElementById("btn-xray")
    ?.addEventListener("click", () =>
        appState.update({ isTransparent: !appState.current.isTransparent })
    );
document
    .getElementById("btn-solid")
    ?.addEventListener("click", () =>
        appState.update({ isSolid: !appState.current.isSolid })
    );

// Tabs UI
const tabs = {
    d: document.getElementById("tab-design"),
    a: document.getElementById("tab-analysis"),
    b: document.getElementById("tab-build")
};
const pans = {
    d: document.getElementById("panel-design"),
    a: document.getElementById("panel-analysis"),
    b: document.getElementById("panel-build")
};
const switchTab = (k: "d" | "a" | "b") => {
    Object.values(pans).forEach(p => p?.classList.add("hidden"));
    Object.values(tabs).forEach(t =>
        t?.classList.remove("text-[#C5A96E]", "border-b-2", "bg-white/5")
    );

    pans[k]?.classList.remove("hidden");
    tabs[k]?.classList.add("text-[#C5A96E]", "border-b-2", "bg-white/5");
};
tabs.d?.addEventListener("click", () => switchTab("d"));
tabs.a?.addEventListener("click", () => switchTab("a"));
tabs.b?.addEventListener("click", () => switchTab("b"));

// ==========================================
// 4. SUSCRIPTOR PRINCIPAL (EL CEREBRO)
// ==========================================

const advP = document.getElementById("advisor-panel");
const cutB = document.getElementById("cut-table-body");
const chartTitle = document.getElementById("chart-title");
const peakDisplay = document.getElementById("val-peak");

appState.subscribe((params, result) => {
    // A. Actualizar 3D
    view.updateGeometry(params, result);

    // B. Preparar Datos de Gráfica
    let dataPoints: any[] = [];
    let limitPoints: any[] = [];
    let yLabel = "";
    let title = "";
    let yMax = undefined;
    let yMin = undefined;

    if (currentGraph === "freq") {
        dataPoints = result.frequencyResponse;
        title = "Respuesta de Frecuencia (dB)";
        yLabel = "dB";
        yMax = 12;
        yMin = -24;
    } else if (currentGraph === "exc") {
        dataPoints = result.coneExcursion;
        title = "Excursión de Cono (mm)";
        yLabel = "mm";
        // Límite Rojo: Xmax
        limitPoints = dataPoints.map(p => ({ x: p.x, y: params.driver.xmax }));
        yMin = 0;
    } else if (currentGraph === "vel") {
        dataPoints = result.portVelocity;
        title = "Velocidad de Aire (m/s)";
        yLabel = "m/s";
        // Límite Rojo: 30 m/s (Ruido audible)
        limitPoints = dataPoints.map(p => ({ x: p.x, y: 30 }));
        yMin = 0;
    }

    // C. Renderizar Gráfica
    chart.data.labels = dataPoints.map(p => p.x);
    chart.data.datasets[0].data = dataPoints.map(p => p.y);
    chart.data.datasets[1].data = limitPoints.map(p => p.y);

    // Escalas dinámicas
    if (yMax !== undefined) chart.options.scales!.y!.max = yMax;
    else delete chart.options.scales!.y!.max;

    if (yMin !== undefined) chart.options.scales!.y!.min = yMin;
    else delete chart.options.scales!.y!.min;

    chart.update();

    // D. Actualizar Leyenda de Gráfica
    if (chartTitle) chartTitle.innerText = title;
    if (peakDisplay) {
        const maxVal = Math.max(...dataPoints.map(p => p.y));
        peakDisplay.innerText = `${maxVal.toFixed(1)} ${yLabel}`;
    }

    // E. Actualizar Tabla de Cortes
    if (cutB) {
        cutB.innerHTML = "";
        result.cutSheet.forEach(c => {
            cutB.innerHTML += `
            <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td class="py-2 text-xs text-gray-400">${c.name}</td>
                <td class="text-[#C5A96E] text-xs font-mono font-bold">${c.width.toFixed(1)} x ${c.height.toFixed(1)}</td>
                <td class="text-center text-xs text-gray-500">${c.count}</td>
            </tr>`;
        });
    }

    // F. Textos y Visibilidad
    const setTxt = (id: string, t: string) => {
        const el = document.getElementById(id);
        if (el) el.innerText = t;
    };
    setTxt("disp-net", result.netTotal.toFixed(2) + " L");

    // Mostrar/Ocultar secciones según topología
    const show = (id: string) =>
        document.getElementById(id)?.classList.remove("hidden");
    const hide = (id: string) =>
        document.getElementById(id)?.classList.add("hidden");

    // Lógica Sellada vs Porteada
    if (params.boxType === BoxType.SEALED) {
        hide("sec-port");
        hide("sec-bandpass");
        // Si estamos viendo velocidad aire en sellada, cambiar a freq
        if (currentGraph === "vel") (window as any).setGraph("freq");
        document.getElementById("btn-g-vel")?.classList.add("hidden"); // Ocultar botón Aire
        document.querySelector("#btn-g-vel + div")?.classList.add("hidden"); // Separador
    } else {
        show("sec-port");
        document.getElementById("btn-g-vel")?.classList.remove("hidden");
        document.querySelector("#btn-g-vel + div")?.classList.remove("hidden");

        if (params.boxType === BoxType.BANDPASS_4TH) show("sec-bandpass");
        else hide("sec-bandpass");
    }

    params.port.type === PortType.SLOT
        ? (show("div-slot"), hide("div-circ"))
        : (hide("div-slot"), show("div-circ"));

    // Botones activos
    const act = (id: string, is: boolean) => {
        const b = document.getElementById(id);
        if (b) b.style.color = is ? "#C5A96E" : "white";
    };
    act("btn-explode", params.isExploded);
    act("btn-xray", params.isTransparent);
    act("btn-solid", params.isSolid);

    // G. Actualizar Consejero y Advertencias
    if (advP) {
        advP.innerHTML = "";
        result.warnings.forEach(
            w =>
                (advP.innerHTML += `<div class="p-2 border-l-2 border-red-500 bg-red-900/20 text-red-200 text-[10px] mb-1 animate-pulse">🛑 ${w}</div>`)
        );
        result.advice.forEach(a => {
            const c =
                a.level === "error"
                    ? "red"
                    : a.level === "warning"
                      ? "yellow"
                      : "blue";
            const i =
                a.level === "error"
                    ? "🛑"
                    : a.level === "warning"
                      ? "⚡"
                      : "ℹ️";
            advP.innerHTML += `<div class="p-2 border-l-2 border-${c}-500 bg-${c}-900/10 text-${c}-200 text-[10px] mb-1">${i} ${a.message}</div>`;
        });
        if (result.warnings.length === 0 && result.advice.length === 0) {
            advP.innerHTML = `<div class="text-center text-gray-600 text-[10px] p-2">Sistema Nominal. Diseño estable.</div>`;
        }
    }
});

// ==========================================
// 5. BUCLE DE ANIMACIÓN
// ==========================================
let mx = 0,
    my = 0;
document.addEventListener("mousemove", e => {
    mx = (e.clientX - window.innerWidth / 2) * 0.001;
    my = (e.clientY - window.innerHeight / 2) * 0.001;
});

function loop() {
    requestAnimationFrame(loop);
    view.animate(mx, my, appState.current.isExploded, !isAppActive);
}
loop();
