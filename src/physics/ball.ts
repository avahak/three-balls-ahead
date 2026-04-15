import { BallSegment } from "./ballSegment";
import { Table } from "./table";

class Ball {
    seg: BallSegment;
    r: number;

    constructor(seg: BallSegment, r: number) {
        this.seg = seg;
        this.r = r;
    }

    createDummy(t: number): Ball {
        const seg = BallSegment.createFromInitialValues(t, [0, 0, 0], [0, 0, 0], [0, 0, 0]);
        const r = Table.tableJson.BALL_RADIUS;
        return new Ball(seg, r);
    }

    clone(): Ball {
        return new Ball(this.seg.clone(), this.r);
    }
}

export { Ball };