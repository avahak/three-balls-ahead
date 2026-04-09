// Vertex shader for tube parts of fat b-splines. Geometry is generated fully here.
precision highp float;

uniform sampler2D controlPointTexture;
uniform isampler2D indexTexture;
uniform vec2 resolution;
uniform int uSegments;
uniform int vSegments;
uniform float minPixelRadius;
uniform int TEXTURE_WIDTH;

out vec3 v_color;

const float PI = 3.141592653589793;
const float PI_OVER_2 = 0.5*PI;
const float TAU = 2.0*PI;

// For tangentDirection
const float EP = 1e-6;
const float RIGHT_ENDPOINT_START = 1.0 - 1e-5;

const int LUT[6] = int[6](
    0, 2, 1,   // first tri
    0, 3, 2    // second tri
);

vec3 eval(vec4 w, vec3 p0, vec3 p1, vec3 p2, vec3 p3) {
    return w.x*p0 + w.y*p1 + w.z*p2 + w.w*p3;
}

vec4 splineCoeffs(float t) {
    float s1 = 1.0 - t;
    float s2 = s1*s1;
    float s3 = s2*s1;
    float t2 = t*t;
    float t3 = t2*t;
    return vec4(s3, 3.0*t3 - 6.0*t2 + 4.0, 3.0*t2*s1 + 3.0*t + 1.0, t3) / 6.0;
}

vec4 d1Coeffs(float t) {
    float s = 1.0 - t;
    float t2 = t * t;
    return vec4(-s*s, 3.0*t2 - 4.0*t, -3.0*t2 + 2.0*t + 1.0, t2) * 0.5;
}

vec4 d2Coeffs(float t) {
    return vec4(1.0 - t, 3.0*t - 2.0, -3.0*t + 1.0, t);
}

vec4 d3Coeffs() {
    return vec4(-1.0, 3.0, -3.0, 1.0);
}

// In case that the derivative of the path is zero at one of the endpoints,
// we use higher order derivatives to suss out a meaningful tangent direction.
// NOTE This only helps at the endpoints and does not solve situations like 
//      gamma(t)=(t*(1-t),0,0) at t=1/2. 
// NOTE In practice we could also fall back from zero 1st derivative to
//      a basic finite difference test.
vec3 tangentDirection(float t, vec3 p0, vec3 p1, vec3 p2, vec3 p3) {
    // 1st derivative
    vec3 v = eval(d1Coeffs(t), p0, p1, p2, p3);
    float len = length(v);
    if (len > EP) 
        return v / len;

    // 2nd derivative
    v = eval(d2Coeffs(t), p0, p1, p2, p3);
    len = length(v);
    if (len > EP) {
        // flip at right endpoint for even-order fallback
        vec3 v0 = v / len;
        return (t > RIGHT_ENDPOINT_START) ? -v0 : v0;
    }

    // 3rd derivative (odd -> no flip)
    v = eval(d3Coeffs(), p0, p1, p2, p3);
    len = length(v);
    if (len > EP) 
        return v / len;

    // fully degenerate
    return vec3(1.0, 0.0, 0.0);
}

vec3 buildNormal(vec3 T) {
    // NOTE: this has to match between caps and tube shaders
    vec3 ref = abs(T.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    return normalize(cross(T, ref));
}

void main() {
    int instanceID = gl_InstanceID;
    int index = 2 * texelFetch(indexTexture, ivec2(instanceID % TEXTURE_WIDTH, instanceID / TEXTURE_WIDTH), 0).r;

    // --- Control points and colors ---
    vec4 texel0 = texelFetch(controlPointTexture, ivec2(index % TEXTURE_WIDTH, index / TEXTURE_WIDTH), 0);
    vec4 texel1 = texelFetch(controlPointTexture, ivec2((index+1) % TEXTURE_WIDTH, (index+1) / TEXTURE_WIDTH), 0);
    vec4 texel2 = texelFetch(controlPointTexture, ivec2((index+2) % TEXTURE_WIDTH, (index+2) / TEXTURE_WIDTH), 0);
    vec4 texel3 = texelFetch(controlPointTexture, ivec2((index+3) % TEXTURE_WIDTH, (index+3) / TEXTURE_WIDTH), 0);
    vec4 texel4 = texelFetch(controlPointTexture, ivec2((index+4) % TEXTURE_WIDTH, (index+4) / TEXTURE_WIDTH), 0);
    vec4 texel5 = texelFetch(controlPointTexture, ivec2((index+5) % TEXTURE_WIDTH, (index+5) / TEXTURE_WIDTH), 0);
    vec4 texel6 = texelFetch(controlPointTexture, ivec2((index+6) % TEXTURE_WIDTH, (index+6) / TEXTURE_WIDTH), 0);
    vec4 texel7 = texelFetch(controlPointTexture, ivec2((index+7) % TEXTURE_WIDTH, (index+7) / TEXTURE_WIDTH), 0);

    vec3 p0 = texel0.rgb;
    vec3 p1 = texel2.rgb;
    vec3 p2 = texel4.rgb;
    vec3 p3 = texel6.rgb;

    vec3 c0 = texel1.rgb;
    vec3 c1 = texel3.rgb;
    vec3 c2 = texel5.rgb;
    vec3 c3 = texel7.rgb;

    vec4 worldRadii = vec4(texel0.a, texel2.a, texel4.a, texel6.a);
    vec4 maxPixelRadii = vec4(texel1.a, texel3.a, texel5.a, texel7.a);

    // --- Topology ---
    int tri  = gl_VertexID / 3;
    int vert = gl_VertexID % 3;

    int quad = tri >> 1;
    int u = quad / vSegments;
    int v = quad % vSegments;

    ivec2 quadCorners[4] = ivec2[4](
        ivec2(u, v),
        ivec2(u + 1, v),
        ivec2(u + 1, (v + 1) % vSegments),
        ivec2(u, (v + 1) % vSegments)
    );

    int cornerIndex = LUT[(tri & 1) * 3 + vert];
    ivec2 uv = quadCorners[cornerIndex];

    float fu = float(uv.x) / float(uSegments);
    float fv = float(uv.y) / float(vSegments) * TAU;

    // --- Spline evaluation ---
    vec4 w = splineCoeffs(fu);

    v_color = w.x*c0 + w.y*c1 + w.z*c2 + w.w*c3;

    vec3 center = w.x*p0 + w.y*p1 + w.z*p2 + w.w*p3;
    vec3 T = tangentDirection(fu, p0, p1, p2, p3);
    vec3 T0 = tangentDirection(0.0, p0, p1, p2, p3);
    vec3 T1 = tangentDirection(1.0, p0, p1, p2, p3);
    vec3 N0 = buildNormal(T0);
    vec3 N1 = buildNormal(T1);

    float angle = acos(clamp(dot(N0, N1), -1.0, 1.0));
    float s = sin(angle);
    vec3 N = N0;
    if (s > 1e-5) {
        float w0 = sin((1.0 - fu) * angle) / s;
        float w1 = sin(fu * angle) / s;
        N = normalize(w0 * N0 + w1 * N1);
    }
    N = normalize(N - T * dot(T, N));
    vec3 B = cross(T, N);

    // --- Radius (screen-space capped) ---
    float worldRadius = dot(w, worldRadii);
    vec2 pixelRadiusBounds = vec2(minPixelRadius, dot(w, maxPixelRadii));
    vec3 viewPos = (modelViewMatrix * vec4(center, 1.0)).xyz;
    vec2 worldRadiusBounds = (pixelRadiusBounds * 2.0 / resolution.y) * (-viewPos.z) / projectionMatrix[1][1];
    // Not using clamp here to make sure lower bound dominates
    float r = max(min(worldRadius, worldRadiusBounds.y), worldRadiusBounds.x);  

    // --- Vertex position ---
    vec3 offset = cos(fv) * N + sin(fv) * B;
    vec3 pos = center + r * offset;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}