import { BallSegment } from "./ballSegment";
import { Constants } from "./constants";
import type { BallStats } from "./types";

class Ball {
    seg: BallSegment;
    stats: BallStats;
    name: string;

    constructor(seg: BallSegment) {
        this.seg = seg;
        const [m, r] = [Constants.M, Constants.R];
        this.stats = { r: r, m: m, im: 1 / m, inertia: 2 / 5 * m * r * r };
        this.name = "-";
    }

    static createDummy(t: number): Ball {
        const seg = BallSegment.createFromInitialValues(t, [0, 0, 0], [0, 0, 0], [0, 0, 0]);
        return new Ball(seg);
    }

    clone(): Ball {
        return new Ball(this.seg.clone());
    }
}

export { Ball };