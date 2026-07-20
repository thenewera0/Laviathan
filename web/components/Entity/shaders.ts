// GLSL Shaders for Leviathan 3D Void Core (Reference Image 1)
// - Central Singularity Core (white/magenta glowing heart)
// - Gyroscopic / Gimbal Concentric Rings with tick marks & markers
// - Dual Swirling Cosmic Accretion Arms (Electric Blue/Violet vs Amber/Gold)
// - Vertical Axis Beam & Terminal Nodes
// - Floor Pedestal Ring Stage

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

// --- SINGULARITY CORE SHADER ---
export const CORE_VERTEX = /* glsl */ `
uniform float uTime;
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
varying float vDisp;

${SIMPLEX_NOISE}

float surface(vec3 p) {
  vec3 q = p * uFreq + vec3(0.0, uFlow * 0.4, uFlow * 0.2);
  float n = snoise(q) * 0.35;
  n += snoise(q * 2.5 - vec3(uFlow * 0.5, 0.0, 0.0)) * 0.15;
  n += uAudio * uListen * 0.35 + uAudio * uSpeak * 0.25;
  return n * uAmp * (1.0 - uError * 0.5);
}

void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  float disp = surface(position);
  vDisp = disp;
  vec3 p = position + normal * disp;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const CORE_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uFlow;
uniform float uGlow;
uniform float uAudio;
uniform float uThink;
uniform float uSpeak;
uniform float uListen;
uniform float uError;

varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vPosition;
varying float vDisp;

${SIMPLEX_NOISE}

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewDir);
  float facing = max(dot(n, v), 0.0);
  float fresnel = pow(1.0 - facing, 2.5);

  // Dark singularity heart (Absolute Black Hole)
  vec3 col = vec3(0.01, 0.01, 0.02);

  // Intense event horizon corona rim
  vec3 coronaCyan = vec3(0.1, 0.5, 1.0);
  vec3 coronaPurple = vec3(0.6, 0.2, 1.0);
  vec3 coronaMix = mix(coronaCyan, coronaPurple, uThink * 0.5 + uAudio * 0.5);
  
  col += coronaMix * fresnel * (1.2 + uGlow * 1.5 + uSpeak * 1.0);

  // Surface energy veins (Subtle creeping energy)
  float veinNoise = snoise(vPosition * 8.0 - vec3(0.0, uFlow * 1.5, 0.0));
  float veins = smoothstep(0.2, 0.0, abs(veinNoise)) * fresnel;
  col += vec3(0.2, 0.7, 1.0) * veins * (0.2 + uThink * 1.0);

  // Cold error state desaturation
  float grey = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(grey * 0.4, grey * 0.6, grey * 1.2), uError * 0.85);

  gl_FragColor = vec4(col, 0.98);
}
`;

// --- GYRO RINGS SHADER ---
export const RING_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vLocalPos;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vUv = uv;
  vLocalPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const RING_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uFlow;
uniform float uRingColorType; // 0: Cyan/Blue, 1: Gold/Amber, 2: Dark Metallic
uniform float uAudio;

varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vLocalPos;

void main() {
  float ang = atan(vLocalPos.y, vLocalPos.x);
  
  // Tick mark graduations around circumference
  float ticks = abs(sin(ang * 48.0));
  float tickMask = smoothstep(0.92, 0.99, ticks);

  // Sub-ticks
  float subTicks = abs(sin(ang * 240.0));
  float subTickMask = smoothstep(0.95, 0.99, subTicks) * 0.4;

  // Pulse along the ring
  float pulse = sin(ang * 4.0 - uFlow * 2.5) * 0.5 + 0.5;
  pulse = pow(pulse, 4.0); // Sharper pulse

  vec3 baseColor = vec3(0.01, 0.01, 0.02); // Darker metallic base
  vec3 tickColor = vec3(0.1, 0.6, 1.0);

  if (uRingColorType > 0.5 && uRingColorType < 1.5) {
    // Gold/Amber ring accents
    tickColor = vec3(1.0, 0.6, 0.1);
  } else if (uRingColorType >= 1.5) {
    // Purple/Cyan ring accents
    tickColor = vec3(0.6, 0.2, 1.0);
  }

  vec3 col = baseColor + tickColor * (tickMask + subTickMask + pulse * 0.6) * (1.0 + uAudio * 1.0);
  float alpha = 0.8 + (tickMask + subTickMask) * 0.2;

  gl_FragColor = vec4(col, alpha);
}
`;

// --- ACCRETION ARM SHADER ---
export const ACCRETION_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uFlow;
varying vec3 vPosition;
varying vec2 vUv;

${SIMPLEX_NOISE}

void main() {
  vUv = uv;
  vec3 p = position;
  
  // Spiral displacement
  float noiseVal = snoise(p * 1.5 + vec3(uFlow * 0.5, uFlow * 0.3, 0.0));
  p += normal * noiseVal * 0.15;

  vPosition = p;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const ACCRETION_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uFlow;
uniform float uArmType; // 0: Blue/Purple, 1: Gold/Amber
uniform float uAudio;

varying vec3 vPosition;
varying vec2 vUv;

${SIMPLEX_NOISE}

void main() {
  float n = snoise(vPosition * 4.0 + vec3(0.0, uFlow * 1.5, uFlow * 0.5));
  float alpha = smoothstep(-0.1, 0.4, n) * smoothstep(1.0, 0.0, abs(vUv.y - 0.5) * 3.0);
  
  // Make the dust strands look more particle-like by multiplying by high frequency noise
  float fineDust = snoise(vPosition * 20.0 + uFlow * 3.0);
  alpha *= smoothstep(0.1, 0.9, fineDust * 0.5 + 0.5) * 1.5;

  vec3 colorBlueViolet = mix(vec3(0.1, 0.6, 1.0), vec3(0.6, 0.1, 1.0), sin(vPosition.x * 2.0 + uFlow) * 0.5 + 0.5);
  vec3 colorGoldAmber = mix(vec3(1.0, 0.8, 0.1), vec3(1.0, 0.3, 0.0), sin(vPosition.x * 2.0 + uFlow) * 0.5 + 0.5);

  vec3 col = (uArmType < 0.5) ? colorBlueViolet : colorGoldAmber;
  col *= (1.5 + n * 0.8 + uAudio * 1.5);

  gl_FragColor = vec4(col, alpha);
}
`;

// --- VERTICAL AXIS SHADER ---
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
uniform float uTime;
uniform float uFlow;
uniform float uAudio;
varying vec3 vPosition;
varying vec2 vUv;

void main() {
  // Pulsing energy wave up and down the axis cylinder/line
  float wave = sin(vPosition.y * 8.0 - uFlow * 5.0) * 0.5 + 0.5;
  vec3 cyanColor = vec3(0.35, 0.85, 1.0);
  vec3 coreWhite = vec3(0.95, 0.98, 1.0);

  vec3 col = mix(cyanColor, coreWhite, wave) * (1.2 + uAudio * 1.0);
  float edge = smoothstep(0.5, 0.0, abs(vUv.x - 0.5));

  gl_FragColor = vec4(col, edge * 0.9);
}
`;

// --- FLOOR PEDESTAL STAGE SHADER ---
export const PEDESTAL_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const PEDESTAL_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uFlow;
uniform float uAudio;
varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  float dist = length(vUv - vec2(0.5));
  
  // Concentric ring lights on the floor pedestal stage
  float ring1 = smoothstep(0.01, 0.0, abs(dist - 0.15));
  float ring2 = smoothstep(0.012, 0.0, abs(dist - 0.30));
  float ring3 = smoothstep(0.015, 0.0, abs(dist - 0.45));

  float radialGlow = smoothstep(0.5, 0.0, dist);
  float wave = sin(dist * 40.0 - uFlow * 3.0) * 0.5 + 0.5;

  vec3 cyanGlow = vec3(0.15, 0.65, 0.95);
  vec3 blueGlow = vec3(0.4, 0.25, 0.95);

  vec3 col = mix(cyanGlow, blueGlow, wave) * (ring1 * 2.5 + ring2 * 2.0 + ring3 * 1.5 + radialGlow * 0.3);
  col *= (1.0 + uAudio * 1.0);

  float alpha = (ring1 + ring2 + ring3) * 0.8 + radialGlow * 0.25;

  gl_FragColor = vec4(col, alpha);
}
`;
