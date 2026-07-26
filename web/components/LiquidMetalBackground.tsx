"use client";

import { useEffect, useRef } from "react";

export default function LiquidMetalBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null!);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: true, alpha: true, depth: false });
    if (!gl) return;

    // Full screen quad vertex shader
    const vsSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // High-Contrast Procedural Liquid Metal & Emissive Electric Blue River Shader (Reference Image 2)
    const fsSource = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;

      // Smooth Trigonometric Sinusoidal Domain Warping (100% Noise-Free & Silk-Smooth)
      float liquidMap(vec2 p, float t) {
        float wave1 = sin(p.x * 2.2 + t * 0.7) + cos(p.y * 1.8 - t * 0.5);
        float wave2 = sin(p.x * 3.5 - t * 0.9 + wave1 * 0.8) + cos(p.y * 3.1 + t * 0.6 + wave1);
        float wave3 = sin(p.x * 1.2 + wave2 * 1.2) + cos(p.y * 1.4 + wave2 * 0.9);
        return (wave1 + wave2 * 0.5 + wave3 * 0.25) / 2.75;
      }

      void main() {
        vec2 st = gl_FragCoord.xy / u_resolution.xy;
        st.x *= u_resolution.x / u_resolution.y;

        float t = u_time * 0.035; // Slow continuous fluid flow

        // Domain Warping for organic liquid metal topology
        vec2 p = st * 2.0;
        float n1 = liquidMap(p, t);
        float n2 = liquidMap(p + vec2(n1 * 0.6, n1 * 0.4), t * 1.2);
        float surface = liquidMap(p + 1.5 * vec2(n2, n1), t * 0.8);

        // Dark Obsidian & Liquid Metal Palette
        vec3 colObsidian   = vec3(0.008, 0.012, 0.02);   // #020305 Deep OLED Black
        vec3 colNavyMetal  = vec3(0.031, 0.066, 0.118);  // #08111E Metallic Navy
        vec3 colSteelMetal = vec3(0.102, 0.160, 0.231);  // #1A283B Liquid Aluminium
        vec3 colMetalSpec  = vec3(0.478, 0.553, 0.667);  // #7A8DAA Specular Highlight

        // Base Liquid Metal Surface Interpolation
        float facet = smoothstep(-0.6, 0.6, surface);
        vec3 liquidSurface = mix(colObsidian, colNavyMetal, facet);
        liquidSurface = mix(liquidSurface, colSteelMetal, pow(clamp(facet, 0.0, 1.0), 2.0) * 0.7);

        // Metallic Specular Reflections along liquid folds
        float spec = pow(clamp(surface * 1.35, 0.0, 1.0), 4.5);
        liquidSurface += colMetalSpec * spec * 0.5;

        // High-Contrast Emissive Electric Blue & Cyan Energy River (Reference Image 2)
        // Volumetric Curved River flowing vertically across space
        float riverPath = st.x - 0.52 - 0.22 * sin(st.y * 2.8 + t * 0.9) - 0.12 * sin(st.y * 5.2 - t * 1.1);
        float riverWidth = 0.09 + 0.04 * sin(st.y * 3.5 + t);
        float riverMask = smoothstep(riverWidth, 0.0, abs(riverPath));

        // Emissive Electric Blue & Cyan Colors (Reference Image 2)
        vec3 colPrimaryBlue  = vec3(0.122, 0.482, 1.0);  // #1F7BFF
        vec3 colElectricBlue = vec3(0.196, 0.780, 1.0);  // #32C7FF
        vec3 colEmissiveCyan = vec3(0.353, 0.984, 1.0);  // #5AFBFF

        vec3 riverColor = mix(colPrimaryBlue, colElectricBlue, riverMask);
        riverColor = mix(riverColor, colEmissiveCyan, pow(riverMask, 2.5));

        // Soft Outer Volumetric Glow (5-10 Intensity)
        float outerGlow = smoothstep(riverWidth * 4.5, 0.0, abs(riverPath));
        vec3 volumetricGlow = colPrimaryBlue * outerGlow * 1.25;

        // Final Composite Surface
        vec3 finalColor = liquidSurface + riverColor * riverMask * 3.2 + volumetricGlow;

        // Soft Vignette for Spatial Focus
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        float vignette = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
        vignette = clamp(pow(16.0 * vignette, 0.28), 0.0, 1.0);
        finalColor *= vignette;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );

    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uTime = gl.getUniformLocation(program, "u_time");

    let animId: number;
    let startTime = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const render = () => {
      resize();
      const now = (performance.now() - startTime) / 1000;
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, now);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full object-cover"
    />
  );
}
