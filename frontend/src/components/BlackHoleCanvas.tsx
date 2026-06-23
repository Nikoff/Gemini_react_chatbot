import { useEffect, useRef } from 'react';

export function BlackHoleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      time += 0.005;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width * 0.7;
      const cy = canvas.height * 0.5;
      const maxRadius = Math.min(canvas.width, canvas.height) * 0.25;

      for (let ring = 0; ring < 8; ring++) {
        const r = maxRadius * (0.4 + ring * 0.1);
        const alpha = 0.15 - ring * 0.015;
        const speed = 0.3 + ring * 0.05;

        ctx.beginPath();
        for (let a = 0; a < Math.PI * 2; a += 0.05) {
          const wobble = Math.sin(a * 3 + time * speed) * 3;
          const x = cx + (r + wobble) * Math.cos(a + time * speed * 0.2);
          const y = cy + (r + wobble) * Math.sin(a + time * speed * 0.2) * 0.4;
          if (a === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        const hue = 20 + ring * 5;
        ctx.strokeStyle = `hsla(${hue}, 90%, 55%, ${alpha})`;
        ctx.lineWidth = 2 - ring * 0.2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, maxRadius * 0.15, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius * 0.15);
      grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
      grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.9)');
      grad.addColorStop(1, 'rgba(20, 10, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fill();

      for (let i = 0; i < 30; i++) {
        const angle = (i / 30) * Math.PI * 2 + time * 0.1;
        const dist = maxRadius * (0.2 + Math.random() * 0.1);
        const x = cx + dist * Math.cos(angle);
        const y = cy + dist * Math.sin(angle) * 0.4;
        const size = Math.random() * 1.5;

        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 200, 100, ${Math.random() * 0.5})`;
        ctx.fill();
      }

      animFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', resize);
    };
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
