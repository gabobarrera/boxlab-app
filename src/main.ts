import '/src/styles/style.css';
import 'flowbite';
import Chart from 'charts.js/auto'; 
import { AcousticView } from './core/AcousticView';
import { appState } from './core/State';
import { DRIVER_DATABASE } from './data/drivers';
import { BoxType, PortType, BracingType } from './types';

// Inicializar 3D
const container = document.getElementById('canvas-container');
const view = new AcousticView(container!);

// --- 1. SETUP CHART.JS ---
const ctx = (document.getElementById('freq-chart') as HTMLCanvasElement).getContext('2d');
const responseChart = new Chart(ctx!, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Respuesta (dB)',
            data: [],
            borderColor: '#C5A96E',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4,
            fill: true,
            backgroundColor: 'rgba(197, 169, 110, 0.1)'
        }]
    },
    options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
            x: { title: { display: true, text: 'Hz', color: '#666' }, ticks: { color: '#888' } },
            y: { title: { display: true, text: 'dB', color: '#666' }, ticks: { color: '#888' }, min: -10, max: 10 }
        }
    }
});

// --- 2. BINDING BIDIRECCIONAL (Sliders <-> Inputs) ---
function syncInput(sliderId: string, numberId: string, field: string, isPort = false) {
    const slider = document.getElementById(sliderId) as HTMLInputElement;
    const number = document.getElementById(numberId) as HTMLInputElement;

    // Slider -> Estado
    slider?.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        if (isPort) appState.updatePort({ [field]: val });
        else appState.update({ [field]: val } as any);
    });

    // Numero -> Estado
    number?.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        if (isPort) appState.updatePort({ [field]: val });
        else appState.update({ [field]: val } as any);
    });

    // Estado -> Inputs
    appState.subscribe((params) => {
        const val = isPort ? (params.port as any)[field] : (params as any)[field];
        // Evitar loop infinito si el elemento tiene foco
        if (slider && document.activeElement !== slider) slider.value = val;
        if (number && document.activeElement !== number) number.value = val;
    });
}

// Activar Bindings
syncInput('slider-width', 'num-width', 'width');
syncInput('slider-height', 'num-height', 'height');
syncInput('slider-depth', 'num-depth', 'depth');
syncInput('slider-diam', 'num-diam', 'diameter', true);
syncInput('slider-p-width', 'num-p-width', 'width', true);
syncInput('slider-p-height', 'num-p-height', 'height', true);


// --- 3. EVENT LISTENERS GENERALES ---
// Driver Select
const driverSelect = document.getElementById('sel-driver') as HTMLSelectElement;
DRIVER_DATABASE.forEach((drv, index) => {
    const opt = document.createElement('option');
    opt.value = index.toString();
    opt.text = drv.name;
    driverSelect.appendChild(opt);
});
driverSelect.addEventListener('change', (e) => {
    const idx = parseInt((e.target as HTMLSelectElement).value);
    appState.updateDriver(DRIVER_DATABASE[idx]);
});

// Box Select
document.getElementById('sel-box-type')?.addEventListener('change', (e) => {
    appState.update({ boxType: (e.target as HTMLSelectElement).value as BoxType });
});

// Bracing Select
document.getElementById('sel-bracing')?.addEventListener('change', (e) => {
    appState.update({ bracingType: (e.target as HTMLSelectElement).value as BracingType });
});

// Port Type
document.getElementById('sel-port-type')?.addEventListener('change', (e) => {
    appState.updatePort({ type: (e.target as HTMLSelectElement).value as PortType });
});

// Port Freq
document.getElementById('in-freq')?.addEventListener('input', (e) => {
    appState.updatePort({ tuningFreq: +((e.target as HTMLInputElement).value) });
});

// Bandpass Ratio
document.getElementById('input-ratio')?.addEventListener('input', (e) => {
    appState.update({ chamberRatio: +((e.target as HTMLInputElement).value) });
});

// Botones Vista
document.getElementById('btn-explode')?.addEventListener('click', () => {
    appState.update({ isExploded: !appState.current.isExploded });
});
document.getElementById('btn-xray')?.addEventListener('click', () => {
    appState.update({ isTransparent: !appState.current.isTransparent });
});


// --- 4. SISTEMA DE PESTAÑAS (TABS) ---
const tabs = {
    design: document.getElementById('tab-design'),
    analysis: document.getElementById('tab-analysis'),
    build: document.getElementById('tab-build')
};
const panels = {
    design: document.getElementById('panel-design'),
    analysis: document.getElementById('panel-analysis'),
    build: document.getElementById('panel-build')
};

function switchTab(target: string) {
    Object.values(panels).forEach(p => p?.classList.add('hidden'));
    Object.values(tabs).forEach(t => t?.classList.remove('text-[#C5A96E]', 'border-b-2', 'border-[#C5A96E]'));
    
    if (target === 'design') {
        panels.design?.classList.remove('hidden');
        tabs.design?.classList.add('text-[#C5A96E]', 'border-b-2', 'border-[#C5A96E]');
    } else if (target === 'analysis') {
        panels.analysis?.classList.remove('hidden');
        tabs.analysis?.classList.add('text-[#C5A96E]', 'border-b-2', 'border-[#C5A96E]');
    } else {
        panels.build?.classList.remove('hidden');
        tabs.build?.classList.add('text-[#C5A96E]', 'border-b-2', 'border-[#C5A96E]');
    }
}
tabs.design?.addEventListener('click', () => switchTab('design'));
tabs.analysis?.addEventListener('click', () => switchTab('analysis'));
tabs.build?.addEventListener('click', () => switchTab('build'));


// --- 5. ACTUALIZACIÓN UI GLOBAL ---
const ui = {
    dispNet: document.getElementById('disp-net'),
    dispPortLen: document.getElementById('disp-port-len'),
    dispWarnings: document.getElementById('ui-warnings'),
    dispC1: document.getElementById('disp-vol-c1'),
    dispC2: document.getElementById('disp-vol-c2'),
    secPort: document.getElementById('sec-port'),
    secBandpass: document.getElementById('sec-bandpass'),
    divSlot: document.getElementById('div-slot'),
    divCirc: document.getElementById('div-circ'),
    btnExplode: document.getElementById('btn-explode')
};

appState.subscribe((params, result) => {
    // A. 3D
    view.updateGeometry(params, result);
    
    // B. Chart
    responseChart.data.labels = result.frequencyResponse.map(p => p.hz);
    responseChart.data.datasets[0].data = result.frequencyResponse.map(p => p.db);
    responseChart.update('none'); // Update sin animación pesada

    // C. Cut Sheet
    const tbody = document.getElementById('cut-table-body');
    if (tbody) {
        tbody.innerHTML = '';
        result.cutSheet.forEach(cut => {
            tbody.innerHTML += `
                <tr class="border-b border-white/5 hover:bg-white/5">
                    <td class="py-2 text-xs">${cut.name}</td>
                    <td class="py-2 font-mono text-[#C5A96E] text-xs">${cut.width.toFixed(1)} x ${cut.height.toFixed(1)}</td>
                    <td class="py-2 text-center text-xs">${cut.count}</td>
                </tr>`;
        });
    }

    // D. Textos
    if(ui.dispNet) ui.dispNet.innerText = result.netTotal.toFixed(2) + " L";
    if(ui.dispPortLen) ui.dispPortLen.innerText = result.portLength.toFixed(1) + " cm";
    if(ui.dispC1) ui.dispC1.innerText = result.chamber1.toFixed(1) + " L";
    if(ui.dispC2) ui.dispC2.innerText = result.chamber2.toFixed(1) + " L";

    // E. Visibilidad
    if (params.boxType === BoxType.SEALED) {
        ui.secPort?.classList.add('hidden');
        ui.secBandpass?.classList.add('hidden');
    } else if (params.boxType === BoxType.PORTED) {
        ui.secPort?.classList.remove('hidden');
        ui.secBandpass?.classList.add('hidden');
    } else {
        ui.secPort?.classList.remove('hidden');
        ui.secBandpass?.classList.remove('hidden');
    }

    if (params.port.type === PortType.SLOT) {
        ui.divSlot?.classList.remove('hidden');
        ui.divCirc?.classList.add('hidden');
    } else {
        ui.divSlot?.classList.add('hidden');
        ui.divCirc?.classList.remove('hidden');
    }

    // F. Botones Estado
    if(ui.btnExplode) ui.btnExplode.style.color = params.isExploded ? '#C5A96E' : 'white';

    // G. Advertencias
    if(ui.dispWarnings) {
        ui.dispWarnings.innerHTML = '';
        result.warnings.forEach(w => {
            const d = document.createElement('div');
            d.className = 'text-red-400 text-[10px] mt-1 border-l-2 border-red-500 pl-2 animate-pulse font-bold bg-red-900/20 p-1 rounded';
            d.innerText = w;
            ui.dispWarnings?.appendChild(d);
        });
    }
});

// Loop
let mx=0, my=0;
document.addEventListener('mousemove', e => {
    mx = (e.clientX - window.innerWidth/2)*0.001;
    my = (e.clientY - window.innerHeight/2)*0.001;
});
function loop() {
    requestAnimationFrame(loop);
    view.animate(mx, my, appState.current.isExploded);
}
loop();
