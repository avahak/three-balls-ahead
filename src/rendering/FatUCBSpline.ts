import * as THREE from 'three';
import vsSpline from './shaders/vsFatSpline.glsl?raw';
import vsCap from './shaders/vsFatSplineCap.glsl?raw';
import fsSpline from './shaders/fsSpline.glsl?raw';

/**
 * Instanced tubular uniform cubic B-spline renderer with optional round endcaps.
 */
class FatUCBSplineGroup {
    static readonly TEXTURE_WIDTH = 1024;

    tubeShader: THREE.ShaderMaterial;
    capShader: THREE.ShaderMaterial;

    tubeGeometry!: THREE.InstancedBufferGeometry;
    capGeometry!: THREE.InstancedBufferGeometry;

    controlPointArray: Float32Array;
    indexArray: Int32Array;
    capDataArray: Int32Array;

    controlPointTexture!: THREE.DataTexture;
    indexTexture!: THREE.DataTexture;
    capDataTexture!: THREE.DataTexture;

    numSegments: number;
    numControlPoints = 0;
    numIndexes = 0;
    numCaps = 0;

    group: THREE.Group;

    /**
     * Creates a new fat uniform cubic b-spline group.
     * @param numSegments Number of segments each spline segment is split into.
     * @param vSegments Number of radial segments in the tubes.
     * @param minPixelRadius Minimum spline tube radius in pixels.
     */
    constructor(numSegments: number = 16, vSegments: number = 8, minPixelRadius: number = 0.5) {
        this.numSegments = numSegments;

        // --- Shaders ---
        this.tubeShader = new THREE.ShaderMaterial({
            uniforms: {
                controlPointTexture: { value: null },
                indexTexture: { value: null },
                TEXTURE_WIDTH: { value: FatUCBSplineGroup.TEXTURE_WIDTH },
                resolution: { value: new THREE.Vector2() },
                uSegments: { value: this.numSegments },
                vSegments: { value: vSegments },
                minPixelRadius: { value: minPixelRadius },
            },
            vertexShader: vsSpline,
            fragmentShader: fsSpline,
            depthWrite: true,
            depthTest: true,
        });

        this.capShader = new THREE.ShaderMaterial({
            uniforms: {
                controlPointTexture: { value: null },
                capDataTexture: { value: null },
                TEXTURE_WIDTH: { value: FatUCBSplineGroup.TEXTURE_WIDTH },
                resolution: { value: new THREE.Vector2() },
                vSegments: { value: vSegments },
                minPixelRadius: { value: minPixelRadius },
            },
            vertexShader: vsCap,
            fragmentShader: fsSpline,
            depthWrite: true,
            depthTest: true,
        });

        // --- Geometry ---
        // Each instanced geometry uses a dummy position buffer; actual positions are computed in shader
        this.tubeGeometry = this.createInstancedGeometry(this.numSegments * vSegments * 6);
        this.capGeometry = this.createInstancedGeometry(vSegments * vSegments * 6);

        // --- Data Arrays and Textures ---
        this.controlPointArray = new Float32Array(0);
        this.indexArray = new Int32Array(0);
        this.capDataArray = new Int32Array(0);

        this.controlPointTexture = new THREE.DataTexture(this.controlPointArray, 1, 1, THREE.RGBAFormat, THREE.FloatType);
        this.indexTexture = new THREE.DataTexture(this.indexArray, 1, 1, THREE.RedIntegerFormat, THREE.IntType);
        this.capDataTexture = new THREE.DataTexture(this.capDataArray, 1, 1, THREE.RGIntegerFormat, THREE.IntType);

        this.tubeShader.uniforms.controlPointTexture.value = this.controlPointTexture;
        this.tubeShader.uniforms.indexTexture.value = this.indexTexture;
        this.capShader.uniforms.controlPointTexture.value = this.controlPointTexture;
        this.capShader.uniforms.capDataTexture.value = this.capDataTexture;

        // --- Grouping Meshes ---
        const tubeMesh = new THREE.Mesh(this.tubeGeometry, this.tubeShader);
        tubeMesh.frustumCulled = false;

        const capMesh = new THREE.Mesh(this.capGeometry, this.capShader);
        capMesh.frustumCulled = false;

        this.group = new THREE.Group();
        this.group.add(tubeMesh);
        this.group.add(capMesh);

        this.reset();
    }

    /** 
     * Create instanced geometry with a dummy position buffer 
     */
    private createInstancedGeometry(vertexCount: number): THREE.InstancedBufferGeometry {
        const geometry = new THREE.InstancedBufferGeometry();
        const dummyPositions = new Float32Array(vertexCount * 3);
        geometry.setAttribute('position', new THREE.BufferAttribute(dummyPositions, 3));
        return geometry;
    }

    /**
     * Must be called whenever pixel ratio or canvas size changes.
     */
    setResolution(renderer: THREE.WebGLRenderer) {
        renderer.getDrawingBufferSize(this.tubeShader.uniforms.resolution.value);
        renderer.getDrawingBufferSize(this.capShader.uniforms.resolution.value);
    }

    /**
     * Adds a new spline.
     * @param controlPoints Array of 3D points.
     * @param color Function mapping control point index to [r,g,b].
     * @param radii Function mapping control point index to [world_radius, max_pixel_radius].
     * @param isClosed Whether the spline forms a closed loop.
     * @param startCap If true, add a hemisphere cap at the start (ignored if isClosed).
     * @param endCap If true, add a hemisphere cap at the end (ignored if isClosed).
     */
    addSpline(
        controlPoints: THREE.Vector3[],
        color: (k: number) => number[],     // (k) => (r, g, b)
        radii: (k: number) => number[],     // (k) => (world_radius, max_pixel_radius)
        isClosed: boolean = false,
        startCap: boolean = false,
        endCap: boolean = false
    ) {
        if (controlPoints.length < 4)
            throw new Error('At least 4 control points required.');

        const startIndex = this.numIndexes;
        const np = this.numControlPoints + controlPoints.length + (isClosed ? 3 : 0);
        const ni = this.numIndexes + controlPoints.length + (isClosed ? 0 : -3);

        this.ensureCapacityControlPointArray(8 * np);
        this.ensureCapacityIndexArray(ni);

        for (let k = 0; k < controlPoints.length + (isClosed ? 3 : 0); k++) {
            const j = k % controlPoints.length;
            const p = controlPoints[j];
            const c = color(j);
            const r = radii(j);
            const offset = 8 * this.numControlPoints;

            // Store (x, y, z, world_radius, r, g, b, max_pixel_radius) per control point
            this.controlPointArray[offset + 0] = p.x;
            this.controlPointArray[offset + 1] = p.y;
            this.controlPointArray[offset + 2] = p.z;
            this.controlPointArray[offset + 3] = r[0];
            this.controlPointArray[offset + 4] = c[0];
            this.controlPointArray[offset + 5] = c[1];
            this.controlPointArray[offset + 6] = c[2];
            this.controlPointArray[offset + 7] = r[1];

            if (k < controlPoints.length + (isClosed ? 0 : -3))
                this.indexArray[this.numIndexes++] = this.numControlPoints;

            this.numControlPoints++;
        }

        this.tubeGeometry.instanceCount = this.numIndexes;
        this.controlPointTexture.needsUpdate = true;
        this.indexTexture.needsUpdate = true;

        if (!isClosed) {
            if (startCap)
                this.addCapInstance(startIndex, 0);
            if (endCap)
                this.addCapInstance(this.numIndexes - 1, 1);
        }
    }

    /**
     * Adds a single cap instance for a given spline segment.
     * @param segmentStartIndex Index into the indexTexture pointing to the first control point of the segment.
     * @param side 0 = start cap, 1 = end cap.
     */
    private addCapInstance(segmentStartIndex: number, side: number) {
        this.ensureCapacityCapDataArray(2 * this.numCaps + 2);

        this.capDataArray[2 * this.numCaps] = this.indexArray[segmentStartIndex];
        this.capDataArray[2 * this.numCaps + 1] = side;
        this.numCaps++;

        this.capGeometry.instanceCount = this.numCaps;
        this.capDataTexture.needsUpdate = true;
    }

    private growArray<T extends Float32Array | Int32Array>(array: T, minLength: number): T {
        const newLength = Math.pow(2, Math.ceil(Math.log2(minLength)));
        const newArray = new (array.constructor as { new(size: number): T })(newLength);
        newArray.set(array, 0);
        return newArray;
    }

    private ensureCapacityControlPointArray(minLength: number) {
        if (minLength <= this.controlPointArray.length)
            return;

        this.controlPointArray = this.growArray(this.controlPointArray, minLength);

        this.controlPointTexture.dispose();

        const texels = this.controlPointArray.length / 4;       // Using THREE.RGBAFormat
        this.controlPointTexture = new THREE.DataTexture(
            this.controlPointArray,
            Math.min(texels, FatUCBSplineGroup.TEXTURE_WIDTH),
            Math.ceil(texels / FatUCBSplineGroup.TEXTURE_WIDTH),
            THREE.RGBAFormat,
            THREE.FloatType
        );

        this.tubeShader.uniforms.controlPointTexture.value = this.controlPointTexture;
        this.capShader.uniforms.controlPointTexture.value = this.controlPointTexture;
    }

    private ensureCapacityIndexArray(minLength: number) {
        if (minLength <= this.indexArray.length)
            return;

        this.indexArray = this.growArray(this.indexArray, minLength);

        this.indexTexture.dispose();

        const texels = this.indexArray.length;      // Using THREE.RedIntegerFormat
        this.indexTexture = new THREE.DataTexture(
            this.indexArray,
            Math.min(texels, FatUCBSplineGroup.TEXTURE_WIDTH),
            Math.ceil(texels / FatUCBSplineGroup.TEXTURE_WIDTH),
            THREE.RedIntegerFormat,
            THREE.IntType
        );

        this.tubeShader.uniforms.indexTexture.value = this.indexTexture;
    }

    private ensureCapacityCapDataArray(minLength: number) {
        if (minLength <= this.capDataArray.length)
            return;

        this.capDataArray = this.growArray(this.capDataArray, minLength);

        this.capDataTexture.dispose();

        const texels = this.capDataArray.length / 2;    // Using THREE.RGIntegerFormat
        this.capDataTexture = new THREE.DataTexture(
            this.capDataArray,
            Math.min(texels, FatUCBSplineGroup.TEXTURE_WIDTH),
            Math.ceil(texels / FatUCBSplineGroup.TEXTURE_WIDTH),
            THREE.RGIntegerFormat,
            THREE.IntType
        );

        this.capShader.uniforms.capDataTexture.value = this.capDataTexture;
    }

    /** 
     * Resets all spline and cap data 
     */
    reset() {
        this.numControlPoints = 0;
        this.numIndexes = 0;
        this.numCaps = 0;
        this.tubeGeometry.instanceCount = 0;
        this.capGeometry.instanceCount = 0;
    }

    /** 
     * Returns a THREE.Group containing both the tube and cap meshes 
     */
    getObject(): THREE.Group {
        return this.group;
    }

    /** 
     * Dispose all geometries, textures, and materials 
     */
    dispose() {
        this.tubeShader.dispose();
        this.capShader.dispose();
        this.controlPointTexture.dispose();
        this.indexTexture.dispose();
        this.capDataTexture.dispose();
        this.tubeGeometry.dispose();
        this.capGeometry.dispose();
    }
}

export { FatUCBSplineGroup };