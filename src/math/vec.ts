import * as math from 'mathjs';

type Vec = number[];
type Vec2 = [number, number];
type Vec3 = [number, number, number];
type Vec4 = [number, number, number, number];

type VecStats = {
    n: number,
    mean: number,
    std: number,
    min: number,
    max: number
};

/**
 * A collection of static methods for n-dimensional vector operations.
 */
class VecMath {
    private static gaussianSpare: number | null = null;

    private constructor() { } // Prevent instantiation

    /**
     * Computes the weighted sum of vectors: sum_k(scalars[k] * vecs[k])
     */
    static wSum<T extends Vec>(vecs: T[], scalars: number[]): T {
        if (vecs.length !== scalars.length)
            throw new Error("vecs and scalars must have the same length");
        if (vecs.length === 0)
            throw new Error("At least one vector is required");

        const dim = vecs[0].length;
        const sum = new Array(dim).fill(0);

        for (let k = 0; k < vecs.length; k++) {
            const vec = vecs[k];
            if (vec.length !== dim)
                throw new Error("All vectors must have the same dimension");
            const scalar = scalars[k];
            for (let j = 0; j < dim; j++)
                sum[j] += scalar * vec[j];
        }

        return sum as T;
    }

    static add<T extends Vec>(v1: T, v2: T): T {
        return VecMath.wSum([v1, v2], [1, 1]);
    }

    static sub<T extends Vec>(v1: T, v2: T): T {
        return VecMath.wSum([v1, v2], [1, -1]);
    }

    static scale<T extends Vec>(v: T, c: number): T {
        return v.map(x => c * x) as T;
    }

    /**
     * Applies a matrix transformation (matrix * vec).
     * @param matrix Can be mathjs.Matrix or number[][]
     */
    static applyMatrix(matrix: number[][] | math.Matrix, v: Vec): Vec {
        return math.multiply(matrix, v).valueOf() as Vec;
    }

    // --- Factory methods ---
    static zeros(dim: number): Vec {
        return new Array(dim).fill(0);
    }

    static e(k: number, dim: number = 3): Vec {
        const v = new Array(dim).fill(0);
        v[k] = 1;
        return v;
    }

    static dot<T extends Vec>(v1: T, v2: T): number {
        if (v1.length !== v2.length)
            throw new Error("Vectors must have the same dimension");
        return v1.reduce((acc, v, k) => acc + v * v2[k], 0);
    }

    static distance<T extends Vec>(v1: T, v2: T): number {
        if (v1.length !== v2.length)
            throw new Error("Vectors must have the same dimension");
        return Math.sqrt(v1.reduce((acc, v, k) => acc + (v - v2[k]) ** 2, 0));
    }

    static norm(v: Vec): number {
        return Math.sqrt(v.reduce((acc, x) => acc + x * x, 0));
    }

    static normalize<T extends Vec>(v: T, targetLength: number = 1): T {
        const r = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0));
        if (r === 0)
            throw Error('Cannot normalize vector of length 0.');
        return v.map(x => targetLength * x / r) as T;
    }

    static cross(v1: Vec3, v2: Vec3): Vec3 {
        if (v1.length !== 3 || v2.length !== 3)
            throw Error('Cross product is only for 3-vectors.');
        return [v1[1] * v2[2] - v1[2] * v2[1], v1[2] * v2[0] - v1[0] * v2[2], v1[0] * v2[1] - v1[1] * v2[0]];
    }

    // Uses Box-Muller transform.
    static gaussian(): number {
        if (VecMath.gaussianSpare !== null) {
            const v = VecMath.gaussianSpare;
            VecMath.gaussianSpare = null;
            return v;
        }

        let u = Math.max(Number.MIN_VALUE, Math.random());
        const r = Math.sqrt(-2.0 * Math.log(u));
        const theta = 2.0 * Math.PI * Math.random();

        VecMath.gaussianSpare = r * Math.sin(theta);
        return r * Math.cos(theta);
    }

    /**
     * Generates a random vector with components drawn from a normal distribution.
     * @param dim Dimension of the vector
     * @param std Standard deviation (default: 1)
     * @returns Array with random components ~N(0, std^2)
     */
    static vGaussian(dim: number = 3, std: number = 1): Vec {
        if (dim <= 0)
            throw new Error("Dimension must be positive");
        if (std < 0)
            throw new Error("Standard deviation must be non-negative");

        const data = Array(dim).fill(0);
        for (let k = 0; k < dim; k++)
            data[k] = VecMath.gaussian() * std;
        return data;
    }

    /**
     * Returns basic statistics of the vector.
     */
    static stats(v: Vec): VecStats {
        const n = v.length;
        if (n === 0)
            throw new Error("Input array must not be empty");

        let sum = 0, sumSq = 0, min = v[0], max = v[0];
        for (const val of v) {
            sum += val;
            sumSq += val * val;
            min = Math.min(min, val);
            max = Math.max(max, val);
        }
        const mean = sum / n;
        const std = Math.sqrt(sumSq / n - mean * mean);

        return { n, mean, std, min, max };
    }

    /**
     * 3x3 rotation matrix
     */
    static rotationMatrix(k: number, theta: number) {
        const [c, s] = [Math.cos(theta), Math.sin(theta)];
        const [k1, k2] = [(k + 1) % 3, (k + 2) % 3];

        const rot = math.identity(3) as math.Matrix;
        rot.subset(math.index(k1, k1), c);
        rot.subset(math.index(k1, k2), -s);
        rot.subset(math.index(k2, k1), s);
        rot.subset(math.index(k2, k2), c);
        return rot;
    }

    /**
     * Rotates a point around the x-axis by a given angle.
     */
    static xRotate(p: Vec3, theta: number): Vec3 {
        return [
            p[0],
            p[1] * Math.cos(theta) - p[2] * Math.sin(theta),
            p[1] * Math.sin(theta) + p[2] * Math.cos(theta)
        ];
    }

    /**
     * Rotates a point around the y-axis by a given angle.
     */
    static yRotate(p: Vec3, theta: number): Vec3 {
        return [
            p[0] * Math.cos(theta) + p[2] * Math.sin(theta),
            p[1],
            p[2] * Math.cos(theta) - p[0] * Math.sin(theta)
        ];
    }

    /**
     * Rotates a point around the z-axis by a given angle.
     */
    static zRotate(p: Vec3, theta: number): Vec3 {
        return [
            p[0] * Math.cos(theta) - p[1] * Math.sin(theta),
            p[0] * Math.sin(theta) + p[1] * Math.cos(theta),
            p[2]
        ];
    }

    /**
     * Returns Cartesian coordinates given spherical coordinates (r,elevation angle,azimutal angle).
     */
    static cartesianFromSpherical(r: number, theta: number, phi: number): Vec3 {
        const q = r * Math.cos(theta);
        return [q * Math.cos(phi), q * Math.sin(phi), r * Math.sin(theta)];
    }

    /**
     * Returns spherical coordinates (r,elevation angle,azimutal angle) given Cartesian coordinates.
     */
    static sphericalFromCartesian(x: number, y: number, z: number): Vec3 {
        const r = VecMath.norm([x, y, z]);
        const theta = Math.asin(z / r);
        const phi = Math.atan2(y, x);
        return [r, theta, phi];
    }


    static toString(v: Vec): string {
        return `Vec(${v.join(', ')})`;
    }
}

export type { Vec, Vec2, Vec3, Vec4, VecStats };
export { VecMath };