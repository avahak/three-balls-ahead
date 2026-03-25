precision highp float;

uniform vec2 resolution;

in vec4 vPos;
in vec2 vUv;

void main() {
    float aspect = resolution.x / resolution.y;
    gl_FragColor = vec4(0.1, 0.2, 0.5+0.5*sin(100.0*aspect), 1.0);
}