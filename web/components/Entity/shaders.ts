// GLSL shaders for the Leviathan Super Core — a living glowing-particle sphere.
// Thousands of points on a sphere: a calm dotted grid across the face that
// erupts into travelling WAVES at the silhouette (Leviathan's signature
// motion), coloured blue (top) -> magenta (sides) -> red/gold (bottom), and
// driven by voice/state. Plus the floor pedestal ring stage (dashboard).

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

// --- GLOWING PARTICLE SPHERE (waves) ---
export const SPHERE_VERTEX = /* glsl */ `
uniform float uFlow;
uniform float uAmp;
uniform float uAudio;
uniform float uListen;
uniform float uThink;
uniform float uSpeak;
uniform float uError;
uniform float uGlow;
uniform float uSize;

varying vec3 vColor;
varying float vBright;

${SIMPLEX_NOISE}

void main() {
  vec3 dir = normalize(position);
  float lat = dir.y;
  float lon = atan(dir.z, dir.x);
  float t = uFlow;

  // Rim factor: 0 on the face, 1 at the silhouette (where waves erupt)
  vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 worldDir = normalize(mat3(modelMatrix) * dir);
  vec3 viewDirW = normalize(cameraPosition - worldPos);
  float rim = 1.0 - abs(dot(worldDir, viewDirW));

  // Travelling waves over the sphere surface
  float w1 = sin(lat * 8.0 - t * 2.5);
  float w2 = sin(lon * 4.0 + t * 1.8);
  float w3 = snoise(dir * 3.0 + vec3(0.0, t * 0.7, 0.0));
  float wave = w1 * 0.4 + w2 * 0.3 + w3 * 0.55;

  // Audio/state amplitude; crests fly out at the rim like the reference
  float amp = uAmp * 0.55 + uAudio * 0.6 + uSpeak * 0.15;
  float disp = wave * amp * (0.3 + rim * 1.7) * (1.0 - uError * 0.6);

  vec3 p = position * (1.0 + disp);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float crest = smoothstep(-0.2, 0.9, wave);
  gl_PointSize = uSize * (0.55 + rim * 1.3 + crest * 0.4) / max(-mv.z, 0.1);
  gl_Position = projectionMatrix * mv;

  // Colour gradient: blue (top) -> magenta (sides) -> red/gold (bottom)
  vec3 topC = vec3(0.30, 0.60, 1.00);
  vec3 midC = vec3(0.72, 0.20, 0.85);
  vec3 botC = vec3(1.00, 0.35, 0.20);
  float yy = dir.y * 0.5 + 0.5;
  vec3 c = yy > 0.5 ? mix(midC, topC, (yy - 0.5) * 2.0) : mix(botC, midC, yy * 2.0);
  vec3 gold = vec3(1.0, 0.75, 0.25);
  c = mix(c, gold, smoothstep(0.35, 0.0, yy) * crest * 0.6); // warm sparks at base

  vBright = 0.45 + rim * 1.1 + crest * 0.5 + uGlow * 0.25 + uThink * 0.2;
  vColor = c;

  if (uError > 0.5) {
    float g = dot(c, vec3(0.299, 0.587, 0.114));
    vColor = mix(c, vec3(g * 0.4, g * 0.55, g), uError * 0.8);
  }
}
`;

export const SPHERE_FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vBright;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.04, d);
  vec3 col = vColor * vBright;
  gl_FragColor = vec4(col, a);
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
