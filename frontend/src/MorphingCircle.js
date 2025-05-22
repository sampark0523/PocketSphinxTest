import React, { useRef, useEffect } from 'react';

function MorphingCircle({ isAiThinking }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // Enhanced particle system
    const particleCount = 200;
    let particles = Array(particleCount).fill().map(() => ({
      x: width / 2 + (Math.random() - 0.5) * 400,
      y: height / 2 + (Math.random() - 0.5) * 400,
      size: Math.random() * 4 + 1,
      speedX: (Math.random() - 0.5) * 2,
      speedY: (Math.random() - 0.5) * 2,
      life: Math.random(),
      maxLife: Math.random() * 0.02 + 0.005,
      hue: Math.random() * 60 - 30,
      orbit: Math.random() * Math.PI * 2,
      orbitSpeed: (Math.random() - 0.5) * 0.02,
      orbitRadius: Math.random() * 100 + 50,
      glowIntensity: Math.random() * 0.5 + 0.5
    }));

    let time = 0;
    let lastTime = 0;
    const fps = 60;
    const frameTime = 1000 / fps;

    // Create off-screen canvas for glow
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = width;
    glowCanvas.height = height;
    const glowCtx = glowCanvas.getContext('2d');

    function createNebulousGlow(x, y, size, color, intensity) {
      const gradient = glowCtx.createRadialGradient(x, y, 0, x, y, size);
      gradient.addColorStop(0, `rgba(${color}, ${intensity})`);
      gradient.addColorStop(0.4, `rgba(${color}, ${intensity * 0.4})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      return gradient;
    }

    function draw(timestamp) {
      if (!lastTime) lastTime = timestamp;
      const delta = timestamp - lastTime;

      if (delta < frameTime) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      time += 0.016;
      lastTime = timestamp;

      // Clear both canvases
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, width, height);
      glowCtx.clearRect(0, 0, width, height);

      // Center point
      const cx = width / 2;
      const cy = height / 2;

      // Update and draw particles
      particles.forEach((particle, i) => {
        particle.orbit += particle.orbitSpeed * (isAiThinking ? 2 : 1);

        const targetX = cx + Math.cos(particle.orbit) * particle.orbitRadius;
        const targetY = cy + Math.sin(particle.orbit) * particle.orbitRadius;

        const chaos = isAiThinking
          ? Math.sin(time * 2 + i) * 20
          : Math.sin(time + i) * 10;

        particle.x += (targetX - particle.x) * 0.02 + chaos * 0.1;
        particle.y += (targetY - particle.y) * 0.02 + chaos * 0.1;

        particle.life += particle.maxLife;
        if (particle.life >= 1) {
          particle.life = 0;
          particle.x = cx + (Math.random() - 0.5) * 400;
          particle.y = cy + (Math.random() - 0.5) * 400;
          particle.orbit = Math.random() * Math.PI * 2;
        }

        const baseColor = isAiThinking
          ? [0, 150 + particle.hue, 255]
          : [100, 255 + particle.hue, 180];

        const intensity = particle.glowIntensity * (1 - particle.life);

        const glow = createNebulousGlow(
          particle.x,
          particle.y,
          particle.size * 15,
          baseColor.join(','),
          intensity * 0.3
        );

        glowCtx.beginPath();
        glowCtx.fillStyle = glow;
        glowCtx.arc(particle.x, particle.y, particle.size * 15, 0, Math.PI * 2);
        glowCtx.fill();

        ctx.beginPath();
        ctx.fillStyle = `rgba(${baseColor.join(',')}, ${intensity})`;
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Lines between close particles
      particles.forEach((p1, i) => {
        particles.slice(i + 1).forEach(p2 => {
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 100) {
            const opacity = (1 - distance / 100) * 0.2;
            ctx.beginPath();
            ctx.strokeStyle = isAiThinking
              ? `rgba(0, 150, 255, ${opacity})`
              : `rgba(100, 255, 180, ${opacity})`;
            ctx.lineWidth = 1;
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        });
      });

      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(glowCanvas, 0, 0);
      ctx.globalCompositeOperation = 'source-over';

      // Central energy core
      const coreSize = 150 + Math.sin(time * 2) * 20;
      const coreColor = isAiThinking
        ? ['0, 150, 255', '0, 100, 255', '0, 50, 255']
        : ['100, 255, 180', '50, 200, 150', '0, 150, 100'];

      const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreSize);
      coreGlow.addColorStop(0, `rgba(${coreColor[0]}, 0.2)`);
      coreGlow.addColorStop(0.5, `rgba(${coreColor[1]}, 0.1)`);
      coreGlow.addColorStop(1, `rgba(${coreColor[2]}, 0)`);

      ctx.beginPath();
      ctx.fillStyle = coreGlow;
      ctx.arc(cx, cy, coreSize, 0, Math.PI * 2);
      ctx.fill();

      animationFrameId = requestAnimationFrame(draw);
    }

    let animationFrameId = requestAnimationFrame(draw);

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      glowCanvas.width = width;
      canvas.height = height;
      glowCanvas.height = height;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isAiThinking]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%',
        background: '#000'
      }} 
    />
  );
}

export default MorphingCircle;
