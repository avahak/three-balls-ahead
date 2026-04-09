import * as THREE from 'three';
import { VecMath } from './math/vec';

class OverheadCamera {
    camera: THREE.PerspectiveCamera;

    phi: number;        // azimutal angle
    theta: number;      // elevation angle
    r: number;
    x0: number;         // (x0,y0) is the origin for the camera orbit
    y0: number;
    sensitivity: number;

    container: HTMLDivElement;

    constructor(container: HTMLDivElement) {
        this.container = container;

        this.camera = new THREE.PerspectiveCamera(45, 1.0, 0.1, 100.0);
        this.camera.up.set(0, 0, 1);

        this.phi = -Math.PI / 2;
        this.theta = 0.499 * Math.PI;
        this.r = 2;
        this.x0 = 0;
        this.y0 = 0;
        this.sensitivity = 5 / 1000;

        this.update();
    }

    setAspectRatio(aspect: number) {
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
    }

    set(r: number, theta: number, phi: number, x0: number, y0: number) {
        this.r = Math.min(10, Math.max(0.5, r));
        this.theta = Math.min(0.499 * Math.PI, Math.max(Math.PI / 16, theta));
        this.phi = phi % (2 * Math.PI);
        this.x0 = x0;
        this.y0 = y0;
        this.update();
    }

    changeOrbit(scale: number, dTheta: number, dPhi: number) {
        this.set(
            this.r * scale,
            this.theta + this.sensitivity * dTheta,
            this.phi - this.sensitivity * dPhi,
            this.x0, this.y0
        );
    }

    moveFocus(x: number, y: number, dx: number, dy: number) {
        const { clientWidth, clientHeight } = this.container;

        const v0 = new THREE.Vector3(
            (x / clientWidth) * 2 - 1,
            -(y / clientHeight) * 2 + 1,
            0.5
        ).unproject(this.camera).sub(this.camera.position);
        const v1 = new THREE.Vector3(
            ((x + dx) / clientWidth) * 2 - 1,
            -((y + dy) / clientHeight) * 2 + 1,
            0.5
        ).unproject(this.camera).sub(this.camera.position);

        const t0 = -this.camera.position.z / v0.z;
        const t1 = -this.camera.position.z / v1.z;

        const p0 = new THREE.Vector3().copy(this.camera.position).add(v0.multiplyScalar(t0));
        const p1 = new THREE.Vector3().copy(this.camera.position).add(v1.multiplyScalar(t1));

        let w = [p0.x - p1.x, p0.y - p1.y];
        if (VecMath.norm(w) > 0.1)
            w = VecMath.normalize(w, 0.1);

        this.set(this.r, this.theta, this.phi, this.x0 + w[0], this.y0 + w[1]);
    }

    /**
     * Updates this.camera position and direction.
     */
    private update() {
        const v = VecMath.cartesianFromSpherical(this.r, this.theta, this.phi);

        this.camera.position.set(this.x0 + v[0], this.y0 + v[1], v[2]);
        this.camera.lookAt(new THREE.Vector3(this.x0, this.y0, 0));
    }
}

export { OverheadCamera };