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

    // Sculpted Liquid Metal & Neon Blue Energy Stream Shader (Reference Image 2)
    const fsSource = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;

      // Organic Liquid Metal Displacement Map
      float map(vec3 p) {
        vec3 q = p;
        q.x += sin(p.y * 1.8 + u_time * 0.4) * 0.4;
        q.y += cos(p.x * 1.5 + u_time * 0.3) * 0.4;
        
        float d1 = sin(q.x * 2.2) * cos(q.y * 2.2) * sin(q.z * 2.2);
        float d2 = sin(q.x * 4.5 + u_time * 0.6) * cos(q.y * 4.5) * 0.25;
        return d1 + d2;
      }

      void main() {
        vec2 st = gl_FragCoord.xy / u_resolution.xy;
        st.x *= u_resolution.x / u_resolution.y;

        float t = u_time * 0.03; // Slow continuous fluid motion

        // Coordinates & Domain Warping
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
        vec3 p = vec3(uv * 2.8, t);

        float n1 = map(p);
        float n2 = map(p + vec3(n1 * 0.8, n1 * 0.5, t * 0.5));
        float surface = map(p + 1.8 * vec3(n2, n1, t * 0.2));

        // Colors matching Reference Image 2
        vec3 colObsidian   = vec3(0.008, 0.012, 0.02);   // #020305 Deep OLED Black
        vec3 colDarkNavy   = vec3(0.03, 0.065, 0.12);    // #08111E Metallic Navy
        vec3 colMetalSpec  = vec3(0.48, 0.55, 0.67);    // #7A8DAA Specular Highlight
        vec3 colCopperGold = vec3(0.85, 0.52, 0.12);    // #D97706 Copper-Gold Reflection

        // Liquid Metal Surface
        float facet = smoothstep(-0.5, 0.7, surface);
        vec3 liquidSurface = mix(colObsidian, colDarkNavy, facet * 0.85);

        // Metallic Specular Reflection + Copper Gold Ridge Lighting (Image 2)
        float spec = pow(clamp(surface * 1.4, 0.0, 1.0), 4.0);
        float goldReflect = pow(clamp((surface + 0.3) * 1.2, 0.0, 1.0), 3.0);
        liquidSurface += colMetalSpec * spec * 0.4;
        liquidSurface += colCopperGold * goldReflect * 0.25;

        // Curved Neon Electric Blue & Cyan Energy Stream (Image 2)
        // Flows down the central crevices of the liquid metal
        float riverX = uv.x - 0.1 * sin(uv.y * 3.5 + t * 1.5) - 0.05 * cos(uv.y * 7.0 - t);
        float riverDist = abs(riverX);
        float riverMask = smoothstep(0.18, 0.0, riverDist);

        // Neon Blue & Cyan Emissive Colors
        vec3 colNeonBlue = vec3(0.0, 0.53, 1.0);  // #0088FF Electric Blue
        vec3 colNeonCyan = vec3(0.0, 0.83, 1.0);  // #00D4FF Neon Cyan
        vec3 colCoreWhite = vec3(0.8, 0.98, 1.0); // #CCFAFF Core Emissive White

        vec3 riverColor = mix(colNeonBlue, colNeonCyan, riverMask);
        riverColor = mix(riverColor, colCoreWhite, pow(riverMask, 3.0));

        // Soft Outer Volumetric Glow
        float outerGlow = smoothstep(0.45, 0.0, riverDist);
        vec3 emissiveGlow = colNeonBlue * outerGlow * 1.35;

        // Final Surface Composite
        vec3 finalColor = liquidSurface + riverColor * riverMask * 3.5 + emissiveGlow;

        // Soft Vignette for Spatial Focus
        float vignette = (1.0 - length(uv * 0.55));
        vignette = clamp(pow(vignette, 1.5), 0.0, 1.0);
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
