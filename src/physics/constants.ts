import * as THREE from 'three';

const Constants = {
    EP: 1.0e-8,
    G: 9.81,
    THETA: 0.01,
    R: 0.028575,
    M: 0.163,
    MU_KINETIC: 0.2,
    MU_ROLL: 0.01,
    MU_SPIN: 10,           // deceleration of sidespin, ~ 10 m/s^2 (according to Dr Dave)
    E1: new THREE.Vector3(1, 0, 0),
    E2: new THREE.Vector3(0, 1, 0),
    E3: new THREE.Vector3(0, 0, 1),
} as const;

export { Constants };