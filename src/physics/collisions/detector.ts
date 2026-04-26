import { VecMath, type Vec3 } from '../../math/vec';
import { Graph } from '../../utils';
import type { Ball } from '../ball';
import { Constants } from '../constants';
import { Table } from '../table';
import type { BallSnapshotTagged } from '../types';
import { Contact } from './contact';
import { ForceSolver } from './forceSolver';
import { CollisionGroup } from './group';
import { SequentialImpulseSolver } from './siSolver';

const TOLERANCE = 1e-9;

class CollisionDetector {
    /**
     * Build a CollisionGroup from a seed ball that is guaranteed to be involved.
     * @param seed The ball triggering the collision.
     * @param allBalls All balls in the simulation (positions at collision time).
     * @returns CollisionGroup or null if no collision detected.
     */
    static detect(seed: BallSnapshotTagged, allBalls: BallSnapshotTagged[], table: Table): CollisionGroup | null {
        const n = allBalls.length;
        const indexMap = new Map<BallSnapshotTagged, number>();
        allBalls.forEach((b, idx) => indexMap.set(b, idx));

        // Build touching graph among balls
        const graph = new Graph<number>(true);
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const b1 = allBalls[i];
                const b2 = allBalls[j];
                const dist = VecMath.distance(b1.p, b2.p);
                const threshold = b1.ball.stats.r + b2.ball.stats.r + TOLERANCE;
                if (dist <= threshold)
                    graph.addEdge(i, j);
            }
        }

        // Connected component of the seed
        const seedIdx = indexMap.get(seed);
        if (seedIdx === undefined)
            return null;
        const component = graph.connectedComponent(seedIdx);

        // Collect balls and create contacts
        const groupBalls: BallSnapshotTagged[] = component.map(idx => allBalls[idx]);
        const contacts: Contact[] = [];

        // Create contacts
        for (let i = 0; i < component.length; i++) {
            const idxA = component[i];
            const ballA = allBalls[idxA];
            const rA = ballA.ball.stats.r;

            for (let idxB of graph.getAdjacentVertices(idxA)) {
                if (idxB <= idxA)   // Avoid duplicates
                    continue;
                const ballB = allBalls[idxB];
                const rB = ballB.ball.stats.r;

                const t = rB / (rA + rB);
                const point = VecMath.wSum([ballA.p, ballB.p], [1 - t, t]);
                const normal = VecMath.normalize(VecMath.sub(ballB.p, ballA.p));
                const contact = new Contact(
                    ballA, ballB, point, normal,
                    Constants.COR_BALL_BALL, Constants.MU_BALL_BALL
                );
                contacts.push(contact);
            }
        }

        // Add ball-slate contacts
        for (const b of allBalls) {
            const dist = VecMath.distance(b.p, table.getClosestSlatePoint(b.p));
            console.log("cloth contact?", b.ball.name, dist, b.ball.stats.r + TOLERANCE);
            if (dist < b.ball.stats.r + TOLERANCE) {
                const point: Vec3 = [b.p[0], b.p[1], -b.ball.stats.r];
                const normal: Vec3 = [0, 0, -1];
                const contact = new Contact(
                    b, null, point, normal,
                    Constants.COR_BALL_SLATE, Constants.MU_SLIDE
                );
                contacts.push(contact);
            }
        }

        // console.log("component", component);
        // console.log("contacts", contacts);

        if (contacts.length === 0)
            return null;
        return new CollisionGroup(groupBalls, contacts);
    }
}

function detectAndResolve(
    t: number,
    seedIdx: number,
    balls: Ball[],
    table: Table,
    solver: "force" | "si"
): BallSnapshotTagged[] | undefined {
    const snapshots: BallSnapshotTagged[] = balls.map((ball) => ({ ...ball.seg.eval(t), ball: ball }));
    const seed = snapshots[seedIdx];
    const group = CollisionDetector.detect(seed, snapshots, table);
    if (!group)
        return;
    for (const ss of group.balls) {
        console.log("initial name,p,v", ss.ball.name, ss.p.slice(), ss.v.slice());
    }
    console.log("detectAndResolve", JSON.stringify({ t, snapshots, group }));
    if (solver === "force")
        ForceSolver.solve(group);
    else if (solver === "si")
        SequentialImpulseSolver.solve(group);
    for (const ss of group.balls) {
        console.log("after collision name,p,v", ss.ball.name, ss.p.slice(), ss.v.slice());
    }
    for (const ss of group.balls)
        ss.ball.seg.setFromInitialValues(t, ss.p, ss.v, ss.w);
    return group.balls;
}

export { CollisionDetector, detectAndResolve };