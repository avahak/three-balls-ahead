precision highp float;

uniform vec2 resolution;
uniform int useFisheye;
uniform float focalLength;
uniform int numSegments;
uniform sampler2D controlPointTexture;
uniform isampler2D indexTexture;

out vec3 color;

#define PI 3.14159265359

// MAX_WIDTH has to match with value in uniformBSpline.ts
#define MAX_WIDTH 1024

vec4 splineCoeffs(float t) {
    float s1 = 1.0 - t;
    float s2 = s1*s1;
    float s3 = s2*s1;
    float t2 = t*t;
    float t3 = t2*t;
    return vec4(s3, 3.0*t3-6.0*t2+4.0, 3.0*t2*s1+3.0*t+1.0, t3) / 6.0;
}

vec3 fisheyeStereographic(vec3 p0) {
    float r0 = length(p0);
    float r0xy = length(p0.xy);
    float phi = 0.5 * atan(r0xy, -p0.z);
    vec3 p = r0 * vec3(2.0*focalLength * sin(phi)*p0.xy/r0xy, -cos(phi));
    return p;
    // Now r on image plane is c*|p.xy|/(-p.z) = c*2f*tan(phi) = c*2f*tan(theta/2), 
    // i.e. r = c*2f tan(theta/2), which is the formula for fisheye lens 
    // with stereographic projection.
}

void main() {
    int vIndex = gl_VertexID;       // 0 or 1
    int iIndex = gl_InstanceID;

    int i = iIndex / numSegments;
    int index = 2 * texelFetch(indexTexture, ivec2(i % MAX_WIDTH, i / MAX_WIDTH), 0).r;

    vec3 p0 = texelFetch(controlPointTexture, ivec2(index % MAX_WIDTH, index / MAX_WIDTH), 0).rgb;
    vec3 c0 = texelFetch(controlPointTexture, ivec2((index+1) % MAX_WIDTH, (index+1) / MAX_WIDTH), 0).rgb;
    vec3 p1 = texelFetch(controlPointTexture, ivec2((index+2) % MAX_WIDTH, (index+2) / MAX_WIDTH), 0).rgb;
    vec3 c1 = texelFetch(controlPointTexture, ivec2((index+3) % MAX_WIDTH, (index+3) / MAX_WIDTH), 0).rgb;
    vec3 p2 = texelFetch(controlPointTexture, ivec2((index+4) % MAX_WIDTH, (index+4) / MAX_WIDTH), 0).rgb;
    vec3 c2 = texelFetch(controlPointTexture, ivec2((index+5) % MAX_WIDTH, (index+5) / MAX_WIDTH), 0).rgb;
    vec3 p3 = texelFetch(controlPointTexture, ivec2((index+6) % MAX_WIDTH, (index+6) / MAX_WIDTH), 0).rgb;
    vec3 c3 = texelFetch(controlPointTexture, ivec2((index+7) % MAX_WIDTH, (index+7) / MAX_WIDTH), 0).rgb;

    float t = float((iIndex % numSegments) + vIndex) / float(numSegments);
    vec4 w = splineCoeffs(t);

    vec3 p = w.x*p0 + w.y*p1 + w.z*p2 + w.w*p3;
    color = w.x*c0 + w.y*c1 + w.z*c2 + w.w*c3;

    vec4 vPos = vec4(p, 1.0);

    if (useFisheye == 0) {
        gl_Position = projectionMatrix * modelViewMatrix * vPos;
    } else {
        vec3 q = (modelViewMatrix * vPos).xyz;
        vec3 qFisheye = fisheyeStereographic(q);
        gl_Position = projectionMatrix * vec4(qFisheye, 1.0);
    }
}