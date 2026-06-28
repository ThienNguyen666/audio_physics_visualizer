import React, { useEffect, useRef, useCallback } from "react";
import init, { Universe } from "../../../physics-core/pkg/physics_core.js";

export const PhysicsCanvas = ({ analyzerRef, isDebugMode, particleCount, theme }) => {
      const canvasRef = useRef(null);
      const universeRef = useRef(null);
      const requestRef = useRef(null);
      const wasmMemoryRef = useRef(null); 

      const fpsRef = useRef(0);
      const lastFpsUpdateRef = useRef(0);
      const frameCountRef = useRef(0);

      const mouseRef = useRef({ x: 0, y: 0, isActive: false, shockwaves: [] });

      useEffect(() => {
            let isMounted = true;
            const loadWasm = async () => {
                  const wasm = await init(); 
                  if (!isMounted) return;
                  wasmMemoryRef.current = wasm.memory; 
                  if (universeRef.current) universeRef.current.free(); 
                  
                  universeRef.current = Universe.new(window.innerWidth || 1000, window.innerHeight || 1000, particleCount);
            };
            loadWasm();
            return () => {
                  isMounted = false;
                  if (universeRef.current) { universeRef.current.free(); universeRef.current = null; }
            };
      }, []); 

      useEffect(() => {
            if (universeRef.current) {
                  universeRef.current.set_particle_count(particleCount);
            }
      }, [particleCount]);

      useEffect(() => {
            const canvas = canvasRef.current;
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            const handleResize = () => {
                  canvas.width = window.innerWidth;
                  canvas.height = window.innerHeight;
                  if (universeRef.current) universeRef.current.resize_canvas(canvas.width, canvas.height);
            };
            window.addEventListener("resize", handleResize);
            return () => window.removeEventListener("resize", handleResize);
      }, []);

      const renderLoop = useCallback((timestamp, lastTime = timestamp) => {
            if (!universeRef.current || !wasmMemoryRef.current) {
                  requestRef.current = requestAnimationFrame((t) => renderLoop(t, lastTime));
                  return;
            }

            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            frameCountRef.current++;

            if (!lastFpsUpdateRef.current) {
                  lastFpsUpdateRef.current = timestamp;
            }

            // CỨ MỖI 500ms (0.5 GIÂY) MỚI CẬP NHẬT CON SỐ FPS 1 LẦN
            if (timestamp - lastFpsUpdateRef.current >= 500) {
                  const delta = timestamp - lastFpsUpdateRef.current;
                  
                  fpsRef.current = Math.round((frameCountRef.current * 1000) / delta);
                  
                  frameCountRef.current = 0;
                  lastFpsUpdateRef.current = timestamp;
            }
            
            let audioData = { bass: 0, mid: 0, treble: 0 };
            if (analyzerRef.current) {
                  audioData = analyzerRef.current.update();
            }

            let bgHue = 0;
            if (theme === 'cyberpunk') bgHue = 280; 
            else if (theme === 'matrix') bgHue = 120; 
            else if (theme === 'volcanic') bgHue = 0; 
            else if (theme === 'ocean') bgHue = 220; 

            // Cập nhật background glow nhẹ nhàng
            const bgLightness = audioData.bass * 15; 
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = `hsla(${bgHue}, 50%, ${bgLightness}%, 0.2)`; 
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // GỌI RUST CORE VỚI THÔNG SỐ NGUYÊN BẢN
            universeRef.current.tick(
                  audioData.bass, audioData.mid, audioData.treble, 
                  mouseRef.current.x, mouseRef.current.y, mouseRef.current.isActive
            );

            const renderPtr = universeRef.current.get_render_buffer_ptr();
            const count = universeRef.current.get_particle_count();
            const cells = new Float32Array(wasmMemoryRef.current.buffer, renderPtr, count * 3);

            let finalHue, lightness;
            if (theme === 'cyberpunk') {
                  const timeHue = (Date.now() * 0.02) % 360; 
                  const hueOffset = (audioData.bass * 100) - (audioData.treble * 80) + (audioData.mid * 40); 
                  finalHue = Math.abs((timeHue + hueOffset) % 360);
                  lightness = 40 + (audioData.bass * 25) + (audioData.mid * 20); 
            } else if (theme === 'matrix') {
                  finalHue = 120; lightness = 30 + (audioData.bass * 40) + (audioData.mid * 20); 
            } else if (theme === 'volcanic') {
                  finalHue = 10 + (audioData.bass * 30) - (audioData.treble * 10); lightness = 40 + (audioData.bass * 30);
            } else if (theme === 'ocean') {
                  finalHue = 200 + (audioData.bass * 40) + (audioData.treble * 20); lightness = 40 + (audioData.bass * 20) + (audioData.mid * 10);
            }
            const particleColor = `hsl(${Math.floor(finalHue)}, 100%, ${lightness}%)`;

            ctx.globalCompositeOperation = 'lighter'; 
            ctx.fillStyle = particleColor;

            if (count > 1500) {
                  ctx.shadowBlur = 0;
            } else {
                  ctx.shadowBlur = 5 + (audioData.bass * 15) + (audioData.treble * 5); 
                  ctx.shadowColor = particleColor;
            }

            ctx.beginPath();
            for (let i = 0; i < count; i++) {
                  const x = cells[i * 3];
                  const y = cells[i * 3 + 1];
                  const radius = cells[i * 3 + 2];
                  
                  ctx.moveTo(x + radius, y); 
                  ctx.arc(x, y, radius, 0, Math.PI * 2);
            }
            ctx.fill();

            // VẼ HIỆU ỨNG NỔ SHOCKWAVES CỦA CHUỘT
            const activeShockwaves = [];
            for (let i = 0; i < mouseRef.current.shockwaves.length; i++) {
                  const sw = mouseRef.current.shockwaves[i];
                  ctx.beginPath();
                  ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
                  ctx.strokeStyle = `rgba(255, 255, 255, ${sw.life})`;
                  ctx.lineWidth = 2 + (1 - sw.life) * 10;
                  ctx.stroke();
                  sw.radius += 20;
                  sw.life -= 0.03;
                  if (sw.life > 0) activeShockwaves.push(sw);
            }
            mouseRef.current.shockwaves = activeShockwaves;

            if(isDebugMode) {
                  ctx.globalCompositeOperation = 'source-over';
                  ctx.shadowBlur = 0;
                  
                  // 1. VẼ LƯỚI KHÔNG GIAN (SPATIAL HASH GRID)
                  const cellSize = 16; 
                  ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)'; 
                  ctx.lineWidth = 1; 
                  ctx.beginPath();

                  // Vẽ các đường dọc
                  for(let x = 0; x < canvas.width; x += cellSize) { 
                        ctx.moveTo(x, 0); 
                        ctx.lineTo(x, canvas.height); 
                  }
                  // Vẽ các đường ngang
                  for(let y = 0; y < canvas.height; y += cellSize) { 
                        ctx.moveTo(0, y); 
                        ctx.lineTo(canvas.width, y); 
                  }
                  ctx.stroke();

                  // 2. VẼ TEXT THÔNG SỐ
                  ctx.fillStyle = 'lime'; 
                  ctx.font = '20px monospace';
                  ctx.fillText(`FPS: ${fpsRef.current} (AAA Wasm Core)`, 20, 30);
                  ctx.fillText(`Particles: ${count}`, 20, 60);      
            }

            requestRef.current = requestAnimationFrame((t) => renderLoop(t, timestamp));
      }, [analyzerRef, isDebugMode, theme]);

      useEffect(() => {
            requestRef.current = requestAnimationFrame(renderLoop);
            return () => cancelAnimationFrame(requestRef.current);
      }, [renderLoop]);

      const updateMousePosition = (x, y) => { 
            mouseRef.current.x = x; 
            mouseRef.current.y = y; 
            mouseRef.current.isActive = true; 
      };
      
      const handleMouseDown = (e) => { 
            updateMousePosition(e.clientX, e.clientY); 
            mouseRef.current.shockwaves.push({ x: e.clientX, y: e.clientY, radius: 10, life: 1.0 }); 
            if (universeRef.current) universeRef.current.add_shockwave(e.clientX, e.clientY);
      };

      const handleTouchStart = (e) => { 
            const touch = e.touches[0]; 
            updateMousePosition(touch.clientX, touch.clientY); 
            mouseRef.current.shockwaves.push({ x: touch.clientX, y: touch.clientY, radius: 10, life: 1.0 }); 
            if (universeRef.current) universeRef.current.add_shockwave(touch.clientX, touch.clientY);
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