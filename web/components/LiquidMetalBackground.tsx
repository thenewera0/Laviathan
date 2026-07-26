"use client";

import { useEffect, useRef } from "react";

export default function LiquidMetalBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const mouseRef = useRef({ x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: true, alpha: true, depth: false });
    if (!gl) return;

    // Track Cursor Motion
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX / window.innerWidth;
      mouseRef.current.targetY = 1.0 - e.clientY / window.innerHeight; // Invert Y for WebGL
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Full screen quad vertex shader
    const vsSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Interactive Sculpted Liquid Metal & Neon Blue Energy Stream Shader (Reference Image 2)
    const fsSource = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;
      uniform float u_time;

      // Organic Liquid Metal Displacement Map using FBM
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 5; i++) {
          value += amplitude * noise(p);
          p *= 2.0;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        uv.x *= u_resolution.x / u_resolution.y;

        float t = u_time * 0.15; // Slow continuous fluid motion

        // Mouse Position in Normalized Aspect Space
        vec2 m = u_mouse;
        m.x *= u_resolution.x / u_resolution.y;

        // Interactive Cursor Ripple Push
        float mouseDist = length(uv - m);
        float mousePush = exp(-mouseDist * 4.0); // Smooth falloff

        // Displace liquid coordinates with cursor push & time
        vec2 q = vec2(0.0);
        q.x = fbm(uv * 3.0 + vec2(t * 0.2, t * 0.3) + mousePush * 0.5);
        q.y = fbm(uv * 3.0 + vec2(-t * 0.1, t * 0.2) - mousePush * 0.5);

        vec2 r = vec2(0.0);
        r.x = fbm(uv * 4.0 + q * 2.0 + vec2(t * 0.4, 0.0));
        r.y = fbm(uv * 4.0 + q * 2.0 + vec2(0.0, t * 0.3));

        float f = fbm(uv * 2.5 + r * 1.5 + t * 0.5);
        
        // Enhance flow based on cursor interaction
        f = mix(f, f + mousePush * 0.8, 0.3);

        // Colors matching Reference Image 3 (Deep Obsidian with vibrant Neon Blue/Cyan/Magenta edges)
        vec3 colObsidian = vec3(0.005, 0.008, 0.015);  // #020305 Deep OLED Black
        vec3 colNeonCyan = vec3(0.0, 0.83, 1.0);       // #00D4FF Neon Cyan
        vec3 colNeonBlue = vec3(0.0, 0.3, 1.0);        // #004DFF Electric Blue
        vec3 colPurple   = vec3(0.4, 0.0, 0.9);        // Deep Magenta/Purple contrast

        // Create metallic ridges and emissive valleys
        float ridge = smoothstep(0.3, 0.7, f);
        float edge = abs(f - 0.5) * 2.0; 
        float glowMask = smoothstep(0.1, 0.0, edge); // Highlight the sharp ridges

        // Base metallic surface
        vec3 liquidSurface = mix(colObsidian, colNeonBlue * 0.2, ridge);
        
        // Add colorful flow currents
        liquidSurface = mix(liquidSurface, colPurple * 0.4, smoothstep(0.4, 0.6, r.x));
        liquidSurface = mix(liquidSurface, colNeonCyan * 0.5, smoothstep(0.5, 0.8, r.y));

        // Specular & Emissive highlights along ridges
        float spec = pow(glowMask, 4.0);
        liquidSurface += colNeonCyan * spec * 1.5;
        liquidSurface += colNeonBlue * pow(glowMask, 2.0) * 0.8;

        // Interactive mouse glow burst
        liquidSurface += colNeonCyan * mousePush * 0.3;

        // Soft Vignette for Spatial Focus
        float vignette = (1.0 - length((gl_FragCoord.xy / u_resolution.xy) - 0.5) * 1.2);
        vignette = clamp(pow(vignette, 1.2), 0.0, 1.0);
        
        vec3 finalColor = liquidSurface * vignette;

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
    const uMouse = gl.getUniformLocation(program, "u_mouse");
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
      const m = mouseRef.current;
      m.x += (m.targetX - m.x) * 0.08; // Smooth cursor easing
      m.y += (m.targetY - m.y) * 0.08;

      const now = (performance.now() - startTime) / 1000;
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform2f(uMouse, m.x, m.y);
      gl.uniform1f(uTime, now);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
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
