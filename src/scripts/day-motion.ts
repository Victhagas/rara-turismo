// Mask coordinates are in the original 1000 × 1778 Lago de Como photo.
const waterBehindBoat = [
  [0, 793], [240, 789], [430, 789], [509, 785], [513, 806], [523, 822],
  [559, 830], [620, 831], [616, 840], [514, 846], [466, 852], [400, 861],
  [374, 869], [355, 893], [306, 899], [244, 907], [182, 915], [130, 927],
  [106, 938], [105, 950], [76, 974], [0, 985],
];

const waterInFront = [
  [0, 993], [50, 997], [59, 1020], [87, 1034], [158, 1023], [264, 1016],
  [351, 1010], [416, 1000], [470, 987], [513, 977], [560, 961], [585, 948],
  [597, 930], [609, 923], [617, 928], [619, 943], [638, 950], [661, 947],
  [683, 957], [712, 959], [718, 971], [703, 992], [690, 1009], [654, 1022],
  [637, 1045], [609, 1062], [593, 1082], [575, 1103], [554, 1128], [544, 1150],
  [557, 1167], [579, 1179], [590, 1197], [593, 1219], [605, 1240], [617, 1256],
  [614, 1282], [602, 1300], [581, 1325], [557, 1344], [525, 1354], [496, 1359],
  [470, 1343], [446, 1317], [412, 1297], [374, 1284], [352, 1252], [335, 1224],
  [308, 1217], [296, 1197], [286, 1181], [275, 1191], [263, 1232], [245, 1250],
  [226, 1234], [210, 1223], [185, 1261], [175, 1252], [164, 1217], [151, 1195],
  [133, 1198], [121, 1231], [116, 1282], [94, 1317], [69, 1331], [52, 1358],
  [25, 1378], [0, 1396],
];

const flag = [
  [792, 389], [805, 387], [824, 392], [847, 393], [873, 398], [895, 402],
  [913, 409], [914, 421], [911, 429], [916, 438], [916, 448], [913, 461],
  [913, 468], [901, 465], [880, 462], [870, 457], [845, 457], [825, 459],
  [807, 462], [791, 462],
];

const vertexSource = `
  attribute vec2 a_position;
  varying vec2 v_screen;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_screen = a_position * vec2(0.5, -0.5) + 0.5;
  }
`;

const fragmentSource = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif
  uniform sampler2D u_photo;
  uniform sampler2D u_mask;
  uniform vec2 u_view;
  uniform vec2 u_drawn;
  uniform vec2 u_offset;
  uniform float u_time;
  varying vec2 v_screen;

  void main() {
    vec2 uv = (v_screen * u_view - u_offset) / u_drawn;
    vec2 mask = texture2D(u_mask, uv).rg;
    if (max(mask.r, mask.g) < 0.003) {
      gl_FragColor = vec4(0.0);
      return;
    }

    vec2 size = vec2(1000.0, 1778.0);
    vec2 p = uv * size;
    vec3 color;
    float alpha;

    if (mask.r > mask.g) {
      float depth = smoothstep(780.0, 1330.0, p.y);
      float wave = sin(p.y * 0.054 + p.x * 0.017 - u_time * 3.5);
      float crossing = sin(p.x * 0.026 - p.y * 0.096 + u_time * 2.6);
      vec2 displacement = vec2(
        (wave + 0.48 * crossing) * mix(1.5, 5.0, depth),
        (0.48 * wave + crossing) * mix(0.8, 2.9, depth)
      );
      vec2 samplePoint = uv + displacement / size;
      color = texture2D(u_photo, samplePoint).rgb;
      alpha = min(mask.r, texture2D(u_mask, samplePoint).r);
      float highlight = smoothstep(0.5, 0.92, dot(color, vec3(0.24, 0.60, 0.16)));
      float shimmer = sin(p.x * 0.055 + p.y * 0.048 - u_time * 3.1 + crossing * 1.5);
      color += 0.095 * highlight * shimmer;
    } else {
      float looseEdge = smoothstep(792.0, 915.0, p.x);
      float fold = p.x * 0.093 + p.y * 0.031 - u_time * 6.0;
      float gust = 0.74 + 0.26 * sin(u_time * 1.55 + 1.0);
      vec2 displacement = vec2(sin(fold + 0.9) * 3.1, sin(fold) * 5.1) * looseEdge * gust;
      vec2 samplePoint = uv + displacement / size;
      color = texture2D(u_photo, samplePoint).rgb;
      alpha = min(mask.g, texture2D(u_mask, samplePoint).g);
      color *= 1.0 + sin(fold - 0.4) * 0.16 * looseEdge * gust;
    }

    gl_FragColor = vec4(clamp(color, 0.0, 1.0) * alpha, alpha);
  }
`;

function makeMask() {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 1067;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return null;
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(canvas.width / 1000, canvas.height / 1778);

  const paint = (points: number[][], color: string, blur: string) => {
    context.filter = blur;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) context.lineTo(x, y);
    context.closePath();
    context.fill();
  };

  paint(waterBehindBoat, "#f00", "blur(3px)");
  paint(waterInFront, "#f00", "blur(3px)");
  paint(flag, "#0f0", "blur(0.9px)");
  return canvas;
}

function shader(gl: WebGLRenderingContext, type: number, source: string) {
  const result = gl.createShader(type);
  if (!result) throw new Error("Could not allocate a motion shader.");
  gl.shaderSource(result, source);
  gl.compileShader(result);
  if (gl.getShaderParameter(result, gl.COMPILE_STATUS)) return result;
  gl.deleteShader(result);
  throw new Error("Could not compile a motion shader.");
}

function createRenderer(canvas: HTMLCanvasElement, image: HTMLImageElement) {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
    powerPreference: "low-power",
  });
  const mask = makeMask();
  if (!gl || !mask) return null;

  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  if (!program || !buffer) return null;

  const textures: WebGLTexture[] = [];
  const shaders: WebGLShader[] = [];
  const dispose = () => {
    for (const texture of textures) gl.deleteTexture(texture);
    for (const item of shaders) gl.deleteShader(item);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
  };

  try {
    shaders.push(shader(gl, gl.VERTEX_SHADER, vertexSource));
    shaders.push(shader(gl, gl.FRAGMENT_SHADER, fragmentSource));
    for (const item of shaders) gl.attachShader(program, item);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error("Could not link the motion shader.");
    }
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    [image, mask].forEach((source, index) => {
      const texture = gl.createTexture();
      if (!texture) throw new Error("Could not allocate a motion texture.");
      textures.push(texture);
      gl.activeTexture(gl.TEXTURE0 + index);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.uniform1i(gl.getUniformLocation(program, index === 0 ? "u_photo" : "u_mask"), index);
    });

    const view = gl.getUniformLocation(program, "u_view");
    const drawn = gl.getUniformLocation(program, "u_drawn");
    const offset = gl.getUniformLocation(program, "u_offset");
    const time = gl.getUniformLocation(program, "u_time");

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      const dpr = Math.min(devicePixelRatio, 1.5, 1250 / Math.max(width, height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);

      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const drawnWidth = image.naturalWidth * scale;
      const drawnHeight = image.naturalHeight * scale;
      const [x, y] = getComputedStyle(image).objectPosition.split(" ");
      const align = (value: string, fallback: number) => value?.endsWith("%") ? parseFloat(value) / 100 : fallback;
      gl.uniform2f(view, width, height);
      gl.uniform2f(drawn, drawnWidth, drawnHeight);
      gl.uniform2f(offset, (width - drawnWidth) * align(x, 0.5), (height - drawnHeight) * align(y, 0.4));
    };

    resize();
    return {
      resize,
      draw(seconds: number) {
        gl.uniform1f(time, seconds % (Math.PI * 40));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      dispose,
    };
  } catch {
    dispose();
    return null;
  }
}

export function initDayMotion(figure: HTMLElement): () => void {
  const image = figure.querySelector("img");
  const canvas = figure.querySelector("canvas");
  if (!image || !canvas) return () => {};

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let renderer: ReturnType<typeof createRenderer> = null;
  let frame = 0;
  let lastDraw = 0;
  let visible = false;
  let failed = false;
  let contextLost = false;

  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    canvas.style.visibility = "hidden";
  };

  const draw = (now: number) => {
    if (now - lastDraw >= 32) {
      renderer?.draw(now / 1000);
      lastDraw = now;
    }
    frame = requestAnimationFrame(draw);
  };

  const sync = () => {
    if (!visible || reducedMotion.matches || document.hidden || failed || contextLost ||
        figure.hasAttribute("data-motion-paused") || !image.complete || !image.naturalWidth) {
      if (reducedMotion.matches || failed || contextLost) figure.removeAttribute("data-motion-ready");
      stop();
      return;
    }
    if (frame) return;
    renderer ??= createRenderer(canvas, image);
    if (!renderer) {
      failed = true;
      figure.removeAttribute("data-motion-ready");
      stop();
      return;
    }
    renderer.resize();
    renderer.draw(performance.now() / 1000);
    canvas.style.visibility = "visible";
    figure.setAttribute("data-motion-ready", "");
    frame = requestAnimationFrame(draw);
  };

  const lose = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    renderer = null;
    sync();
  };
  const restore = () => {
    contextLost = false;
    sync();
  };

  canvas.style.visibility = "hidden";
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  const resize = new ResizeObserver(() => {
    renderer?.resize();
    if (frame) renderer?.draw(performance.now() / 1000);
  });
  const pause = new MutationObserver(sync);
  intersection.observe(figure);
  resize.observe(figure);
  pause.observe(figure, { attributes: true, attributeFilter: ["data-motion-paused"] });
  reducedMotion.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  image.addEventListener("load", sync);
  canvas.addEventListener("webglcontextlost", lose);
  canvas.addEventListener("webglcontextrestored", restore);

  return () => {
    stop();
    figure.removeAttribute("data-motion-ready");
    intersection.disconnect();
    resize.disconnect();
    pause.disconnect();
    reducedMotion.removeEventListener("change", sync);
    document.removeEventListener("visibilitychange", sync);
    image.removeEventListener("load", sync);
    canvas.removeEventListener("webglcontextlost", lose);
    canvas.removeEventListener("webglcontextrestored", restore);
    renderer?.dispose();
  };
}
