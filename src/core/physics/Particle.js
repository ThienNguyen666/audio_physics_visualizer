import { PHYSICS } from "../constants";

export class Particle {
      constructor(x, y) {
            this.x = x;
            this.y = y;

            this.vx = (Math.random() - 0.5) * 2;
            this.vy = (Math.random() - 0.5) * 2;

            this.radius = PHYSICS.PARTICLE_RADIUS;

            this.mass = 1;
      }

      update(audioData, canvasWidth, canvasHeight, mouseState) {
            const dynamicGravity = PHYSICS.GRAVITY_BASE + PHYSICS.BASS_MULTIPLIER * audioData.bass;
            
            const thermalEnergy = PHYSICS.TREBLE_MULTIPLIER * audioData.treble;
            const stochasticForceX = (Math.random() - 0.5) * thermalEnergy;
            const stochasticForceY = (Math.random() - 0.5) * thermalEnergy;
            
            // LOGIC LỰC TRUNG TÂM (CENTRAL FORCES)
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight / 2;
            const dxCenter = centerX - this.x;
            const dyCenter = centerY - this.y;
            
            const distCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter) || 1; 
            
            const pullForceCenter = audioData.mid * PHYSICS.MID_PULL_FORCE;
            let pushForceCenter = 0;
            if (audioData.bass > 0.5) { 
                 pushForceCenter = (audioData.bass * PHYSICS.BASS_PUSH_FORCE * 100) / distCenter;
            }

            const centralForceX = (dxCenter / distCenter) * (pullForceCenter - pushForceCenter);
            const centralForceY = (dyCenter / distCenter) * (pullForceCenter - pushForceCenter);

            // TƯƠNG TÁC VẬT LÝ TỪ NGƯỜI DÙNG
            let mouseForceX = 0;
            let mouseForceY = 0;

            // 2A. Hố đen hấp dẫn (Chuột Hover / Chạm)
            if (mouseState.isActive) {
                  const dxMouse = mouseState.x - this.x;
                  const dyMouse = mouseState.y - this.y;
                  const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse) || 1;

                  if (distMouse < PHYSICS.MOUSE_INTERACTION_RADIUS) {
                        // Càng gần chuột hút càng mạnh (tỉ lệ nghịch)
                        const pullStrength = PHYSICS.MOUSE_PULL_FORCE * (1 - distMouse / PHYSICS.MOUSE_INTERACTION_RADIUS);
                        mouseForceX += (dxMouse / distMouse) * pullStrength;
                        mouseForceY += (dyMouse / distMouse) * pullStrength;
                  }
            }

            // 2B. Sóng xung kích nổ tung (Mouse Click / Chạm)
            for (let i = 0; i < mouseState.shockwaves.length; i++) {
                  const sw = mouseState.shockwaves[i];
                  const dxWave = this.x - sw.x;
                  const dyWave = this.y - sw.y;
                  const distWave = Math.sqrt(dxWave * dxWave + dyWave * dyWave) || 1;
                  
                  // Chỉ hạt nằm ĐÚNG TRÊN VÀNH ĐAI sóng mới bị tác động (Wavefront logic)
                  const waveThickness = 40; 
                  const distToWave = Math.abs(distWave - sw.radius);
                  
                  if (distToWave < waveThickness) {
                        // Tính toán lực đẩy (càng nằm chính giữa vành đai đẩy càng văng)
                        const pushStrength = PHYSICS.SHOCKWAVE_PUSH_FORCE * sw.life * (1 - distToWave / waveThickness);
                        // dxWave, dyWave là hướng từ TÂM NỔ ra HẠT, nên ta cộng vào (đẩy ra xa)
                        mouseForceX += (dxWave / distWave) * pushStrength; 
                        mouseForceY += (dyWave / distWave) * pushStrength;
                  }
            }
            // ==========================================
            
            this.vx = (this.vx * (1 - PHYSICS.DAMPING)) + stochasticForceX + centralForceX + mouseForceX;
            this.vy = (this.vy * (1 - PHYSICS.DAMPING)) + dynamicGravity + stochasticForceY + centralForceY + mouseForceY;

            this.x += this.vx;
            this.y += this.vy;

            this._handleBoundaryCollision(canvasWidth, canvasHeight);
      }

      _handleBoundaryCollision(width, height){
            if(this.x < this.radius){
                  this.x = this.radius;
                  this.vx *= - PHYSICS.RESTITUTION;
            } else if(this.x > width - this.radius){
                  this.x = width - this.radius;
                  this.vx *= - PHYSICS.RESTITUTION;
            }

            if(this.y < this.radius){
                  this.y = this.radius;
                  this.vy *= - PHYSICS.RESTITUTION;
            } else if(this.y > height - this.radius){
                  this.y = height - this.radius;
                  this.vy *= - PHYSICS.RESTITUTION;
            }
      }

      resolveCollision(otherParticle) {
            const dx = this.x - otherParticle.x;
            const dy = this.y - otherParticle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDist = this.radius + otherParticle.radius;

            if(distance < minDist && distance > 0) {
                  const overlap = minDist - distance;

                  const nx = dx / distance;
                  const ny = dy / distance;

                  this.x -= nx * overlap * 0.5;
                  this.y -= ny * overlap * 0.5;

                  otherParticle.x -= nx * overlap * 0.5;
                  otherParticle.y -= ny * overlap * 0.5;

                  const dvx = otherParticle.vx - this.vx;
                  const dvy = otherParticle.vy - this.vy;

                  const velocityAlongNormal = nx * dvx + ny * dvy;

                  if(velocityAlongNormal < 0) return;

                  const impulse = - (1 + PHYSICS.RESTITUTION) * velocityAlongNormal / (1 / this.mass + 1 / otherParticle.mass);

                  const impulseX = impulse * nx;
                  const impulseY = impulse * ny;

                  this.vx -= impulseX / this.mass;
                  this.vy -= impulseY / this.mass;

                  otherParticle.vx += impulseX / otherParticle.mass;
                  otherParticle.vy += impulseY / otherParticle.mass;
            }
      }
}