import { VecMath, type Vec3 } from "./vec";

/**
 * Computes the closest point on the triangle a, b, c to p in R^3.
 * See https://github.com/embree/embree/blob/master/tutorials/common/math/closest_point.h
 */
function closestPointTriangle(p: Vec3, a: Vec3, b: Vec3, c: Vec3): Vec3 {
    const ab = VecMath.sub(b, a);
    const ac = VecMath.sub(c, a);

    // Closest point a:
    const ap = VecMath.sub(p, a);
    const d1 = VecMath.dot(ab, ap);
    const d2 = VecMath.dot(ac, ap);
    if ((d1 <= 0) && (d2 <= 0))
        return a;

    // Closest point b:
    const bp = VecMath.sub(p, b);
    const d3 = VecMath.dot(ab, bp);
    const d4 = VecMath.dot(ac, bp);
    if ((d3 >= 0) && (d4 <= d3))
        return b;

    // Closest point c:
    const cp = VecMath.sub(p, c);
    const d5 = VecMath.dot(ab, cp);
    const d6 = VecMath.dot(ac, cp);
    if ((d6 >= 0) && (d5 <= d6))
        return c;

    // Closest point on edge (a, b): (vc is barycentric coordinate coefficient for c)
    const vc = d1 * d4 - d3 * d2;
    if ((vc <= 0) && (d1 >= 0) && (d3 <= 0)) {
        const v = d1 / (d1 - d3);
        return VecMath.wSum([a, ab], [1, v]);
    }

    // Closest point on edge (a, c):
    const vb = d5 * d2 - d1 * d6;
    if ((vb <= 0) && (d2 >= 0) && (d6 <= 0)) {
        const v = d2 / (d2 - d6);
        return VecMath.wSum([a, ac], [1, v]);
    }

    // Closest point on edge (b, c):
    const va = d3 * d6 - d5 * d4;
    if ((va <= 0.0) && (d4 >= d3) && (d5 >= d6)) {
        const v = (d4 - d3) / ((d4 - d3) + (d5 - d6));
        return VecMath.wSum([b, c], [1 - v, v]);
    }

    // Closest point inside the triangle:
    const vSum = va + vb + vc;
    const w = [va / vSum, vb / vSum, vc / vSum];
    return VecMath.wSum([a, b, c], w);
}

/**
 * Returns closest value in interval `[minValue, maxValue]` to `x`.
 */
function clamp(x: number, minValue: number, maxValue: number) {
    return Math.max(Math.min(x, maxValue), minValue);
}

/**
 * Bijection N x N -> N.
 * See: https://en.wikipedia.org/wiki/Pairing_function#Cantor_pairing_function
 */
function cantorFunction(x: number, y: number): number {
    return ((x + y + 1) * (x + y)) / 2 + y;
}

export { closestPointTriangle, clamp, cantorFunction };