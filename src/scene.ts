/**
 * Basic template for a three.js scene decoupling three.js and React by writing
 * a standalone class to handle three.js.
 * 
 * Draws a cube and a square with custom shader.
 */
import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
// import vs from './shaders/vs.glsl?raw';
// import fs from './shaders/fs.glsl?raw';
import type { AssetLoader } from './rendering/assetLoader';
import { BallSegment, BallState, test } from './physics/ballSegment';
import { Vec } from './math/vec';
import { UCBSplineGroup } from './rendering/UCBSpline';
import { OverheadCamera } from './overheadCamera';
import { Constants as Cst } from './physics/constants';

const SHADOW_MAP_SIZE = 1024;

const setShadow = (object: THREE.Object3D, castShadow: boolean, receiveShadow: boolean) => {
    object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.castShadow = castShadow;
            child.receiveShadow = receiveShadow;
        }
    });
};

class Scene {
    container: HTMLDivElement;
    overheadCamera!: OverheadCamera;
    scene!: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    cleanUpTasks: (() => void)[];
    animationRequestID: number | null = null;
    lastTime: number | null = null;
    gui: any;
    isStopped: boolean = false;

    assetLoader: AssetLoader;

    constructor(container: HTMLDivElement, assetLoader: AssetLoader) {
        this.container = container;
        this.cleanUpTasks = [];
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        container.appendChild(this.renderer.domElement);

        this.renderer.getContext().getExtension('EXT_float_blend');

        this.overheadCamera = new OverheadCamera(container);

        this.assetLoader = assetLoader;
    }

    async init() {
        await this.loadAssets();

        test();

        this.setupScene();
        this.setupResizeRenderer();
        this.createGUI();

        this.cleanUpTasks.push(() => {
            if (this.animationRequestID)
                cancelAnimationFrame(this.animationRequestID);
        });
        this.animate = this.animate.bind(this);
        this.animate();
    }

    async loadAssets() {
        await Promise.all([
            this.assetLoader.loadModel("table", "/three-balls-ahead/table/pooltable.obj", "/three-balls-ahead/table/pooltable.mtl"),
            this.assetLoader.loadModel("cushions", "/three-balls-ahead/table/cushions.obj", "/three-balls-ahead/table/pooltable.mtl"),
            this.assetLoader.loadFont("gara64", "/three-balls-ahead/fonts/", "gara64"),
        ]);
    }

    resizeRenderer() {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        const { clientWidth, clientHeight } = this.container;
        console.log(`Resize! (${clientWidth}, ${clientHeight})`);
        this.renderer.setSize(clientWidth, clientHeight);
        const aspect = clientWidth / clientHeight;

        this.overheadCamera.setAspectRatio(aspect);

        // this.shader.uniforms.resolution.value = new THREE.Vector2(clientWidth, clientHeight);
    }

    setupResizeRenderer() {
        // Create a ResizeObserver to monitor the container's size
        const resizeObserver = new ResizeObserver(() => {
            this.resizeRenderer();
        });
        resizeObserver.observe(this.container);
        this.cleanUpTasks.push(() => resizeObserver.unobserve(this.container));
        this.resizeRenderer();
    }

    createGUI() {
        this.gui = new GUI();
        const animateButton = () => this.animateStep();
        const toggleStop = () => {
            this.isStopped = !this.isStopped;
        };
        const myObject = {
            animateButton,
            toggleStop,
        };
        this.gui.add(myObject, 'animateButton').name("Animate step");
        this.gui.add(myObject, 'toggleStop').name("Toggle stop/play");
        this.gui.close();
    }

    dispose() {
        this.container.removeChild(this.renderer.domElement);
        for (const task of this.cleanUpTasks)
            task();
        this.renderer.dispose();
        // this.shader.dispose();

        this.gui?.destroy();
    }

    setupScene() {
        this.scene = new THREE.Scene();

        const ambientLight = new THREE.AmbientLight();
        ambientLight.intensity = 0.125;
        this.scene.add(ambientLight);
        const numLights = 4;
        for (let k = 0; k < numLights; k++) {
            let light = new THREE.SpotLight(0xffffff);
            light.decay = 0;
            light.penumbra = 0.1;
            light.angle = Math.PI / 8;
            light.castShadow = true;
            light.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
            light.intensity = 5.0 / numLights;
            const [r, phi] = [1.0, 2.0 * Math.PI * k / numLights];
            light.position.set(r * Math.cos(phi), r * Math.sin(phi), 4);
            // light.target.position.set(0.0, 0.0, 0.0);
            // this.scene.add(light.target);
            this.scene.add(light);
        }

        const group = new THREE.Group();
        const group1 = this.assetLoader.getModel("table")!;
        const group2 = this.assetLoader.getModel("cushions")!;
        group.add(group1, group2);
        // group.setRotationFromEuler(new THREE.Euler(-1.0, 0.0, 0.0));
        setShadow(group, true, true);
        this.scene.add(group);

        // @ts-ignore
        const getControlPoints = (t0: number, t1: number, p0: number[], v0: number[], a: number[]) => {
            // a = A * h * h
            // b = (2.0 * A * t0 + B) * h
            // c = A * t0 * t0 + B * t0 + C

            // P = np.array([
            //     a * (k-1)**2 + b * (k-1) + c - a / 3.0
            //     for k in range(4)
            // ])
            const dt = t1 - t0;
            const cpList = [];
            for (let k = -1; k < 3; k++) {
                const v = Vec.wSum([a, v0, p0, [0, 0, 1]], [(k * k - 1 / 3) * dt * dt / 2, k * dt, 1, Cst.R]);
                cpList.push(new THREE.Vector3(...v));
            }
            console.log(cpList);
            return cpList;
        };

        const getControlPointsDebug = (p0: number[], p1: number[]) => {
            // for line segments control points [2*A-B, A, B, 2*B-A] are perfect, 
            // with C(0)=A, C(1)=B, constant speed C'(t)=B-A.
            const e3 = [0, 0, 1];
            const q0 = Vec.wSum([p0, e3], [1, Cst.R + Math.abs(Vec.gaussian() * 0.0)]);
            const q1 = Vec.wSum([p1, e3], [1, Cst.R + Math.abs(Vec.gaussian() * 0.0)]);

            const cp0 = Vec.wSum([q0, q1], [2, -1]);
            const cp1 = Vec.wSum([q0, q1], [1, 0]);
            const cp2 = Vec.wSum([q0, q1], [0, 1]);
            const cp3 = Vec.wSum([q0, q1], [-1, 2]);
            return [
                new THREE.Vector3(...cp0), new THREE.Vector3(...cp1),
                new THREE.Vector3(...cp2), new THREE.Vector3(...cp3)
            ];
        };

        // const t0 = 10.0 * Vec.gaussian();
        // const p0 = [...Vec.vGaussian(2, 1), 0];
        // const v0 = [...Vec.vGaussian(2, 1), 0];
        // const w0 = Vec.vGaussian(3, 1);
        const t0 = 0;
        const p0 = [-1, 0, 0];
        const v0 = [2.5, 0, 0];
        const w0 = [10, -250, 50];
        const maxStep = 1;
        let q = new THREE.Quaternion(0, 0, 0, 1);
        let bs = BallSegment.create(t0, p0, v0, w0);

        const sg = new UCBSplineGroup();
        const stateColor = new Map<BallState, number[]>();
        stateColor.set(BallState.Flying, [0.25, 0.25, 1]);
        stateColor.set(BallState.Stopped, [1, 1, 1]);
        stateColor.set(BallState.SpinningStationary, [0.25, 1, 0.25]);
        stateColor.set(BallState.Rolling, [0.25, 1, 1]);
        stateColor.set(BallState.Sliding, [1, 0.25, 0.25]);

        let iter = 0;
        while (iter < 50) {
            console.log("iter", iter, "t", bs.t0, "state", bs.state, "q", q, { ...bs });
            if (bs.state == BallState.Stopped)
                break;
            iter++;

            const dt = Math.min(bs.t1 - bs.t0, maxStep);
            const evalResult = bs.eval(bs.t0 + dt, q);

            sg.addSpline(getControlPoints(bs.t0, bs.t0 + dt, bs.p0, bs.v0, bs.a), () => stateColor.get(bs.state)!);
            // sg.addSpline(getControlPoints(bs.t0, bs.t0 + dt, bs.p0, bs.v0, bs.a), () => [Math.random(), Math.random(), Math.random()]);
            // sg.addSpline(getControlPointsDebug(bs.p0, evalResult.p), () => stateColor.get(bs.state)!);

            q.multiply(evalResult.q!);
            bs = BallSegment.create(bs.t0 + dt, evalResult.p, evalResult.v, evalResult.w);
        }
        this.scene.add(sg.getObject());
    }

    getResolution() {
        const { clientWidth, clientHeight } = this.container;
        return new THREE.Vector2(clientWidth, clientHeight);
    }

    animate() {
        this.animationRequestID = requestAnimationFrame(this.animate);
        if (!this.isStopped)
            this.animateStep();
    }

    animateStep() {
        const currentTime = (this.lastTime ?? 0.0) + 1.0;
        this.lastTime = currentTime;

        // const t = this.lastTime * 0.002;

        this.renderer.render(this.scene, this.overheadCamera.camera);
    }
}

export { Scene };