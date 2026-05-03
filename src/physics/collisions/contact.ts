import { VecMath, type Vec3 } from '../../math/vec';
import { type BallSnapshotTagged } from '../types';

class Contact {
    // Immutable geometry
    public readonly bodyA: BallSnapshotTagged;
    public readonly bodyB: BallSnapshotTagged | null;   // null is slate
    public readonly point: Vec3;
    public readonly normal: Vec3;
    public readonly restitution: number;
    public readonly friction: number;
    public readonly rA: Vec3;
    public readonly rB: Vec3;
    public readonly imEff: number;      // inverse effective mass

    // Mutable state for force solver
    public depth: number = 0;
    public depthDer: number = 0;

    constructor(
        bodyA: BallSnapshotTagged,
        bodyB: BallSnapshotTagged | null,
        point: Vec3,
        normal: Vec3,
        restitution: number,
        friction: number,
    ) {
        this.bodyA = bodyA;
        this.bodyB = bodyB;
        this.point = point;
        this.normal = normal;
        this.restitution = restitution;
        this.friction = friction;

        // Precompute vectors from centres to contact point
        this.rA = VecMath.sub(point, bodyA.p);
        this.rB = bodyB ? VecMath.sub(point, bodyB.p) : [0, 0, 0];

        // Precompute inverse effective mass for normal direction
        this.imEff = bodyA.ball.stats.im + (bodyB ? bodyB.ball.stats.im : 0);
    }

    /** 
     * Relative velocity `vA-vB` at the contact point. 
     */
    public getRelativeVelocity(): Vec3 {
        const vA = VecMath.add(this.bodyA.v, VecMath.cross(this.bodyA.w, this.rA));
        if (!this.bodyB)
            return vA;
        const vB = VecMath.add(this.bodyB.v, VecMath.cross(this.bodyB.w, this.rB));
        return VecMath.sub(vA, vB);
    }

    /** 
     * Apply an impulse to the two bodies. 
     * A gets -impulse and B gets impulse.
     * Called by siSolver.
     */
    public applyImpulse(impulse: Vec3): void {
        // Body A
        const dvA = VecMath.scale(impulse, -this.bodyA.ball.stats.im);
        this.bodyA.v = VecMath.add(this.bodyA.v, dvA);
        const dwA = VecMath.cross(this.rA, impulse);
        this.bodyA.w = VecMath.wSum([this.bodyA.w, dwA], [1, -1 / this.bodyA.ball.stats.inertia]);

        // Body B (if exists)
        if (this.bodyB) {
            const dvB = VecMath.scale(impulse, this.bodyB.ball.stats.im);
            this.bodyB.v = VecMath.add(this.bodyB.v, dvB);
            const dwB = VecMath.cross(this.rB, impulse);
            this.bodyB.w = VecMath.wSum([this.bodyB.w, dwB], [1, 1 / this.bodyB.ball.stats.inertia]);
        }
    }

    /**
     * Accumulate a force into temporary acceleration buffers `accMap`.
     * A gets -force and B gets force.
     * Called by ForceSolver.
     */
    public applyForce(force: Vec3, dt: number, accMap: Map<BallSnapshotTagged, { a: Vec3; dw: Vec3 }>): void {
        const aAcc = accMap.get(this.bodyA);
        if (aAcc) {
            aAcc.a = VecMath.wSum([aAcc.a, force], [1, -dt * this.bodyA.ball.stats.im]);
            const torque = VecMath.cross(this.rA, force);
            aAcc.dw = VecMath.wSum([aAcc.dw, torque], [1, -dt / this.bodyA.ball.stats.inertia]);
        }
        if (this.bodyB) {
            const bAcc = accMap.get(this.bodyB);
            if (bAcc) {
                bAcc.a = VecMath.wSum([bAcc.a, force], [1, dt * this.bodyB.ball.stats.im]);
                const torque = VecMath.cross(this.rB, force);
                bAcc.dw = VecMath.wSum([bAcc.dw, torque], [1, dt / this.bodyB.ball.stats.inertia]);
            }
        }
    }
}

export { Contact };