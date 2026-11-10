const vertexSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentSource = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif

  varying vec2 v_uv;
  uniform sampler2D u_photo;
  uniform vec2 u_origin;
  uniform vec2 u_extent;
  uniform float u_time;

  float greenLight(vec3 color) {
    return max(0.0, color.g - (color.r + color.b) * 0.5);
  }

  void main() {
    vec2 uv = u_origin + v_uv * u_extent;
    float sky = 1.0 - smoothstep(0.48, 0.60, uv.y);
    float edges = smoothstep(0.0, 0.025, uv.x)
      * (1.0 - smoothstep(0.975, 1.0, uv.x))
      * smoothstep(0.0, 0.020, uv.y);
    if (sky * edges < 0.001) {
      gl_FragColor = vec4(0.0);
      return;
    }

    vec2 drift = vec2(
      0.018 * sin(u_time * 0.44 + uv.y * 12.0 - uv.x * 4.0)
        + 0.008 * sin(u_time * 0.71 + uv.x * 15.0 + uv.y * 10.0),
      0.010 * sin(u_time * 0.31 + uv.x * 9.0 - uv.y * 5.0)
    );
    vec3 still = texture2D(u_photo, uv).rgb;
    vec3 moving = texture2D(u_photo, uv + drift).rgb;
    float green = max(greenLight(still), greenLight(moving));
    float aurora = smoothstep(0.045, 0.18, green);
    float glow = 0.05 * sin(u_time * 0.65 + uv.x * 8.0 - uv.y * 11.0)
      + 0.025 * sin(u_time * 1.1 - uv.x * 21.0);

    gl_FragColor = vec4(moving + vec3(0.40, 1.0, 0.68) * glow * green, sky * edges * aurora);
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

function positionFraction(value: string | undefined) {
  if (value?.endsWith("%")) return Number.parseFloat(value) / 100;
  if (value === "left" || value === "top") return 0;
  if (value === "right" || value === "bottom") return 1;
  return 0.5;
}

function createRenderer(canvas: HTMLCanvasElement, image: HTMLImageElement) {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
    powerPreference: "low-power",
  });
  if (!gl) return;

  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  const quad = gl.createBuffer();
  const photo = gl.createTexture();
  const dispose = () => {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    gl.deleteProgram(program);
    gl.deleteBuffer(quad);
    gl.deleteTexture(photo);
  };
  if (!vertex || !fragment || !program || !quad || !photo) {
    dispose();
    return;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    dispose();
    return;
  }

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, photo);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  } catch {
    dispose();
    return;
  }
  const origin = gl.getUniformLocation(program, "u_origin");
  const extent = gl.getUniformLocation(program, "u_extent");
  const time = gl.getUniformLocation(program, "u_time");
  const clear = () => gl.clear(gl.COLOR_BUFFER_BIT);

  return {
    resize() {
      const { width, height } = image.getBoundingClientRect();
      if (!width || !height) return false;
      const density = Math.min(devicePixelRatio, 1.5, 1100 / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * density));
      canvas.height = Math.max(1, Math.round(height * density));
      gl.viewport(0, 0, canvas.width, canvas.height);

      const coverScale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const extentX = width / (image.naturalWidth * coverScale);
      const extentY = height / (image.naturalHeight * coverScale);
      const [x, y] = getComputedStyle(image).objectPosition.split(/\s+/);
      gl.uniform2f(origin, (1 - extentX) * positionFraction(x), (1 - extentY) * positionFraction(y));
      gl.uniform2f(extent, extentX, extentY);
      return true;
    },
    draw(seconds: number) {
      gl.uniform1f(time, seconds);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    clear,
    dispose,
  };
}

export function initNightMotion(figure: HTMLElement): () => void {
  const image = figure.querySelector("img");
  const canvas = figure.querySelector("canvas");
  if (!image || !canvas) return () => {};

  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let renderer: ReturnType<typeof createRenderer>;
  let tried = false;
  let visible = false;
  let frame = 0;
  let lastDraw = 0;
  let seconds = 0;

  const render = (now: number) => {
    if (now - lastDraw >= 1000 / 30) {
      seconds += Math.min((now - lastDraw) / 1000, 0.07);
      renderer?.draw(seconds);
      lastDraw = now;
    }
    frame = requestAnimationFrame(render);
  };
  const sync = () => {
    cancelAnimationFrame(frame);
    const staticImage = motion.matches || figure.hasAttribute("data-motion-paused");
    if (staticImage) renderer?.clear();
    if (staticImage || !visible || document.hidden || !image.naturalWidth) return;

    if (!tried) {
      tried = true;
      renderer = createRenderer(canvas, image);
    }
    if (!renderer?.resize()) return;
    renderer.draw(seconds);
    figure.setAttribute("data-motion-ready", "");
    lastDraw = performance.now();
    frame = requestAnimationFrame(render);
  };
  const onContextLost = () => {
    cancelAnimationFrame(frame);
    renderer = undefined;
    figure.removeAttribute("data-motion-ready");
  };

  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  const resize = new ResizeObserver(sync);
  const pause = new MutationObserver(sync);
  intersection.observe(figure);
  resize.observe(figure);
  pause.observe(figure, { attributes: true, attributeFilter: ["data-motion-paused"] });
  image.addEventListener("load", sync);
  document.addEventListener("visibilitychange", sync);
  motion.addEventListener("change", sync);
  canvas.addEventListener("webglcontextlost", onContextLost);

  return () => {
    cancelAnimationFrame(frame);
    intersection.disconnect();
    resize.disconnect();
    pause.disconnect();
    image.removeEventListener("load", sync);
    document.removeEventListener("visibilitychange", sync);
    motion.removeEventListener("change", sync);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    renderer?.clear();
    renderer?.dispose();
    figure.removeAttribute("data-motion-ready");
  };
}
