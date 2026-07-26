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
      // OPTIMIZATION: Reduced from 5 octaves to 3. Visually identical for large liquid waves, but saves 40% GPU time per pixel.
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 3; i++) {
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

        // Distance from cursor
        float mouseDist = length(uv - m);
        
        // Premium Flashlight / Cursor Reveal Mask
        // Smoothly fades out over a radius so the blue metal only appears near the cursor
        float revealMask = smoothstep(0.55, 0.0, mouseDist);
        float mousePush = exp(-mouseDist * 6.0); 

        // Displace liquid coordinates with cursor push & time
        vec2 q = vec2(0.0);
        q.x = fbm(uv * 5.0 + vec2(t * 0.2, t * 0.3) + mousePush * 0.5);
        q.y = fbm(uv * 5.0 + vec2(-t * 0.1, t * 0.2) - mousePush * 0.5);

        vec2 r = vec2(0.0);
        r.x = fbm(uv * 7.0 + q * 2.5 + vec2(t * 0.4, 0.0));
        r.y = fbm(uv * 7.0 + q * 2.5 + vec2(0.0, t * 0.3));

        float f = fbm(uv * 4.0 + r * 2.0 + t * 0.5);
        
        // Colors
        vec3 colTitanium = vec3(0.015, 0.015, 0.020); // Glossy dark titanium
        vec3 colMatte    = vec3(0.002, 0.002, 0.004); // Deep matte black void
        
        vec3 colNeonCyan = vec3(0.0, 0.83, 1.0);
        vec3 colNeonBlue = vec3(0.0, 0.3, 1.0);
        vec3 colPurple   = vec3(0.4, 0.0, 0.9);

        // 1. Base Dark Space Environment
        // A very subtle glossy liquid metal black that fills the screen
        float darkGloss = pow(f, 3.0) * 0.05; // tiny bit of shine on the black metal
        vec3 bgFinal = mix(colMatte, colTitanium, f * 0.7) + vec3(darkGloss);

        // 2. Vibrant signature blue liquid metal effect (Revealed by cursor)
        vec3 liquidSurface = vec3(0.0);
        if (revealMask > 0.0) {
            float ridge = smoothstep(0.45, 0.55, f);
            float edge = abs(f - 0.5) * 2.0; 
            float glowMask = pow(1.0 - edge, 3.5);

            liquidSurface = mix(vec3(0.0), colNeonBlue * 0.3, ridge);
            liquidSurface = mix(liquidSurface, colPurple * 0.6, smoothstep(0.4, 0.7, r.x));
            liquidSurface = mix(liquidSurface, colNeonCyan * 0.9, smoothstep(0.5, 0.8, r.y));

            float spec = pow(glowMask, 5.0);
            liquidSurface += colNeonCyan * spec * 3.0;
            liquidSurface += colNeonBlue * pow(glowMask, 3.0) * 2.0;
            liquidSurface += colNeonCyan * mousePush * 0.6;
        }

        // Multiply revealMask by f to make the flashlight edge organic and fluid instead of a perfect circle
        float organicReveal = revealMask * smoothstep(0.1, 0.9, f + revealMask * 0.6);
        
        // Composite the two: dark space everywhere, vibrant liquid under the cursor
        vec3 finalColor = bgFinal + liquidSurface * organicReveal;

        // Overall Vignette for deep space immersion
        float vignette = (1.0 - length((gl_FragCoord.xy / u_resolution.xy) - 0.5) * 0.85);
        vignette = clamp(pow(vignette, 0.9), 0.0, 1.0);
        finalColor *= vignette;

        // The background is completely opaque dark space, so we just use alpha=1.0
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
