import * as THREE from 'three';

const Constants = {
    EP: 1.0e-8,
    G: 9.81,
    THETA: 0.01,
    R: 0.028575,
    M: 0.163,
    MU_SLIDE: 0.2,     // 0.2
    MU_ROLL: 0.01,
    MU_BALL_BALL: 0.1,
    // deceleration of sidespin is ~ 10 rad/s^2 (according to Dr Dave, see TP_B-2.pdf)
    // (5\mu g)/(2R) ~ 10 => \mu ~ 10*(2R)/(5g) ~ 0.012
    MU_SPIN: 0.012,
    COR_BALL_BALL: 0.85,
    COR_BALL_SLATE: 0.7,
    E1: new THREE.Vector3(1, 0, 0),
    E2: new THREE.Vector3(0, 1, 0),
    E3: new THREE.Vector3(0, 0, 1),
} as const;

export { Constants };