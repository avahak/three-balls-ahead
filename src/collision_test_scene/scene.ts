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
import type { AssetLoader } from '../assetLoader';
import { BallSegment, BallState } from '../physics/ballSegment';
import { VecMath } from '../math/vec';
import { FatUCBSplineGroup } from '../rendering/FatUCBSpline';
import { OverheadCamera } from '../overheadCamera';
import { Constants as Cst } from '../physics/constants';
import { Simulator } from './simulator';
import { Table } from '../physics/table';
import { TextGroup } from '../rendering/textRender';

const SHADOW_MAP_SIZE = 1024 * 2;

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
    uiCamera!: THREE.OrthographicCamera;
    scene!: THREE.Scene;
    uiScene!: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    cleanUpTasks: (() => void)[];
    animationRequestID: number | null = null;
    lastTime: number | null = null;
    gui: any;
    isStopped: boolean = true;

    assetLoader: AssetLoader;

    balls: THREE.Object3D[] = [];
    ballsByName: Map<string, THREE.Object3D> = new Map();

    textGroup!: TextGroup;
    sg: FatUCBSplineGroup | null = null;
    simulator!: Simulator;

    solverMode: "forceSolver" | "siSolver" = "forceSolver";

    constructor(container: HTMLDivElement, assetLoader: AssetLoader) {
        this.container = container;
        this.cleanUpTasks = [];
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        // this.renderer.setClearColor(0x000000, 0);
        this.renderer.autoClear = false;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;  // This may give WebGL warning
        // this.renderer.shadowMap.type = THREE.BasicShadowMap;
        container.appendChild(this.renderer.domElement);

        this.renderer.getContext().getExtension('EXT_float_blend');

        this.overheadCamera = new OverheadCamera(container);
        this.uiCamera = new THREE.OrthographicCamera();
        this.uiCamera.position.set(0, 0, 1);

        this.assetLoader = assetLoader;
    }

    async init() {
        await this.loadAssets();

        this.simulator = new Simulator(this.assetLoader);

        this.uiScene = new THREE.Scene();

        this.setupScene();
        this.setupResizeRenderer();
        this.createGUI();

        this.textGroup = new TextGroup(this.assetLoader.getFont("gara64")!);
        this.uiScene.add(this.textGroup.getObject());

        // this.cleanUpTasks.push(() => {
        //     if (this.animationRequestID)
        //         cancelAnimationFrame(this.animationRequestID);
        // });
        this.animate = this.animate.bind(this);
        this.animate();
    }

    async loadAssets() {
        const promises: Promise<any>[] = [];
        for (let k = 0; k < 16; k++)
            promises.push(this.assetLoader.loadImage(`ball_${k}`, `/three-balls-ahead/balls/ball${k}.png`));
        promises.push(this.assetLoader.loadImage(`cloth1`, `/three-balls-ahead/table/cloth1.png`));
        promises.push(this.assetLoader.loadImage(`cloth2`, `/three-balls-ahead/table/cloth2.png`));
        promises.push(
            this.assetLoader.loadModel("table", "/three-balls-ahead/table/pooltable.obj", "/three-balls-ahead/table/pooltable.mtl"),
            this.assetLoader.loadModel("cushions", "/three-balls-ahead/table/cushions.obj", "/three-balls-ahead/table/pooltable.mtl"),
            this.assetLoader.loadFont("gara64", "/three-balls-ahead/fonts/", "gara64"),
            this.assetLoader.loadFile("table_json", "/three-balls-ahead/table/pooltable.json", "json"),
        );
        await Promise.all(promises);
    }

    resizeRenderer() {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        const { clientWidth, clientHeight } = this.container;
        console.log(`Resize! (${clientWidth}, ${clientHeight})`);
        this.renderer.setSize(clientWidth, clientHeight);
        const aspect = clientWidth / clientHeight;

        this.overheadCamera.setAspectRatio(aspect);
        this.uiCamera.left = -aspect;
        this.uiCamera.right = aspect;
        this.uiCamera.updateProjectionMatrix();

        this.sg?.setResolution(this.renderer);
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
        const animateButton = () => {
            this.isStopped = false;
            this.animateStep();
            this.isStopped = true;
        }
        const toggleStop = () => {
            this.isStopped = !this.isStopped;
        };
        const logEvents = () => {
            console.log(this.simulator.t, this.simulator.eventHandler.queue);
        };
        const switchSolverMode = () => {
            this.solverMode = (this.solverMode === "forceSolver") ? "siSolver" : "forceSolver";
        };
        const restart = () => {
            this.lastTime = null;
            this.isStopped = true;
            this.simulator.restart();
            this.updateBallPositions();
        };
        const myObject = {
            animateButton,
            toggleStop,
            logEvents,
            restart,
            switchSolverMode,
            solverMode: this.solverMode,
        };
        this.gui.add(myObject, 'animateButton').name("Animate step");
        this.gui.add(myObject, 'toggleStop').name("Toggle stop/play");
        this.gui.add(myObject, 'logEvents').name("Log events");
        this.gui.add(myObject, 'restart').name("Restart");
        this.gui.add(myObject, 'solverMode', ['forceSolver', 'siSolver']).name("Solver mode").onChange((value: "forceSolver" | "siSolver") => {
            this.solverMode = value;
        });
        this.gui.close();
    }

    dispose() {
        if (this.animationRequestID)
            cancelAnimationFrame(this.animationRequestID);

        // this.sg?.dispose();
        // this.textGroup.dispose();

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
        ambientLight.intensity = 0.15;
        this.scene.add(ambientLight);
        // const numLights = 4;
        // for (let k = 0; k < numLights; k++) {
        //     let light = new THREE.SpotLight(0xffffff);
        //     light.decay = 0;
        //     light.penumbra = 0.1;
        //     light.angle = Math.PI / 8;
        //     light.castShadow = true;
        //     light.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
        //     light.intensity = 4.0 / numLights;
        //     const [r, phi] = [2.0, 2.0 * Math.PI * k / numLights];
        //     light.position.set(r * Math.cos(phi), r * Math.sin(phi), 4);
        //     light.target.position.set(0.0, 0.0, 0.0);
        //     this.scene.add(light.target);
        //     this.scene.add(light);
        // }
        const light = new THREE.DirectionalLight(0xffffff, 4.0);
        light.castShadow = true;
        light.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
        const offset = 3;
        light.shadow.camera.left = -offset;
        light.shadow.camera.right = offset;
        light.shadow.camera.top = offset;
        light.shadow.camera.bottom = -offset;
        light.shadow.camera.near = 0.1;
        light.shadow.camera.far = 100;
        light.position.set(0, 0, 10);
        this.scene.add(light);

        const group = new THREE.Group();
        group.position.set(0, 0, -Table.tableJson.specs.BALL_RADIUS);
        // const group1 = this.assetLoader.getModel("table")!;
        // group.add(group1);

        const img = this.assetLoader.getImage("cloth2")!;
        const repeats = 20;
        img.wrapS = THREE.RepeatWrapping;
        img.wrapT = THREE.RepeatWrapping;
        img.colorSpace = THREE.SRGBColorSpace;
        img.repeat.set(repeats, repeats);
        const planeGeometry = new THREE.PlaneGeometry(2 * repeats, repeats);
        const planeMaterial = new THREE.MeshStandardMaterial({ map: img });
        const group1 = new THREE.Group().add(new THREE.Mesh(planeGeometry, planeMaterial));
        group.add(group1);

        // const group2 = this.assetLoader.getModel("cushions")!;
        // group.add(group2);
        // group.setRotationFromEuler(new THREE.Euler(-1.0, 0.0, 0.0));
        setShadow(group, true, true);
        this.scene.add(group);

        const ballGeometry = new THREE.SphereGeometry(1, 32, 16);
        const ball = new THREE.Mesh(ballGeometry);
        const ballBaseGroup = new THREE.Group();
        ballBaseGroup.add(ball);
        setShadow(ballBaseGroup, true, true);

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
                const v = VecMath.wSum([a, v0, p0, [0, 0, 1]], [(k * k - 1 / 3) * dt * dt / 2, k * dt, 1, Cst.R]);
                cpList.push(new THREE.Vector3(...v));
            }
            console.log(cpList);
            return cpList;
        };


        this.sg = new FatUCBSplineGroup();
        const stateColor = new Map<BallState, number[]>();
        stateColor.set(BallState.Flying, [0.25, 0.25, 1]);
        stateColor.set(BallState.Stopped, [1, 1, 1]);
        stateColor.set(BallState.SpinningStationary, [0.25, 1, 0.25]);
        stateColor.set(BallState.Rolling, [0.25, 1, 1]);
        stateColor.set(BallState.Sliding, [1, 0.25, 0.25]);

        for (let k = 0; k < this.simulator.balls.length; k++) {
            const material = new THREE.MeshStandardMaterial({ color: 0x336699, roughness: 0.2, metalness: 0.2 });
            material.color = new THREE.Color('white');
            material.map = this.assetLoader.getImage(`ball_${k % 16}`);
            material.needsUpdate = true;

            const ball: THREE.Object3D = ballBaseGroup.clone();
            ball.traverse((child) => {
                if (child instanceof THREE.Mesh)
                    child.material = material;
            });
            let r = Table.tableJson.specs.BALL_RADIUS;
            ball.scale.set(r, r, r);
            this.balls.push(ball);
            this.ballsByName.set(`ball_${k}`, ball);
            this.scene.add(ball);
        }
    }

    updateBallPositions() {
        const t = this.simulator.t;
        for (let k = 0; k < this.balls.length; k++) {
            const ball = this.balls[k];
            const seg = this.simulator.balls[k].seg;
            const evalResult = seg.eval(t);
            if (evalResult.q)
                ball.setRotationFromQuaternion(evalResult.q);
            ball.position.set(...evalResult.p);
        }
    }

    getResolution() {
        const { clientWidth, clientHeight } = this.container;
        return new THREE.Vector2(clientWidth, clientHeight);
    }

    animate() {
        this.animationRequestID = requestAnimationFrame(this.animate);
        this.animateStep();
    }

    animateStep() {
        const currentTime = (this.lastTime ?? 0.0) + 1 / 60 / 2;
        if (!this.isStopped) {
            this.lastTime = currentTime;

            // console.log("currentTime", currentTime);

            this.simulator.advanceTime(currentTime, this.solverMode);
            if (!this.simulator.stopped)
                this.updateBallPositions();
        }

        this.renderer.render(this.scene, this.overheadCamera.camera);

        this.textGroup.reset();
        const size = 0.075;
        this.textGroup.addText(`currentTime: ${currentTime}`, [this.uiCamera.right, 1, 0], [1, 1, 1], [1, 1], size);
        this.textGroup.addText(`simulator len: ${this.simulator.eventHandler.size()}, steps: ${this.simulator.steps_DEBUG}`, [this.uiCamera.right, 1 - size, 0], [1, 1, 1], [1, 1], size);
        this.textGroup.addText(`evalCounter_DEBUG: ${BallSegment.evalCounter_DEBUG}`, [this.uiCamera.right, 1 - 2 * size, 0], [1, 1, 1], [1, 1], size);
        this.renderer.render(this.uiScene, this.uiCamera);
    }
}

export { Scene };