import * as THREE from 'three';
import vsText from './shaders/vsText.glsl?raw';
import fsText from './shaders/fsText.glsl?raw';
import { MCSDFFont } from './font';

/**
 * Renders text using multi-channel signed distance field fonts.
 */
class TextGroup {
    // TEXTURE_MAX_WIDTH has to match value in vsText.glsl.
    // This is used to avoid limitations on texture dimensions.
    static TEXTURE_MAX_WIDTH = 1024;
    // FLOATS_PER_CHAR is number of floats stored for 1 text character
    // (4 atlasCoords, 3 pos, 3 e1, 3 e2, 3 color)
    static FLOATS_PER_CHAR = 16;
    // affects sharpness on text edges, default 0.5
    static SHARPNESS = 0.5;

    font: MCSDFFont;
    shader: THREE.ShaderMaterial;
    ibGeometry: THREE.InstancedBufferGeometry;
    dataTexture: THREE.Texture;
    mesh: THREE.Object3D;

    data: Float32Array<ArrayBuffer>;
    numChars!: number;

    constructor(font: MCSDFFont) {
        this.font = font;

        this.shader = new THREE.ShaderMaterial({
            uniforms: {
                dataTexture: { value: null },
                atlasTexture: { value: font.atlas },
                unitRange: { value: [TextGroup.SHARPNESS / this.font.layoutData.atlas.width, TextGroup.SHARPNESS / this.font.layoutData.atlas.height] },
                numChars: { value: null },
                useFisheye: { value: 0 },
                focalLength: { value: 0.5 },
            },
            vertexShader: vsText,
            fragmentShader: fsText,
            transparent: true,
            // blending: THREE.AdditiveBlending,        // There is no easy solution here
            // depthWrite: false,
            // depthTest: false
        });

        this.ibGeometry = new THREE.InstancedBufferGeometry();
        const square = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
        const squareIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);
        this.ibGeometry.setAttribute('position', new THREE.BufferAttribute(square, 3));
        this.ibGeometry.setIndex(new THREE.BufferAttribute(squareIndices, 1));

        this.data = new Float32Array(Math.floor(TextGroup.TEXTURE_MAX_WIDTH / TextGroup.FLOATS_PER_CHAR));
        this.dataTexture = new THREE.DataTexture(this.data, this.data.length / 4, 1, THREE.RGBAFormat, THREE.FloatType);
        this.shader.uniforms.dataTexture.value = this.dataTexture;
        this.dataTexture.needsUpdate = true;

        this.mesh = new THREE.Mesh(this.ibGeometry, this.shader);
        this.mesh.frustumCulled = false;

        this.reset();
    }

    /**
     * Returns bounding box [xMin, yMin, xMax, yMax] for given text.
     */
    private computeTextBounds(
        text: string,
    ) {
        let xMin = 0;
        let yMin = 0;
        let xMax = 0;
        let yMax = 0;

        let x = 0;
        let y = 0;
        let previousCharCode = -1;
        for (let k = 0; k < text.length; k++) {
            let code = text.charCodeAt(k);
            if (code === 10) {
                // Newline
                x = 0;
                y -= this.font.layoutData.metrics.lineHeight;
                previousCharCode = -1;
                continue;
            }

            let glyph = this.font.glyphLookup?.[code];
            if (!glyph) {
                // Replace unknown characters with '%' (code 37)
                code = 37;
                glyph = this.font.glyphLookup?.[code];
                if (!glyph) {
                    previousCharCode = -1;
                    continue;
                }
            }
            if (glyph.planeBounds) {
                // Kerning
                x += this.font.kerningLookup?.[previousCharCode]?.[code] ?? 0;

                // Compute position of the character rectangle in space
                const x1 = x + glyph.planeBounds.left;
                const x2 = x + glyph.planeBounds.right;
                const y1 = y + glyph.planeBounds.bottom;
                const y2 = y + glyph.planeBounds.top;

                xMin = Math.min(xMin, x1);
                xMax = Math.max(xMax, x2);
                yMin = Math.min(yMin, y1);
                yMax = Math.max(yMax, y2);

                previousCharCode = code;
            } else {
                previousCharCode = -1;
            }
            x += glyph.advance ?? 0;
        }
        return [xMin, yMin, xMax, yMax];
    }

    /**
     * Prepares text to be rendered. If pos is a function, it is used to 
     * compute the coordinates of the character rectanges. If pos is a vector,
     * it is used to position the text block and text is made to always face the camera.
     * @param anchor anchors for x, y, with [-1,-1] corresponding to bottom left and [1,1] to top right
     * @param textSize only used when text is made to face the camera.
     */
    addText(
        text: string,
        pos: ((x: number, y: number) => number[]) | number[],
        color: number[],
        anchor: number[],
        textSize: number = 0
    ) {
        const faceCamera = (typeof (pos) !== 'function');

        const bounds = this.computeTextBounds(text);
        const x0 = -0.5 * ((1 - anchor[0]) * bounds[0] + (1 + anchor[0]) * bounds[2]);
        const y0 = -0.5 * ((1 - anchor[1]) * bounds[1] + (1 + anchor[1]) * bounds[3]);

        let x = x0;
        let y = y0;
        let previousCharCode = -1;
        for (let k = 0; k < text.length; k++) {
            let code = text.charCodeAt(k);
            if (code === 10) {
                // Newline
                x = x0;
                y -= this.font.layoutData.metrics.lineHeight;
                previousCharCode = -1;
                continue;
            }

            let glyph = this.font.glyphLookup?.[code];
            if (!glyph) {
                // Replace unknown characters with '%' (code 37)
                code = 37;
                glyph = this.font.glyphLookup?.[code];
                if (!glyph) {
                    previousCharCode = -1;
                    continue;
                }
            }
            if (glyph.planeBounds) {
                // Kerning
                x += this.font.kerningLookup?.[previousCharCode]?.[code] ?? 0;

                // Compute position of the character rectangle in space
                let p, e1, e2;
                const x1 = x + glyph.planeBounds.left;
                const x2 = x + glyph.planeBounds.right;
                const y1 = y + glyph.planeBounds.bottom;
                const y2 = y + glyph.planeBounds.top;
                if (faceCamera) {
                    p = pos;
                    e1 = [textSize * x1, textSize * (x2 - x1), 0];
                    e2 = [textSize * y1, textSize * (y2 - y1), 0];
                } else {
                    const pLeft = pos(x1, 0.5 * (y1 + y2));
                    const pRight = pos(x2, 0.5 * (y1 + y2));
                    const pBottom = pos(0.5 * (x1 + x2), y1);
                    const pTop = pos(0.5 * (x1 + x2), y2);
                    p = [
                        (pLeft[0] + pRight[0] + pBottom[0] + pTop[0]) / 4,
                        (pLeft[1] + pRight[1] + pBottom[1] + pTop[1]) / 4,
                        (pLeft[2] + pRight[2] + pBottom[2] + pTop[2]) / 4,
                    ];
                    e1 = [pRight[0] - pLeft[0], pRight[1] - pLeft[1], pRight[2] - pLeft[2]];
                    e2 = [pTop[0] - pBottom[0], pTop[1] - pBottom[1], pTop[2] - pBottom[2]];
                }

                if (TextGroup.FLOATS_PER_CHAR * this.numChars >= this.data.length)
                    this.extendArray();

                const m = TextGroup.FLOATS_PER_CHAR * this.numChars;
                // 4 atlas coords
                this.data[m + 0] = glyph.atlasBounds.left / this.font.layoutData.atlas.width;
                this.data[m + 1] = glyph.atlasBounds.bottom / this.font.layoutData.atlas.height;
                this.data[m + 2] = glyph.atlasBounds.right / this.font.layoutData.atlas.width;
                this.data[m + 3] = glyph.atlasBounds.top / this.font.layoutData.atlas.height;
                // 3 pos
                this.data[m + 4] = p[0];
                this.data[m + 5] = p[1];
                this.data[m + 6] = p[2];
                // 3 e1
                this.data[m + 7] = e1[0];
                this.data[m + 8] = e1[1];
                this.data[m + 9] = e1[2];
                // 3 e2
                this.data[m + 10] = e2[0];
                this.data[m + 11] = e2[1];
                this.data[m + 12] = e2[2];
                // 3 color, code faceCamera into red channel (hacky)
                this.data[m + 13] = color[0] + (faceCamera ? 2 : 0);
                this.data[m + 14] = color[1];
                this.data[m + 15] = color[2];

                this.numChars++;
                previousCharCode = code;
            } else {
                previousCharCode = -1;
            }
            x += glyph.advance ?? 0;
        }
        this.ibGeometry.instanceCount = this.numChars;
        this.shader.uniforms.numChars.value = this.numChars;
        this.dataTexture.needsUpdate = true;
    }

    /**
     * Doubles this.data.
     */
    private extendArray() {
        const n = this.data.length;
        // Create new arrays with double size
        const newArray = new Float32Array(2 * n);

        // Copy existing data from previous array
        newArray.set(this.data, 0);
        this.data = newArray;

        // Hook new arrays into textures
        this.dataTexture.dispose();
        const m = 2 * n / 4;
        this.dataTexture = new THREE.DataTexture(
            this.data,
            Math.min(m, TextGroup.TEXTURE_MAX_WIDTH),
            Math.ceil(m / TextGroup.TEXTURE_MAX_WIDTH),
            THREE.RGBAFormat, THREE.FloatType
        );
        this.shader.uniforms.dataTexture.value = this.dataTexture;
        this.dataTexture.needsUpdate = true;
    }

    reset() {
        this.numChars = 0;
        this.ibGeometry.instanceCount = 0;
        this.shader.uniforms.numChars.value = 0;
    }

    getObject(): THREE.Object3D {
        return this.mesh;
    }

    dispose() {
        this.shader.dispose();
        this.ibGeometry.dispose();
        this.dataTexture.dispose();
    }
}

export { TextGroup };