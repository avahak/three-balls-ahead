precision highp float;

uniform int numChars;
uniform int useFisheye;
uniform float focalLength;
uniform sampler2D dataTexture;

out vec2 atlasCoords;
out vec3 color;

#define TEXTURE_MAX_WIDTH 1024

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
    // Read data
    int iIndex = 4 * gl_InstanceID;
    ivec2 texelIndex0 = ivec2(iIndex % TEXTURE_MAX_WIDTH, iIndex / TEXTURE_MAX_WIDTH);
    ivec2 texelIndex1 = ivec2((iIndex+1) % TEXTURE_MAX_WIDTH, (iIndex+1) / TEXTURE_MAX_WIDTH);
    ivec2 texelIndex2 = ivec2((iIndex+2) % TEXTURE_MAX_WIDTH, (iIndex+2) / TEXTURE_MAX_WIDTH);
    ivec2 texelIndex3 = ivec2((iIndex+3) % TEXTURE_MAX_WIDTH, (iIndex+3) / TEXTURE_MAX_WIDTH);
    vec4 tf0 = texelFetch(dataTexture, texelIndex0, 0);
    vec4 tf1 = texelFetch(dataTexture, texelIndex1, 0);
    vec4 tf2 = texelFetch(dataTexture, texelIndex2, 0);
    vec4 tf3 = texelFetch(dataTexture, texelIndex3, 0);

    // Unpack values
    vec4 atlas4 = tf0;
    vec3 posCenter = tf1.xyz;
    vec3 e1 = vec3(tf1.w, tf2.xy);
    vec3 e2 = vec3(tf2.zw, tf3.x);
    int faceCamera = int(floor(0.25+0.5*tf3.y));
    color = vec3(tf3.y - 2.0*float(faceCamera), tf3.zw);

    vec2 vUv = position.xy;
    atlasCoords = atlas4.xy + vUv*(atlas4.zw - atlas4.xy);

    vec4 vPos;
    if (faceCamera == 0) {
        vPos = vec4(posCenter + (vUv.x-0.5)*e1 + (vUv.y-0.5)*e2, 1.0);
    } else {
        // Text is made to face the camera
        mat4 mat = inverse(projectionMatrix * modelViewMatrix); // could be precomputed
        vec3 w1 = normalize(mat[0].xyz);
        vec3 w2 = normalize(mat[1].xyz);
        if (useFisheye == 0) {
            vPos = vec4(posCenter + (e1.x+e1.y*vUv.x)*w1 + (e2.x+e2.y*vUv.y)*w2, 1.0);
        } else {
            // BUG text size is computed wrong here
            posCenter = fisheyeStereographic((modelViewMatrix * vec4(posCenter, 1.0)).xyz);
            vPos = vec4((e1.x+e1.y*vUv.x)*w1 + (e2.x+e2.y*vUv.y)*w2, 0.0);
            gl_Position = projectionMatrix * (vec4(posCenter, 1.0) + focalLength*modelViewMatrix * vPos);
            return;
        }
    }
    if (useFisheye == 0) {
        gl_Position = projectionMatrix * modelViewMatrix * vPos;
    } else {
        vec3 q = (modelViewMatrix * vPos).xyz;
        vec3 qFisheye = fisheyeStereographic(q);
        gl_Position = projectionMatrix * vec4(qFisheye, 1.0);
    }
}