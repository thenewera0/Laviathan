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
  vec3 indigo = vec3(0.10, 0.16, 0.55);
  vec3 blue   = vec3(0.12, 0.40, 0.95);
  vec3 cyan   = vec3(0.30, 0.82, 1.00);
  vec3 violet = vec3(0.52, 0.28, 0.92);
  vec3 col;
  if (t < 0.33)      col = mix(indigo, blue,   smoothstep(0.0, 0.33, t));
  else if (t < 0.66) col = mix(blue,   cyan,   smoothstep(0.33, 0.66, t));
  else               col = mix(cyan,   violet, smoothstep(0.66, 1.0, t));
  // gently fold violet back to indigo so the cycle is seamless
  col = mix(col, indigo, smoothstep(0.92, 1.0, t) * 0.6);
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

  // Abyssal skin, deepening where the surface folds inward — blue-leaning
  // teal, never olive
  vec3 base = mix(vec3(0.007, 0.020, 0.034), vec3(0.014, 0.060, 0.088), facing * 0.5 + vDisp * 1.2);

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
    vec3(0.03, 0.19, 0.32),                       // deep cyan-blue body-light
    iridescence(aur2 * 0.5 + 0.42 + uFlow * 0.015), // drifting oil-slick hue
    0.40 + 0.35 * max(aur2, 0.0)
  );
  vec3 inner = innerCol * innerAmt * 0.5;

  // ---- luminous tide: a slow wave of light crossing the body (idle life)
  float tide = pow(0.5 + 0.5 * sin(dot(n, vec3(0.2, 1.0, 0.35)) * 3.5 - uFlow * 1.1), 5.0);
  inner += vec3(0.08, 0.34, 0.46) * tide * facing * uGlow * 0.35;

  // ---- thin-film sheen rides the fresnel band
  float filmPhase = fresnel * 1.15 + vDisp * 1.6 + uFlow * 0.03;
  vec3 sheen = iridescence(filmPhase) * fresnel * uGlow * 0.95;

  // ---- two drifting key lights give the surface sculpt and wet gleam
  vec3 l1 = normalize(vec3(sin(uFlow * 0.25), 0.65, cos(uFlow * 0.25)));
  vec3 l2 = normalize(vec3(-0.55, -0.35, 0.75));
  float spec = pow(max(dot(reflect(-l1, n), v), 0.0), 32.0) * 0.38
             + pow(max(dot(reflect(-l2, n), v), 0.0), 20.0) * 0.16;
  vec3 specCol = iridescence(filmPhase + 0.18) * spec * uGlow;

  // ---- bioluminescent veins: faintly alive always, ablaze while thinking
  float veinField = snoise(n * 3.5 + vec3(0.0, uFlow * 0.9, 0.0));
  float veins = smoothstep(0.28, 0.02, abs(veinField)) * (0.16 + uThink);
  vec3 veinGlow = vec3(0.30, 0.72, 1.00) * veins * (0.35 + 0.65 * facing);

  // ---- speaking: emission swells with the voice
  float pulse = uAudio * uSpeak;
  vec3 col = base + inner + sheen * (1.0 + pulse * 1.6) + specCol + veinGlow;
  col += vec3(0.32, 0.74, 1.00) * (fresnel * 0.5 + facing * 0.25) * pulse;

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
  vec3 indigo = vec3(0.10, 0.16, 0.55);
  vec3 blue   = vec3(0.12, 0.40, 0.95);
  vec3 cyan   = vec3(0.30, 0.82, 1.00);
  vec3 violet = vec3(0.52, 0.28, 0.92);
  vec3 col;
  if (t < 0.33)      col = mix(indigo, blue,   smoothstep(0.0, 0.33, t));
  else if (t < 0.66) col = mix(blue,   cyan,   smoothstep(0.33, 0.66, t));
  else               col = mix(cyan,   violet, smoothstep(0.66, 1.0, t));
  // gently fold violet back to indigo so the cycle is seamless
  col = mix(col, indigo, smoothstep(0.92, 1.0, t) * 0.6);
  return col;
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewDir);
  float rim = pow(1.0 - abs(dot(n, v)), 4.5);
  float breathe = 0.85 + 0.15 * sin(uFlow * 0.6);
  // Cold bioluminescent haze, not a planetary ring — teal-dominant, soft
  vec3 hue = mix(iridescence(rim * 0.9 + uFlow * 0.02), vec3(0.18, 0.45, 0.85), 0.55);
  vec3 col = hue * rim * uGlow * 0.30 * breathe;
  col = mix(col, vec3(0.10, 0.16, 0.28) * rim, uError);
  gl_FragColor = vec4(col, rim * 0.5);
}
`;
