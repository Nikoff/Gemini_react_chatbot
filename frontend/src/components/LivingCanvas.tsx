import { useEffect, useRef, useCallback } from 'react';

const VERT = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAG = `
  precision mediump float;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_inkAmount;
  uniform float u_sketchAmount;
  uniform vec2 u_mouse;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  vec3 paperTexture(vec2 uv) {
    float grain = noise(uv * 800.0) * 0.06;
    float fiber = fbm(uv * 120.0) * 0.08;
    float bump = noise(uv * 300.0 + 42.0) * 0.04;
    vec3 base = vec3(0.96, 0.93, 0.88);
    base += grain + fiber + bump;
    float vignette = 1.0 - length(uv - 0.5) * 0.5;
    base *= vignette;
    return base;
  }

  float fluidSDF(vec2 uv, float t) {
    float d = 1e10;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      vec2 center = vec2(
        0.5 + 0.3 * sin(t * 0.7 + fi * 1.3),
        0.5 + 0.3 * cos(t * 0.5 + fi * 1.7)
      );
      float r = 0.08 + 0.06 * sin(t * 1.2 + fi * 2.1);
      float dist = length(uv - center) - r;
      d = min(d, dist);
    }
    return d;
  }

  vec3 inkEffect(vec2 uv, float amount) {
    float t = u_time * 0.4;
    float d = fluidSDF(uv, t);
    float spread = smoothstep(0.15, -0.05, d) * amount;

    vec2 deform = vec2(
      fbm(uv * 8.0 + t) - 0.5,
      fbm(uv * 8.0 + t + 100.0) - 0.5
    ) * 0.02 * amount;

    float ink = smoothstep(0.2, -0.1, fluidSDF(uv + deform, t)) * amount;

    vec3 inkColor = mix(
      vec3(0.15, 0.12, 0.18),
      vec3(0.2, 0.35, 0.55),
      noise(uv * 20.0 + t)
    );

    float bleed = fbm(uv * 15.0 + t * 0.5) * 0.3 * amount;

    return inkColor * (ink + bleed * 0.5);
  }

  float pencilStroke(vec2 uv, float t) {
    float angle = noise(uv * 3.0) * 6.28;
    vec2 dir = vec2(cos(angle), sin(angle));
    float stroke = noise(uv * vec2(200.0, 40.0) + dir * t * 0.5);
    stroke = smoothstep(0.3, 0.7, stroke);
    float density = fbm(uv * 6.0 + t * 0.1);
    return stroke * density;
  }

  vec3 sketchEffect(vec2 uv, float amount) {
    float stroke = pencilStroke(uv, u_time);
    vec3 pencilColor = vec3(0.25, 0.22, 0.2);
    float edge = 1.0 - smoothstep(0.0, 0.15, fluidSDF(uv, u_time * 0.4));
    float sketch = mix(1.0, stroke * edge, amount);
    return mix(vec3(1.0), pencilColor, sketch * amount * 0.8);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 paper = paperTexture(uv);

    vec3 sketch = sketchEffect(uv, u_sketchAmount);
    vec3 ink = inkEffect(uv, u_inkAmount);

    vec3 color = paper * sketch;
    color = mix(color, color * vec3(0.85, 0.82, 0.78), ink * 0.3);
    color = mix(color, ink, u_inkAmount * 0.6);

    float bleed = fbm(uv * 10.0 + u_time * 0.2) * u_inkAmount * 0.05;
    color += vec3(0.1, 0.08, 0.12) * bleed;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vert: string, frag: string): WebGLProgram | null {
  const vs = createShader(gl, gl.VERTEX_SHADER, vert);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

export function LivingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({});
  const startTimeRef = useRef(0);
  const inkAmountRef = useRef(0);
  const sketchAmountRef = useRef(1);
  const animFrameRef = useRef<number>(0);

  const initGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) return false;

    const program = createProgram(gl, VERT, FRAG);
    if (!program) return false;

    gl.useProgram(program);

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    uniforms.resolution = gl.getUniformLocation(program, 'u_resolution');
    uniforms.time = gl.getUniformLocation(program, 'u_time');
    uniforms.inkAmount = gl.getUniformLocation(program, 'u_inkAmount');
    uniforms.sketchAmount = gl.getUniformLocation(program, 'u_sketchAmount');
    uniforms.mouse = gl.getUniformLocation(program, 'u_mouse');

    glRef.current = gl;
    programRef.current = program;
    uniformsRef.current = uniforms;

    return true;
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const gl = glRef.current;
    if (!canvas || !gl) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    if (!initGL()) return;
    resize();
    startTimeRef.current = Date.now();

    window.addEventListener('resize', resize);

    const render = () => {
      const gl = glRef.current;
      const u = uniformsRef.current;
      if (!gl) return;

      const t = (Date.now() - startTimeRef.current) / 1000;
      inkAmountRef.current += (0 - inkAmountRef.current) * 0.02;
      sketchAmountRef.current += (1 - sketchAmountRef.current) * 0.02;

      gl.uniform2f(u.resolution, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(u.time, t);
      gl.uniform1f(u.inkAmount, inkAmountRef.current);
      gl.uniform1f(u.sketchAmount, sketchAmountRef.current);
      gl.uniform2f(u.mouse, 0.5, 0.5);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    const handler = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.dispatchEvent(new CustomEvent('livingcanvas-trigger'));
      }
    };

    window.addEventListener('livingcanvas-ink', handler);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('livingcanvas-ink', handler);
    };
  }, [initGL, resize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTrigger = () => {
      inkAmountRef.current = 1;
      sketchAmountRef.current = 0.8;
      setTimeout(() => {
        inkAmountRef.current = 0;
        sketchAmountRef.current = 1;
      }, 2000);
    };

    canvas.addEventListener('livingcanvas-trigger', onTrigger);
    return () => canvas.removeEventListener('livingcanvas-trigger', onTrigger);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: -1,
      }}
    />
  );
}

export function triggerLivingCanvasInk() {
  window.dispatchEvent(new Event('livingcanvas-ink'));
}
