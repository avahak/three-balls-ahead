// NOTE This is originally from the dev-site-misc project. Make improvements there first!

interface Modifiers {
    shiftKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    metaKey: boolean;
};

interface InputMapper {
    mouse?: {
        down?: (args: { x: number, y: number, button: number } & Modifiers) => void;
        up?: (args: { x: number, y: number, button: number } & Modifiers) => void;
        drag?: (args: { x: number, y: number, dx: number, dy: number, buttons: number } & Modifiers) => void;
        move?: (args: { x: number, y: number, isInside: boolean } & Modifiers) => void;
    };
    touch?: {
        start?: (args: { x: number, y: number } & Modifiers) => void;
        end?: (args: { x: number, y: number } & Modifiers) => void;
        dragSingle?: (args: { x: number, y: number, dx: number, dy: number } & Modifiers) => void;
        dragPair?: (args: { x: number, y: number, dx: number, dy: number, scale: number, angle: number } & Modifiers) => void;
    };
    wheel?: {
        zoom?: (args: { x: number, y: number, delta: number } & Modifiers) => void;
        pan?: (args: { x: number, y: number, dx: number, dy: number } & Modifiers) => void;
    }
    keyboard?: {
        keydown?: (args: { key: string, code: string } & Modifiers) => void;
        keyup?: (args: { key: string, code: string } & Modifiers) => void;
    }
    safariGesture?: {
        change?: (args: { x: number, y: number, scale: number, angle: number } & Modifiers) => void;
    }
};

function isInside(rect: DOMRect, x: number, y: number): boolean {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function getModifiers(event: MouseEvent | PointerEvent | WheelEvent | KeyboardEvent): Modifiers {
    return {
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
    };
}


/** 
 * Attaches input events to actions in form of InputMapper. 
 */
class InputListener {
    private container: HTMLElement;
    private mapper: InputMapper;

    private pointers: Map<number, { x: number, y: number }> = new Map();
    private lastDistance: number | null = null;
    private lastAngle: number | null = null;
    private lastMidpoint: { x: number, y: number } | null = null;
    private lastPointer: { x: number, y: number } | null = null;

    // Safari gesture tracking
    private lastGestureScale: number | null = null;
    private lastGestureRotation: number | null = null;

    constructor(container: HTMLElement, mapper: InputMapper) {
        this.container = container;
        this.mapper = mapper;

        // Needed to prevent default touch behaviors such as scrolling and zooming
        this.container.style.touchAction = 'none';
        this.container.style.userSelect = 'none';

        this.container.addEventListener('pointerdown', this.onPointerDown, { passive: false });
        this.container.addEventListener('pointermove', this.onPointerMove, { passive: false });
        this.container.addEventListener('pointerup', this.onPointerUp, { passive: false });
        this.container.addEventListener('pointercancel', this.onPointerUp, { passive: false });
        this.container.addEventListener('wheel', this.onWheel, { passive: false });
        this.container.addEventListener('contextmenu', this.onContextmenu, { passive: false });

        // Safari trackpad gestures
        this.container.addEventListener('gesturestart', this.onSafariGestureStart as EventListener, { passive: false });
        this.container.addEventListener('gesturechange', this.onSafariGestureChange as EventListener, { passive: false });
        this.container.addEventListener('gestureend', this.onSafariGestureEnd as EventListener, { passive: false });

        document.addEventListener('keydown', this.onKeydown, { passive: false });
        document.addEventListener('keyup', this.onKeyup, { passive: false });
    }

    private onContextmenu = (event: MouseEvent) => {
        event.preventDefault();
    };

    private onPointerDown = (event: PointerEvent) => {
        event.preventDefault();

        (event.target as HTMLElement).setPointerCapture(event.pointerId);

        const modifiers = getModifiers(event);
        const rect = this.container.getBoundingClientRect();

        this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        this.lastPointer = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };

        if (event.pointerType === 'mouse' && this.mapper.mouse?.down) {
            this.mapper.mouse.down({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
                button: event.button,
                ...modifiers
            });
        } else if (event.pointerType === 'touch' && this.pointers.size === 1 && this.mapper.touch?.start) {
            this.mapper.touch.start({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
                ...modifiers
            });
        }

        if (this.pointers.size === 2 && event.pointerType === 'touch') {
            const [p1, p2] = Array.from(this.pointers.values());
            this.lastDistance = this.getDistance(p1, p2);
            this.lastAngle = this.getAngle(p1, p2);
            this.lastMidpoint = this.getMidpoint(p1, p2);
        }
    };

    private onPointerMove = (event: PointerEvent) => {
        event.preventDefault();

        const modifiers = getModifiers(event);
        const rect = this.container.getBoundingClientRect();

        const pointer = this.pointers.get(event.pointerId);
        if (!pointer) return;

        const dx = event.clientX - pointer.x;
        const dy = event.clientY - pointer.y;

        // update first to avoid stale data
        this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        this.lastPointer = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };

        if (event.pointerType === 'mouse') {
            if (this.mapper.mouse?.move) {
                const inside = isInside(rect, event.clientX, event.clientY);
                this.mapper.mouse.move({
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                    isInside: inside,
                    ...modifiers
                });
            }

            if (this.mapper.mouse?.drag) {
                this.mapper.mouse.drag({
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                    dx,
                    dy,
                    buttons: event.buttons,
                    ...modifiers
                });
            }
        } else if (event.pointerType === 'touch') {
            if (this.pointers.size === 1 && this.mapper.touch?.dragSingle) {
                this.mapper.touch.dragSingle({
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                    dx,
                    dy,
                    ...modifiers
                });
            } else if (this.pointers.size === 2) {
                const [p1, p2] = Array.from(this.pointers.values());

                const newDistance = this.getDistance(p1, p2);
                const newAngle = this.getAngle(p1, p2);
                const newMidpoint = this.getMidpoint(p1, p2);

                if (this.lastDistance && this.lastAngle && this.lastMidpoint) {
                    const scale = newDistance / this.lastDistance;
                    const angle = newAngle - this.lastAngle;
                    const delta = {
                        x: newMidpoint.x - this.lastMidpoint.x,
                        y: newMidpoint.y - this.lastMidpoint.y
                    };

                    this.mapper.touch?.dragPair?.({
                        x: newMidpoint.x - rect.left,
                        y: newMidpoint.y - rect.top,
                        dx: delta.x,
                        dy: delta.y,
                        scale,
                        angle,
                        ...modifiers
                    });
                }

                this.lastDistance = newDistance;
                this.lastAngle = newAngle;
                this.lastMidpoint = newMidpoint;
            }
        }
    };

    private onPointerUp = (event: PointerEvent) => {
        event.preventDefault();

        const modifiers = getModifiers(event);
        const rect = this.container.getBoundingClientRect();

        this.pointers.delete(event.pointerId);

        if (event.pointerType === 'mouse' && this.mapper.mouse?.up) {
            this.mapper.mouse.up({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
                button: event.button,
                ...modifiers
            });
        } else if (event.pointerType === 'touch' && this.pointers.size === 0 && this.mapper.touch?.end) {
            this.mapper.touch.end({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
                ...modifiers
            });
        }

        if (this.pointers.size < 2) {
            this.lastDistance = null;
            this.lastAngle = null;
            this.lastMidpoint = null;
        }
    };

    private onWheel = (event: WheelEvent) => {
        event.preventDefault();
        event.stopPropagation();

        const modifiers = getModifiers(event);
        const rect = this.container.getBoundingClientRect();

        const factor =
            event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 100 :
                event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 20 : 1;

        const isZooming = event.ctrlKey || (event.deltaX === 0 && factor * Math.abs(event.deltaY) > 50);

        if (isZooming && this.mapper.wheel?.zoom) {
            this.mapper.wheel.zoom({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
                delta: factor * event.deltaY,
                ...modifiers
            });
        } else if (!isZooming && this.mapper.wheel?.pan) {
            this.mapper.wheel.pan({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
                dx: factor * event.deltaX,
                dy: factor * event.deltaY,
                ...modifiers
            });
        }
    };

    // --- Safari gesture handling ---

    private onSafariGestureStart = (event: any) => {
        if (typeof event.scale !== 'number' || typeof event.rotation !== 'number') return;
        event.preventDefault();

        this.lastGestureScale = event.scale;
        this.lastGestureRotation = event.rotation;
    };

    private onSafariGestureChange = (event: any) => {
        if (typeof event.scale !== 'number' || typeof event.rotation !== 'number') return;

        event.preventDefault();

        const modifiers = getModifiers(event);

        if (this.lastGestureScale === null || this.lastGestureRotation === null) {
            this.lastGestureScale = event.scale;
            this.lastGestureRotation = event.rotation;
            return;
        }

        const scaleDelta = event.scale / this.lastGestureScale;
        const angleDelta = (event.rotation - this.lastGestureRotation) * Math.PI / 180;

        this.lastGestureScale = event.scale;
        this.lastGestureRotation = event.rotation;

        // --- synthesize pivot ---
        let x: number;
        let y: number;

        if (this.lastPointer) {
            x = this.lastPointer.x;
            y = this.lastPointer.y;
        } else {
            const rect = this.container.getBoundingClientRect();
            x = rect.width / 2;
            y = rect.height / 2;
        }

        this.mapper.safariGesture?.change?.({
            x,
            y,
            scale: scaleDelta,
            angle: angleDelta,
            ...modifiers
        });
    };

    private onSafariGestureEnd = (_event: any) => {
        this.lastGestureScale = null;
        this.lastGestureRotation = null;
    };

    private onKeydown = (event: KeyboardEvent) => {
        const modifiers = getModifiers(event);
        this.mapper.keyboard?.keydown?.({
            key: event.key,
            code: event.code,
            ...modifiers
        });
    };

    private onKeyup = (event: KeyboardEvent) => {
        const modifiers = getModifiers(event);
        this.mapper.keyboard?.keyup?.({
            key: event.key,
            code: event.code,
            ...modifiers
        });
    };

    private getDistance(p1: { x: number, y: number }, p2: { x: number, y: number }): number {
        return Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }

    private getAngle(p1: { x: number, y: number }, p2: { x: number, y: number }): number {
        return Math.atan2(p2.y - p1.y, p2.x - p1.x);
    }

    private getMidpoint(p1: { x: number, y: number }, p2: { x: number, y: number }): { x: number, y: number } {
        return {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2,
        };
    }

    public cleanup() {
        this.container.removeEventListener('pointerdown', this.onPointerDown);
        this.container.removeEventListener('pointermove', this.onPointerMove);
        this.container.removeEventListener('pointerup', this.onPointerUp);
        this.container.removeEventListener('pointercancel', this.onPointerUp);
        this.container.removeEventListener('wheel', this.onWheel);
        this.container.removeEventListener('contextmenu', this.onContextmenu);

        this.container.removeEventListener('gesturestart', this.onSafariGestureStart as EventListener);
        this.container.removeEventListener('gesturechange', this.onSafariGestureChange as EventListener);
        this.container.removeEventListener('gestureend', this.onSafariGestureEnd as EventListener);

        document.removeEventListener('keydown', this.onKeydown);
        document.removeEventListener('keyup', this.onKeyup);
    }
}

export type { InputMapper };
export { InputListener };