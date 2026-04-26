import type { BallSnapshotTagged } from '../types';
import { Contact } from './contact';

class CollisionGroup {
    public readonly balls: BallSnapshotTagged[];
    public readonly contacts: Contact[];

    constructor(balls: BallSnapshotTagged[], contacts: Contact[]) {
        this.balls = balls;
        this.contacts = contacts;
    }
}

export { CollisionGroup };