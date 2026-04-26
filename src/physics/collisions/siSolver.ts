import { VecMath } from '../../math/vec';
import { CollisionGroup } from './group';

/**
 * Sequential impulse solver for instantaneous collision resolution.
 * Iteratively applies normal and friction impulses to resolve all contacts
 * in a collision group. Runs until all contacts are separating or max iterations reached.
 */
class SequentialImpulseSolver {
    static solve(
        group: CollisionGroup,
        maxIter: number = 1000,
        convergenceThreshold: number = 1e-7
    ): void {
        let iter = 0;
        for (; iter < maxIter; iter++) {
            let allSeparating = true;

            for (const contact of group.contacts) {
                // Normal impulse
                const vrel = contact.getRelativeVelocity();
                const vn = VecMath.dot(vrel, contact.normal);
                let jn = 0;

                if (vn < -convergenceThreshold) {
                    allSeparating = false;
                    // Compute normal impulse magnitude
                    jn = -(1 + contact.restitution) * vn * contact.imEff;
                    const impulseNorm = VecMath.scale(contact.normal, jn);
                    contact.applyImpulse(impulseNorm);
                }

                // Friction impulse (only if a normal impulse was applied)
                if (jn > 0) {
                    const vrelNew = contact.getRelativeVelocity();
                    const vnNew = VecMath.dot(vrelNew, contact.normal);
                    const vt = VecMath.wSum([vrelNew, contact.normal], [1, vnNew]);
                    const vtLen = VecMath.norm(vt);

                    if (vtLen > convergenceThreshold) {
                        // Desired impulse to cancel tangential motion
                        const jtDes = vtLen * contact.imEff;
                        const jtMax = contact.friction * jn;
                        const jt = Math.min(jtDes, jtMax);
                        const impulseTan = VecMath.scale(vt, -jt / vtLen);
                        contact.applyImpulse(impulseTan);
                    }
                }
            }

            if (allSeparating)
                break;
        }
        console.log(`SequentialImpulseSolver.solve: iter=${iter}`);
    }
}

export { SequentialImpulseSolver };