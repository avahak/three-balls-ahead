import { AssetLoader } from "../assetLoader";
import { cantorFunction } from "../math/misc";
import { VecMath, type Vec3 } from "../math/vec";
import { Ball } from "../physics/ball";
import { BallSegment, BallState } from "../physics/ballSegment";
import { detectAndResolve } from "../physics/collisions/detector";
import { EventHandler } from "../physics/eventHandler";
import type { BallBallEvent, BallEventInternal } from "../physics/eventTypes";
import { Table } from "../physics/table";

class Simulator {
    balls: Ball[];
    t: number;
    eventHandler: EventHandler;
    table: Table;
    steps_DEBUG: number = 0;
    stopped: boolean = false;

    // Helpers to prevent creating duplicate events
    private ballsIndex = new Map<Ball, number>();
    private bbEventsAdded = new Map<number, number>();

    constructor(assetLoader: AssetLoader) {
        this.t = 0;
        this.table = new Table(assetLoader);

        this.eventHandler = new EventHandler();

        // Create and position balls
        const r = Table.tableJson.specs.BALL_RADIUS;
        const tableLength = Table.tableJson.specs.TABLE_LENGTH;
        // console.log("json", Table.tableJson);
        const vx = 8;
        const w0: Vec3 = [0, -50, 100];
        const seg0 = BallSegment.createFromInitialValues(this.t, [-tableLength / 4, 0, 0], [vx, 0, 0], w0);
        console.log(seg0.t1);
        const cueBall = new Ball(seg0);
        cueBall.name = "Cueball";
        this.balls = [cueBall];

        const MODE: string = "8-ball";
        // const MODE: string = "cut";

        if (MODE == "8-ball") {
            for (let k = 1; k <= 5; k++) {
                for (let j = 0; j < k; j++) {
                    const x = tableLength / 4 + r * (k - 1) * Math.sqrt(3);
                    const y = r * (2 * j + 1 - k);
                    const p: Vec3 = [x, y, 0];
                    // const w0 = VecMath.vGaussian(3, 30.5) as Vec3;
                    const w0 = [0, 0, 0] as Vec3;
                    const seg = BallSegment.createFromInitialValues(this.t, p, [0, 0, 0], w0);
                    const ball = new Ball(seg);
                    ball.name = `Ball_${this.balls.length}`;
                    this.balls.push(ball);
                }
            }
        } else if (MODE == "cut") {
            const p: Vec3 = [tableLength / 4, 1.5 * r, 0];
            const w0 = [0, 0, 0] as Vec3;
            const seg = BallSegment.createFromInitialValues(this.t, p, [0, 0, 0], w0);
            const ball = new Ball(seg);
            ball.name = `Ball_1`;
            this.balls.push(ball);
        }

        for (let k = 0; k < this.balls.length; k++)
            this.ballsIndex.set(this.balls[k], k);

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

    advanceTime(targetTime: number) {
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
                ball.seg.setFromInitialValues(event.t, ballEval.p, ballEval.v, ballEval.w);

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
                console.log(JSON.stringify({ text, t, simulatorT: this.t, dist, ball, ball2 }));
                if (dist < 1e-9) {
                    const ss = detectAndResolve(t, this.balls.indexOf(ball), this.balls, this.table, "force");
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