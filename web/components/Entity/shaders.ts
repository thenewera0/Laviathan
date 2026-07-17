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
  // Two octaves of drifting currents...
  float n = snoise(p * uFreq + vec3(0.0, uFlow * 0.35, uFlow * 0.1)) * 0.62;
  n += snoise(p * uFreq * 2.15 - vec3(uFlow * 0.5, 0.0, uFlow * 0.2)) * 0.26;
  // ...plus a fine ripple that only exists while listening, driven by your voice
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
vec3 iridescence(float t) {
  vec3 a = vec3(0.32, 0.36, 0.40);
  vec3 b = vec3(0.42, 0.34, 0.32);
  vec3 c = vec3(0.90, 1.00, 0.85);
  vec3 d = vec3(0.55, 0.30, 0.08);
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewDir);
  float facing = max(dot(n, v), 0.0);
  float fresnel = pow(1.0 - facing, 2.4);

  // Abyssal body: near-black teal, deepening where the surface folds inward
  vec3 base = mix(vec3(0.008, 0.022, 0.024), vec3(0.020, 0.068, 0.072), facing * 0.6 + vDisp * 1.2);

  // Thin-film sheen rides the fresnel band and drifts slowly
  float filmPhase = fresnel * 1.15 + vDisp * 1.6 + uFlow * 0.03;
  vec3 sheen = iridescence(filmPhase) * fresnel * uGlow;

  // Thinking: bioluminescent veins branch beneath the skin
  float veinField = snoise(n * 3.5 + vec3(0.0, uFlow * 0.9, 0.0));
  float veins = smoothstep(0.28, 0.02, abs(veinField)) * uThink;
  vec3 veinGlow = vec3(0.35, 0.95, 0.86) * veins * (0.35 + 0.65 * facing);

  // Speaking: emission swells with the voice
  float pulse = uAudio * uSpeak;
  vec3 col = base + sheen * (1.0 + pulse * 1.6) + veinGlow;
  col += vec3(0.40, 0.90, 0.82) * fresnel * pulse * 0.5;

  // Error: heat leaves the body — desaturate, shift cold
  float grey = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 coldCol = mix(vec3(grey), vec3(grey * 0.7, grey * 0.85, grey * 1.25), 0.8);
  col = mix(col, coldCol + vec3(0.02, 0.04, 0.09) * fresnel, uError);

  gl_FragColor = vec4(col, 1.0);
}
`;
