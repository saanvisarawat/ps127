import { useEffect, useRef } from 'react';

// Logical drawing resolution — the canvas element is scaled to its container
// via CSS, so this only needs to match the aspect ratio set on .landing-graphic.
const W = 460;
const H = 430;
const ACCENT = '57, 255, 20';

const NODES = [
  { x: 70, y: 100 },
  { x: 200, y: 55 },
  { x: 340, y: 110 },
  { x: 400, y: 230 },
  { x: 280, y: 300 },
  { x: 140, y: 270 },
  { x: 60, y: 370 },
  { x: 360, y: 380 },
  { x: 230, y: 200 },
];

const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
  [5, 6], [4, 7], [1, 8], [5, 8], [3, 8], [8, 0],
];

// A subset of edges carries a moving "vehicle" trace — not every road, so it
// stays readable rather than noisy.
const TRACE_EDGE_INDICES = [0, 2, 4, 7, 9, 11];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export default function HeroGraphic() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // Randomized-but-stable-per-mount timing so nodes/traces never sync up.
    const pings = NODES.map(() => ({
      period: 3200 + Math.random() * 3200,
      offset: Math.random() * 6000,
    }));
    const traces = TRACE_EDGE_INDICES.map((edgeIdx) => ({
      edgeIdx,
      duration: 2600 + Math.random() * 2600,
      offset: Math.random(),
      reverse: Math.random() > 0.5,
    }));

    // Faint road-grid backdrop, rendered once to an offscreen canvas since it never changes.
    const bg = document.createElement('canvas');
    bg.width = W * dpr;
    bg.height = H * dpr;
    const bgCtx = bg.getContext('2d');
    bgCtx.scale(dpr, dpr);
    bgCtx.strokeStyle = `rgba(${ACCENT}, 0.05)`;
    bgCtx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const y = 20 + i * 78;
      bgCtx.beginPath();
      bgCtx.moveTo(0, y);
      bgCtx.lineTo(W, y + (i % 2 === 0 ? 12 : -12));
      bgCtx.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const x = 10 + i * 90;
      bgCtx.beginPath();
      bgCtx.moveTo(x, 0);
      bgCtx.lineTo(x + (i % 2 === 0 ? -16 : 16), H);
      bgCtx.stroke();
    }

    let raf;
    function frame(t) {
      ctx.clearRect(0, 0, W, H);

      // Layer 1 (furthest back): blurred faint city-grid backdrop.
      ctx.save();
      ctx.filter = 'blur(1.2px)';
      ctx.drawImage(bg, 0, 0, W, H);
      ctx.restore();

      // Layer 2: road/connection edges linking the camera nodes.
      ctx.strokeStyle = `rgba(${ACCENT}, 0.16)`;
      ctx.lineWidth = 1;
      EDGES.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(NODES[a].x, NODES[a].y);
        ctx.lineTo(NODES[b].x, NODES[b].y);
        ctx.stroke();
      });

      // Layer 3: expanding detection pings, staggered per node.
      NODES.forEach((n, i) => {
        const { period, offset } = pings[i];
        const progress = ((t + offset) % period) / period;
        if (progress < 0.6) {
          const p = progress / 0.6;
          ctx.beginPath();
          ctx.arc(n.x, n.y, lerp(4, 24, p), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${ACCENT}, ${(1 - p) * 0.55})`;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      });

      // Layer 4: camera node cores.
      NODES.forEach((n) => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${ACCENT}, 0.9)`;
        ctx.shadowColor = `rgba(${ACCENT}, 0.8)`;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Layer 5 (foreground, brightest): moving vehicle traces along the roads.
      traces.forEach(({ edgeIdx, duration, offset, reverse }) => {
        const [a, b] = EDGES[edgeIdx];
        const start = reverse ? NODES[b] : NODES[a];
        const end = reverse ? NODES[a] : NODES[b];
        const tp = (t / duration + offset) % 1;
        const fadeWindow = 0.12;
        let alpha = 1;
        if (tp < fadeWindow) alpha = tp / fadeWindow;
        else if (tp > 1 - fadeWindow) alpha = (1 - tp) / fadeWindow;

        const x = lerp(start.x, end.x, tp);
        const y = lerp(start.y, end.y, tp);
        const tailT = Math.max(0, tp - 0.06);
        const tx = lerp(start.x, end.x, tailT);
        const ty = lerp(start.y, end.y, tailT);

        const grad = ctx.createLinearGradient(tx, ty, x, y);
        grad.addColorStop(0, `rgba(${ACCENT}, 0)`);
        grad.addColorStop(1, `rgba(234, 255, 240, ${alpha * 0.9})`);

        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.shadowColor = `rgba(${ACCENT}, ${alpha * 0.7})`;
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="hero-graphic-canvas" style={{ width: '100%', height: '100%' }} />;
}
