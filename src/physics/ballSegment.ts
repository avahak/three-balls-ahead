// TODO rethink: maybe update same BallSegment instead of always creating new ones,
// and let user clone BallSegment if the old segment is needed

// Related link: https://ekiefl.github.io/2020/04/24/pooltool-theory/

import * as THREE from 'three';
import { Constants as Cst } from "./constants";
import { Vec } from "../math/vec";
import { integrateRotation } from '../math/integrate';

const BallState = {
    Stopped: 0,
    SpinningStationary: 1,
    Sliding: 2,
    Rolling: 3,
    Flying: 4,
} as const;

class BallSegment {
    t0: number;
    t1: number;
    state: BallState;
    p0: number[];
    v0: number[];
    a: number[];
    w0: number[];
    dw: number[];

    private constructor(
        t0: number,
        t1: number,
        state: BallState,
        p0: number[],
        v0: number[],
        a: number[],
        w0: number[],
        dw: number[]
    ) {
        this.t0 = t0;
        this.t1 = t1;
        this.state = state;
        this.p0 = p0;
        this.v0 = v0;
        this.a = a;
        this.w0 = w0;
        this.dw = dw;
    }

    public static create(
        t0: number,
        p0: number[],
        v0: number[],
        w0: number[],
    ): BallSegment {
        const r_v0 = Vec.norm(v0);
        // const r_w0 = Vec.norm(w0);
        const r_w0_xy = Vec.norm([w0[0], w0[1]]);

        if (Math.abs(p0[2]) > Cst.EP || Math.abs(v0[2]) > Cst.EP) {
            // Flying
            const a = [0, 0, -Cst.G];
            const dw = [0, 0, 0];
            // p0[2] + v0[2]*(t1-t0) - 1/2*g*(t1-t0)^2 = 0
            const t1 = t0 + (v0[2] + Math.sqrt(v0[2] * v0[2] + 2 * Cst.G * p0[2])) / Cst.G;
            return new BallSegment(t0, t1, BallState.Flying, p0, v0, a, w0, dw);
        }

        const c_spin = 2 * Cst.R / (5 * Cst.MU_SPIN * Cst.G);
        const dt_spin = c_spin * Math.abs(w0[2]);
        const t1_spin = t0 + dt_spin;   // Time when sidespin ends
        const hasSidespin = Math.abs(w0[2]) > Cst.EP;

        if (r_v0 < Cst.EP && r_w0_xy < Cst.EP) {
            if (!hasSidespin) {
                // Stopped
                return new BallSegment(t0, Number.POSITIVE_INFINITY, BallState.Stopped, [p0[0], p0[1], 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]);
            }
            // SpinningStationary
            const dw = [0, 0, -w0[2] / dt_spin];
            return new BallSegment(t0, t1_spin, BallState.SpinningStationary, [p0[0], p0[1], 0], [0, 0, 0], [0, 0, 0], w0, dw);
        }

        // Relative velocity for sliding: u = v0 + r*e_3\cross w0
        const u_xy = [v0[0] - Cst.R * w0[1], v0[1] + Cst.R * w0[0]];
        const r_u_xy = Vec.norm(u_xy);
        console.log('u_xy', u_xy);

        if (r_u_xy < Cst.EP) {
            // Rolling
            const c_roll = 1 / (Cst.MU_ROLL * Cst.G);
            const dt_roll = c_roll * r_v0;
            const t1_roll = t0 + dt_roll;   // Time when rolling ends
            const a = [-v0[0] / dt_roll, -v0[1] / dt_roll, 0];
            const dw = [-w0[0] / dt_roll, -w0[1] / dt_roll, hasSidespin ? -w0[2] / dt_spin : 0];
            const t1 = hasSidespin ? Math.min(t1_spin, t1_roll) : t1_roll;
            return new BallSegment(t0, t1, BallState.Rolling, p0, v0, a, w0, dw);
        }

        // Sliding
        // q = e_3\cross u/|u|
        const q = [-u_xy[1] / r_u_xy, u_xy[0] / r_u_xy, 0];
        const c_slide = Cst.MU_SLIDE * Cst.G;
        const dt_slide = 2 / 7 * r_u_xy / c_slide;
        const t1_slide = t0 + dt_slide;
        const t1 = hasSidespin ? Math.min(t1_spin, t1_slide) : t1_slide;
        const a = [-c_slide * u_xy[0] / r_u_xy, -c_slide * u_xy[1] / r_u_xy, 0];
        const dw = [5 * c_slide / (2 * Cst.R) * q[0], 5 * c_slide / (2 * Cst.R) * q[1], hasSidespin ? -w0[2] / dt_spin : 0];
        return new BallSegment(t0, t1, BallState.Sliding, p0, v0, a, w0, dw);
    }

    /**
     * Evaluates position, angular velocity, and optionally rotation at a time in the segment. 
     */
    public eval(t: number, q0?: THREE.Quaternion): { p: number[], v: number[], w: number[], q?: THREE.Quaternion } {
        if (t < this.t0 || t > this.t1)
            throw Error("Invalid time.");
        const dt = t - this.t0;
        const p = Vec.wSum([this.p0, this.v0, this.a], [1, dt, 0.5 * dt * dt]);
        const v = Vec.wSum([this.v0, this.a], [1, dt]);
        const w = Vec.wSum([this.w0, this.dw], [1, dt]);
        if (q0) {
            const q = integrateRotation(dt, new THREE.Vector3(...this.w0), new THREE.Vector3(...this.dw));
            return { p, v, w, q };
        }
        return { p, v, w };
    }
}

const test = () => {
    const t0 = 10.0 * Vec.gaussian();
    const p0 = [...Vec.vGaussian(2, 1), 0];
    const v0 = [...Vec.vGaussian(2, 1), 0];
    const w0 = Vec.vGaussian(3, 1);
    // const t0 = 0;
    // const p0 = [0, 0, 0];
    // const v0 = [1, 0, 0];
    // const w0 = [0, 0, 0];
    let q = new THREE.Quaternion(0, 0, 0, 1);
    let bs = BallSegment.create(t0, p0, v0, w0);

    let iter = 0;
    while (iter < 10) {
        console.log("iter", iter, "t", bs.t0, "state", bs.state, "q", q, { ...bs });
        iter++;

        const dt = Math.min(bs.t1 - bs.t0, 10);
        const evalResult = bs.eval(bs.t0 + dt, q);
        q.multiply(evalResult.q!);
        bs = BallSegment.create(bs.t0 + dt, evalResult.p, evalResult.v, evalResult.w);
    }
};


export { BallState, BallSegment, test };
export type BallState = (typeof BallState)[keyof typeof BallState];