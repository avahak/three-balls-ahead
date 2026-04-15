/**
 * Runge-Kutta methods implementation.
 * See: https://en.wikipedia.org/wiki/Runge%E2%80%93Kutta_methods
 * See: https://www.pulsarmagnetosphere.com/PHYS-427-Fall2024/Lecture%2010/?print-pdf#/
 * See: https://www.unige.ch/~hairer/software.html
 * See: Solving Ordinary Differential Equations I: Nonstiff Problems By Ernst Hairer, Syvert P. Nørsett, Gerhard
 * 
 * NOTE Modify this file in its original location, not here!
 */

class ButcherTableau {
    sn: number; // Number of stages
    mat: number[][]; // Coefficient matrix
    vc: number[]; // Nodes
    vb: number[]; // Weights
    vb2?: number[]; // Optional weights for lower-order method (adaptive methods)
    orders: number[]; // Orders for vb and vb2

    constructor(orders: number[], mat: number[][], vb: number[], vb2?: number[]) {
        this.sn = vb.length;
        this.orders = orders;
        this.mat = mat;
        this.vb = vb;
        this.vb2 = vb2;

        // Construct nodes by consistency
        this.vc = Array(this.sn).fill(0);
        for (let k = 0; k < this.sn; k++)
            this.vc[k] = this.mat[k].reduce((sum, val) => sum + val, 0);
    }

    isValid(): boolean {
        if (!this.mat || !this.vb || !this.vc)
            return false;
        if (this.mat.length !== this.sn || this.mat[0].length !== this.sn)
            return false;
        if (this.vb.length !== this.sn || this.vc.length !== this.sn)
            return false;
        if (this.vb2 && this.vb2.length !== this.sn)
            return false;

        // vb:s need to sum to 1:
        const sum = this.vb.reduce((acc, val) => acc + val, 0);
        if (Math.abs(sum - 1) > 100 * Number.EPSILON)
            return false;

        if (this.vb2) {
            const sum2 = this.vb2.reduce((acc, val) => acc + val, 0);
            if (Math.abs(sum2 - 1) > 100 * Number.EPSILON)
                return false;
        }

        for (let i = 0; i < this.sn; i++)
            for (let j = i; j < this.sn; j++)
                if (Math.abs(this.mat[i][j]) > 0)
                    return false;

        return true;
    }

    /**
     * Euler's method.
     */
    public static readonly EULER = new ButcherTableau(
        [1],
        [[0.0]],
        [1.0],
    );

    /**
     * Midpoint method.
     */
    public static readonly MIDPOINT = new ButcherTableau(
        [2],
        [[0.0, 0.0], [0.5, 0.0]],
        [0.0, 1.0],
    );

    /**
     * Heun's method.
     */
    public static readonly HEUN = new ButcherTableau(
        [2, 1],
        [[0.0, 0.0], [1.0, 0.0]],
        [0.5, 0.5],
        [1.0, 0.0]
    );

    /**
     * Basic RK4, safe.
     */
    public static readonly RK4 = new ButcherTableau(
        [4],
        [[0.0, 0.0, 0.0, 0.0], [0.5, 0.0, 0.0, 0.0], [0.0, 0.5, 0.0, 0.0], [0.0, 0.0, 1.0, 0.0]],
        [1.0 / 6.0, 1.0 / 3.0, 1.0 / 3.0, 1.0 / 6.0]
    );

    /**
     * Runge–Kutta–Fehlberg method.
     */
    public static readonly RKF45 = new ButcherTableau(
        [5, 4],
        [[0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        [1.0 / 4.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        [3.0 / 32.0, 9.0 / 32.0, 0.0, 0.0, 0.0, 0.0],
        [1932.0 / 2197.0, -7200.0 / 2197.0, 7296.0 / 2197.0, 0.0, 0.0, 0.0],
        [439.0 / 216.0, -8.0, 3680.0 / 513.0, -845.0 / 4104.0, 0.0, 0.0],
        [-8.0 / 27.0, 2.0, -3544.0 / 2565.0, 1859.0 / 4104.0, -11.0 / 40.0, 0.0]],
        [16.0 / 135.0, 0.0, 6656.0 / 12825.0, 28561.0 / 56430.0, -9.0 / 50.0, 2.0 / 55.0],
        [25.0 / 216.0, 0.0, 1408.0 / 2565.0, 2197.0 / 4104.0, -1.0 / 5.0, 0.0]
    );

    /**
     * Dormand–Prince method.
     */
    public static readonly RKDP = new ButcherTableau(
        [5, 4],
        [[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        [1.0 / 5.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        [3.0 / 40.0, 9.0 / 40.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        [44.0 / 45.0, -56.0 / 15.0, 32.0 / 9.0, 0.0, 0.0, 0.0, 0.0],
        [19372.0 / 6561.0, -25360.0 / 2187.0, 64448.0 / 6561.0, -212.0 / 729.0, 0.0, 0.0, 0.0],
        [9017.0 / 3168.0, -355.0 / 33.0, 46732.0 / 5247.0, 49.0 / 176.0, -5103.0 / 18656.0, 0.0, 0.0],
        [35.0 / 384.0, 0.0, 500.0 / 1113.0, 125.0 / 192.0, -2187.0 / 6784.0, 11.0 / 84.0, 0.0]],
        [35.0 / 384.0, 0.0, 500.0 / 1113.0, 125.0 / 192.0, -2187.0 / 6784.0, 11.0 / 84.0, 0.0],
        [5179.0 / 57600.0, 0.0, 7571.0 / 16695.0, 393.0 / 640.0, -92097.0 / 339200.0, 187.0 / 2100.0, 1.0 / 40.0]
    );
}

class ODESolver {
    f: (t: number, y: number[]) => number[];
    bt: ButcherTableau;
    static ADAPTIVE_SAFETY_FACTOR = 0.85;
    static ADAPTIVE_MIN_STEP_SIZE = 1e-6;
    static ADAPTIVE_FACTOR_BOUNDS = [0.2, 5.0];
    static ADAPTIVE_STEPS_BOUNDS = [4, 1e6];

    constructor(f: (t: number, y: number[]) => number[], bt: ButcherTableau) {
        this.f = f;
        this.bt = bt;
    }

    /**
     * Perform one RK step from t0 to t1.
     * @param useVb2 If true, use embedded lower-order weights (for error estimation).
     */
    step(y0: number[], t0: number, t1: number, useVb2: boolean = false): number[] {
        const n = y0.length;
        const h = t1 - t0;
        const stages = this.bt.sn;
        const weights = useVb2 ? this.bt.vb2! : this.bt.vb;

        // Reusable buffers for stage derivatives and stage values
        const sDer: number[][] = Array.from({ length: stages }, () => new Array(n));
        const sVal = new Array(n);

        for (let s = 0; s < stages; s++) {
            for (let i = 0; i < n; i++)
                sVal[i] = y0[i];

            for (let j = 0; j < s; j++) {
                const coeff = this.bt.mat[s][j];
                if (coeff !== 0) {
                    const derJ = sDer[j];
                    for (let i = 0; i < n; i++)
                        sVal[i] += coeff * derJ[i];
                }
            }

            const fVal = this.f(t0 + h * this.bt.vc[s], sVal);
            for (let i = 0; i < n; i++)
                sDer[s][i] = h * fVal[i];
        }

        // Combine stage derivatives into the final result
        const y1 = new Array(n);
        for (let i = 0; i < n; i++) {
            let sum = y0[i];
            for (let s = 0; s < stages; s++)
                sum += weights[s] * sDer[s][i];
            y1[i] = sum;
        }
        return y1;
    }

    /**
     * Fixed-step integration.
     */
    solve(y0: number[], t0: number, t1: number, stepNum: number): number[][] {
        const sol = [y0.slice()];
        const h = (t1 - t0) / stepNum;

        for (let k = 0; k < stepNum; k++) {
            const yNext = this.step(sol[k], t0 + k * h, t0 + (k + 1) * h);
            sol.push(yNext);
        }

        return sol;
    }

    /**
     * Adaptive-step integration.
     * @param denseOutput If true, stage derivatives are added to the output.
     */
    adaptiveSolve(
        y0: number[],
        t0: number, t1: number,
        atol: number, rtol: number,
        denseOutput: boolean = false
    ): { ts: number[], ys: number[][], sds?: number[][][] } {
        if (!this.bt.vb2)
            throw new Error("Adaptive solve requires vb2.");

        const n = y0.length;
        const stages = this.bt.sn;

        // --- Initial step size estimation ---
        // Source: Solving Ordinary Differential Equations I: Nonstiff Problems By Ernst Hairer, Syvert P. Nørsett, Gerhard, p. 169.
        const f0 = this.f(t0, y0);
        const d0 = this.weightedNorm(y0, y0, atol, rtol);
        const d1 = this.weightedNorm(y0, f0, atol, rtol);
        let h0 = (d0 < 1e-5 || d1 < 1e-5) ? 1e-6 : 0.01 * d0 / d1;
        h0 = Math.min(h0, t1 - t0);

        const y1 = new Array(n);
        for (let i = 0; i < n; i++)
            y1[i] = y0[i] + h0 * f0[i];
        const f1 = this.f(t0 + h0, y1);
        const d2 = this.weightedNorm(y0, f1.map((v, i) => (v - f0[i]) / h0), atol, rtol);
        let h1 = Math.pow(0.01 / Math.max(d1, d2), 1 / (this.bt.orders[0] + 1));
        if (Math.max(d1, d2) < 1e-15) {
            h1 = Math.max(1e-6, 1e-3 * h0);
        }
        let h = Math.min(100 * h0, h1);

        let y = y0.slice();
        let t = t0;
        let steps = 0;

        const tList = [t0];
        const yList = [y0.slice()];
        const sDerList: number[][][] | null = denseOutput ? [] : null;

        // Reusable buffers for stage derivatives and stage values
        const sDer: number[][] = Array.from({ length: stages }, () => new Array(n));
        const sVal = new Array(n);

        while (t < t1) {
            steps++;
            if (steps > ODESolver.ADAPTIVE_STEPS_BOUNDS[1]) {
                throw new Error("Max steps exceeded");
            }

            h = Math.min(h, t1 - t, (t1 - t0) / ODESolver.ADAPTIVE_STEPS_BOUNDS[0]);

            // --- Compute stage derivatives for this step ---
            for (let s = 0; s < stages; s++) {
                for (let i = 0; i < n; i++)
                    sVal[i] = y[i];

                for (let j = 0; j < s; j++) {
                    const coeff = this.bt.mat[s][j];
                    if (coeff !== 0) {
                        const derJ = sDer[j];
                        for (let i = 0; i < n; i++)
                            sVal[i] += coeff * derJ[i];
                    }
                }

                const fVal = this.f(t + h * this.bt.vc[s], sVal);
                for (let i = 0; i < n; i++)
                    sDer[s][i] = h * fVal[i];
            }

            // --- Form high‑order (yNext) and low‑order (yNext2) solutions ---
            const yNext = new Array(n);
            const yNext2 = new Array(n);
            for (let i = 0; i < n; i++) {
                let sumHigh = y[i];
                let sumLow = y[i];
                for (let s = 0; s < stages; s++) {
                    sumHigh += this.bt.vb[s] * sDer[s][i];
                    sumLow += this.bt.vb2![s] * sDer[s][i];
                }
                yNext[i] = sumHigh;
                yNext2[i] = sumLow;
            }

            if (yNext.some(v => !isFinite(v)) || yNext2.some(v => !isFinite(v))) {
                h = Math.max(ODESolver.ADAPTIVE_MIN_STEP_SIZE, h * ODESolver.ADAPTIVE_FACTOR_BOUNDS[0]);
                continue;
            }

            // --- Error estimation and step size control ---
            const err = this.weightedError(y, yNext, yNext2, atol, rtol);
            let factor = ODESolver.ADAPTIVE_FACTOR_BOUNDS[1];
            if (err > 1e-12) {
                factor = ODESolver.ADAPTIVE_SAFETY_FACTOR * Math.pow(err, -1 / this.bt.orders[0]);
            }
            factor = Math.min(ODESolver.ADAPTIVE_FACTOR_BOUNDS[1], Math.max(ODESolver.ADAPTIVE_FACTOR_BOUNDS[0], factor));
            let hNew = h * factor;

            if (err <= 1 || h <= ODESolver.ADAPTIVE_MIN_STEP_SIZE) {
                // Accept step
                t += h;
                y = yNext;
                h = hNew;

                tList.push(t);
                yList.push(y.slice());
                if (denseOutput)
                    sDerList?.push(sDer.map(i => [...i]));
            } else {
                // Reject step, try again with smaller h
                h = Math.max(hNew, ODESolver.ADAPTIVE_MIN_STEP_SIZE);
            }
        }

        console.log(`ODESolver.adaptiveSolve steps: ${steps}`);
        return denseOutput ? { ts: tList, ys: yList, sds: sDerList! } : { ts: tList, ys: yList };
    }

    private weightedNorm(ref: number[], vec: number[], atol: number, rtol: number): number {
        const n = ref.length;
        let sumSq = 0;
        for (let i = 0; i < n; i++) {
            const scale = atol + rtol * Math.abs(ref[i]);
            const ratio = vec[i] / scale;
            sumSq += ratio * ratio;
        }
        return Math.sqrt(sumSq / n);
    }

    private weightedError(y: number[], y1: number[], y2: number[], atol: number, rtol: number): number {
        const n = y.length;
        let sumSq = 0;
        for (let i = 0; i < n; i++) {
            const scale = atol + rtol * Math.max(Math.abs(y[i]), Math.abs(y1[i]));
            const diff = (y1[i] - y2[i]) / scale;
            sumSq += diff * diff;
        }
        return Math.sqrt(sumSq / n);
    }

    /**
     * Interpolates the solution of the Dormand–Prince method at a given time t,
     * using the dense output data from adaptiveSolve with RKDP method and denseOutput = true.
     * See: Hairer et al., p. 192.
     *
     * @param output - The result of adaptiveSolve with RKDP method and denseOutput: true.
     * @param t - The time at which to evaluate the solution.
     * @returns The interpolated state vector at time t.
     */
    interpolateRKDP(
        output: { ts: number[]; ys: number[][]; sds?: number[][][] },
        t: number
    ): number[] {
        const { ts, ys, sds } = output;
        if (this.bt !== ButcherTableau.RKDP)
            throw new Error("This method only works for RKDP method.");
        if (!sds)
            throw new Error("Dense output data (sds) is required for interpolation.");
        if (t < ts[0] || t > ts[ts.length - 1])
            throw new Error(`Time ${t} is outside the integration interval [${ts[0]}, ${ts[ts.length - 1]}].`);

        // Binary search
        let lo = 0, hi = ts.length - 1;
        while (lo < hi) {
            const mid = Math.floor((lo + hi) / 2);
            if (ts[mid] <= t) lo = mid + 1;
            else hi = mid;
        }
        let i = lo - 1;
        if (i === ts.length - 1)
            i--;

        const tStart = ts[i];
        const h = ts[i + 1] - tStart;
        const theta = (t - tStart) / h;

        const y0 = ys[i];

        const n = y0.length;

        // From Haierer et al. p. 192
        const th = theta;
        const th2 = th * th;
        const thm1 = th - 1;
        const thm1_2 = thm1 * thm1;

        const b1 =
            th2 * (3 - 2 * th) * this.bt.vb[0] +
            th * thm1_2 -
            th2 * thm1_2 * 5 * (2558722523 - 31403016 * th) / 11282082432;

        const b3 =
            th2 * (3 - 2 * th) * this.bt.vb[2] +
            th2 * thm1_2 * 100 * (882725551 - 15701508 * th) / 32700410799;

        const b4 =
            th2 * (3 - 2 * th) * this.bt.vb[3] -
            th2 * thm1_2 * 25 * (443332067 - 31403016 * th) / 1880347072;

        const b5 =
            th2 * (3 - 2 * th) * this.bt.vb[4] +
            th2 * thm1_2 * 32805 * (23143187 - 3489224 * th) / 199316789632;

        const b6 =
            th2 * (3 - 2 * th) * this.bt.vb[5] -
            th2 * thm1_2 * 55 * (29972135 - 7076736 * th) / 822651844;

        const b7 =
            th2 * (th - 1) +
            th2 * thm1_2 * 10 * (7414447 - 829305 * th) / 29380423;

        const result = new Array(n);

        for (let j = 0; j < n; j++) {
            result[j] = y0[j] + (
                b1 * sds[i][0][j] +
                b3 * sds[i][2][j] +
                b4 * sds[i][3][j] +
                b5 * sds[i][4][j] +
                b6 * sds[i][5][j] +
                b7 * sds[i][6][j]
            );
        }

        return result;
    }
}

export { ButcherTableau, ODESolver };