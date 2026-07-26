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

    // Smooth Bioluminescent Liquid Metal & Emissive Blue Energy River Shader (Reference Image 2)
    const fsSource = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;

      // Smooth Simplex 3D Noise Functions
      vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod(i, 289.0);
        vec4 p = permute(permute(permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }

      // Smooth low-frequency FBM (No harsh high-frequency noise)
      float fbmSmooth(vec3 p) {
        float value = 0.0;
        float amplitude = 0.55;
        for (int i = 0; i < 3; i++) {
          value += amplitude * snoise(p);
          p *= 1.85;
          amplitude *= 0.45;
        }
        return value;
      }

      void main() {
        vec2 st = gl_FragCoord.xy / u_resolution.xy;
        st.x *= u_resolution.x / u_resolution.y;

        float t = u_time * 0.025; // Ultra-slow silk fluid motion

        // Smooth Domain Warping for organic liquid metal topology
        vec3 p = vec3(st * 1.5, t);
        vec3 q = vec3(fbmSmooth(p + vec3(0.0, 0.0, t)), fbmSmooth(p + vec3(3.2, 1.1, t)), t);
        vec3 r = vec3(fbmSmooth(p + 3.0 * q + vec3(1.4, 4.2, t)), fbmSmooth(p + 3.0 * q + vec3(5.3, 2.1, t)), t);

        float n = fbmSmooth(p + 2.5 * r);

        // Dark Liquid Obsidian & Metallic Surface Palette
        vec3 colBg = vec3(0.008, 0.012, 0.02);      // #020305
        vec3 colMetalDark = vec3(0.03, 0.065, 0.12); // #08111E
        vec3 colMetalSpec = vec3(0.48, 0.55, 0.67);  // #7A8DAA Metallic Reflection

        float metalFacet = smoothstep(-0.2, 0.8, n);
        vec3 liquidSurface = mix(colBg, colMetalDark, metalFacet * 0.85);

        // Smooth Metallic Specular Highlights along liquid ridges
        float specHighlight = pow(clamp(n * 1.2, 0.0, 1.0), 4.0);
        liquidSurface += colMetalSpec * specHighlight * 0.35;

        // Curved Emissive Blue & Cyan Energy River Stream
        float riverDistance = abs(st.x - 0.5 - 0.2 * sin(st.y * 2.5 + t * 0.7) - 0.08 * fbmSmooth(vec3(st * 2.0, t)));
        float riverWidth = 0.12 + 0.06 * sin(st.y * 4.0 + t);
        float riverMask = smoothstep(riverWidth, 0.0, riverDistance);

        // Electric Blue & Cyan Energy Palette (Reference Image 2)
        vec3 colElectricBlue = vec3(0.12, 0.48, 1.0);  // #1F7BFF
        vec3 colBrightCyan   = vec3(0.2, 0.78, 1.0);   // #32C7FF
        vec3 colPureCyan     = vec3(0.35, 0.98, 1.0);  // #5AFBFF

        vec3 riverColor = mix(colElectricBlue, colBrightCyan, riverMask);
        riverColor = mix(riverColor, colPureCyan, pow(riverMask, 2.0));

        // Soft Volumetric Glow (No Grain)
        float softGlow = smoothstep(riverWidth * 3.5, 0.0, riverDistance);
        vec3 emissiveGlow = colElectricBlue * softGlow * 1.1;

        // Final Composite Surface
        vec3 finalColor = liquidSurface + riverColor * riverMask * 2.4 + emissiveGlow;

        // Smooth Vignette
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        float vignette = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
        vignette = clamp(pow(16.0 * vignette, 0.3), 0.0, 1.0);
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
