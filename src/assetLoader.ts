import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';

interface ModelCache {
    [key: string]: THREE.Group;
}

interface ImageCache {
    [key: string]: THREE.Texture;
}

export class AssetLoader {
    private textureLoader: THREE.TextureLoader;
    private modelCache: ModelCache = {};
    private imageCache: ImageCache = {};
    private loadingPromises: Map<string, Promise<any>> = new Map();

    constructor() {
        this.textureLoader = new THREE.TextureLoader();
    }

    async loadModel(id: string, objPath: string, mtlPath?: string): Promise<THREE.Group> {
        if (this.modelCache[id]) {
            console.log(`Returning cached model: ${id}`);
            return this.modelCache[id];
        }

        if (this.loadingPromises.has(`model-${id}`)) {
            return this.loadingPromises.get(`model-${id}`) as Promise<THREE.Group>;
        }

        console.log(`Loading model: ${id} from ${objPath}${mtlPath ? ' with materials' : ''}`);

        const loadPromise = new Promise<THREE.Group>(async (resolve, reject) => {
            try {
                const objLoader = new OBJLoader();

                if (mtlPath) {
                    const materials = await this.loadMTL(mtlPath);
                    objLoader.setMaterials(materials);
                }

                objLoader.load(
                    objPath,
                    (object) => {
                        let group = object instanceof THREE.Group ? object : new THREE.Group().add(object);
                        this.modelCache[id] = group;
                        this.loadingPromises.delete(`model-${id}`);
                        resolve(group);
                    },
                    undefined,
                    (error) => {
                        this.loadingPromises.delete(`model-${id}`);
                        reject(error);
                    }
                );
            } catch (error) {
                this.loadingPromises.delete(`model-${id}`);
                reject(error);
            }
        });

        this.loadingPromises.set(`model-${id}`, loadPromise);
        return loadPromise;
    }

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

    getModel(id: string): THREE.Group | null {
        const cached = this.modelCache[id];
        if (!cached) {
            console.warn(`Model not found in cache: ${id}`);
            return null;
        }
        return cached;
    }

    async loadImage(id: string, path: string): Promise<THREE.Texture> {
        if (this.imageCache[id]) {
            console.log(`Returning cached image: ${id}`);
            return this.imageCache[id];
        }

        if (this.loadingPromises.has(`image-${id}`)) {
            return this.loadingPromises.get(`image-${id}`) as Promise<THREE.Texture>;
        }

        console.log(`Loading image: ${id} from ${path}`);

        const loadPromise = new Promise<THREE.Texture>((resolve, reject) => {
            this.textureLoader.load(
                path,
                (texture) => {
                    this.imageCache[id] = texture;
                    this.loadingPromises.delete(`image-${id}`);
                    resolve(texture);
                },
                undefined,
                (error) => {
                    this.loadingPromises.delete(`image-${id}`);
                    reject(error);
                }
            );
        });

        this.loadingPromises.set(`image-${id}`, loadPromise);
        return loadPromise;
    }

    getImage(id: string): THREE.Texture | null {
        const cached = this.imageCache[id];
        if (!cached) {
            console.warn(`Image not found in cache: ${id}`);
            return null;
        }
        return cached;
    }

    async loadModels(models: { id: string; objPath: string; mtlPath?: string }[]): Promise<Map<string, THREE.Group>> {
        const promises = models.map(({ id, objPath, mtlPath }) =>
            this.loadModel(id, objPath, mtlPath).then(group => ({ id, group }))
        );

        const results = await Promise.all(promises);
        const map = new Map();
        results.forEach(({ id, group }) => map.set(id, group));
        return map;
    }

    async loadImages(images: { id: string; path: string }[]): Promise<Map<string, THREE.Texture>> {
        const promises = images.map(({ id, path }) =>
            this.loadImage(id, path).then(texture => ({ id, texture }))
        );

        const results = await Promise.all(promises);
        const map = new Map();
        results.forEach(({ id, texture }) => map.set(id, texture));
        return map;
    }

    // removeImage(id: string): void {
    //     const cached = this.imageCache[id];
    //     if (cached) {
    //         cached.dispose();
    //         delete this.imageCache[id];
    //     }
    // }

    clearAll(): void {
        Object.values(this.imageCache).forEach((texture) => {
            texture.dispose();
        });

        this.modelCache = {};
        this.imageCache = {};
        this.loadingPromises.clear();

        console.log('All caches cleared');
    }

    // getStats(): { models: number; images: number; activeLoads: number } {
    //     return {
    //         models: Object.keys(this.modelCache).length,
    //         images: Object.keys(this.imageCache).length,
    //         activeLoads: this.loadingPromises.size
    //     };
    // }
}