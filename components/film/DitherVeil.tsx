"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { motion, type MotionValue } from "framer-motion";

type DitherVeilProps = {
  /** 0 = clear, 1 = fully covered. */
  progress: MotionValue<number>;
  /** Ink colour (hex). */
  color?: string;
  /** Optional image drawn as 1-bit halftone in the ink colour (e.g. clouds). Same-origin or CORS-enabled. */
  image?: string;
  /** Dither cell size in CSS pixels. */
  cell?: number;
  className?: string;
};

const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// Ordered (Bayer 8x8) dither of a noisy dissolve field: grains of ink arrive in drifts as progress rises.
const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uProgress;
uniform float uCell;
uniform vec3 uInk;
uniform sampler2D uTex;
uniform float uHasTex;
uniform vec2 uTexScale;

float bayer2(vec2 a) { a = floor(mod(a, 2.0)); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy / uCell);
  vec2 uv = (cell + 0.5) * uCell / uRes;
  float field = 0.65 * noise(uv * vec2(5.0, 3.5)) + 0.35 * (1.0 - uv.y);
  float soft = 0.22;
  float ink = clamp((uProgress * (1.0 + soft) - field) / soft, 0.0, 1.0);
  if (uHasTex > 0.5) {
    vec3 c = texture2D(uTex, (uv - 0.5) * uTexScale + 0.5).rgb;
    ink *= dot(c, vec3(0.299, 0.587, 0.114));
  }
  float on = step(bayer8(cell) + 0.0001, ink);
  gl_FragColor = vec4(uInk * on, on);
}
`;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.replace(/./g, "$&$&") : h;
  const n = Number.parseInt(full, 16);
  if (full.length !== 6 || Number.isNaN(n)) return [0.18, 0.36, 0.72];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGLRenderingContext): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  const sources: [number, string][] = [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, FRAGMENT],
  ];
  for (const [type, source] of sources) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("DitherVeil shader:", gl.getShaderInfoLog(shader));
      return null;
    }
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

let webglSupported: boolean | undefined;
function probeWebgl(): boolean {
  if (webglSupported === undefined) {
    try {
      webglSupported = Boolean(document.createElement("canvas").getContext("webgl"));
    } catch {
      webglSupported = false;
    }
  }
  return webglSupported;
}
const subscribeNever = () => () => {};

export function DitherVeil({ progress, color = "#2f5bb7", image, cell = 3, className }: DitherVeilProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webgl = useSyncExternalStore(subscribeNever, probeWebgl, () => true);
  const cls = className ?? "pointer-events-none absolute inset-0 h-full w-full";

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { antialias: false, premultipliedAlpha: true });
    const program = gl && compile(gl);
    if (!canvas || !gl || !program) return;

    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // One oversized triangle covers the whole viewport.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const uRes = uniform("uRes");
    const uProgress = uniform("uProgress");
    const uCell = uniform("uCell");
    const uHasTex = uniform("uHasTex");
    const uTexScale = uniform("uTexScale");
    gl.uniform3fv(uniform("uInk"), hexToRgb(color));
    gl.uniform1i(uniform("uTex"), 0);
    gl.uniform1f(uHasTex, 0);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let texture: WebGLTexture | null = null;
    let texAspect = 0;
    let raf = 0;
    let disposed = false;

    const render = () => {
      raf = 0;
      const { width, height } = canvas;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uRes, width, height);
      gl.uniform1f(uCell, Math.max(1, cell * dpr));
      gl.uniform1f(uProgress, Math.min(1, Math.max(0, progress.get())));
      if (texAspect) {
        const aspect = width / height;
        gl.uniform2f(
          uTexScale,
          aspect > texAspect ? 1 : aspect / texAspect,
          aspect > texAspect ? texAspect / aspect : 1,
        );
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const schedule = () => {
      if (!raf && !disposed) raf = requestAnimationFrame(render);
    };

    const ro = new ResizeObserver(() => {
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      schedule();
    });
    ro.observe(canvas);
    const unsubscribe = progress.on("change", schedule);

    if (image) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = image;
      img.decode().then(
        () => {
          if (disposed) return;
          texture = gl.createTexture();
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          texAspect = img.naturalWidth / img.naturalHeight;
          gl.uniform1f(uHasTex, 1);
          schedule();
        },
        () => console.warn("DitherVeil: could not load", image),
      );
    }
    schedule();

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      unsubscribe();
      ro.disconnect();
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [progress, color, image, cell]);

  if (!webgl) {
    return <motion.div aria-hidden className={cls} style={{ backgroundColor: color, opacity: progress }} />;
  }
  return <canvas ref={canvasRef} aria-hidden className={cls} />;
}
