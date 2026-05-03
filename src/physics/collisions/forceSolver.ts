import { VecMath, type Vec3 } from '../../math/vec';
import { type BallSnapshotTagged } from '../types';
import { CollisionGroup } from './group';


class ForceSolver {

    static solve(
        group: CollisionGroup,
        dt: number = 0.05,
        maxIter: number = 10000,
        hardnessBallBall: number = 1,
        hardnessBallSlate: number = 1
    ): void {
        // Reset depths
        for (const contact of group.contacts) {
            contact.depth = 0;
            contact.depthDer = 0;
        }

        // Acceleration accumulators per ball
        const accMap = new Map<BallSnapshotTagged, { a: Vec3; dw: Vec3 }>();
        for (const ball of group.balls)
            accMap.set(ball, { a: [0, 0, 0], dw: [0, 0, 0] });

        let iter = 1;
        for (; iter < maxIter; iter++) {
            // Reset accumulators
            for (const ball of group.balls) {
                const acc = accMap.get(ball)!;
                acc.a = [0, 0, 0];
                acc.dw = [0, 0, 0];
            }

            // Compute forces and accumulate accelerations
            for (const contact of group.contacts) {
                const vrel = contact.getRelativeVelocity();     // v_A-v_B
                const vn = VecMath.dot(vrel, contact.normal);
                contact.depthDer = vn;

                // Forces only exist if there is penetration
                if (contact.depth < 1e-9)
                    continue;

                // Normal force magnitude (Hertzian: F = hardness * depth^(3/2))
                const hardness = contact.bodyB ? hardnessBallBall : hardnessBallSlate;
                let forceMag = hardness * Math.pow(Math.max(0, contact.depth), 1.5);
                // If separating, use restitution to reduce force
                if (vn < 0)
                    forceMag *= contact.restitution * contact.restitution;

                const normalForce = VecMath.scale(contact.normal, forceMag);

                // Tangential direction
                const vt = VecMath.wSum([vrel, contact.normal], [1, -vn]);
                const vtLen = VecMath.norm(vt);
                let frictionForce: Vec3 = [0, 0, 0];
                if (vtLen > 1e-9) {
                    const frictionMag = contact.friction * forceMag;
                    frictionForce = VecMath.scale(vt, frictionMag / vtLen);
                }
                // console.log(contact.bodyA.ball.name, contact.bodyB?.ball.name, { vn, depth: contact.depth, normalForce, frictionForce });

                const totalForce = VecMath.add(normalForce, frictionForce);
                contact.applyForce(totalForce, dt, accMap);
            }

            // Integrate velocities
            for (const ball of group.balls) {
                const acc = accMap.get(ball)!;
                ball.v = VecMath.wSum([ball.v, acc.a], [1, dt]);
                ball.w = VecMath.wSum([ball.w, acc.dw], [1, dt]);
            }

            // Update depths
            for (const contact of group.contacts) {
                contact.depth += contact.depthDer * dt;
                // console.log("depth", contact.depth);
            }

            // Convergence check: all contacts separating and no penetration
            let resolved = true;
            for (const contact of group.contacts) {
                if (contact.depth > 1e-9 || contact.depthDer > 1e-9) {
                    resolved = false;
                    break;
                }
            }
            if (resolved)
                break;
        }
        console.log(`ForceSolver.solve: iter=${iter}`);
    }
}

export { ForceSolver };