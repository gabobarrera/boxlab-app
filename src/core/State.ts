import {
    DesignParams,
    BoxType,
    PortType,
    BracingType,
    SimulationResult,
    ApplicationType,
    SpeakerType
} from "../types";
import { AudioMath } from "../physics/AudioMath";
import { Advisor } from "./Advisor";
import { DRIVER_DATABASE } from "../data/drivers";

type Listener = (state: DesignParams, result: SimulationResult) => void;

const INITIAL_STATE: DesignParams = {
    application: "car_audio",
    speakerType: "subwoofer_box",
    width: 45,
    height: 60,
    depth: 40,
    thickness: 18,
    boxType: BoxType.PORTED,
    bracingType: BracingType.WINDOW,
    driverSize: 12,
    driver: DRIVER_DATABASE[0],
    port: {
        type: PortType.AERO_FLARE,
        tuningFreq: 36,
        diameter: 10,
        width: 30,
        height: 5,
        count: 1
    },
    chamberRatio: 0.5,
    isExploded: false,
    isTransparent: false,
    isSolid: false
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
    public updatePort(partialPort: Partial<DesignParams["port"]>): void {
        this.state.port = { ...this.state.port, ...partialPort };
        this.notify();
    }
    public updateDriver(partialDriver: Partial<DesignParams["driver"]>): void {
        this.state.driver = { ...this.state.driver, ...partialDriver };
        this.notify();
    }

    // WIZARD PRESETS
    public setProjectContext(app: ApplicationType, speaker: SpeakerType): void {
        this.state.application = app;
        this.state.speakerType = speaker;

        if (speaker === "tower") {
            this.state.width = 22;
            this.state.height = 95;
            this.state.depth = 30;
            this.state.driverSize = 6.5;
            this.state.port.tuningFreq = 42;
        } else if (speaker === "soundbar") {
            this.state.width = 100;
            this.state.height = 12;
            this.state.depth = 12;
            this.state.driverSize = 4;
            this.state.boxType = BoxType.SEALED;
        } else if (speaker === "bookshelf") {
            this.state.width = 20;
            this.state.height = 35;
            this.state.depth = 25;
            this.state.driverSize = 6;
        } else {
            this.state.width = 45;
            this.state.height = 40;
            this.state.depth = 40;
            this.state.driverSize = 12;
        }

        if (app === "studio") {
            this.state.thickness = 25;
            this.state.bracingType = BracingType.CROSS;
        }
        this.notify();
    }

    public get current(): DesignParams {
        return { ...this.state };
    }

    private notify(): void {
        const result = AudioMath.calculate(this.state);
        result.advice = Advisor.analyze(this.state, result);
        this.lastResult = result;
        this.listeners.forEach(fn => fn(this.state, this.lastResult!));
    }
}
export const appState = new StateManager();
