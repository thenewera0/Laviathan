"use client";

// The Leviathan Super Core — a living glowing-particle sphere.
// Thousands of points on a sphere form a calm dotted face that erupts into
// travelling waves at the silhouette — Leviathan's signature motion — coloured
// blue (top) -> magenta (sides) -> red/gold (bottom), reacting to voice/state.
// Floats over the floor pedestal stage (dashboard layout).

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
  PEDESTAL_FRAGMENT,
  PEDESTAL_VERTEX,
  SPHERE_FRAGMENT,
  SPHERE_VERTEX,
} from "./shaders";

// ---- Scene tuning (safe to tweak) ---------------------------------------
const SPHERE_RADIUS = 1.35;    // orb size
const PARTICLE_COUNT = 7000;   // dot density on the sphere
const POINT_SIZE = 9.0;        // base dot size (perspective-scaled)
// -------------------------------------------------------------------------

const STATE_PARAMS: Record<
  EntityState,
  { amp: number; freq: number; flowSpeed: number; glow: number; scale: number }
> = {
  idle: { amp: 0.35, freq: 1.55, flowSpeed: 0.34, glow: 0.9, scale: 1.0 },
  listening: { amp: 0.55, freq: 1.95, flowSpeed: 0.6, glow: 1.2, scale: 1.05 },
  thinking: { amp: 0.45, freq: 2.5, flowSpeed: 1.7, glow: 1.1, scale: 0.98 },
  speaking: { amp: 0.5, freq: 1.7, flowSpeed: 0.9, glow: 1.35, scale: 1.03 },
  error: { amp: 0.12, freq: 1.2, flowSpeed: 0.12, glow: 0.3, scale: 0.9 },
};

function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

type U = Record<string, { value: number }>;

// --- GLOWING PARTICLE SPHERE ----------------------------------------------
function WaveParticleSphere({ uniforms }: { uniforms: U }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3);
    const golden = Math.PI * (1 + Math.sqrt(5));
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Fibonacci sphere — even coverage, no pole clumping
      const phi = Math.acos(1 - (2 * (i + 0.5)) / PARTICLE_COUNT);
      const theta = golden * i;
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);
      arr[i * 3] = x * SPHERE_RADIUS;
      arr[i * 3 + 1] = y * SPHERE_RADIUS;
      arr[i * 3 + 2] = z * SPHERE_RADIUS;
    }
    return arr;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={SPHERE_VERTEX}
        fragmentShader={SPHERE_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// --- FLOOR PEDESTAL STAGE --------------------------------------------------
function FloorPedestalStage({ uniforms }: { uniforms: U }) {
  return (
    <group position={[0, -2.0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7.0, 7.0]} />
        <shaderMaterial
          vertexShader={PEDESTAL_VERTEX}
          fragmentShader={PEDESTAL_FRAGMENT}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <ringGeometry args={[1.2, 1.25, 64]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.28} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <ringGeometry args={[2.0, 2.06, 64]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

// --- STARFIELD (blue + gold) -----------------------------------------------
function Starfield({ reducedMotion }: { reducedMotion: boolean }) {
  const count = 420;
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 13;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 9;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1.5;
      const gold = Math.random() < 0.3;
      col[i * 3] = gold ? 1.0 : 0.5;
      col[i * 3 + 1] = gold ? 0.75 : 0.7;
      col[i * 3 + 2] = gold ? 0.35 : 1.0;
    }
    return { positions: pos, colors: col };
  }, []);
  const ref = useRef<THREE.Points>(null!);
  useFrame((_, dt) => {
    if (!reducedMotion && ref.current) {
      ref.current.rotation.y += dt * 0.015;
      ref.current.rotation.z += dt * 0.004;
    }
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.016}
        vertexColors
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// --- CORE ASSEMBLY ---------------------------------------------------------
function SuperCoreBody({ reducedMotion }: { reducedMotion: boolean }) {
  const mainGroup = useRef<THREE.Group>(null!);
  const orbGroup = useRef<THREE.Group>(null!);
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
      uSize: { value: POINT_SIZE },
    }),
    []
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const { entityState, audioLevel, facePos } = useLeviathan.getState();
    const p = STATE_PARAMS[entityState];

    const motionScale = reducedMotion ? 0.15 : 1;
    flow.current += dt * p.flowSpeed * motionScale;
    uniforms.uTime.value += dt;
    uniforms.uFlow.value = flow.current;

    const targetAudio = reducedMotion ? 0 : audioLevel;
    smoothedAudio.current =
      targetAudio > smoothedAudio.current
        ? damp(smoothedAudio.current, targetAudio, 22, dt)
        : damp(smoothedAudio.current, targetAudio, 6, dt);
    uniforms.uAudio.value = smoothedAudio.current;

    uniforms.uAmp.value = damp(uniforms.uAmp.value, p.amp, 3.5, dt);
    uniforms.uFreq.value = damp(uniforms.uFreq.value, p.freq, 3.5, dt);
    uniforms.uGlow.value = damp(uniforms.uGlow.value, p.glow, 4, dt);
    uniforms.uListen.value = damp(uniforms.uListen.value, entityState === "listening" ? 1 : 0, 4.5, dt);
    uniforms.uThink.value = damp(uniforms.uThink.value, entityState === "thinking" ? 1 : 0, 4.5, dt);
    uniforms.uSpeak.value = damp(uniforms.uSpeak.value, entityState === "speaking" ? 1 : 0, 4.5, dt);
    uniforms.uError.value = damp(uniforms.uError.value, entityState === "error" ? 1 : 0, 4.5, dt);

    if (orbGroup.current && !reducedMotion) {
      orbGroup.current.rotation.y += dt * (0.08 + smoothedAudio.current * 0.15);
    }

    if (mainGroup.current) {
      const fx = facePos ? facePos.x : pointer.x;
      const fy = facePos ? facePos.y : pointer.y;
      const lean = (uniforms.uListen.value * 0.3 + 0.05) * (facePos ? 1.4 : 1);
      mainGroup.current.position.x = damp(mainGroup.current.position.x, fx * lean, 3, dt);
      mainGroup.current.position.y = damp(mainGroup.current.position.y, fy * lean * 0.5, 3, dt);
      mainGroup.current.rotation.x = damp(mainGroup.current.rotation.x, -fy * 0.12, 2.5, dt);
    }
  });

  return (
    <group ref={mainGroup}>
      <group ref={orbGroup}>
        <WaveParticleSphere uniforms={uniforms} />
      </group>
      <FloorPedestalStage uniforms={uniforms} />
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
      camera={{ position: [0, 0, 4.0], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
      style={{ position: "absolute", inset: 0, zIndex: 0 }}
    >
      <ambientLight intensity={0.06} />
      <directionalLight position={[-2, 2, 2]} intensity={1.2} color="#38bdf8" />
      <directionalLight position={[2, -2, -2]} intensity={0.9} color="#f59e0b" />

      <SuperCoreBody reducedMotion={reducedMotion} />
      <Starfield reducedMotion={reducedMotion} />

      <EffectComposer>
        <Bloom
          intensity={1.3}
          luminanceThreshold={0.25}
          luminanceSmoothing={0.4}
          mipmapBlur
        />
        <ChromaticAberration
          offset={new THREE.Vector2(0.0007, 0.0004)}
          radialModulation={false}
          modulationOffset={0}
        />
        <Noise opacity={0.014} />
        <Vignette eskil={false} offset={0.15} darkness={0.7} />
      </EffectComposer>
    </Canvas>
  );
}
