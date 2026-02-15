import { DesignParams, BoxType, PortType, BracingType, SimulationResult } from '../types';
import { AudioMath } from '../physics/AudioMath';
import { DRIVER_DATABASE } from '../data/drivers'; // Import database

type Listener = (state: DesignParams, result: SimulationResult) => void;

const INITIAL_STATE: DesignParams = {
    width: 45, height: 60, depth: 40, thickness: 18,
    boxType: BoxType.PORTED,
    bracingType: BracingType.WINDOW,
    driverSize: 12,
    driver: DRIVER_DATABASE[0], // Generic Driver init
    port: {
        type: PortType.AERO_FLARE,
        tuningFreq: 36,
        diameter: 10, width: 30, height: 5, count: 1
    },
    chamberRatio: 0.5,
    isExploded: false,    // Vista normal
    isTransparent: false  // Opacidad normal
};

export class StateManager {
    private state: DesignParams;
    private listeners: Listener[] = [];
    private lastResult: SimulationResult | null = null;

    constructor() {
        this.state = JSON.parse(JSON.stringify(INITIAL_STATE));
        this.notify();
    }

    public subscribe(listener: Listener): void {
        this.listeners.push(listener);
        if (this.lastResult) listener(this.state, this.lastResult);
    }

    public update(partialState: Partial<DesignParams>): void {
        this.state = { ...this.state, ...partialState };
        this.notify();
    }

    public updatePort(partialPort: Partial<DesignParams['port']>): void {
        this.state.port = { ...this.state.port, ...partialPort };
        this.notify();
    }
    
    public updateDriver(partialDriver: Partial<DesignParams['driver']>): void {
        this.state.driver = { ...this.state.driver, ...partialDriver };
        this.notify();
    }

    public get current(): DesignParams { return { ...this.state }; }

    private notify(): void {
        this.lastResult = AudioMath.calculate(this.state);
        this.listeners.forEach(fn => fn(this.state, this.lastResult!));
    }
}

export const appState = new StateManager();
