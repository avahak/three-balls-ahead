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
import type { AssetLoader } from './assetLoader';

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
    camera!: THREE.Camera;
    scene!: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    cleanUpTasks: (() => void)[];
    animationRequestID: number | null = null;
    lastTime: number | null = null;
    gui: any;
    isStopped: boolean = false;

    // shader!: THREE.ShaderMaterial;
    cube!: THREE.Mesh;

    constructor(container: HTMLDivElement, assetLoader: AssetLoader) {
        this.container = container;
        this.cleanUpTasks = [];
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        container.appendChild(this.renderer.domElement);

        this.renderer.getContext().getExtension('EXT_float_blend');

        this.setupCamera();
        this.setupScene(assetLoader);
        this.setupResizeRenderer();
        this.createGUI();

        this.cleanUpTasks.push(() => {
            if (this.animationRequestID)
                cancelAnimationFrame(this.animationRequestID);
        });
        this.animate = this.animate.bind(this);
        this.animate();
    }

    resizeRenderer() {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        const { clientWidth, clientHeight } = this.container;
        console.log(`Resize! (${clientWidth}, ${clientHeight})`);
        this.renderer.setSize(clientWidth, clientHeight);
        const aspect = clientWidth / clientHeight;
        if (this.camera instanceof THREE.OrthographicCamera) {
            this.camera.left = -aspect;
            this.camera.right = aspect;
            this.camera.updateProjectionMatrix();
        } else if (this.camera instanceof THREE.PerspectiveCamera) {
            this.camera.aspect = aspect;
            this.camera.updateProjectionMatrix();
        }
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

        this.gui.destroy();
    }

    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(45, 1.0, 0.1, 100.0);

        this.camera.position.set(0, 0, 2);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));
    }

    async loadAssets(assetLoader: AssetLoader) {
        const group = new THREE.Group();
        const group1 = await assetLoader.loadModel("table", "/three-balls-ahead/table/pooltable.obj", "/three-balls-ahead/table/pooltable.mtl");
        const group2 = await assetLoader.loadModel("cushions", "/three-balls-ahead/table/cushions.obj", "/three-balls-ahead/table/pooltable.mtl");
        group.add(group1, group2);
        // group.setRotationFromEuler(new THREE.Euler(-1.0, 0.0, 0.0));
        setShadow(group, true, true);
        this.scene.add(group);
    }

    setupScene(assetLoader: AssetLoader) {
        this.scene = new THREE.Scene();
        const cubeGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const cubeMaterial = new THREE.MeshNormalMaterial();
        this.cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
        setShadow(this.cube, true, true);
        this.scene.add(this.cube);

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

        this.loadAssets(assetLoader);

        // this.shader = new THREE.ShaderMaterial({
        //     uniforms: {
        //         resolution: { value: null },
        //     },
        //     vertexShader: vs,
        //     fragmentShader: fs,
        // });

        // const geometry = new THREE.PlaneGeometry(2, 2);
        // let mesh = new THREE.Mesh(geometry, this.shader);
        // this.scene.add(mesh);
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

        const t = this.lastTime * 0.002;

        // this.camera.position.set(1.5 * Math.cos(-t), 1.5 * Math.sin(-t), 0.5);
        // this.camera.up.set(0.0, 0.0, 1.0);
        // this.camera.lookAt(new THREE.Vector3(0.0, 0.0, 0.0));

        this.cube.position.set(0.5 * Math.cos(2 * t), 0.25 * Math.sin(2 * t), 0.27);

        this.renderer.render(this.scene, this.camera);
    }
}

export { Scene };