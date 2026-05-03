import { VecMath } from '../../math/vec';
import { CollisionGroup } from './group';

/**
 * Sequential impulse solver for instantaneous collision resolution.
 * Iteratively applies normal and friction impulses to resolve all contacts
 * in a collision group. Runs until all contacts are separating or max iterations reached.
 * 
 * TODO FIX, NOT CORRECT!
 */
class SequentialImpulseSolver {
    static solve(
        group: CollisionGroup,
        maxIter: number = 1000,
        threshold: number = 1e-9
    ): void {
        let iter = 1;
        for (; iter < maxIter; iter++) {
            let allSeparating = true;

            for (const contact of group.contacts) {
                // Normal impulse
                const vrel = contact.getRelativeVelocity();     // v_A-v_B
                const vn = VecMath.dot(vrel, contact.normal);
                let jn = 0;

                if (vn > threshold) {
                    allSeparating = false;
                    // Compute normal impulse magnitude
                    jn = (1 + contact.restitution) * vn / contact.imEff;    // effective mass in normal direction is 1/contact.imEff
                    const impulseNormal = VecMath.scale(contact.normal, jn);
                    contact.applyImpulse(impulseNormal);

                    // Friction impulse
                    // We don't need to recompute relative velocity since 
                    // normal impulse does not change its tangential component.
                    const vt = VecMath.wSum([vrel, contact.normal], [1, -vn]);
                    const vtLen = VecMath.norm(vt);

                    if (vtLen > threshold) {
                        // Desired impulse to cancel tangential motion
                        const jtDes = vtLen * 2 / 7 / contact.imEff;    // effective mass in the tangential direction is 2/7/contact.imEff
                        const jtMax = contact.friction * jn;
                        const jt = Math.min(jtDes, jtMax);
                        const impulseTan = VecMath.scale(vt, jt / vtLen);

                        contact.applyImpulse(impulseTan);
                    }

                    console.log("impulse", structuredClone({ vn, contact }));
                }
            }

            if (allSeparating)
                break;
        }
        console.log(`SequentialImpulseSolver.solve: iter=${iter}`);
    }
}

export { SequentialImpulseSolver };