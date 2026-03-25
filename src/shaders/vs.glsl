precision highp float;

out vec4 vPos;
out vec2 vUv;

void main() {
    vPos = vec4(position.xyz, 1.0);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vPos;
}