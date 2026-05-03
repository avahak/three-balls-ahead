import * as THREE from 'three';
import type { Vec3 } from "../math/vec";
import type { Ball } from './ball';

type BallSnapshot = {
    t: number;
    p: Vec3;
    v: Vec3;
    w: Vec3;
    q?: THREE.Quaternion;
};

type BallSnapshotTagged = BallSnapshot & { ball: Ball };

type BallStats = {
    r: number;      // m
    m: number;      // kg
    im: number;     // mass inverted [1/kg]
    inertia: number;    // 2/5 m r^2
};

export type { BallSnapshot, BallSnapshotTagged, BallStats };