import * as THREE from 'three';
import { AssetLoader } from "../assetLoader";
import { cantorFunction } from "../math/misc";
import { VecMath, type Vec3 } from "../math/vec";
import { Ball } from "../physics/ball";
import { BallSegment } from "../physics/ballSegment";
import { detectAndResolve } from "../physics/collisions/detector";
import { EventHandler } from "../physics/eventHandler";
import type { BallBallEvent, BallEventInternal } from "../physics/eventTypes";
import { Table } from "../physics/table";

class Simulator {
    balls: Ball[] = [];
    t: number = 0;
    eventHandler: EventHandler;
    table: Table;
    steps_DEBUG: number = 0;
    stopped: boolean = false;

    config: "8-ball" | "cut" = "8-ball";
    // config: "8-ball" | "cut" = "cut";


    // Helpers to prevent creating duplicate events
    private ballsIndex = new Map<Ball, number>();
    private bbEventsAdded = new Map<number, number>();

    constructor(assetLoader: AssetLoader) {
        this.table = new Table(assetLoader);

        this.eventHandler = new EventHandler();

        this.restart();
    }

    restart() {
        this.t = 0;
        this.steps_DEBUG = 0;
        BallSegment.evalCounter_DEBUG = 0;
        this.bbEventsAdded = new Map();

        const ballsExist = this.balls.length > 0;

        // Create and position balls
        const r = Table.tableJson.specs.BALL_RADIUS;
        const tableLength = Table.tableJson.specs.TABLE_LENGTH;
        // console.log("json", Table.tableJson);
        const vx = this.config == "8-ball" ? 7 : 3;
        const vz = this.config == "8-ball" ? 1 : 0;
        const w0: Vec3 = [0, -50, 10];
        const seg0 = BallSegment.createFromInitialValues(this.t, [-tableLength / 4, 0, 0], [vx, 0, vz], w0, new THREE.Quaternion());
        console.log(seg0.t1);
        if (ballsExist) {
            this.balls[0].seg = seg0;
        } else {
            const cueBall = new Ball(seg0);
            cueBall.name = "Cueball";
            this.balls = [cueBall];
        }

        if (this.config == "8-ball") {
            let count = 1;
            for (let k = 1; k <= 5; k++) {
                for (let j = 0; j < k; j++) {
                    const x = tableLength / 4 + r * (k - 1) * Math.sqrt(3);
                    const y = r * (2 * j + 1 - k);
                    const p: Vec3 = [x, y, 0];
                    // const w0 = VecMath.vGaussian(3, 30.5) as Vec3;
                    const w0 = [0, 0, 0] as Vec3;
                    const seg = BallSegment.createFromInitialValues(this.t, p, [0, 0, 0], w0, new THREE.Quaternion());
                    if (ballsExist) {
                        this.balls[count].seg = seg;
                    } else {
                        const ball = new Ball(seg);
                        ball.name = `Ball_${this.balls.length}`;
                        this.balls.push(ball);
                    }
                    count++;
                }
            }
        } else if (this.config == "cut") {
            const p1: Vec3 = [0, 1.5 * r, 0];
            const seg1 = BallSegment.createFromInitialValues(this.t, p1, [0, 0, 0], [0, 0, 0], new THREE.Quaternion());
            const p2: Vec3 = [10 * r, -8 * r, 0];
            const seg2 = BallSegment.createFromInitialValues(this.t, p2, [0, 0, 0], [0, 0, 0], new THREE.Quaternion());

            if (ballsExist) {
                this.balls[1].seg = seg1;
                this.balls[2].seg = seg2;
            } else {
                const ball1 = new Ball(seg1);
                ball1.name = `Ball_1`;
                this.balls.push(ball1);
                const ball2 = new Ball(seg2);
                ball2.name = `Ball_2`;
                this.balls.push(ball2);
            }
        }

        for (let k = 0; k < this.balls.length; k++)
            this.ballsIndex.set(this.balls[k], k);

        this.eventHandler.reset();
        this.renewEvents(this.t, this.balls);
    }

    addInternalEvent(ball: Ball) {
        if (Number.isFinite(ball.seg.t1)) {
            const event: BallEventInternal = {
                type: "BALL_INTERNAL",
                ball: ball,
                segId: ball.seg.id,
                t: ball.seg.t1,
            };
            this.eventHandler.addEvent(event);
        }
    }

    addBallBallEvent(tMin: number, ball: Ball, ball2: Ball) {
        const t = BallSegment.collisionLowerBound(tMin, ball.seg, ball2.seg);
        if (Number.isFinite(t)) {
            console.log(`Reschedule at t=${t}`);
            const event: BallBallEvent = {
                type: "BALL_BALL",
                ball: ball,
                ball2: ball2,
                segId: ball.seg.id,
                segId2: ball2.seg.id,
                t: t,
            };
            this.eventHandler.addEvent(event);
        }
    }

    /**
     * Renews internal and ball-ball events for an array of balls that have
     * changed their trajectory.
     */
    renewEvents(tMin: number, dirtyBalls: Ball[]) {
        for (const dirtyBall of dirtyBalls) {
            this.addInternalEvent(dirtyBall);
            for (const ball of this.balls) {
                // We want to add collision check between ball and dirtyBall but to 
                // prevent possible duplicate checks, we use bbEventsAdded map to check
                // that the pair has not been added yet.
                const [i1, i2] = [this.ballsIndex.get(dirtyBall)!, this.ballsIndex.get(ball)!];
                if (i1 !== i2) {
                    const index = cantorFunction(Math.min(i1, i2), Math.max(i1, i2));
                    if (this.bbEventsAdded.get(index) !== this.steps_DEBUG) {
                        this.addBallBallEvent(tMin, dirtyBall, ball);
                        // console.log("BB", dirtyBall.name, dirtyBall.seg.id, ball.name, ball.seg.id);
                        this.bbEventsAdded.set(index, this.steps_DEBUG);
                    }
                }
            }
        }
    }


    advanceTime(targetTime: number, solverMode: "forceSolver" | "siSolver") {
        if (this.stopped)
            return;

        while (this.eventHandler.getNextTime() < targetTime) {
            this.steps_DEBUG++;
            const event = this.eventHandler.pop()!;     // cannot be undefined by while condition
            // console.log(event);
            if (event.type === "BALL_INTERNAL") {
                const ball = event.ball;
                if (ball.seg.id !== event.segId)
                    continue;
                // What is the best way to handle this? 
                // Within BallSegment only?
                // if (ball.seg.state === BallState.Flying) {
                // }
                const ballEval = ball.seg.eval(event.t);
                console.log(ball.name, ball.seg.state);
                ball.seg.setFromInitialValues(event.t, ballEval.p, ballEval.v, ballEval.w, ballEval.q);

                // console.log(event.t, event.ball);
                this.renewEvents(event.t, [ball]);
            }
            if (event.type === "BALL_BALL") {
                if (event.ball.seg.id !== event.segId || event.ball2.seg.id !== event.segId2)
                    continue;
                const ball = event.ball;
                const ball2 = event.ball2;
                const t = event.t;
                const ballEval = ball.seg.eval(t);
                const ball2Eval = ball2.seg.eval(t);
                const dist = VecMath.distance(ballEval.p, ball2Eval.p) - ball.stats.r - ball2.stats.r;
                const text = dist < 1e-9 ? "Collision detected!" : "ball-ball without collision";
                console.log("collision", structuredClone({ text, t, simulatorT: this.t, dist, ball, ball2 }));
                if (dist < 1e-9) {
                    let ss;
                    if (solverMode === "forceSolver")
                        ss = detectAndResolve(t, this.balls.indexOf(ball), this.balls, this.table, "force");
                    else
                        ss = detectAndResolve(t, this.balls.indexOf(ball), this.balls, this.table, "si");
                    if (ss) {
                        const ballsCollision = ss.map((b) => b.ball);
                        this.renewEvents(t, ballsCollision);

                        // this.stopped = true;    // Just for debug
                        // return;
                    } else {
                        // Something went wrong
                        this.stopped = true;
                        return;
                    }
                } else {
                    // Here we need to reschedule!! Whole point of the sequential algorithm!
                    this.addBallBallEvent(t, ball, ball2);
                }
            }
            this.t = event.t;
        }
        this.t = targetTime;
    }
}

export { Simulator };