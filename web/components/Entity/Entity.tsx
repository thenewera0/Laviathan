"use client";

// The Leviathan Super Core — 3D Void Core (Reference Image 1) & Floor Stage (Reference Image 2)
// Combines central singularity, concentric gyroscopic rings, dual accretion arms (Blue/Purple & Gold/Amber),
// vertical illuminated axis crosshair, dark orbiting celestial spheres, and floor pedestal stage.

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
  ACCRETION_FRAGMENT,
  ACCRETION_VERTEX,
  AXIS_FRAGMENT,
  AXIS_VERTEX,
  CORE_FRAGMENT,
  CORE_VERTEX,
  PEDESTAL_FRAGMENT,
  PEDESTAL_VERTEX,
  RING_FRAGMENT,
  RING_VERTEX,
} from "./shaders";

const STATE_PARAMS: Record<
  EntityState,
  { amp: number; freq: number; flowSpeed: number; glow: number; scale: number }
> = {
  idle: { amp: 0.19, freq: 1.55, flowSpeed: 0.34, glow: 0.9, scale: 1.0 },
  listening: { amp: 0.24, freq: 1.95, flowSpeed: 0.6, glow: 1.2, scale: 1.05 },
  thinking: { amp: 0.2, freq: 2.5, flowSpeed: 1.6, glow: 1.1, scale: 0.98 },
  speaking: { amp: 0.15, freq: 1.7, flowSpeed: 0.8, glow: 1.35, scale: 1.03 },
  error: { amp: 0.07, freq: 1.2, flowSpeed: 0.1, glow: 0.3, scale: 0.85 },
};

function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

// --- CENTRAL SINGULARITY CORE ---
function CentralSingularityCore({
  uniforms,
}: {
  uniforms: Record<string, { value: number }>;
}) {
  const mesh = useRef<THREE.Mesh>(null!);

  useFrame((_, dt) => {
    if (!mesh.current) return;
    mesh.current.rotation.y += dt * 0.15;
    mesh.current.rotation.z += dt * 0.05;
  });

  return (
    <mesh ref={mesh} scale={0.72}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        vertexShader={CORE_VERTEX}
        fragmentShader={CORE_FRAGMENT}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}

// --- CONCENTRIC GYROSCOPIC GIMBAL RINGS ---
function GyroscopicRings({
  uniforms,
}: {
  uniforms: Record<string, { value: number }>;
}) {
  const ringGroup = useRef<THREE.Group>(null!);

  useFrame((_, dt) => {
    if (!ringGroup.current) return;
    const children = ringGroup.current.children;
    if (children[0]) children[0].rotation.z += dt * 0.2;
    if (children[1]) children[1].rotation.x += dt * 0.15;
    if (children[2]) children[2].rotation.y += dt * 0.25;
    if (children[3]) children[3].rotation.z -= dt * 0.18;
  });

  const ringConfigs: Array<{
    args: [number, number, number, number];
    colorType: number;
    rot: [number, number, number];
  }> = [
    { args: [0.95, 0.003, 16, 120], colorType: 0, rot: [0.8, 0.2, 0] },
    { args: [1.25, 0.004, 16, 120], colorType: 2, rot: [-0.6, 0.4, 0.5] },
    { args: [1.55, 0.005, 16, 120], colorType: 1, rot: [0.4, -0.7, -0.3] },
    { args: [1.85, 0.003, 16, 120], colorType: 0, rot: [-0.3, 0.8, 0.2] },
  ];

  return (
    <group ref={ringGroup}>
      {ringConfigs.map((cfg, idx) => (
        <mesh
          key={idx}
          rotation={cfg.rot as [number, number, number]}
        >
          <torusGeometry args={cfg.args} />
          <shaderMaterial
            vertexShader={RING_VERTEX}
            fragmentShader={RING_FRAGMENT}
            uniforms={{
              ...uniforms,
              uRingColorType: { value: cfg.colorType },
            }}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// --- DUAL COSMIC ACCRETION ENERGY ARMS (BLUE/VIOLET vs GOLD/AMBER) ---
function DualAccretionArms({
  uniforms,
}: {
  uniforms: Record<string, { value: number }>;
}) {
  const armsGroup = useRef<THREE.Group>(null!);

  useFrame((_, dt) => {
    if (!armsGroup.current) return;
    armsGroup.current.rotation.z += dt * 0.12;
    armsGroup.current.rotation.y += dt * 0.08;
  });

  return (
    <group ref={armsGroup} rotation={[0.6, -0.3, 0.4]}>
      {/* Left/Top Electric Cyan/Blue & Purple Arm */}
      <mesh position={[-0.4, 0.2, 0]} rotation={[0, 0, 0.2]}>
        <torusGeometry args={[1.4, 0.18, 16, 80, Math.PI * 1.2]} />
        <shaderMaterial
          vertexShader={ACCRETION_VERTEX}
          fragmentShader={ACCRETION_FRAGMENT}
          uniforms={{ ...uniforms, uArmType: { value: 0 } }}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Right/Bottom Warm Amber & Gold Arm */}
      <mesh position={[0.4, -0.2, 0]} rotation={[0, 0, Math.PI + 0.2]}>
        <torusGeometry args={[1.4, 0.18, 16, 80, Math.PI * 1.2]} />
        <shaderMaterial
          vertexShader={ACCRETION_VERTEX}
          fragmentShader={ACCRETION_FRAGMENT}
          uniforms={{ ...uniforms, uArmType: { value: 1 } }}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// --- VERTICAL ILLUMINATED AXIS BEAM & TERMINAL NODES ---
function VerticalAxisCrosshair({
  uniforms,
}: {
  uniforms: Record<string, { value: number }>;
}) {
  return (
    <group>
      {/* Vertical Cyan/Blue Laser Cylinder */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 4.8, 16]} />
        <shaderMaterial
          vertexShader={AXIS_VERTEX}
          fragmentShader={AXIS_FRAGMENT}
          uniforms={uniforms}
          transparent
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Top Terminal Ring Node (O) */}
      <group position={[0, 2.4, 0]}>
        <mesh>
          <ringGeometry args={[0.05, 0.08, 32]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.025, 16, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>

      {/* Bottom Terminal Ring Node (O) */}
      <group position={[0, -2.4, 0]}>
        <mesh>
          <ringGeometry args={[0.05, 0.08, 32]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.025, 16, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
    </group>
  );
}

// --- ORBITING DARK SPHERES (CELESTIAL BODIES) ---
function OrbitingDarkSpheres() {
  const group = useRef<THREE.Group>(null!);

  useFrame((_, dt) => {
    if (group.current) {
      group.current.rotation.y += dt * 0.18;
      group.current.rotation.x += dt * 0.06;
    }
  });

  const spheres = [
    { pos: [1.1, 0.3, 0.4] as [number, number, number], r: 0.06 },
    { pos: [-1.3, -0.4, 0.2] as [number, number, number], r: 0.08 },
    { pos: [0.5, -1.0, -0.6] as [number, number, number], r: 0.07 },
    { pos: [-0.8, 0.9, -0.5] as [number, number, number], r: 0.05 },
    { pos: [1.6, -0.2, 0.7] as [number, number, number], r: 0.065 },
    { pos: [-1.5, 0.5, 0.8] as [number, number, number], r: 0.075 },
  ];

  return (
    <group ref={group}>
      {spheres.map((s, i) => (
        <mesh key={i} position={s.pos}>
          <sphereGeometry args={[s.r, 24, 24]} />
          <meshStandardMaterial
            color="#05070a"
            roughness={0.2}
            metalness={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}

// --- FLOOR PEDESTAL STAGE (Reference Image 2) ---
function FloorPedestalStage({
  uniforms,
}: {
  uniforms: Record<string, { value: number }>;
}) {
  return (
    <group position={[0, -2.3, 0]}>
      {/* Radial floor ring shader plane */}
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

      {/* 3D Base Rings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <ringGeometry args={[1.2, 1.25, 64]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.35} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <ringGeometry args={[2.0, 2.06, 64]} />
        <meshBasicMaterial color="#818cf8" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

// --- COSMIC VOID STARFIELD & DUST PARTICLES ---
function CosmicVoidDust({ reducedMotion }: { reducedMotion: boolean }) {
  const points = useRef<THREE.Points>(null!);
  const count = 480;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
    }
    return arr;
  }, []);

  useFrame((_, dt) => {
    if (reducedMotion || !points.current) return;
    points.current.rotation.y += dt * 0.02;
    points.current.rotation.z += dt * 0.005;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.018}
        color="#38bdf8"
        transparent
        opacity={0.45}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// --- CORE COMPONENT CONTAINER ---
function SuperCoreBody({ reducedMotion }: { reducedMotion: boolean }) {
  const mainGroup = useRef<THREE.Group>(null!);
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

    if (mainGroup.current) {
      const fx = facePos ? facePos.x : pointer.x;
      const fy = facePos ? facePos.y : pointer.y;
      const lean = (uniforms.uListen.value * 0.35 + 0.06) * (facePos ? 1.4 : 1);
      mainGroup.current.position.x = damp(mainGroup.current.position.x, fx * lean, 3, dt);
      mainGroup.current.position.y = damp(mainGroup.current.position.y, fy * lean * 0.5, 3, dt);
      mainGroup.current.rotation.y = damp(mainGroup.current.rotation.y, fx * 0.2, 2.5, dt);
      mainGroup.current.rotation.x = damp(mainGroup.current.rotation.x, -fy * 0.15, 2.5, dt);
    }
  });

  return (
    <group ref={mainGroup}>
      <CentralSingularityCore uniforms={uniforms} />
      <GyroscopicRings uniforms={uniforms} />
      <DualAccretionArms uniforms={uniforms} />
      <VerticalAxisCrosshair uniforms={uniforms} />
      <OrbitingDarkSpheres />
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
      camera={{ position: [0, 0, 3.8], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
      style={{ position: "absolute", inset: 0, zIndex: 0 }}
    >
      <ambientLight intensity={0.05} />
      {/* Subtle rim lighting instead of washing out the center */}
      <directionalLight position={[-2, 2, 2]} intensity={1.5} color="#38bdf8" />
      <directionalLight position={[2, -2, -2]} intensity={1.0} color="#f59e0b" />
      <directionalLight position={[0, 0, 5]} intensity={0.5} color="#60a5fa" />

      <SuperCoreBody reducedMotion={reducedMotion} />
      <CosmicVoidDust reducedMotion={reducedMotion} />

      <EffectComposer>
        <Bloom
          intensity={1.2}
          luminanceThreshold={0.5}
          luminanceSmoothing={0.3}
          mipmapBlur
        />
        <ChromaticAberration
          offset={new THREE.Vector2(0.0008, 0.0005)}
          radialModulation={false}
          modulationOffset={0}
        />
        <Noise opacity={0.015} />
        <Vignette eskil={false} offset={0.15} darkness={0.7} />
      </EffectComposer>
    </Canvas>
  );
}
