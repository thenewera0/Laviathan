"use client";

// The Leviathan entity — a living volume whose form IS its state.
// Idle: slow drifting currents. Listening: it leans toward you and ripples
// on your voice. Thinking: bioluminescent veins branch beneath the skin.
// Speaking: the whole body pulses with the voice. Error: it recoils, cold.

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useLeviathan, type EntityState } from "@/lib/store";
import {
  FRAGMENT_SHADER,
  VERTEX_SHADER,
} from "./shaders";

// ---- Scene framing (safe to tweak) --------------------------------------
const ORB_POS: [number, number, number] = [0, 0.12, 0];  // centre, slightly low
const ORB_SCALE = 0.92;                                   // a touch bigger
const CAM_POS: [number, number, number] = [0, 0.9, 5.0];  // pull back + above
const CAM_LOOK: [number, number, number] = [0, -0.25, 0]; // tilt down onto floor
const PEDESTAL_POS: [number, number, number] = [0, -1.15, 0];
// -------------------------------------------------------------------------

// Per-state targets; the CPU eases toward these every frame so state
// changes read as behavior, never as a cut.
const STATE_PARAMS: Record<
  EntityState,
  { amp: number; freq: number; flowSpeed: number; glow: number; scale: number }
> = {
  idle: { amp: 0.19, freq: 1.55, flowSpeed: 0.34, glow: 0.9, scale: 1.0 },
  listening: { amp: 0.24, freq: 1.95, flowSpeed: 0.6, glow: 1.15, scale: 1.04 },
  thinking: { amp: 0.2, freq: 2.5, flowSpeed: 1.5, glow: 1.0, scale: 0.98 },
  speaking: { amp: 0.15, freq: 1.7, flowSpeed: 0.7, glow: 1.3, scale: 1.02 },
  error: { amp: 0.07, freq: 1.2, flowSpeed: 0.1, glow: 0.32, scale: 0.86 },
};

const WEIGHT_KEYS: Array<[EntityState, string]> = [
  ["listening", "uListen"],
  ["thinking", "uThink"],
  ["speaking", "uSpeak"],
  ["error", "uError"],
];

function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

function EntityBody({ reducedMotion }: { reducedMotion: boolean }) {
  const mesh = useRef<THREE.Mesh>(null!);
  const flow = useRef(0);
  const smoothedAudio = useRef(0);
  const { pointer } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFlow: { value: 0 },
      uAmp: { value: STATE_PARAMS.idle.amp },
      uFreq: { value: STATE_PARAMS.idle.freq },
      uGlow: { value: STATE_PARAMS.idle.glow },
      uAudio: { value: 0 },
      uListen: { value: 0 },
      uThink: { value: 0 },
      uSpeak: { value: 0 },
      uError: { value: 0 },
    }),
    []
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const { entityState, audioLevel } = useLeviathan.getState();
    const p = STATE_PARAMS[entityState];
    const u = uniforms;

    // Flow time accumulates at a state-dependent rate: thinking races,
    // error nearly freezes. Reduced motion slows everything to a drift.
    const motionScale = reducedMotion ? 0.15 : 1;
    flow.current += dt * p.flowSpeed * motionScale;
    u.uTime.value += dt;
    u.uFlow.value = flow.current;

    // Audio envelope: fast attack, slow release — ripples land, then fade
    const target = reducedMotion ? 0 : audioLevel;
    smoothedAudio.current =
      target > smoothedAudio.current
        ? damp(smoothedAudio.current, target, 22, dt)
        : damp(smoothedAudio.current, target, 6, dt);
    u.uAudio.value = smoothedAudio.current;

    u.uAmp.value = damp(u.uAmp.value, p.amp, 3.5, dt);
    u.uFreq.value = damp(u.uFreq.value, p.freq, 3.5, dt);
    u.uGlow.value = damp(u.uGlow.value, p.glow, 4, dt);

    for (const [state, key] of WEIGHT_KEYS) {
      const uni = (u as Record<string, { value: number }>)[key];
      uni.value = damp(uni.value, entityState === state ? 1 : 0, 4.5, dt);
    }

    // Breathing scale + speech pulse
    const breathe = reducedMotion ? 0 : Math.sin(u.uTime.value * 0.55) * 0.014;
    const pulse = smoothedAudio.current * u.uSpeak.value * 0.055;
    const s = p.scale + breathe + pulse;
    mesh.current.scale.setScalar(damp(mesh.current.scale.x, s, 5, dt));

    // The whole mass turns, slowly — a body, not a decal
    mesh.current.rotation.z += dt * 0.02 * motionScale;

    // Gaze-follow: it looks at YOU when the webcam sees a face (MediaPipe,
    // on-device); the cursor is the stand-in otherwise.
    const face = useLeviathan.getState().facePos;
    const fx = face ? face.x : pointer.x;
    const fy = face ? face.y : pointer.y;
    const lean = (u.uListen.value * 0.35 + 0.06) * (face ? 1.4 : 1);
    mesh.current.position.x = damp(mesh.current.position.x, fx * lean, 3, dt);
    mesh.current.position.y = damp(mesh.current.position.y, fy * lean * 0.7, 3, dt);
    mesh.current.rotation.y = damp(mesh.current.rotation.y, fx * 0.25, 2.5, dt);
    mesh.current.rotation.x = damp(mesh.current.rotation.x, -fy * 0.18, 2.5, dt);
  });

  return (
    <group>
      <mesh ref={mesh}>
        <icosahedronGeometry args={[1, 64]} />
        <shaderMaterial
          vertexShader={VERTEX_SHADER}
          fragmentShader={FRAGMENT_SHADER}
          uniforms={uniforms}
        />
      </mesh>
      {/* aura shell removed — no surrounding circle; heat now radiates from
          the orb's own surface (see FRAGMENT_SHADER ejections). */}
    </group>
  );
}

// A vast, faint pressure-glow behind the entity — presence, not decoration
function BackGlow() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            float d = length(vUv - 0.5) * 2.0;
            float g = pow(smoothstep(1.0, 0.0, d), 2.6);
            float breathe = 0.85 + 0.15 * sin(uTime * 0.4);
            vec3 col = mix(vec3(0.010, 0.042, 0.062), vec3(0.022, 0.072, 0.115), g);
            gl_FragColor = vec4(col * g * breathe, g * 0.8);
          }`,
      }),
    []
  );

  useFrame((_, dt) => {
    material.uniforms.uTime.value += dt;
  });

  return (
    <mesh position={[0, 0, -2.5]} material={material}>
      <planeGeometry args={[11, 11]} />
    </mesh>
  );
}

// Marine snow: faint particulate drifting up past the entity, selling depth
function MarineSnow({ reducedMotion }: { reducedMotion: boolean }) {
  const points = useRef<THREE.Points>(null!);
  const count = 320;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 9;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 6;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 4 - 1;
    }
    return arr;
  }, []);

  useFrame((_, dt) => {
    if (reducedMotion) return;
    const pos = points.current.geometry.attributes.position;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += dt * 0.05 * (0.5 + ((i * 37) % 10) / 10);
      arr[i * 3] += Math.sin(arr[i * 3 + 1] * 0.8 + i) * dt * 0.01;
      if (arr[i * 3 + 1] > 3.2) arr[i * 3 + 1] = -3.2;
    }
    pos.needsUpdate = true;
    // The whole field orbits the entity, slowly — a current, not static dust
    points.current.rotation.y += dt * 0.015;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.015}
        color="#67e8dd"
        transparent
        opacity={0.35}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}



// 3D Glowing Celestial Concentric Orbital Rings at the base
function CelestialRings({ reducedMotion }: { reducedMotion: boolean }) {
  const ring1 = useRef<THREE.Mesh>(null!);
  const ring2 = useRef<THREE.Mesh>(null!);
  const ring3 = useRef<THREE.Mesh>(null!);

  useFrame((_, dt) => {
    if (reducedMotion) return;
    if (ring1.current) {
      ring1.current.rotation.z += dt * 0.35;
    }
    if (ring2.current) {
      ring2.current.rotation.z -= dt * 0.25;
    }
    if (ring3.current) {
      ring3.current.rotation.z += dt * 0.12;
    }
  });

  return (
    <group position={PEDESTAL_POS} scale={1.5} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Inner Ring — Electric Cyan */}
      <mesh ref={ring1}>
        <torusGeometry args={[1.45, 0.018, 32, 120]} />
        <meshBasicMaterial
          color="#5AFBFF"
          transparent
          opacity={0.88}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Middle Ring — Bright Electric Blue */}
      <mesh ref={ring2}>
        <torusGeometry args={[1.85, 0.014, 32, 120]} />
        <meshBasicMaterial
          color="#32C7FF"
          transparent
          opacity={0.78}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer Ring — Deep Electric Blue */}
      <mesh ref={ring3}>
        <torusGeometry args={[2.35, 0.010, 32, 120]} />
        <meshBasicMaterial
          color="#1F7BFF"
          transparent
          opacity={0.68}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

export default function Entity() {
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  return (
    <Canvas
      camera={{ position: CAM_POS, fov: 40 }}
      onCreated={({ camera }) => camera.lookAt(...CAM_LOOK)}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
      style={{ position: "absolute", inset: 0 }}
    >
      <BackGlow />
      <group position={ORB_POS} scale={ORB_SCALE}>
        <EntityBody reducedMotion={reducedMotion} />
      </group>
      <CelestialRings reducedMotion={reducedMotion} />
      <EffectComposer>
        <Bloom
          intensity={0.85}
          luminanceThreshold={0.12}
          luminanceSmoothing={0.6}
          mipmapBlur
        />
        <ChromaticAberration
          offset={new THREE.Vector2(0.0004, 0.0002)}
          radialModulation={false}
          modulationOffset={0}
        />
        <Vignette eskil={false} offset={0.18} darkness={0.72} />
      </EffectComposer>
    </Canvas>
  );
}
