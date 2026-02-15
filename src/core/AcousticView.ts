import * as THREE from "three";
// Asegúrate de tener 'three' instalado. Vite resuelve esto automáticamente.
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { DesignParams, BoxType, PortType, SimulationResult } from "../types";

export class AcousticView {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;

    // --- SISTEMAS ---
    private particleSystem: THREE.Points;
    private solidGroup: THREE.Group;

    // --- DATOS DE PARTÍCULAS ---
    private maxParticles = 60000; // Alta densidad
    private particleGeo: THREE.BufferGeometry;
    private particleMat: THREE.PointsMaterial;

    private speakerTargets: number[] = [];
    private explodedTargets: number[] = [];
    private types: number[] = [];
    private baseColors: number[] = [];

    private colorHelper = new THREE.Color();
    private GOLD = new THREE.Color(0xc5a96e);

    // --- MATERIALES SÓLIDOS (CAD) ---
    private matBody: THREE.MeshStandardMaterial;
    private matDriver: THREE.MeshStandardMaterial;
    private matPort: THREE.MeshStandardMaterial;

    // --- ANIMACIÓN ---
    private clock = new THREE.Clock();

    // Variables de Centrado Inteligente
    private currentTargetX = 0;
    private targetTargetX = 0;

    constructor(container: HTMLElement) {
        // 1. Escena
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x050505, 0.002);
        this.scene.background = new THREE.Color(0x050505);

        // 2. Cámara
        this.camera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / window.innerHeight,
            0.1,
            3000
        );
        this.camera.position.set(0, 0, 140);

        // 3. Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);

        // 4. Orbit Controls
        this.controls = new OrbitControls(
            this.camera,
            this.renderer.domElement
        );
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = true;
        this.controls.minDistance = 50;
        this.controls.maxDistance = 400;
        this.controls.enabled = false; // Se activa al entrar a la App

        // 5. Luces
        const amb = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(amb);
        const dir = new THREE.DirectionalLight(0xffffff, 1.5);
        dir.position.set(50, 100, 100);
        this.scene.add(dir);

        // 6. Textura
        const texture = this.getTexture();

        // 7. Sistema de Partículas
        this.particleGeo = new THREE.BufferGeometry();
        this.particleGeo.setAttribute(
            "position",
            new THREE.BufferAttribute(
                new Float32Array(this.maxParticles * 3),
                3
            )
        );
        this.particleGeo.setAttribute(
            "color",
            new THREE.BufferAttribute(
                new Float32Array(this.maxParticles * 3),
                3
            )
        );

        this.particleMat = new THREE.PointsMaterial({
            size: 1.5,
            map: texture,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            opacity: 0.95
        });
        this.particleSystem = new THREE.Points(
            this.particleGeo,
            this.particleMat
        );
        this.scene.add(this.particleSystem);

        // 8. Grupo Sólido
        this.solidGroup = new THREE.Group();
        this.scene.add(this.solidGroup);

        this.matBody = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.3,
            metalness: 0.1,
            side: THREE.DoubleSide
        });
        this.matDriver = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.4,
            metalness: 0.6
        });
        this.matPort = new THREE.MeshStandardMaterial({
            color: 0xc5a96e,
            roughness: 0.2,
            metalness: 0.8
        });

        window.addEventListener("resize", () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    private getTexture(): THREE.Texture {
        const c = document.createElement("canvas");
        c.width = 32;
        c.height = 32;
        const ctx = c.getContext("2d");
        if (ctx) {
            const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
            g.addColorStop(0, "rgba(255,255,255,1)");
            g.addColorStop(0.4, "rgba(255,255,255,0.1)");
            g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 32, 32);
        }
        const t = new THREE.Texture(c);
        t.needsUpdate = true;
        return t;
    }

    // --- CENTRADO INTELIGENTE ---
    public setCenterOffset(isSidebarOpen: boolean) {
        // Movemos el "Target" (punto de mira) a la izquierda (-35)
        // Esto hace que la caja parezca estar a la derecha, centrada en el espacio vacío.
        this.targetTargetX = isSidebarOpen ? -35 : 0;
    }

    // --- GENERADOR DE PUNTOS ---
    private addPoints(
        geometry: THREE.BufferGeometry,
        type: number,
        zOffset: number = 0
    ) {
        const pos = geometry.attributes.position.array;
        let r = 0,
            g = 0,
            b = 0;
        for (let i = 0; i < pos.length; i += 3) {
            this.speakerTargets.push(pos[i], pos[i + 1], pos[i + 2] + zOffset);

            // Explosión en anillo
            const angle = Math.random() * Math.PI * 2;
            const rad = 180 + Math.random() * 150;
            this.explodedTargets.push(
                Math.cos(angle) * rad,
                (Math.random() - 0.5) * 300,
                Math.sin(angle) * rad - 50
            );

            this.types.push(type);

            // Colores Definidos
            if (type === 0) {
                // Caja: Gris Medio (Visible)
                const v = Math.random() * 0.2 + 0.3;
                r = v;
                g = v;
                b = v;
            } else if (type === 1) {
                r = 0.2;
                g = 0.2;
                b = 0.2;
            } // Cono
            else if (type === 2) {
                r = this.GOLD.r;
                g = this.GOLD.g;
                b = this.GOLD.b;
            } // Tweeter
            else if (type === 3) {
                r = this.GOLD.r * 0.8;
                g = this.GOLD.g * 0.8;
                b = this.GOLD.b * 0.8;
            } // Borde

            this.baseColors.push(r, g, b);
        }
    }

    public updateGeometry(
        params: DesignParams,
        result: SimulationResult
    ): void {
        if (params.isSolid) {
            this.particleSystem.visible = false;
            this.solidGroup.visible = true;
            this.buildSolid(params, result);
        } else {
            this.particleSystem.visible = true;
            this.solidGroup.visible = false;
            this.buildParticles(params);
        }
    }

    private buildParticles(params: DesignParams) {
        this.speakerTargets = [];
        this.explodedTargets = [];
        this.types = [];
        this.baseColors = [];

        // 1. Caja
        const boxGeo = new THREE.BoxGeometry(
            params.width,
            params.height,
            params.depth,
            30,
            40,
            30
        );
        this.addPoints(boxGeo, 0, 0);

        // 2. Driver
        let dY = 0;
        if (
            params.speakerType === "tower" ||
            params.speakerType === "bookshelf"
        )
            dY = -params.height * 0.15;
        const fZ = params.depth / 2;
        const dR = (params.driverSize * 2.54) / 2;

        for (let r = 1; r <= dR; r += 0.5) {
            const rg = new THREE.RingGeometry(r, r + 0.25, 64);
            const cd = (r / dR) * 6;
            rg.translate(0, dY, fZ - 6 + cd);
            this.addPoints(rg, 1);
        }
        for (let r = dR; r <= dR + 2; r += 0.3) {
            const rg = new THREE.RingGeometry(r, r + 0.2, 64);
            rg.translate(0, dY, fZ);
            this.addPoints(rg, 3);
        }

        // 3. Tweeter
        if (
            ["tower", "bookshelf", "studio", "hifi_home"].includes(
                params.speakerType
            ) ||
            params.application === "hifi_home"
        ) {
            const tY = params.height / 4;
            for (let r = 0.2; r <= 2.5; r += 0.2) {
                const rg = new THREE.RingGeometry(r, r + 0.1, 32);
                rg.translate(0, tY, fZ + 0.5);
                this.addPoints(rg, 2);
            }
        }

        const cnt = this.speakerTargets.length / 3;
        this.particleGeo.setAttribute(
            "position",
            new THREE.BufferAttribute(new Float32Array(this.speakerTargets), 3)
        );
        this.particleGeo.setAttribute(
            "color",
            new THREE.BufferAttribute(new Float32Array(this.baseColors), 3)
        );
        this.particleGeo.setDrawRange(0, cnt);
        this.particleGeo.attributes.position.needsUpdate = true;
        this.particleGeo.attributes.color.needsUpdate = true;
    }

    private buildSolid(params: DesignParams, result: SimulationResult) {
        while (this.solidGroup.children.length > 0)
            this.solidGroup.remove(this.solidGroup.children[0]);
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(params.width, params.height, params.depth),
            this.matBody
        );
        this.matBody.transparent = params.isTransparent;
        this.matBody.opacity = params.isTransparent ? 0.3 : 1;
        this.solidGroup.add(box);

        const dR = (params.driverSize * 2.54) / 2;
        const cyl = new THREE.Mesh(
            new THREE.CylinderGeometry(dR, dR * 0.7, 5, 32),
            this.matDriver
        );
        cyl.rotateX(Math.PI / 2);
        let dY = 0;
        if (
            params.speakerType === "tower" ||
            params.speakerType === "bookshelf"
        )
            dY = -params.height * 0.15;
        cyl.position.set(0, dY, params.depth / 2);
        this.solidGroup.add(cyl);

        // Puerto simple para sólido
        if (params.boxType !== BoxType.SEALED) {
            const pLen = result.portLength * 2.0;
            const pM = new THREE.Mesh(
                new THREE.CylinderGeometry(
                    params.port.diameter,
                    params.port.diameter,
                    pLen,
                    32
                ),
                this.matPort
            );
            pM.rotateX(Math.PI / 2);
            pM.position.set(
                0,
                params.boxType === BoxType.BANDPASS_4TH
                    ? params.height * 0.25
                    : -params.height * 0.35,
                params.depth / 2 - pLen / 2
            );
            this.solidGroup.add(pM);
        }
    }

    // --- LOOP ANIMACIÓN ---
    public animate(
        mx: number,
        my: number,
        isExploded: boolean,
        isAuto: boolean
    ): void {
        const time = this.clock.getElapsedTime();
        const pos = this.particleGeo.attributes.position.array as Float32Array;
        const col = this.particleGeo.attributes.color.array as Float32Array;

        const tgt = isExploded ? this.explodedTargets : this.speakerTargets;
        const spd = isExploded ? 0.03 : 0.1;
        const beat = Math.pow((Math.sin(time * 3) + 1) / 2, 8);

        const count = this.speakerTargets.length;
        for (let i = 0; i < count; i += 3) {
            const idx = i / 3;
            let tx = tgt[i],
                ty = tgt[i + 1],
                tz = tgt[i + 2];

            if (!isExploded) {
                const type = this.types[idx];
                if (type === 1 || type === 3) {
                    const mv = beat * 1.5;
                    tz += mv;
                    const l = mv * 0.15;
                    col[i] = this.baseColors[i] + l;
                    col[i + 1] = this.baseColors[i + 1] + l;
                    col[i + 2] = this.baseColors[i + 2] + l;
                } else {
                    col[i] = this.baseColors[i];
                    col[i + 1] = this.baseColors[i + 1];
                    col[i + 2] = this.baseColors[i + 2];
                }
            } else {
                ty += Math.sin(time + tx * 0.02) * 1.5;
            }
            pos[i] += (tx - pos[i]) * spd;
            pos[i + 1] += (ty - pos[i + 1]) * spd;
            pos[i + 2] += (tz - pos[i + 2]) * spd;
        }
        this.particleGeo.attributes.position.needsUpdate = true;
        this.particleGeo.attributes.color.needsUpdate = true;

        // --- LÓGICA DE CONTROL Y CENTRADO ---
        if (isAuto && !isExploded) {
            // MODO INICIO
            this.controls.enabled = false;
            this.particleSystem.rotation.y += 0.003;
            this.solidGroup.rotation.y += 0.003;
            this.particleSystem.rotation.x = Math.sin(time * 0.5) * 0.15;
            this.solidGroup.rotation.x = Math.sin(time * 0.5) * 0.15;

            // Reseteamos el Target
            this.controls.target.set(0, 0, 0);
        } else {
            // MODO APP
            this.controls.enabled = true;
            this.controls.update();

            // Paramos la rotación automática suavemente
            this.particleSystem.rotation.x *= 0.9;
            this.particleSystem.rotation.y *= 0.9;
            this.solidGroup.rotation.x *= 0.9;
            this.solidGroup.rotation.y *= 0.9;

            // Centrado: Movemos el TARGET de la cámara
            this.currentTargetX +=
                (this.targetTargetX - this.currentTargetX) * 0.05;
            this.controls.target.setX(this.currentTargetX);
        }

        this.renderer.render(this.scene, this.camera);
    }
}
