// Related link: https://ekiefl.github.io/2020/04/24/pooltool-theory/

import { Constants as Cst } from "./constants";
import { Vec } from "../math/vec";

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
        const r_w0 = Vec.norm(w0);
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
        const hasSidespin = dt_spin > Cst.EP;

        if (r_v0 < Cst.EP && r_w0_xy < Cst.EP) {
            if (!hasSidespin) {
                // Stopped
                return new BallSegment(t0, Number.POSITIVE_INFINITY, BallState.Stopped, [p0[0], p0[1], 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]);
            }
            // SpinningStationary
            const dw = [0, 0, -w0[2] / dt_spin];
            return new BallSegment(t0, t1_spin, BallState.SpinningStationary, [p0[0], p0[1], 0], [0, 0, 0], [0, 0, 0], w0, dw);
        }

        // v0 + r*e_3\cross w0
        const slide_xy = [v0[0] - Cst.R * w0[1], v0[1] + Cst.R * w0[0]];
        const r_slide_xy = Vec.norm(slide_xy);

        if (r_slide_xy < Cst.EP) {
            // Rolling
            const c_roll = 1 / (Cst.MU_ROLL * Cst.G);
            const dt_roll = c_roll * r_v0;
            const t1_roll = t0 + dt_roll;   // Time when rolling ends
            const a = [-v0[0] / dt_roll, -v0[1] / dt_roll, 0];
            const dw = [-w0[0] / dt_roll, -w0[1] / dt_roll, hasSidespin ? -w0[2] / dt_roll : 0];
            if (!hasSidespin) {
                // Rolling without sidespin
                return new BallSegment(t0, t1_roll, BallState.Rolling, p0, v0, a, w0, dw);
            }
            // Rolling with sidespin
            const t1 = Math.min(t1_spin, t1_roll);
            return new BallSegment(t0, t1, BallState.Rolling, p0, v0, a, w0, dw);
        }

        // Sliding
        // ...
        return new BallSegment(t0, t1, state, p0, v0, a, w0, dw);
    }

}


export { BallState, BallSegment };
export type BallState = (typeof BallState)[keyof typeof BallState];