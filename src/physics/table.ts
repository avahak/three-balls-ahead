import { type AssetLoader } from "../assetLoader";
import { clamp, closestPointTriangle } from "../math/misc";
import { VecMath, type Vec2, type Vec3 } from "../math/vec";
import * as THREE from 'three';

class Table {
    public static tableJson: any;
    public static cushionVertices: Vec3[];
    public static pocketCenters: Vec2[];
    public static pocketRadii: number[];

    constructor(assetLoader: AssetLoader) {
        Table.tableJson = assetLoader.getFile("table_json");
        const cushions = assetLoader.getModel("cushions");
        if (!cushions || !Table.tableJson)
            throw new Error("Assets not loaded.");

        // Initialize pockets:
        Table.pocketCenters = [];
        Table.pocketRadii = [];
        for (let k = 1; k <= 6; k++) {
            const center = Table.tableJson[`pocket_fall_center_${k}`];
            Table.pocketCenters.push([center[0], center[1]]);
            Table.pocketRadii.push(Table.tableJson[`pocket_fall_radius_${k}`]);
        }

        Table.cushionVertices = [];
        const cushionsPos = (cushions.children[0] as THREE.Mesh).geometry.attributes.position;
        for (let k = 0; k < cushionsPos.count / 3; k++) {
            Table.cushionVertices.push(new THREE.Vector3().fromBufferAttribute(cushionsPos, 3 * k).toArray());
            Table.cushionVertices.push(new THREE.Vector3().fromBufferAttribute(cushionsPos, 3 * k + 1).toArray());
            Table.cushionVertices.push(new THREE.Vector3().fromBufferAttribute(cushionsPos, 3 * k + 2).toArray());
        }
    }

    /**
     * Finds closest point on the slate to p. Nontrivial because of the geometry.
     */
    public getClosestSlatePoint(p: Vec3): Vec3 {
        // Logic: 
        // Case A) point inside circle -> circle projection or corner point
        // Case B) point outside circle -> projection to box if that outside circle too 
        //    or corner point otherwise

        const p2: Vec2 = [p[0], p[1]];
        const box = Table.tableJson.railbox;
        const corners = Table.tableJson[`pocket_fall_corners`];
        const ballRadius = Table.tableJson.specs.BALL_RADIUS;

        // Case A: point p2 inside one of the circles
        for (let k = 0; k < 6; k++) {
            const center = Table.pocketCenters[k];
            const radius = Table.pocketRadii[k];
            const r = VecMath.distance(p2, center);
            if (r < radius) {
                const cp = VecMath.add(center, VecMath.normalize(VecMath.sub(p2, center), radius));
                const closest: [number, Vec2] = [radius - r, cp];
                // Here we only need to check corresponding 2 corners
                for (let j = 2 * k; j < 2 * (k + 1); j++) {
                    const corner: Vec2 = [corners[j][0], corners[j][1]];
                    const dist = VecMath.distance(p2, corner);
                    if (dist < closest[0]) {
                        closest[0] = dist;
                        closest[1] = corner;
                    }
                }
                return [closest[1][0], closest[1][1], -ballRadius];
            }
        }

        // Case B: point p2 outside all circles
        // Point clamped to box
        let bp: Vec2 = [clamp(p[0], -box[0], box[0]), clamp(p[1], -box[1], box[1])];
        // If bp is inside one of the circles then closest is one of the two corner points:
        for (let k = 0; k < 6; k++) {
            const center = Table.pocketCenters[k];
            const radius = Table.pocketRadii[k];
            const r = VecMath.distance(bp, center);
            if (r < radius) {
                const closest: [number, Vec2 | null] = [Number.POSITIVE_INFINITY, null];
                // Here we only need to check corresponding 2 corners
                for (let j = 2 * k; j < 2 * (k + 1); j++) {
                    const corner: Vec2 = [corners[j][0], corners[j][1]];
                    const dist = VecMath.distance(p2, corner);
                    if (dist < closest[0]) {
                        closest[0] = dist;
                        closest[1] = corner;
                    }
                }
                return [closest[1]![0], closest[1]![1], -ballRadius];
            }
        }

        // Point outside circles and closest box point (bp) also outside circles -> bp
        return [bp[0], bp[1], -ballRadius];
    }

    public getClosestCushionPoint(p: Vec3): Vec3 {
        // TODO a lot of optimization can be done here
        const closestCushion: [Vec3 | null, number] = [null, Infinity];
        for (let k = 0; k < Table.cushionVertices.length / 3; k++) {
            const cp = closestPointTriangle(
                p,
                Table.cushionVertices[3 * k],
                Table.cushionVertices[3 * k + 1],
                Table.cushionVertices[3 * k + 2]
            );
            const dist = VecMath.distance(p, cp);
            if (dist < closestCushion[1]) {
                closestCushion[0] = cp;
                closestCushion[1] = dist;
            }
        }
        return closestCushion[0]!;
    }
}

export { Table };