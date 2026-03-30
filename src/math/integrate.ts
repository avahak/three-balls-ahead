import { Vec } from "./vec";
import { Quaternion, Vector3 } from "three";

/**
 * Integrates a time-varying angular velocity of the affine form
 * w(t) = w0 + t*dw over the interval [0, t0] using a midpoint
 * exponential integrator.
 *
 * The method advances the rotation by composing incremental
 * quaternion exponentials evaluated at midpoints of each step.
 * This preserves the rotation structure and yields second-order accuracy.
 *
 * @param t0 endpoint for integration
 * @param omega0 initial angular velocity vector at t = 0
 * @param domega constant time derivative of angular velocity
 * @param steps number of uniform timesteps over [0, 1]
 * @returns unit quaternion representing the final rotation
 */
function integrateRotation(
    t0: number,
    omega0: Vector3,
    domega: Vector3,
    steps: number = 16
): Quaternion {
    const q = new Quaternion();

    const dt = t0 / steps;
    let t = 0;

    // Reusable temporaries
    const omegaMid = new Vector3();
    const theta = new Vector3();
    const deltaQ = new Quaternion();

    for (let i = 0; i < steps; i++) {
        const midTime = t + 0.5 * dt;

        omegaMid.x = omega0.x + domega.x * midTime;
        omegaMid.y = omega0.y + domega.y * midTime;
        omegaMid.z = omega0.z + domega.z * midTime;

        theta.x = omegaMid.x * dt;
        theta.y = omegaMid.y * dt;
        theta.z = omegaMid.z * dt;

        const x = theta.x;
        const y = theta.y;
        const z = theta.z;

        const angleSq = x * x + y * y + z * z;

        if (angleSq < 1e-16) {
            // small-angle approximation
            deltaQ.set(0.5 * x, 0.5 * y, 0.5 * z, 1.0);
        } else {
            const halfAngle = 0.5 * Math.sqrt(angleSq);
            const s = 0.5 * Math.sin(halfAngle) / halfAngle;
            deltaQ.set(x * s, y * s, z * s, Math.cos(halfAngle));
        }

        q.multiply(deltaQ);

        t += dt;
    }

    return q.normalize();
}

/**
 * Test integrator convergence over many random trials.
 * Runs trials, compares coarse step integrations to a "ground truth"
 * obtained with higher number of steps. Reports statistics of log-angle-errors.
 */
function testCorrectnessStats() {
    const numTrials = 1000;
    const finestSteps = 1024 * 16;
    const stepCounts = [];
    for (let s = 2; s <= 1024; s *= 2)
        stepCounts.push(s);

    // Prepare accumulators for log-errors
    const logErrors: Record<number, number[]> = {};
    for (const steps of stepCounts)
        logErrors[steps] = [];

    for (let trial = 0; trial < numTrials; trial++) {
        const omega0 = new Vector3(...Vec.randomGaussian(3, 2 * Math.PI));
        const domega = new Vector3(...Vec.randomGaussian(3, 2 * Math.PI));

        // Ground truth
        const qFine = integrateRotation(1, omega0, domega, finestSteps);

        // Coarse integrations
        for (const steps of stepCounts) {
            const q = integrateRotation(1, omega0, domega, steps);

            // Compute rotation difference angle
            const qDiff = q.clone().conjugate().multiply(qFine);
            const angleDiff = 2 * Math.acos(Math.min(Math.max(qDiff.w, -1), 1));

            // Store log10 of error (avoid log(0))
            logErrors[steps].push(Math.log10(angleDiff + 1e-16));
        }
    }

    console.log(`Step size statistics over ${numTrials} trials:`);
    for (const steps of stepCounts) {
        const errs = logErrors[steps];
        const maxLogErr = Math.max(...errs);
        const meanLogErr = errs.reduce((a, b) => a + b, 0) / errs.length;
        console.log(`Steps: ${steps}, largest log10-angle-error: ${maxLogErr.toFixed(3)}, mean log10-angle-error: ${meanLogErr.toFixed(3)}`);
    }
}

function testPerformance() {
    const omega0 = new Vector3(...Vec.randomGaussian(3, 2 * Math.PI));
    const domega = new Vector3(...Vec.randomGaussian(3, 2 * Math.PI));
    const steps = 16;

    const startTime = performance.now();
    let count = 0;
    while (performance.now() - startTime < 1000) {
        // @ts-ignore
        const q = integrateRotation(omega0, domega, steps);
        count++;
    }

    console.log(`Performance test (steps=${steps}):`);
    console.log("Integrations in 1 second:", count);
}

function test() {
    testCorrectnessStats();
    testPerformance();
}

export { integrateRotation, test };