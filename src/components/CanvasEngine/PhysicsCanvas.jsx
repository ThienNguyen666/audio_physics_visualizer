import React, {useEffect, useRef, useCallback} from "react";
import { Particle } from "../../core/physics/Particle";
import { SpatialHash } from "../../core/physics/SpatialHash";

import { PHYSICS } from "../../core/constants";

import { useGameLoop } from "../../hooks/useGameLoop";

export const PhysicsCanvas = ({ analyzerRef, isDebugMode }) => {
      const canvasRef = useRef(null);
      const particlesRef = useRef([]);
      const spatialHashRef = useRef(null);

      const fpsRef = useRef(0);

      useEffect(() => {
            const canvas = canvasRef.current;

            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            spatialHashRef.current = new SpatialHash(canvas.width, canvas.height);

            const NUM_PARTICLES = 1000;
            particlesRef.current = [];

            for(let i = 0; i < NUM_PARTICLES; ++i) {
                 const x = Math.random() * canvas.width;
                 const y = Math.random() * canvas.height;
                 particlesRef.current.push(new Particle(x, y));
            }

            const handleResize = () => {
                  canvas.width = window.innerWidth;
                  canvas.height = window.innerHeight;
                  spatialHashRef.current = new SpatialHash(canvas.width, canvas.height);
            };

            window.addEventListener("resize", handleResize);

            return () => window.removeEventListener("resize", handleResize);
      }, []);

      const gameLoopCallback = useCallback((deltaTime) => {
            const canvas = canvasRef.current;
            if(!canvas) return;

            const ctx = canvas.getContext("2d");
            const width = canvas.width;
            const height = canvas.height;

            fpsRef.current = Math.round(1000 / deltaTime);

            // HIỆU ỨNG MOTION BLUR (VỆT CHUYỂN ĐỘNG)
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
            ctx.fillRect(0, 0, width, height);

            let audioData = {
                  bass: 0,
                  treble: 0,
            };

            if(analyzerRef.current) {
                  audioData = analyzerRef.current.update();
            }

            const hash = spatialHashRef.current;
            hash.clear();
            const particles = particlesRef.current;

            for(let i = 0; i < particles.length; ++i) {
                  hash.insert(particles[i]);
            }
            
            // DYNAMIC COLOR MAPPING (MÀU THEO PHỔ ÂM)
            const bass = Math.min(1, audioData.bass * 1.5); 
            const mid = Math.min(1, (audioData.mid || 0) * 1.5);
            const treble = Math.min(1, audioData.treble * 1.5);

            const timeHue = (Date.now() * 0.02) % 360; 
            const hueOffset = (bass * 100) - (treble * 80) + (mid * 40);
            const finalHue = Math.abs((timeHue + hueOffset) % 360);
            
            const lightness = 40 + (bass * 25) + (mid * 20); 

            const particleColor = `hsl(${Math.floor(finalHue)}, 100%, ${lightness}%)`;
            
            // GLOW & NEON PARTICLES (PHÁT SÁNG)
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = particleColor;

            ctx.shadowBlur = 5 + bass * 15 + treble * 5; 
            ctx.shadowColor = particleColor;

            ctx.beginPath();

            for(let i = 0; i < particles.length; ++i) {
                  const p = particles[i];
                  
                  const neighbors = hash.query(p);
                  for(let j = 0; j < neighbors.length; ++j) {
                        const other = neighbors[j];
                        if(p !== other){
                              p.resolveCollision(other);
                        }
                  }

                  p.update(audioData, width, height);

                  ctx.moveTo(p.x, p.y);
                  ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI);
            }
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.globalCompositeOperation = "source-over";

            if(isDebugMode) {
                  drawDebugInfo(ctx, width, height, hash.cellSize);
            }
      }, [analyzerRef, isDebugMode]);

      useGameLoop(gameLoopCallback);

      const drawDebugInfo = (ctx, width, height, cellSize) => {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();

            for(let x = 0; x < width; x += cellSize) {
                  ctx.moveTo(x, 0);
                  ctx.lineTo(x, height);
            }
            for(let y = 0; y < height; y += cellSize) {
                  ctx.moveTo(0, y);
                  ctx.lineTo(width, y);
            }
            ctx.stroke();
            
            ctx.fillStyle = 'lime';
            ctx.font = '20px monospace';

            ctx.fillText(`FPS: ${fpsRef.current}`, 20, 30);
            ctx.fillText(`Particles: ${particlesRef.current.length}`, 20, 60);
      };

      return (
            <canvas ref={canvasRef} style = {{ display : "block", background : '#111'}}/>
      );
}