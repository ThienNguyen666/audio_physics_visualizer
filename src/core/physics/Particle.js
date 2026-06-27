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

      update(audioData, canvasWidth, canvasHeight) {
            const dynamicGravity = PHYSICS.GRAVITY_BASE + PHYSICS.BASS_MULTIPLIER * audioData.bass;
            
            const thermalEnergy = PHYSICS.TREBLE_MULTIPLIER * audioData.treble;
            const stochasticForceX = (Math.random() - 0.5) * thermalEnergy;
            const stochasticForceY = (Math.random() - 0.5) * thermalEnergy;
            
            // LOGIC LỰC TRUNG TÂM (CENTRAL FORCES)
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight / 2;
            const dx = centerX - this.x;
            const dy = centerY - this.y;
            
            const distance = Math.sqrt(dx * dx + dy * dy) || 1; 
            
            const dirX = dx / distance;
            const dirY = dy / distance;

            const pullForce = audioData.mid * PHYSICS.MID_PULL_FORCE;

            let pushForce = 0;
            if (audioData.bass > 0.5) { 
                 pushForce = (audioData.bass * PHYSICS.BASS_PUSH_FORCE * 100) / distance;
            }

            const centralForceX = dirX * (pullForce - pushForce);
            const centralForceY = dirY * (pullForce - pushForce);

            this.vx = (this.vx * (1 - PHYSICS.DAMPING)) + stochasticForceX + centralForceX;
            this.vy = (this.vy * (1 - PHYSICS.DAMPING)) + dynamicGravity + stochasticForceY + centralForceY;

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