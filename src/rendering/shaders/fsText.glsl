precision highp float;

uniform int numChars;
uniform sampler2D atlasTexture;
uniform vec2 unitRange;

in vec2 atlasCoords;
in vec3 color;

float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

void main() {
    vec3 msd = texture(atlasTexture, atlasCoords).rgb;
    float sd = median(msd.r, msd.g, msd.b) - 0.5;
    vec2 screenTexSize = vec2(1.0) / fwidth(atlasCoords);
    float screenPxRange = max(dot(unitRange, screenTexSize), 1.0);
    float screenPxDistance = screenPxRange * sd;
    float alpha = clamp(screenPxDistance + 0.5, 0.0, 1.0);

    // Opacity does not work correctly but no easy solution
    if (alpha > 0.2) {
        gl_FragColor = vec4(color, alpha);
    } else {
        discard;
    }
}