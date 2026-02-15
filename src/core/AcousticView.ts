import * as THREE from 'three';
import { DesignParams, BoxType, PortType, SimulationResult } from '../types';

export class AcousticView {
    // ... (Propiedades estándar de Three.js igual)
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private particleSystem: THREE.Points;
    
    private maxParticles = 30000;
    private targetPositions: Float32Array;
    private types: Uint8Array;
    private baseColors: Float32Array;
    private explodedPositions: Float32Array; // NUEVO: Para guardar posición expandida

    private goldColor = new THREE.Color(0xC5A96E);
    private redColor = new THREE.Color(0xFF0000);

    constructor(container: HTMLElement) {
        // ... (Scene setup igual)
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x050505, 0.002);
        this.scene.background = new THREE.Color(0x050505);
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 3000);
        this.camera.position.set(140, 70, 200);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(this.renderer.domElement);

        this.targetPositions = new Float32Array(this.maxParticles * 3);
        this.explodedPositions = new Float32Array(this.maxParticles * 3); // Buffer extra
        this.types = new Uint8Array(this.maxParticles);
        this.baseColors = new Float32Array(this.maxParticles * 3);
        
        this.particleSystem = this.createSystem();
        this.scene.add(this.particleSystem);
    }

    private createSystem(): THREE.Points {
        // ... (Igual que antes)
        const pos = new Float32Array(this.maxParticles*3);
        const col = new Float32Array(this.maxParticles*3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const mat = new THREE.PointsMaterial({ size: 1.2, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8 });
        return new THREE.Points(geo, mat);
    }

    public updateGeometry(params: DesignParams, result: SimulationResult): void {
        let idx = 0;
        const sf = 2.0; 
        const W = params.width * sf;
        const H = params.height * sf;
        const D = params.depth * sf;
        const driverR = (params.driverSize * 2.54 * sf) / 2;

        // Calculamos posiciones "Normales" y "Explosivas"
        // 1. BOX (Paredes)
        // Separamos paredes para la explosión
        idx = this.generateBoxExploded(idx, W, H, D, 8000);

        // 2. DRIVER
        let driverZ = D/2;
        if (params.boxType === BoxType.BANDPASS_4TH) driverZ = (params.chamberRatio - 0.5) * D;
        idx = this.generateDriver(idx, driverR, driverZ, D, 3000); // Pasamos D para calcular explosión Z

        // 3. PUERTO
        if (params.boxType !== BoxType.SEALED) {
            const pLen = result.portLength * sf;
            const portColor = result.isPortCollision ? this.redColor : this.goldColor;
            const pY = (params.boxType === BoxType.BANDPASS_4TH) ? H*0.25 : -H*0.35;
            idx = this.generatePort(idx, params, pLen, pY, D/2, D, portColor, 4000);
        }

        // Limpieza
        for(let i=idx; i<this.maxParticles; i++) {
            this.targetPositions[i*3] = 0; this.explodedPositions[i*3]=0;
        }

        // TRANSPARENCIA
        const mat = this.particleSystem.material as THREE.PointsMaterial;
        mat.opacity = params.isTransparent ? 0.2 : 0.85;
        mat.size = params.isTransparent ? 0.8 : 1.2;
    }

    // Generador de Caja con Lógica Explosiva
    private generateBoxExploded(startIdx: number, W: number, H: number, D: number, count: number): number {
        let idx = startIdx;
        const color = new THREE.Color(0.15, 0.15, 0.15);
        const explodeDist = 40; // Distancia de separación

        for(let i=0; i<count; i++) {
            const face = Math.floor(Math.random()*6);
            let x=0, y=0, z=0;
            let ex=0, ey=0, ez=0; // Exploded coords
            const u = Math.random()-0.5; const v = Math.random()-0.5;
            
            // Lógica: Si es cara derecha (face 0), x es positivo, exploded x suma distancia
            if(face===0){ x=0.5*W; y=u*H; z=v*D;      ex=x+explodeDist; ey=y; ez=z; } 
            else if(face===1){ x=-0.5*W; y=u*H; z=v*D; ex=x-explodeDist; ey=y; ez=z; }
            else if(face===2){ x=u*W; y=0.5*H; z=v*D;  ex=x; ey=y+explodeDist; ez=z; } 
            else if(face===3){ x=u*W; y=-0.5*H; z=v*D; ex=x; ey=y-explodeDist; ez=z; }
            else if(face===4){ x=u*W; y=v*H; z=0.5*D;  ex=x; ey=y; ez=z+explodeDist; } 
            else if(face===5){ x=u*W; y=v*H; z=-0.5*D; ex=x; ey=y; ez=z-explodeDist; }
            
            this.setPos(idx, x,y,z, ex,ey,ez);
            this.types[idx] = 0; 
            this.setBaseColor(idx, color);
            idx++;
        }
        return idx;
    }

    private generateDriver(startIdx: number, r: number, z: number, D: number, count: number): number {
        let idx = startIdx;
        const color = new THREE.Color(0.3, 0.3, 0.3);
        const explodeZ = z + 60; // El driver sale volando hacia el frente
        
        for(let i=0; i<count; i++) {
            const rad = Math.sqrt(Math.random()) * r;
            const theta = Math.random()*2*Math.PI;
            const depth = (rad/r)*(r*0.4);
            
            const x = rad * Math.cos(theta);
            const y = rad * Math.sin(theta);
            const finalZ = z - depth;

            this.setPos(idx, x, y, finalZ, x, y, explodeZ - depth);
            this.types[idx] = 1;
            this.setBaseColor(idx, color);
            idx++;
        }
        return idx;
    }

    private generatePort(startIdx: number, params: DesignParams, len: number, y: number, zStart: number, D: number, color: THREE.Color, count: number): number {
        let idx = startIdx;
        const sf = 2.0;
        const explodeZ = zStart + 50; // Puerto sale con el driver

        for(let i=0; i<count; i++) {
            const t = Math.random(); const zPos = t * len;
            let px=0, py=0;
            // ... (Lógica forma puerto igual que antes)
             const theta = Math.random()*2*Math.PI;
             let rad = (params.port.diameter * sf) / 2;
             if (params.port.type === PortType.AERO_FLARE) {
                 const flare = Math.pow((2*t - 1), 6) * 0.6;
                 rad = rad * (1 + flare);
             }
             px = rad * Math.cos(theta); py = rad * Math.sin(theta);
            // ... (Fin lógica forma)

            const pz = zStart - zPos;
            this.setPos(idx, px, py+y, pz, px, py+y, explodeZ - zPos);
            this.types[idx] = 4;
            this.setBaseColor(idx, color);
            idx++;
        }
        return idx;
    }

    private setPos(i: number, x:number, y:number, z:number, ex:number, ey:number, ez:number) {
        this.targetPositions[i*3] = x; this.targetPositions[i*3+1] = y; this.targetPositions[i*3+2] = z;
        this.explodedPositions[i*3] = ex; this.explodedPositions[i*3+1] = ey; this.explodedPositions[i*3+2] = ez;
    }

    private setBaseColor(i: number, c: THREE.Color) {
        this.baseColors[i*3] = c.r; this.baseColors[i*3+1] = c.g; this.baseColors[i*3+2] = c.b;
    }

    public animate(mouseX: number, mouseY: number, isExploded: boolean): void {
        const positions = this.particleSystem.geometry.attributes.position.array as Float32Array;
        const colors = this.particleSystem.geometry.attributes.color.array as Float32Array;
        const lerp = 0.08;

        // Seleccionar array objetivo según estado
        const targetArr = isExploded ? this.explodedPositions : this.targetPositions;

        for(let i=0; i<this.maxParticles; i++) {
            const i3 = i*3;
            // Interpolación suave entre posiciones
            positions[i3]   += (targetArr[i3]   - positions[i3])   * lerp;
            positions[i3+1] += (targetArr[i3+1] - positions[i3+1]) * lerp;
            positions[i3+2] += (targetArr[i3+2] - positions[i3+2]) * lerp;
            
            colors[i3] = this.baseColors[i3];
            colors[i3+1] = this.baseColors[i3+1];
            colors[i3+2] = this.baseColors[i3+2];
        }

        this.particleSystem.geometry.attributes.position.needsUpdate = true;
        this.particleSystem.geometry.attributes.color.needsUpdate = true;
        this.particleSystem.rotation.y += 0.05 * (mouseX - this.particleSystem.rotation.y);
        this.particleSystem.rotation.x += 0.05 * (-mouseY - this.particleSystem.rotation.x);
        this.renderer.render(this.scene, this.camera);
    }
}
