import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { MCSDFFont } from './font';

interface AssetCache {
    [key: string]: any;
}

type AssetType = 'model' | 'image' | 'file' | 'font';

export class AssetLoader {
    private textureLoader: THREE.TextureLoader;
    private cache: AssetCache = {};
    private loadingPromises: Map<string, Promise<any>> = new Map();

    constructor() {
        this.textureLoader = new THREE.TextureLoader();
    }

    /**
     * Generic asset loading core that handles caching and deduplication
     * @param type - Type of asset
     * @param id - Unique identifier for the asset
     * @param loader - Function that performs the actual loading
     * @returns Promise resolving to the loaded asset
     */
    private async _loadAsset<T>(
        type: AssetType,
        id: string,
        loader: () => Promise<T>
    ): Promise<T> {
        const cacheKey = `${type}:${id}`;

        if (this.cache[cacheKey]) {
            console.log(`Returning cached ${type}: ${id}`);
            return this.cache[cacheKey];
        }

        if (this.loadingPromises.has(cacheKey))
            return this.loadingPromises.get(cacheKey) as Promise<T>;

        console.log(`Loading ${type}: ${id}`);

        // Create and store the loading promise
        const loadPromise = loader().then(
            (result) => {
                this.cache[cacheKey] = result;
                this.loadingPromises.delete(cacheKey);
                return result;
            },
            (error) => {
                this.loadingPromises.delete(cacheKey);
                throw error;
            }
        );

        this.loadingPromises.set(cacheKey, loadPromise);
        return loadPromise;
    }

    /**
     * Load a 3D model (OBJ with optional MTL)
     */
    async loadModel(id: string, objPath: string, mtlPath?: string): Promise<THREE.Group> {
        return this._loadAsset('model', id, async () => {
            const objLoader = new OBJLoader();

            if (mtlPath) {
                const materials = await this.loadMTL(mtlPath);
                objLoader.setMaterials(materials);
            }

            return new Promise((resolve, reject) => {
                objLoader.load(
                    objPath,
                    (object) => {
                        const group = object instanceof THREE.Group ? object : new THREE.Group().add(object);
                        resolve(group);
                    },
                    undefined,
                    reject
                );
            });
        });
    }

    /**
     * Load MTL file and return material creator
     */
    private loadMTL(mtlPath: string): Promise<MTLLoader.MaterialCreator> {
        const mtlLoader = new MTLLoader();

        return new Promise((resolve, reject) => {
            mtlLoader.load(
                mtlPath,
                (materialCreator) => {
                    materialCreator.preload();
                    resolve(materialCreator);
                },
                undefined,
                reject
            );
        });
    }

    /**
     * Load an image as a Three.js texture
     */
    async loadImage(id: string, path: string): Promise<THREE.Texture> {
        return this._loadAsset('image', id, () => {
            return new Promise((resolve, reject) => {
                this.textureLoader.load(
                    path,
                    (texture) => resolve(texture),
                    undefined,
                    reject
                );
            });
        });
    }

    /**
     * Load a generic file (JSON, text, blob, etc.)
     */
    async loadFile(id: string, path: string, responseType: 'json' | 'text' | 'blob' = 'text'): Promise<any> {
        return this._loadAsset('file', id, async () => {
            const response = await fetch(path);

            if (!response.ok) {
                throw new Error(`Failed to load file: ${path} (${response.status})`);
            }

            switch (responseType) {
                case 'json':
                    return response.json();
                case 'text':
                    return response.text();
                case 'blob':
                    return response.blob();
                default:
                    return response.text();
            }
        });
    }

    /**
     * Load a multi-channel signed distance field font
     * Combines atlas texture loading and JSON metadata loading
     */
    async loadFont(id: string, fontPath: string, fileBaseName: string): Promise<MCSDFFont> {
        return this._loadAsset('font', id, async () => {
            // Build paths if not provided (assuming conventional naming)
            const atlasUrl = `${fontPath}${fileBaseName}.png`;
            const jsonUrl = `${fontPath}${fileBaseName}.json`;

            // Load atlas texture using loadImage
            const atlasTexture = await this.loadImage(`${id}:atlas`, atlasUrl);

            // Load JSON metadata using loadFile
            const layoutData = await this.loadFile(`${id}:metadata`, jsonUrl, 'json');

            const font = new MCSDFFont(id, layoutData, atlasTexture);

            // Configure texture properties
            atlasTexture.anisotropy = 4;
            atlasTexture.needsUpdate = true;
            // Optional: configure mipmapping settings if needed
            // atlasTexture.generateMipmaps = false;
            // atlasTexture.minFilter = THREE.LinearFilter;
            // atlasTexture.magFilter = THREE.LinearFilter;

            return font;
        });
    }

    /**
     * Get a cached asset by its type and ID
     */
    getAsset<T = any>(type: AssetType, id: string): T | null {
        const cacheKey = `${type}:${id}`;
        const cached = this.cache[cacheKey];

        if (!cached) {
            console.warn(`Asset not found in cache: ${cacheKey}`);
            return null;
        }

        return cached as T;
    }

    /**
     * Convenience method for getting models
     */
    getModel(id: string): THREE.Group | null {
        return this.getAsset('model', id);
    }

    /**
     * Convenience method for getting images
     */
    getImage(id: string): THREE.Texture | null {
        return this.getAsset('image', id);
    }

    /**
     * Convenience method for getting fonts
     */
    getFont(id: string): MCSDFFont | null {
        return this.getAsset('font', id);
    }

    /**
     * Convenience method for getting files
     */
    getFile<T = any>(id: string): T | null {
        return this.getAsset('file', id);
    }

    /**
     * Remove a specific asset from cache
     */
    removeAsset(type: AssetType, id: string): void {
        const cacheKey = `${type}:${id}`;
        const asset = this.cache[cacheKey];

        if (asset) {
            // Dispose textures if applicable
            if (asset instanceof THREE.Texture) {
                asset.dispose();
            } else if (asset instanceof MCSDFFont) {
                asset.dispose();
            }

            delete this.cache[cacheKey];
            console.log(`Removed ${type}: ${id} from cache`);
        }
    }

    /**
     * Clear all cached assets
     */
    clearAll(): void {
        // Dispose all textures and fonts
        Object.keys(this.cache).forEach((key) => {
            const asset = this.cache[key];
            if (asset instanceof THREE.Texture) {
                asset.dispose();
            } else if (asset instanceof MCSDFFont) {
                asset.dispose();
            }
        });

        this.cache = {};
        this.loadingPromises.clear();

        console.log('All caches cleared');
    }
}