/**
 * Generic graph.
 */
class Graph<T> implements Graph<T> {
    private adjacencyTable: Map<T, Set<T>>;
    private keepSymmetric: boolean;

    public constructor(keepSymmetric: boolean) {
        this.adjacencyTable = new Map();
        this.keepSymmetric = keepSymmetric;
    }

    public addEdge(object1: T, object2: T): void {
        if (!this.adjacencyTable.has(object1))
            this.adjacencyTable.set(object1, new Set());
        this.adjacencyTable.get(object1)!.add(object2);

        if (this.keepSymmetric) {
            if (!this.adjacencyTable.has(object2))
                this.adjacencyTable.set(object2, new Set());
            this.adjacencyTable.get(object2)!.add(object1);
        }
    }

    public hasEdge(object1: T, object2: T): boolean {
        if (!this.adjacencyTable.has(object1))
            return false;
        return this.adjacencyTable.get(object1)!.has(object2);
    }

    /** 
     * Get the list of objects adjacent to a given object
     */
    public getAdjacentVertices(object: T): T[] {
        if (!this.adjacencyTable.has(object))
            return [];
        return Array.from(this.adjacencyTable.get(object)!);
    }

    /**
     * Get the list of all adjacent vertices as ordered pairs
     */
    public getAdjacentPairs(): [T, T][] {
        const pairs: [T, T][] = [];
        for (const [object, adjacentObjects] of this.adjacencyTable.entries())
            for (const touchedObject of adjacentObjects)
                pairs.push([object, touchedObject]);
        return pairs;
    }

    /** 
     * Computes connected component for a single object.
     */
    public connectedComponent(startingObject: T): T[] {
        const visited: Set<T> = new Set();
        const connectedComponent: T[] = [];
        const stack: T[] = [startingObject];
        while (stack.length > 0) {
            const currentObject = stack.pop();
            if (visited.has(currentObject!))
                continue;
            visited.add(currentObject!);
            connectedComponent.push(currentObject!);
            for (const adjacentObject of this.getAdjacentVertices(currentObject!))
                if (!visited.has(adjacentObject))
                    stack.push(adjacentObject);
        }
        return connectedComponent;
    }
}

export { Graph };