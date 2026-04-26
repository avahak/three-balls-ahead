import type { Ball } from "./ball";

/**
 * State change for a ball.
 */
interface BallEventInternal {
    readonly type: "BALL_INTERNAL";
    ball: Ball;
    segId: number;
    t: number;
}

/**
 * Collision between two balls
 */
interface BallBallEvent {
    readonly type: "BALL_BALL";
    ball: Ball;
    ball2: Ball;
    segId: number;
    segId2: number;
    t: number;
}

type BallEvent = BallEventInternal | BallBallEvent;

export type { BallEvent, BallEventInternal, BallBallEvent };