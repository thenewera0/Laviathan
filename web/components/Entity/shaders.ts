// GLSL for the Leviathan entity — a fluid volume displaced by layered
// simplex noise, skinned with thin-film iridescence over an abyssal base.
// State is not a switch: five weights (listen/think/speak/error + shared
// params) are eased on the CPU and blended continuously here.

export const SIMPLEX_NOISE = /* glsl */ `
// Simplex 3D noise — Ian McEwan / Ashima Arts (MIT)
vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

export const VERTEX_SHADER = /* glsl */ `
uniform float uTime;
uniform float uAmp;      // displacement amplitude (state-blended)
uniform float uFreq;     // noise spatial frequency
uniform float uFlow;     // accumulated flow time (state controls its speed)
uniform float uAudio;    // live amplitude 0..1
uniform float uListen;   // state weights, eased on CPU
uniform float uSpeak;
uniform float uError;

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vDisp;

${SIMPLEX_NOISE}

float surface(vec3 p) {
  // Domain warp: currents bending currents — fluid, never rubber-sheet
  vec3 warp = vec3(
    snoise(p * 0.9 + vec3(0.0, uFlow * 0.20, 0.0)),
    snoise(p * 0.9 + vec3(13.7, -uFlow * 0.15, 5.1)),
    snoise(p * 0.9 + vec3(7.3, 2.9, uFlow * 0.12))
  );
  vec3 q = p * uFreq + warp * 0.55 + vec3(0.0, uFlow * 0.30, uFlow * 0.08);

  float n = snoise(q) * 0.58;
  n += snoise(q * 2.05 - vec3(uFlow * 0.45, 0.0, uFlow * 0.18)) * 0.27;
  n += snoise(q * 4.3 + vec3(0.0, uFlow * 0.7, 0.0)) * 0.07;
  // A fine ripple that only exists while listening, driven by your voice
  n += snoise(p * 5.5 + vec3(0.0, uFlow * 2.2, 0.0)) * uAudio * uListen * 0.5;
  // Speaking: a coherent whole-body pulse rather than surface chop
  n += uAudio * uSpeak * 0.35;
  // Error: the surface stills and contracts
  return n * uAmp * (1.0 - uError * 0.6) - uError * 0.13;
}

vec3 displaced(vec3 p) {
  vec3 dir = normalize(p);
  return p + dir * surface(p);
}

void main() {
  // On a sphere, position is the normal — recompute true normals from
  // neighboring displaced points on the tangent plane.
  vec3 n = normalize(position);
  vec3 tangent = normalize(cross(n, abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 bitangent = cross(n, tangent);
  float eps = 0.03;

  vec3 p0 = displaced(position);
  vec3 p1 = displaced(position + tangent * eps);
  vec3 p2 = displaced(position + bitangent * eps);
  vec3 newNormal = normalize(cross(p1 - p0, p2 - p0));

  vDisp = surface(position);
  vNormal = normalize(normalMatrix * newNormal);

  vec4 mvPosition = modelViewMatrix * vec4(p0, 1.0);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const FRAGMENT_SHADER = /* glsl */ `
uniform float uTime;
uniform float uFlow;
uniform float uGlow;     // rim/iridescence intensity (state-blended)
uniform float uAudio;
uniform float uThink;    // state weights
uniform float uSpeak;
uniform float uError;

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vDisp;

${SIMPLEX_NOISE}

// Cosine palette tuned to an oil-slick drift: teal -> violet -> amber
// Cool thin-film: a cyclic gradient through indigo -> blue -> cyan ->
// violet. No green, no amber — the light stays deep-sea electric.
vec3 iridescence(float t) {
  t = fract(t);
  vec3 deepblue = vec3(0.04, 0.10, 0.34);
  vec3 blue     = vec3(0.14, 0.30, 0.88);
  vec3 violet   = vec3(0.22, 0.40, 0.98);
  vec3 orchid   = vec3(0.34, 0.62, 1.00);
  vec3 col;
  if (t < 0.33)      col = mix(deepblue, blue,   smoothstep(0.0, 0.33, t));
  else if (t < 0.66) col = mix(blue,     violet, smoothstep(0.33, 0.66, t));
  else               col = mix(violet,   orchid, smoothstep(0.66, 1.0, t));
  // fold back to deep blue so the bluish-violet cycle is seamless
  col = mix(col, deepblue, smoothstep(0.92, 1.0, t) * 0.6);
  return col;
}

float fbm(vec3 p) {
  float s = 0.55 * snoise(p);
  s += 0.28 * snoise(p * 2.1);
  s += 0.14 * snoise(p * 4.4);
  return s;
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewDir);
  float facing = max(dot(n, v), 0.0);
  float fresnel = pow(1.0 - facing, 2.2);

  // Blackish lead-silver skin: dark gunmetal deepening in the folds, lifting
  // to a cool brushed-lead sheen where it faces you. Kept deep so colour reads
  // as rich blue-violet, not washed lavender.
  vec3 base = mix(vec3(0.013, 0.015, 0.026), vec3(0.052, 0.062, 0.105), facing * 0.5 + vDisp * 1.2);

  // ---- INNER AURORA: the body is lit from within, never a dead void ----
  // Slow bioluminescent weather drifting under the skin, brightest where
  // you look straight into the mass.
  // Sparse luminous weather: mostly abyss-dark body, with drifting
  // bright currents — light must stay scarce to stay precious.
  float aur = fbm(n * 2.3 + vec3(0.0, uFlow * 0.45, uFlow * 0.12));
  float aur2 = fbm(n * 1.2 - vec3(uFlow * 0.2, 0.0, uFlow * 0.3));
  float currents = smoothstep(0.15, 0.75, aur);      // only the crests glow
  float innerAmt = pow(facing, 1.7) * (0.10 + 0.90 * currents) * uGlow;
  vec3 innerCol = mix(
    vec3(0.04, 0.11, 0.32),                       // deep blue body-light
    iridescence(aur2 * 0.5 + 0.42 + uFlow * 0.015), // drifting oil-slick hue
    0.40 + 0.35 * max(aur2, 0.0)
  );
  vec3 inner = innerCol * innerAmt * 0.5;

  // ---- luminous tide: a slow wave of light crossing the body (idle life)
  float tide = pow(0.5 + 0.5 * sin(dot(n, vec3(0.2, 1.0, 0.35)) * 3.5 - uFlow * 1.1), 5.0);
  inner += vec3(0.16, 0.16, 0.46) * tide * facing * uGlow * 0.35;

  // ---- thin-film sheen rides the fresnel band
  float filmPhase = fresnel * 1.15 + vDisp * 1.6 + uFlow * 0.03;
  vec3 sheen = iridescence(filmPhase) * fresnel * uGlow * 0.95;

  // ---- two drifting key lights give the surface sculpt and wet gleam
  vec3 l1 = normalize(vec3(sin(uFlow * 0.25), 0.65, cos(uFlow * 0.25)));
  vec3 l2 = normalize(vec3(-0.55, -0.35, 0.75));
  float spec = pow(max(dot(reflect(-l1, n), v), 0.0), 32.0) * 0.38
             + pow(max(dot(reflect(-l2, n), v), 0.0), 20.0) * 0.16;
  // metallic lead gleam: iridescent film tinted toward brushed silver
  vec3 specCol = mix(iridescence(filmPhase + 0.18), vec3(0.72, 0.76, 0.86), 0.32) * spec * uGlow;

  // ---- bioluminescent veins: faintly alive always, ablaze while thinking
  float veinField = snoise(n * 3.5 + vec3(0.0, uFlow * 0.9, 0.0));
  float veins = smoothstep(0.28, 0.02, abs(veinField)) * (0.16 + uThink);
  vec3 veinGlow = vec3(0.30, 0.56, 1.00) * veins * (0.35 + 0.65 * facing);

  // ---- speaking: emission swells with the voice
  float pulse = uAudio * uSpeak;
  vec3 col = base + inner + sheen * (1.0 + pulse * 1.6) + specCol + veinGlow;
  col += vec3(0.34, 0.60, 1.00) * (fresnel * 0.5 + facing * 0.25) * pulse;

  // ---- HEAT-HAZE: light breathes outward from the core in slow rings, and
  // the whole body's hue drifts like a mirage — always silently in motion.
  float heat = pow(0.5 + 0.5 * sin(facing * 9.0 - uFlow * 2.0), 2.2);
  float haze = fbm(n * 3.2 + vec3(0.0, uFlow * 0.7, uFlow * 0.25));
  vec3 heatCol = iridescence(filmPhase * 0.6 + heat * 0.22 + haze * 0.10 + uFlow * 0.03);
  col += heatCol * heat * pow(facing, 1.3) * uGlow * 0.18;
  // Sun-like radiant heat: hot blue-white energy pumping out from the core
  float radiate = pow(0.5 + 0.5 * sin(facing * 7.0 - uFlow * 2.6), 3.0) * pow(facing, 1.5);
  col += vec3(0.45, 0.72, 1.05) * radiate * (0.16 + uSpeak * 0.2 + uAudio * 0.25);
  vec3 mirageHue = iridescence(uFlow * 0.05) * (0.4 + 0.6 * facing);
  col = mix(col, mirageHue, 0.025 * (0.5 + 0.5 * sin(uFlow * 0.3)));

  // ---- error: heat leaves the body — desaturate, shift cold
  float grey = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 coldCol = mix(vec3(grey), vec3(grey * 0.7, grey * 0.85, grey * 1.25), 0.8);
  col = mix(col, coldCol + vec3(0.02, 0.04, 0.09) * fresnel, uError);

  gl_FragColor = vec4(col, 1.0);
}
`;

// Aura halo: an additive fresnel shell breathing just outside the body
export const AURA_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

export const AURA_FRAGMENT = /* glsl */ `
uniform float uFlow;
uniform float uGlow;
uniform float uError;
varying vec3 vNormal;
varying vec3 vViewDir;

// Cool thin-film: a cyclic gradient through indigo -> blue -> cyan ->
// violet. No green, no amber — the light stays deep-sea electric.
vec3 iridescence(float t) {
  t = fract(t);
  vec3 deepblue = vec3(0.04, 0.10, 0.34);
  vec3 blue     = vec3(0.14, 0.30, 0.88);
  vec3 violet   = vec3(0.22, 0.40, 0.98);
  vec3 orchid   = vec3(0.34, 0.62, 1.00);
  vec3 col;
  if (t < 0.33)      col = mix(deepblue, blue,   smoothstep(0.0, 0.33, t));
  else if (t < 0.66) col = mix(blue,     violet, smoothstep(0.33, 0.66, t));
  else               col = mix(violet,   orchid, smoothstep(0.66, 1.0, t));
  // fold back to deep blue so the bluish-violet cycle is seamless
  col = mix(col, deepblue, smoothstep(0.92, 1.0, t) * 0.6);
  return col;
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewDir);
  float rim = pow(1.0 - abs(dot(n, v)), 3.6);

  // radiant heat waves rippling out through the corona
  float wave = 0.5 + 0.5 * sin(rim * 9.0 - uFlow * 3.2);
  // solar prominences / ejections — lumpy tongues of light that flare and fade
  float f = sin(vNormal.x * 11.0 + uFlow * 1.3)
          * sin(vNormal.y * 10.0 - uFlow * 1.1)
          * sin(vNormal.z * 12.0 + uFlow * 0.7);
  float eject = pow(max(f, 0.0), 3.0);

  vec3 hot = vec3(0.42, 0.70, 1.05);            // hot blue-white heat
  vec3 col = hot * rim * uGlow * (0.4 + 0.5 * wave);
  col += vec3(0.70, 0.86, 1.10) * eject * rim * (1.1 + uGlow);  // ejections flare out
  col = mix(col, vec3(0.10, 0.16, 0.28) * rim, uError);

  float a = rim * (0.5 + eject * 0.7);
  gl_FragColor = vec4(col, a);
}
`;

// Floor pedestal stage: a bright core with concentric light rings, read as an
// ellipse in perspective. Seats the entity in the scene (Reference Image 1).
export const PEDESTAL_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const PEDESTAL_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uAudio;
varying vec2 vUv;

void main() {
  float dist = length(vUv - 0.5) * 2.0;              // 0 center .. 1 edge

  // white-blue core light pooling at the pedestal centre
  float core = pow(smoothstep(0.42, 0.0, dist), 3.0);

  // concentric graduation rings
  float rings = 0.0;
  rings += smoothstep(0.020, 0.0, abs(dist - 0.34));
  rings += smoothstep(0.020, 0.0, abs(dist - 0.56)) * 0.85;
  rings += smoothstep(0.026, 0.0, abs(dist - 0.80)) * 0.6;

  float sweep = 0.5 + 0.5 * sin(dist * 26.0 - uTime * 2.0);
  vec3 white  = vec3(0.85, 0.92, 1.00);
  vec3 blue   = vec3(0.30, 0.55, 1.00);
  vec3 violet = vec3(0.24, 0.62, 1.00);

  vec3 col = white * core * 2.2
           + mix(blue, violet, sweep) * rings * (1.1 + uAudio * 1.2);

  // faint radial floor wash so the stage doesn't end at a hard edge
  col += blue * 0.05 * smoothstep(1.0, 0.2, dist);

  float alpha = clamp(core * 1.3 + rings * 0.9 + 0.06, 0.0, 1.0)
              * smoothstep(1.08, 0.35, dist);
  gl_FragColor = vec4(col, alpha);
}
`;

// Spiral galaxy dust — dense log-spiral arms with a blazing blue life-core.
// The particle field (in Entity.tsx) sits on top for star density; this is
// the glowing gas the stars swim in.
export const GALAXY_VERTEX = /* glsl */ `
varying vec3 vLocalPos;
void main() {
  vLocalPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const GALAXY_FRAGMENT = /* glsl */ `
uniform float uFlow;
uniform float uAudio;
varying vec3 vLocalPos;

${SIMPLEX_NOISE}

const float RGAL = 3.6;

void main() {
  vec2 p = vLocalPos.xy;
  float r = length(p);
  float R = r / RGAL;
  if (R > 1.0) discard;
  float ang = atan(p.y, p.x);
  float spin = uFlow * 0.12;

  // two interleaved log-spiral arms -> dense, galactic
  float phase = 2.5 * ang - 4.0 * log(r + 0.2) - spin;
  float arms = pow(0.5 + 0.5 * cos(phase), 2.0)
             + 0.6 * pow(0.5 + 0.5 * cos(phase + 2.094), 2.0);

  // multi-scale dust grain for real, non-uniform density
  float g1 = snoise(vec3(p * 2.2, spin * 0.5));
  float g2 = snoise(vec3(p * 7.0, spin));
  float grain = (0.5 + 0.5 * g1) * (0.55 + 0.45 * (0.5 + 0.5 * g2));

  float rad = smoothstep(1.0, 0.14, R);
  float density = arms * grain * rad;

  // colour: blazing blue-white core -> cyan -> deep-blue arms, sparse warm flecks
  vec3 arm  = vec3(0.08, 0.30, 0.85);
  vec3 mid  = vec3(0.16, 0.55, 1.00);
  vec3 core = vec3(0.62, 0.86, 1.00);
  vec3 warm = vec3(0.95, 0.62, 0.30);
  vec3 col = mix(arm, mid, smoothstep(0.85, 0.2, R));
  col = mix(col, core, smoothstep(0.16, 0.0, R));
  col += warm * pow(max(g2, 0.0), 2.0) * 0.14 * smoothstep(0.9, 0.3, R);

  // blazing life-core
  float coreGlow = pow(smoothstep(0.26, 0.0, R), 2.6);
  col += vec3(0.5, 0.82, 1.05) * coreGlow * (2.2 + uAudio * 1.0);

  float alpha = clamp(density * 1.5 + coreGlow, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

// Upward light column — the core's energy pouring up into the entity above.
export const BEAM_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const BEAM_FRAGMENT = /* glsl */ `
uniform float uFlow;
uniform float uAudio;
varying vec2 vUv;

void main() {
  float x = abs(vUv.x - 0.5) * 2.0;   // 0 center .. 1 edge
  float up = vUv.y;                   // 0 base (core) .. 1 top (orb)
  float horiz = pow(smoothstep(1.0, 0.0, x), 1.6);
  float vert = mix(1.0, 0.15, up) * smoothstep(0.0, 0.12, up);
  float flick = 0.82 + 0.18 * sin(uFlow * 3.0 + up * 7.0);
  vec3 col = mix(vec3(0.80, 0.92, 1.05), vec3(0.35, 0.66, 1.05), up);
  float a = horiz * vert * flick * (0.7 + uAudio * 0.5);
  gl_FragColor = vec4(col, a);
}
`;
