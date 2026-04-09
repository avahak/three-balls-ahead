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
        const p2 = [p[0], p[1]];
        const box = Table.tableJson.railbox;
        // 1) Clamp cp to box:
        let cp: Vec2 = [clamp(p[0], -box[0], box[0]), clamp(p[1], -box[1], box[1])];
        // 2) If cp is inside pocket circles, project it to the circle:
        for (let k = 0; k < 6; k++) {
            const center = Table.pocketCenters[k];
            const radius = Table.pocketRadii[k];
            if (VecMath.distance(cp, center) < radius)
                cp = VecMath.add(center, VecMath.normalize(VecMath.sub(cp, center), radius));
        }
        // 3) If point is inside box, return it:
        if ((Math.abs(cp[0]) <= box[0]) && (Math.abs(cp[1]) <= box[1]))
            return [...cp, 0];

        // 4) if point outside box, return closest point from pocket_fall_corners
        const corners = Table.tableJson[`pocket_fall_corners`];
        const closest: [number, Vec2 | null] = [Infinity, null];
        for (let k = 0; k < 12; k++) {
            const corner: Vec2 = [corners[k][0], corners[k][1]];
            const dist = VecMath.distance(p2, corner);
            if (dist < closest[0]) {
                closest[0] = dist;
                closest[1] = corner;
            }
        }
        return [closest[1]![0], closest[1]![1], 0];
    }

    public getClosestCushionPoint(p: Vec3): Vec3 {
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