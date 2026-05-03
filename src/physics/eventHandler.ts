// Is this class even needed? What does it add?

// import type { Ball } from "./ball";
import type { BallEvent } from "./eventTypes";
import { PriorityQueue } from "./priorityQueue";


class EventHandler {
    queue!: PriorityQueue<BallEvent>;

    constructor() {
        this.reset();
    }

    reset() {
        this.queue = new PriorityQueue<BallEvent>();
    }

    size(): number {
        return this.queue.size();
    }

    addEvent(event: BallEvent) {
        this.queue.push(event);
    }

    getNextTime(): number {
        const next = this.queue.peek();
        return next ? next.t : Number.POSITIVE_INFINITY;
    }

    pop(): BallEvent | undefined {
        const event = this.queue.pop();
        if (!event)
            return undefined;
        return event;
    }
}

export { EventHandler };