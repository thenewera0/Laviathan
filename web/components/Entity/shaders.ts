// GLSL Shaders for the Leviathan Super Core — a living galactic singularity.
// Reconstructs Reference Image 1 as a real-time, audio-reactive 3D disk:
// - Tilted accretion disk with log-spiral arms (blue/violet vs gold/amber)
// - Bright gold-white event horizon + dark singularity heart
// - Central violet flare with a gold twist streak
// - Tick-marked concentric dial rings (coplanar with the disk)
// - Vertical illuminated axis beam with terminal nodes
// - Floor pedestal ring stage (dashboard context, Reference Image 2)

export const SIMPLEX_NOISE = /* glsl */ `
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

// --- SINGULARITY CORE (dark heart + gold-white event horizon rim) ---
export const CORE_VERTEX = /* glsl */ `
uniform float uFlow;
uniform float uAmp;
uniform float uFreq;
uniform float uAudio;
uniform float uListen;
uniform float uSpeak;
uniform float uError;

varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vPosition;

${SIMPLEX_NOISE}

float surface(vec3 p) {
  vec3 q = p * uFreq + vec3(0.0, uFlow * 0.4, uFlow * 0.2);
  float n = snoise(q) * 0.3;
  n += snoise(q * 2.5 - vec3(uFlow * 0.5, 0.0, 0.0)) * 0.12;
  n += uAudio * uListen * 0.3 + uAudio * uSpeak * 0.2;
  return n * uAmp * (1.0 - uError * 0.5);
}

void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  vec3 p = position + normal * surface(position);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const CORE_FRAGMENT = /* glsl */ `
uniform float uFlow;
uniform float uGlow;
uniform float uAudio;
uniform float uThink;
uniform float uSpeak;
uniform float uError;

varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vPosition;

${SIMPLEX_NOISE}

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewDir);
  float facing = max(dot(n, v), 0.0);
  float fresnel = pow(1.0 - facing, 3.0);

  // Absolute black-hole heart
  vec3 col = vec3(0.006, 0.006, 0.012);

  // Gold-white event-horizon rim, cooling to cyan when thinking
  vec3 rim = mix(vec3(1.0, 0.82, 0.5), vec3(0.45, 0.72, 1.0), uThink * 0.55);
  col += rim * fresnel * (1.0 + uGlow * 1.3 + uSpeak * 0.9 + uAudio * 0.8);

  // Faint infalling filaments
  float vein = snoise(vPosition * 7.0 - vec3(0.0, uFlow * 1.4, 0.0));
  col += vec3(0.5, 0.35, 1.0) * smoothstep(0.25, 0.0, abs(vein)) * fresnel * (0.15 + uThink * 0.8);

  // Cold error desaturation
  float grey = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(grey * 0.4, grey * 0.6, grey * 1.2), uError * 0.85);

  gl_FragColor = vec4(col, 0.99);
}
`;

// --- ACCRETION DISK (tilted log-spiral galaxy) ---
export const DISK_VERTEX = /* glsl */ `
varying vec3 vLocalPos;
void main() {
  vLocalPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const DISK_FRAGMENT = /* glsl */ `
uniform float uFlow;
uniform float uAudio;
uniform float uGlow;
uniform float uThink;

varying vec3 vLocalPos;

${SIMPLEX_NOISE}

const float DISK_R = 2.4;   // outer radius in local units
const float HOLE   = 0.11;  // normalized inner hole (singularity sits here)

void main() {
  float r = length(vLocalPos.xy);
  float R = r / DISK_R;
  if (R > 1.06 || R < HOLE) discard;

  float ang = atan(vLocalPos.y, vLocalPos.x);

  // Two-arm logarithmic spiral; gold arm is the opposite arm of the pair
  float armPhase = 2.0 * ang - 3.2 * log(r + 0.15) - uFlow * 0.8;
  float blueArm = pow(0.5 + 0.5 * cos(armPhase), 3.0);
  float goldArm = pow(0.5 + 0.5 * cos(armPhase + 3.14159), 3.0);

  // Particle-like grain along the arms
  float g1 = snoise(vec3(vLocalPos.xy * 3.5, uFlow * 0.3));
  float g2 = snoise(vec3(vLocalPos.xy * 11.0, uFlow * 0.6));
  float grain = (0.55 + 0.45 * g1) * (0.6 + 0.4 * (0.5 + 0.5 * g2));

  // Radial brightness: fade toward hole and outer edge, brightest mid-inner
  float rad = smoothstep(1.06, 0.28, R) * smoothstep(HOLE, 0.2, R);

  // Violet tint on the blue arm toward the upper-left
  float vio = smoothstep(0.1, 1.0, 0.5 + 0.5 * sin(ang + 2.2));
  vec3 blue   = vec3(0.13, 0.42, 1.0);
  vec3 violet = vec3(0.5, 0.16, 1.0);
  vec3 gold   = vec3(1.0, 0.62, 0.14);

  vec3 col = blueArm * mix(blue, violet, vio) + goldArm * gold;
  col *= grain * rad;

  // Fine radial spokes
  float spokes = pow(0.5 + 0.5 * cos(ang * 90.0), 24.0) * 0.12 * smoothstep(1.0, 0.35, R);
  col += vec3(0.3, 0.55, 1.0) * spokes;

  // Bright gold-white event horizon inner rim
  float horizon = smoothstep(0.03, 0.0, abs(R - 0.135));
  col += vec3(1.0, 0.85, 0.55) * horizon * 2.2;

  col *= (1.1 + uGlow * 0.5 + uThink * 0.3 + uAudio * 1.2);

  float alpha = clamp((blueArm + goldArm) * grain * rad * 1.4 + horizon + spokes, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

// --- CENTRAL FLARE (violet singularity glow + gold twist streak) ---
export const FLARE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const FLARE_FRAGMENT = /* glsl */ `
uniform float uFlow;
uniform float uAudio;
uniform float uSpeak;
uniform float uError;
varying vec2 vUv;

void main() {
  vec2 p = vUv - 0.5;
  float r = length(p);

  float glow = smoothstep(0.5, 0.0, r);
  vec3 col = vec3(0.72, 0.32, 1.0) * pow(glow, 2.2) * (2.0 + uSpeak * 1.6 + uAudio * 1.6);

  // Gold S-twist crossing the center
  float streak = smoothstep(0.045, 0.0, abs(p.y - sin(p.x * 10.0 + uFlow * 1.5) * 0.06))
               * smoothstep(0.45, 0.0, r);
  col += vec3(1.0, 0.72, 0.3) * streak * 1.7;

  col = mix(col, vec3(0.2, 0.25, 0.4) * glow, uError * 0.8);

  float alpha = clamp(pow(glow, 2.2) + streak, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

// --- CONCENTRIC DIAL RINGS (tick-marked, coplanar with the disk) ---
export const RING_VERTEX = /* glsl */ `
varying vec3 vLocalPos;
void main() {
  vLocalPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const RING_FRAGMENT = /* glsl */ `
uniform float uFlow;
uniform float uRingColorType; // 0: Cyan/Blue, 1: Gold/Amber, 2: Violet
uniform float uAudio;

varying vec3 vLocalPos;

void main() {
  float ang = atan(vLocalPos.y, vLocalPos.x);

  float ticks = abs(sin(ang * 48.0));
  float tickMask = smoothstep(0.92, 0.99, ticks);

  float subTicks = abs(sin(ang * 240.0));
  float subTickMask = smoothstep(0.95, 0.99, subTicks) * 0.4;

  float pulse = sin(ang * 4.0 - uFlow * 2.5) * 0.5 + 0.5;
  pulse = pow(pulse, 4.0);

  vec3 baseColor = vec3(0.01, 0.02, 0.04);
  vec3 tickColor = vec3(0.35, 0.7, 1.0);
  if (uRingColorType > 0.5 && uRingColorType < 1.5) {
    tickColor = vec3(1.0, 0.68, 0.2);
  } else if (uRingColorType >= 1.5) {
    tickColor = vec3(0.6, 0.25, 1.0);
  }

  vec3 col = baseColor + tickColor * (tickMask + subTickMask + pulse * 0.5) * (1.0 + uAudio * 0.9);
  float alpha = 0.55 + (tickMask + subTickMask) * 0.45;
  gl_FragColor = vec4(col, alpha);
}
`;

// --- VERTICAL AXIS BEAM ---
export const AXIS_VERTEX = /* glsl */ `
varying vec3 vPosition;
varying vec2 vUv;
void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const AXIS_FRAGMENT = /* glsl */ `
uniform float uFlow;
uniform float uAudio;
varying vec3 vPosition;
varying vec2 vUv;

void main() {
  float wave = sin(vPosition.y * 8.0 - uFlow * 5.0) * 0.5 + 0.5;
  vec3 cyan = vec3(0.4, 0.85, 1.0);
  vec3 white = vec3(0.95, 0.98, 1.0);
  vec3 col = mix(cyan, white, wave) * (1.3 + uAudio * 1.1);

  // brighten toward the center crossing
  float center = smoothstep(1.6, 0.0, abs(vPosition.y));
  col += white * center * 0.6;

  float edge = smoothstep(0.5, 0.0, abs(vUv.x - 0.5));
  gl_FragColor = vec4(col, edge * (0.55 + center * 0.4));
}
`;

// --- FLOOR PEDESTAL STAGE ---
export const PEDESTAL_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const PEDESTAL_FRAGMENT = /* glsl */ `
uniform float uFlow;
uniform float uAudio;
varying vec2 vUv;

void main() {
  float dist = length(vUv - vec2(0.5));
  float ring1 = smoothstep(0.01, 0.0, abs(dist - 0.15));
  float ring2 = smoothstep(0.012, 0.0, abs(dist - 0.30));
  float ring3 = smoothstep(0.015, 0.0, abs(dist - 0.45));
  float radialGlow = smoothstep(0.5, 0.0, dist);
  float wave = sin(dist * 40.0 - uFlow * 3.0) * 0.5 + 0.5;

  vec3 cyanGlow = vec3(0.15, 0.65, 0.95);
  vec3 blueGlow = vec3(0.4, 0.25, 0.95);
  vec3 col = mix(cyanGlow, blueGlow, wave) * (ring1 * 2.5 + ring2 * 2.0 + ring3 * 1.5 + radialGlow * 0.3);
  col *= (1.0 + uAudio * 1.0);

  float alpha = (ring1 + ring2 + ring3) * 0.7 + radialGlow * 0.2;
  gl_FragColor = vec4(col, alpha);
}
`;
