import React, {useEffect, useRef, useCallback} from "react";
import { Particle } from "../../core/physics/Particle";
import { SpatialHash } from "../../core/physics/SpatialHash";
import { PHYSICS } from "../../core/constants";
import { useGameLoop } from "../../hooks/useGameLoop";

export const PhysicsCanvas = ({ analyzerRef, isDebugMode, particleCount, theme }) => {
      const canvasRef = useRef(null);
      const particlesRef = useRef([]);
      const spatialHashRef = useRef(null);
      const fpsRef = useRef(0);

      const mouseRef = useRef({ x: 0, y: 0, isActive: false, shockwaves: [] });

      // KHỞI TẠO CANVAS & RESIZE
      useEffect(() => {
            const canvas = canvasRef.current;
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            spatialHashRef.current = new SpatialHash(canvas.width, canvas.height);

            const handleResize = () => {
                  canvas.width = window.innerWidth;
                  canvas.height = window.innerHeight;
                  spatialHashRef.current = new SpatialHash(canvas.width, canvas.height);
            };
            window.addEventListener("resize", handleResize);
            return () => window.removeEventListener("resize", handleResize);
      }, []);

      // ĐIỀU CHỈNH SỐ LƯỢNG HẠT ĐỘNG (Không làm lag màn hình)
      useEffect(() => {
            const canvas = canvasRef.current;
            const currentCount = particlesRef.current.length;
            
            if (particleCount > currentCount) {
                  for(let i = 0; i < particleCount - currentCount; ++i) {
                        const px = Math.random() * (canvas?.width || 1000);
                        const py = Math.random() * (canvas?.height || 1000);
                        particlesRef.current.push(new Particle(px, py));
                  }
            } else if (particleCount < currentCount) {
                  particlesRef.current.splice(particleCount);
            }
      }, [particleCount]);

      // VÒNG LẶP ĐỒ HỌA CHÍNH (Thêm dependency 'theme')
      const gameLoopCallback = useCallback((deltaTime) => {
            const canvas = canvasRef.current;
            if(!canvas) return;
            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;

            fpsRef.current = Math.round(1000 / deltaTime);

            let audioData = { bass: 0, mid: 0, treble: 0 };
            if(analyzerRef.current) audioData = analyzerRef.current.update();

            const bass = Math.min(1, audioData.bass * 1.5); 
            const mid = Math.min(1, (audioData.mid || 0) * 1.5);
            const treble = Math.min(1, audioData.treble * 1.5);

            // TÍNH NĂNG BACKGROUND GLOW (NHẤP NHÁY NỀN)
            let bgHue = 0;
            if (theme === 'cyberpunk') bgHue = 280; // Tím đen
            else if (theme === 'matrix') bgHue = 120; // Xanh rêu
            else if (theme === 'volcanic') bgHue = 0; // Đỏ mờ
            else if (theme === 'ocean') bgHue = 220; // Xanh biển sâu

            const bgLightness = bass * 15; 
            
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = `hsla(${bgHue}, 50%, ${bgLightness}%, 0.2)`; 
            ctx.fillRect(0, 0, width, height);
            

            const hash = spatialHashRef.current;
            hash.clear();
            const particles = particlesRef.current;
            
            for(let i = 0; i < particles.length; i++) hash.insert(particles[i]);

            
            // 2. BỘ LỌC THEME MÀU SẮC (COLOR PRESETS) 
            let finalHue, lightness;
            
            if (theme === 'cyberpunk') {
                  const timeHue = (Date.now() * 0.02) % 360; 
                  const hueOffset = (bass * 100) - (treble * 80) + (mid * 40); 
                  finalHue = Math.abs((timeHue + hueOffset) % 360);
                  lightness = 40 + (bass * 25) + (mid * 20); 
            } else if (theme === 'matrix') {
                  finalHue = 120; // Khóa chặt màu xanh lá
                  lightness = 30 + (bass * 40) + (mid * 20); 
            } else if (theme === 'volcanic') {
                  finalHue = 10 + (bass * 30) - (treble * 10); // Chuyển từ Cam -> Đỏ rực
                  lightness = 40 + (bass * 30);
            } else if (theme === 'ocean') {
                  finalHue = 200 + (bass * 40) + (treble * 20); // Chuyển từ Xanh dương -> Lục lam
                  lightness = 40 + (bass * 20) + (mid * 10);
            }
            const particleColor = `hsl(${Math.floor(finalHue)}, 100%, ${lightness}%)`;
            

            ctx.globalCompositeOperation = 'lighter'; 
            ctx.fillStyle = particleColor;
            ctx.shadowBlur = 5 + (bass * 15) + (treble * 5); 
            ctx.shadowColor = particleColor;
            
            ctx.beginPath();
            for(let i = 0; i < particles.length; i++) {
                  const p = particles[i];
                  const neighbors = hash.query(p);
                  for(let j = 0; j < neighbors.length; j++) {
                        const other = neighbors[j];
                        if(p !== other) p.resolveCollision(other);
                  }

                  p.update(audioData, width, height, mouseRef.current);
                  ctx.moveTo(p.x, p.y);
                  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            }
            ctx.fill();

            // VẼ HIỆU ỨNG NỔ (SHOCKWAVES)
            const activeShockwaves = [];
            for (let i = 0; i < mouseRef.current.shockwaves.length; i++) {
                  const sw = mouseRef.current.shockwaves[i];
                  ctx.beginPath();
                  ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
                  ctx.strokeStyle = `rgba(255, 255, 255, ${sw.life})`;
                  ctx.lineWidth = 2 + (1 - sw.life) * 10;
                  ctx.stroke();
                  sw.radius += PHYSICS.SHOCKWAVE_EXPANSION_SPEED;
                  sw.life -= 0.03;
                  if (sw.life > 0) activeShockwaves.push(sw);
            }
            mouseRef.current.shockwaves = activeShockwaves;

            ctx.shadowBlur = 0;
            ctx.globalCompositeOperation = 'source-over';

            if(isDebugMode) drawDebugInfo(ctx, width, height, hash.cellSize);
      }, [analyzerRef, isDebugMode, theme]); // <= Thêm theme vào Dependency để nó cập nhật màu liên tục

      useGameLoop(gameLoopCallback);

      // CÁC HÀM XỬ LÝ CHUỘT
      const updateMousePosition = (x, y) => { 
            mouseRef.current.x = x; 
            mouseRef.current.y = y; 
            mouseRef.current.isActive = true; 
      };

      const handleMouseDown = (e) => { 
            updateMousePosition(e.clientX, e.clientY); 
            mouseRef.current.shockwaves.push({ x: e.clientX, y: e.clientY, radius: 10, life: 1.0 }); 
      };
      const handleTouchStart = (e) => { 
            const touch = e.touches[0]; 
            updateMousePosition(touch.clientX, touch.clientY); 
            mouseRef.current.shockwaves.push({ x: touch.clientX, y: touch.clientY, radius: 10, life: 1.0 }); 
      };
      
      const drawDebugInfo = (ctx, width, height, cellSize) => {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)'; ctx.lineWidth = 1; ctx.beginPath();
            for(let x = 0; x < width; x += cellSize) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
            for(let y = 0; y < height; y += cellSize) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
            ctx.stroke();
            ctx.fillStyle = 'lime'; ctx.font = '20px monospace';
            ctx.fillText(`FPS: ${fpsRef.current}`, 20, 30);
            ctx.fillText(`Particles: ${particlesRef.current.length}`, 20, 60);
      };

      return (
            <canvas 
                  ref={canvasRef} 
                  onMouseMove={(e) => updateMousePosition(e.clientX, e.clientY)}
                  onMouseLeave={() => mouseRef.current.isActive = false}
                  onMouseDown={handleMouseDown}
                  onTouchMove={(e) => updateMousePosition(e.touches[0].clientX, e.touches[0].clientY)}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={() => mouseRef.current.isActive = false}
                  style={{ display: 'block', background: '#000', cursor: 'crosshair', touchAction: 'none' }} 
            />
      );
};