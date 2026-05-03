// Related link: https://ekiefl.github.io/2020/04/24/pooltool-theory/

import * as THREE from 'three';
import { Constants as Cst } from "./constants";
import { VecMath, type Vec3 } from "../math/vec";
import { integrateRotation } from '../math/integrate';
import { Table } from './table';
import type { BallSnapshot } from './types';

const BallState = {
    Stopped: 0,
    SpinningStationary: 1,
    Sliding: 2,
    Rolling: 3,
    Flying: 4,
} as const;

class BallSegment {
    private static idCounter: number = 0;
    static evalCounter_DEBUG: number = 0;

    t0: number;
    t1: number;
    state: BallState;
    p0: Vec3;
    v0: Vec3;
    a: Vec3;
    w0: Vec3;
    dw: Vec3;
    id!: number;         // Update this whenever the segment changes, used to discard outdated segments in event handler
    q0?: THREE.Quaternion;

    private constructor(
        t0: number,
        t1: number,
        state: BallState,
        p0: Vec3,
        v0: Vec3,
        a: Vec3,
        w0: Vec3,
        dw: Vec3,
        q0?: THREE.Quaternion,
    ) {
        this.t0 = t0;
        this.t1 = t1;
        this.state = state;
        this.p0 = p0;
        this.v0 = v0;
        this.a = a;
        this.w0 = w0;
        this.dw = dw;
        this.q0 = q0;
        this.updateId();
    }

    updateId() {
        BallSegment.idCounter++;
        this.id = BallSegment.idCounter;
    }

    set(
        t0: number,
        t1: number,
        state: BallState,
        p0: Vec3,
        v0: Vec3,
        a: Vec3,
        w0: Vec3,
        dw: Vec3,
        q0?: THREE.Quaternion,
    ): BallSegment {
        this.t0 = t0;
        this.t1 = t1;
        this.state = state;
        this.p0 = p0;
        this.v0 = v0;
        this.a = a;
        this.w0 = w0;
        this.dw = dw;
        this.q0 = q0;
        this.updateId();
        return this;
    }

    clone(): BallSegment {
        return new BallSegment(
            this.t0, this.t1, this.state,
            [...this.p0], [...this.v0], [...this.a],
            [...this.w0], [...this.dw],
            this.q0?.clone() ?? undefined,
        );
    }

    setFromInitialValues(
        t0: number,
        p0: Vec3,
        v0: Vec3,
        w0: Vec3,
        q0?: THREE.Quaternion,
    ) {
        if (p0[2] <= -Cst.EP)
            throw Error("Ball below z=0 plane.");

        const vMinBounce = 0.01;    // Ad hoc way to prevent infinite number of small bounces

        if (Math.abs(p0[2]) < Cst.EP && v0[2] < Cst.EP && v0[2] >= -vMinBounce) {
            // Very small velocities result in no bounce back
            p0[2] = 0;
            v0[2] = 0;
        }

        if (Math.abs(p0[2]) < Cst.EP && v0[2] < -vMinBounce) {
            // Bouncing (Flying)
            const m = Cst.M;
            const r = Cst.R;
            const I = (2 / 5) * m * r * r;
            const e = Cst.COR_BALL_SLATE;
            const mu = Cst.MU_SLIDE;
            const g = Cst.G;

            const vn = v0[2] + vMinBounce;      // dampening the bounces to get finite amount

            const vtx = v0[0] - r * w0[1];
            const vty = v0[1] + r * w0[0];

            const Jn = -(1 + e) * m * vn;   // normal impulse
            const JtMax = mu * Jn;

            const invEff = 7 / 2 / m;
            const JtxStick = -vtx / invEff;
            const JtyStick = -vty / invEff;
            const JtStick = Math.hypot(JtxStick, JtyStick);

            let Jtx = 0;
            let Jty = 0;

            if (JtStick <= JtMax) {
                Jtx = JtxStick;
                Jty = JtyStick;
            } else {
                const vT = Math.hypot(vtx, vty);
                if (vT > 0) {
                    Jtx = -JtMax * vtx / vT;
                    Jty = -JtMax * vty / vT;
                }
            }

            const v1: Vec3 = [
                v0[0] + Jtx / m,
                v0[1] + Jty / m,
                -e * vn,
            ];

            const w1: Vec3 = [
                w0[0] + (r / I) * Jty,
                w0[1] - (r / I) * Jtx,
                w0[2],
            ];

            const discr = v1[2] * v1[2] + 2 * g * p0[2];
            if (discr < 0)
                throw new Error("Ball below z=0 plane.");
            const dt = (v1[2] + Math.sqrt(discr)) / g;
            const t1 = t0 + Math.max(0, dt);

            return this.set(
                t0, t1,
                BallState.Flying,
                p0, v1, [0, 0, -g],
                w1, [0, 0, 0],
                q0
            );
        }

        if (p0[2] >= Cst.EP || v0[2] >= Cst.EP) {
            // Flying
            const a: Vec3 = [0, 0, -Cst.G];
            const dw: Vec3 = [0, 0, 0];
            // p0[2] + v0[2]*(t1-t0) - 1/2*g*(t1-t0)^2 = 0
            const discr = v0[2] * v0[2] + 2 * Cst.G * p0[2];
            if (discr < 0)
                throw Error("Ball below z=0 plane.");
            const t1 = t0 + (v0[2] + Math.sqrt(discr)) / Cst.G;
            return this.set(t0, t1, BallState.Flying, p0, v0, a, w0, dw, q0);
        }

        const r_v0_xy = VecMath.norm([v0[0], v0[1]]);
        const r_w0_xy = VecMath.norm([w0[0], w0[1]]);

        const c_spin = 2 * Cst.R / (5 * Cst.MU_SPIN * Cst.G);
        const dt_spin = c_spin * Math.abs(w0[2]);
        const t1_spin = t0 + dt_spin;   // Time when sidespin ends
        const hasSidespin = Math.abs(w0[2]) > Cst.EP;

        if (r_v0_xy < Cst.EP && r_w0_xy < Cst.EP) {
            if (!hasSidespin) {
                // Stopped
                return this.set(t0, Number.POSITIVE_INFINITY, BallState.Stopped, [p0[0], p0[1], 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], q0);
            }
            // SpinningStationary
            const dw: Vec3 = [0, 0, -Math.sign(w0[2]) / c_spin];
            return this.set(t0, t1_spin, BallState.SpinningStationary, [p0[0], p0[1], 0], [0, 0, 0], [0, 0, 0], w0, dw, q0);
        }

        // Relative velocity for sliding: u = v0 + r*e_3\cross w0
        const u_xy = [v0[0] - Cst.R * w0[1], v0[1] + Cst.R * w0[0]];
        const r_u_xy = VecMath.norm(u_xy);

        if (r_u_xy < Cst.EP) {
            // Rolling
            const c_roll = 1 / (Cst.MU_ROLL * Cst.G);
            const dt_roll = c_roll * r_v0_xy;
            const t1_roll = t0 + dt_roll;   // Time when rolling ends
            const a: Vec3 = [-v0[0] / dt_roll, -v0[1] / dt_roll, 0];
            const dw: Vec3 = [-w0[0] / dt_roll, -w0[1] / dt_roll, hasSidespin ? -Math.sign(w0[2]) / c_spin : 0];
            const t1 = hasSidespin ? Math.min(t1_spin, t1_roll) : t1_roll;  // min is correct
            return this.set(t0, t1, BallState.Rolling, p0, v0, a, w0, dw, q0);
        }

        // Sliding
        // q = e_3\cross u/|u|
        const q = [-u_xy[1] / r_u_xy, u_xy[0] / r_u_xy, 0];
        const c_slide = Cst.MU_SLIDE * Cst.G;
        const dt_slide = 2 / 7 * r_u_xy / c_slide;
        const t1_slide = t0 + dt_slide;     // Time when sliding ends
        const t1 = hasSidespin ? Math.min(t1_spin, t1_slide) : t1_slide;    // min is correct
        const a: Vec3 = [-c_slide * u_xy[0] / r_u_xy, -c_slide * u_xy[1] / r_u_xy, 0];
        const dw: Vec3 = [5 * c_slide / (2 * Cst.R) * q[0], 5 * c_slide / (2 * Cst.R) * q[1], hasSidespin ? -w0[2] / dt_spin : 0];
        return this.set(t0, t1, BallState.Sliding, p0, v0, a, w0, dw, q0);
    }

    static createFromInitialValues(
        t0: number,
        p0: Vec3,
        v0: Vec3,
        w0: Vec3,
        q0?: THREE.Quaternion,
    ): BallSegment {
        const bs = new BallSegment(
            t0, Number.POSITIVE_INFINITY,
            BallState.Stopped,
            [0, 0, 0], [0, 0, 0], [0, 0, 0],
            [0, 0, 0], [0, 0, 0],
            q0
        );
        return bs.setFromInitialValues(t0, p0, v0, w0, q0);
    }

    /**
     * Evaluates position, angular velocity, and optionally rotation at a time in the segment. 
     */
    eval(t: number): BallSnapshot {
        BallSegment.evalCounter_DEBUG++;

        if (t < this.t0 || t > this.t1)
            throw Error("Invalid time.");
        const dt = t - this.t0;
        const p = VecMath.wSum([this.p0, this.v0, this.a], [1, dt, 0.5 * dt * dt]);
        const v = VecMath.wSum([this.v0, this.a], [1, dt]);
        const w = VecMath.wSum([this.w0, this.dw], [1, dt]);
        if (this.q0) {
            const q = integrateRotation(
                dt,
                this.w0,
                this.dw
            );
            // const q0q = this.q0.clone().multiply(q).normalize();
            const qq0 = q.clone().multiply(this.q0).normalize();
            return { t, p, v, w, q: qq0 };
        }
        return { t, p, v, w };
    }

    /**
     * Takes in BallSnapshot (from `eval` for example)
     * and feeds it into `setFromInitialValues`.
     */
    setFromBallSnapshot(ss: BallSnapshot) {
        this.setFromInitialValues(ss.t, ss.p, ss.v, ss.w);
        if (ss.q)
            this.q0 = ss.q;
        return this;
    }

    /**
     * Computes lower bound for time when balls represented by the segments can collide.
     */
    static collisionLowerBound(tMin: number, seg1: BallSegment, seg2: BallSegment): number {
        const t0 = Math.max(tMin, seg1.t0, seg2.t0);
        const t1 = Math.min(seg1.t1, seg2.t1);
        if (t0 > t1)
            throw Error(`collisionLowerBound invalid time ${{ t0, t1, tMin }}`);
        const dt1 = t0 - seg1.t0;
        const dt2 = t0 - seg2.t0;
        const p1: Vec3 = VecMath.wSum([seg1.p0, seg1.v0, seg1.a], [1, dt1, 0.5 * dt1 * dt1]);
        const p2: Vec3 = VecMath.wSum([seg2.p0, seg2.v0, seg2.a], [1, dt2, 0.5 * dt2 * dt2]);
        const v1: Vec3 = VecMath.wSum([seg1.v0, seg1.a], [1, dt1]);
        const v2: Vec3 = VecMath.wSum([seg2.v0, seg2.a], [1, dt2]);
        const p0 = VecMath.sub(p2, p1);
        const v0 = VecMath.sub(v2, v1);
        const a = VecMath.sub(seg2.a, seg1.a);
        // Now the difference seg2-seg1 has parameters [p0,v0,a] and is defined on [t0,t1].
        // We want to find when this curve meets B(0,2r) and apply the sequential march 
        // algorithm.

        const R = 2 * Table.tableJson.specs.BALL_RADIUS;
        const n = VecMath.normalize(p0);
        // Now we want to project everything with proj(p)=p.n. Now
        // - proj(p) < R means intersection
        // - proj(p) > R means no intersection.
        const p0n = VecMath.dot(p0, n);
        const v0n = VecMath.dot(v0, n);
        const an = VecMath.dot(a, n);
        // The equation for the boundary is p0n+v0n*s+an*s^2/2=R, s\in[0,t1-t0]
        const coeffs = [p0n - R, v0n, an / 2];
        const ep = 1e-12;
        let s = Number.POSITIVE_INFINITY;
        if (Math.abs(coeffs[2]) < ep) {
            if (Math.abs(coeffs[1]) > ep) {
                const s1 = -coeffs[0] / coeffs[1];
                if (s1 > ep)
                    s = s1;
            }
        } else {
            const discr = coeffs[1] * coeffs[1] - 4 * coeffs[2] * coeffs[0];
            if (discr >= 0) {
                const d = Math.sqrt(discr);
                const s1 = (-coeffs[1] + d) / (2 * coeffs[2]);
                const s2 = (-coeffs[1] - d) / (2 * coeffs[2]);
                if (s1 > ep)
                    s = s1;
                if (s2 > ep)
                    s = Math.min(s, s2);
            }
        }
        // if ((seg1.id === 137 && seg2.id === 129) || (seg1.id === 129 && seg2.id === 137)) {
        //     console.log("DEBUG", { t0, t1, s, coeffs, p0n, v0n, an, seg1: seg1.clone(), seg2: seg2.clone() });
        // }
        if (t0 + s < t1)
            return t0 + s;
        return Number.POSITIVE_INFINITY;
    }
}

const test = () => {
    const t0 = 10.0 * VecMath.gaussian();
    const p0 = [...VecMath.vGaussian(2, 1), 0] as Vec3;
    const v0 = [...VecMath.vGaussian(2, 1), 0] as Vec3;
    const w0 = VecMath.vGaussian(3, 1) as Vec3;
    // const t0 = 0;
    // const p0 = [0, 0, 0];
    // const v0 = [1, 0, 0];
    // const w0 = [0, 0, 0];
    let q = new THREE.Quaternion(0, 0, 0, 1);
    let bs = BallSegment.createFromInitialValues(t0, p0, v0, w0);

    let iter = 0;
    while (iter < 10) {
        console.log("iter", iter, "t", bs.t0, "state", bs.state, "q", q, { ...bs });
        iter++;

        const dt = Math.min(bs.t1 - bs.t0, 10);
        const evalResult = bs.eval(bs.t0 + dt);
        q.multiply(evalResult.q!);
        bs = BallSegment.createFromInitialValues(bs.t0 + dt, evalResult.p, evalResult.v, evalResult.w);
    }
};


export type BallState = (typeof BallState)[keyof typeof BallState];
export { BallState, BallSegment, test };