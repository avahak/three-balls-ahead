type Timed = { t: number };

class PriorityQueue<T extends Timed> {
    // Parent of i is at (i-1)>>1, left child at (i<<1)+1 and right at (i<<1)+2 
    // (if array is long enough to have them).
    private heap: T[] = [];

    size(): number {
        return this.heap.length;
    }

    peek(): T | undefined {
        return this.heap[0];
    }

    push(value: T): void {
        this.heap.push(value);
        this.bubbleUp(this.heap.length - 1);
    }

    pop(): T | undefined {
        const n = this.heap.length;
        if (n === 0)
            return undefined;
        if (n === 1)
            return this.heap.pop();

        const root = this.heap[0];
        this.heap[0] = this.heap.pop()!;
        this.bubbleDown(0);
        return root;
    }

    private bubbleUp(i: number): void {
        const heap = this.heap;
        while (i > 0) {
            const p = (i - 1) >> 1;     // index for parent
            if (heap[p].t <= heap[i].t)
                break;
            [heap[p], heap[i]] = [heap[i], heap[p]];
            i = p;
        }
    }

    private bubbleDown(i: number): void {
        const heap = this.heap;
        const n = heap.length;

        while (true) {
            let left = (i << 1) + 1;
            let right = left + 1;
            let smallest = i;

            if (left < n && heap[left].t < heap[smallest].t)
                smallest = left;
            if (right < n && heap[right].t < heap[smallest].t)
                smallest = right;
            if (smallest === i)
                break;

            [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
            i = smallest;
        }
    }
}

export { PriorityQueue };