use wasm_bindgen::prelude::*;
use rand::Rng;

// =============================================
// CONSTANTS — Khớp hoàn toàn với constants.js
// =============================================
const GRAVITY_BASE: f64              = 0.05;
const BASS_MULTIPLIER: f64           = 3.0;
const TREBLE_MULTIPLIER: f64         = 40.0;
const DAMPING: f64                   = 0.01;
const RESTITUTION: f64               = 0.9;
const MID_PULL_FORCE: f64            = 0.25;
const BASS_PUSH_FORCE: f64           = 5.0;
const MOUSE_PULL_FORCE: f64          = 1.5;
const MOUSE_INTERACTION_RADIUS: f64  = 150.0;
const SHOCKWAVE_PUSH_FORCE: f64      = 15.0;
const SHOCKWAVE_EXPANSION_SPEED: f64 = 20.0;
const PARTICLE_RADIUS: f64           = 4.0;

// Cấu hình Spatial Hash — Khớp 100% với SPATIAL_CELL_SIZE = 16
const CELL_SIZE: f64                 = 16.0; 
const MAX_SHOCKWAVES: usize          = 16;

#[derive(Clone, Copy)]
struct Particle {
    x: f64, y: f64,
    vx: f64, vy: f64,
}

#[derive(Clone, Copy)]
struct Shockwave {
    x: f64, y: f64,
    radius: f64, life: f64,
}

#[wasm_bindgen]
pub struct Universe {
    particles:        Vec<Particle>,
    shockwaves:       Vec<Shockwave>,
    width:            f64,
    height:           f64,
    render_buffer:    Vec<f32>,         
    shockwave_buffer: Vec<f32>,         
    grid:             Vec<Vec<usize>>,  
    cols:             usize,
    rows:             usize,
}

#[wasm_bindgen]
impl Universe {
    pub fn new(width: f64, height: f64, count: usize) -> Universe {
        let (w, h)  = (width.max(10.0), height.max(10.0));
        let cols    = (w / CELL_SIZE).ceil() as usize;
        let rows    = (h / CELL_SIZE).ceil() as usize;
        let mut rng = rand::thread_rng();

        let particles: Vec<Particle> = (0..count).map(|_| Particle {
            x:  rng.gen_range(0.0..w),
            y:  rng.gen_range(0.0..h),
            vx: rng.gen_range(-1.0..1.0),
            vy: rng.gen_range(-1.0..1.0),
        }).collect();

        Universe {
            particles,
            shockwaves:       Vec::with_capacity(MAX_SHOCKWAVES),
            width: w, height: h,
            render_buffer:    vec![0.0f32; count * 3],
            shockwave_buffer: vec![0.0f32; 1 + MAX_SHOCKWAVES * 4],
            grid:             vec![Vec::new(); cols * rows],
            cols, rows,
        }
    }

    pub fn set_particle_count(&mut self, new_count: usize) {
        let cur = self.particles.len();
        if new_count > cur {
            let mut rng = rand::thread_rng();
            for _ in cur..new_count {
                self.particles.push(Particle {
                    x:  rng.gen_range(0.0..self.width),
                    y:  rng.gen_range(-50.0..0.0),
                    vx: rng.gen_range(-1.0..1.0),
                    vy: rng.gen_range(0.0..1.0),
                });
            }
        } else {
            self.particles.truncate(new_count);
        }
        self.render_buffer.resize(new_count * 3, 0.0);
    }

    pub fn resize_canvas(&mut self, width: f64, height: f64) {
        self.width  = width.max(10.0);
        self.height = height.max(10.0);
        self.cols   = (self.width  / CELL_SIZE).ceil() as usize;
        self.rows   = (self.height / CELL_SIZE).ceil() as usize;
        self.grid   = vec![Vec::new(); self.cols * self.rows];
    }

    pub fn add_shockwave(&mut self, x: f64, y: f64) {
        if self.shockwaves.len() >= MAX_SHOCKWAVES {
            self.shockwaves.remove(0);
        }
        self.shockwaves.push(Shockwave { x, y, radius: 10.0, life: 1.0 });
    }

    pub fn tick(
        &mut self,
        bass: f64, mid: f64, treble: f64,
        mouse_x: f64, mouse_y: f64, mouse_active: bool,
    ) {
        // 1. Cập nhật shockwaves decay
        for sw in self.shockwaves.iter_mut() {
            sw.radius += SHOCKWAVE_EXPANSION_SPEED;
            sw.life   -= 0.03;
        }
        self.shockwaves.retain(|sw| sw.life > 0.0);

        // Copy shockwaves data sang buffer
        self.shockwave_buffer[0] = self.shockwaves.len() as f32;
        for (i, sw) in self.shockwaves.iter().enumerate() {
            let b = 1 + i * 4;
            self.shockwave_buffer[b]     = sw.x      as f32;
            self.shockwave_buffer[b + 1] = sw.y      as f32;
            self.shockwave_buffer[b + 2] = sw.radius as f32;
            self.shockwave_buffer[b + 3] = sw.life   as f32;
        }

        let (center_x, center_y) = (self.width / 2.0, self.height / 2.0);
        let mut rng = rand::thread_rng();

        // VÒNG LẶP I: CẬP NHẬT LỰC & VẬN TỐC & VỊ TRÍ
        for i in 0..self.particles.len() {
            let mut p = self.particles[i];

            // --- Lực lượng Dynamic Gravity & Stochastic (Treble) ---
            let dynamic_gravity = GRAVITY_BASE + BASS_MULTIPLIER * bass;
            let thermal = TREBLE_MULTIPLIER * treble;
            let stoch_x = rng.gen_range(-0.5..=0.5) * thermal;
            let stoch_y = rng.gen_range(-0.5..=0.5) * thermal;

            // --- Lực trung tâm (Central Forces) ---
            let dx_c = center_x - p.x;
            let dy_c = center_y - p.y;
            let mut dist_c = (dx_c * dx_c + dy_c * dy_c).sqrt();
            if dist_c == 0.0 { dist_c = 1.0; } // Khớp chuẩn logic "|| 1" của JS

            let pull = mid * MID_PULL_FORCE;
            let push = if bass > 0.5 {
                (bass * BASS_PUSH_FORCE * 100.0) / dist_c
            } else { 0.0 };

            let cfx = (dx_c / dist_c) * (pull - push);
            let cfy = (dy_c / dist_c) * (pull - push);

            // --- Lực Chuột (Mouse Interaction) ---
            let mut mfx = 0.0;
            let mut mfy = 0.0;
            if mouse_active {
                let dx_m = mouse_x - p.x;
                let dy_m = mouse_y - p.y;
                let mut dist_m = (dx_m * dx_m + dy_m * dy_m).sqrt();
                if dist_m == 0.0 { dist_m = 1.0; }

                if dist_m < MOUSE_INTERACTION_RADIUS {
                    let strength = MOUSE_PULL_FORCE * (1.0 - dist_m / MOUSE_INTERACTION_RADIUS);
                    mfx = (dx_m / dist_m) * strength;
                    mfy = (dy_m / dist_m) * strength;
                }
            }

            // --- Lực Sóng Xung Kích (Shockwave Push) ---
            let mut sfx = 0.0;
            let mut sfy = 0.0;
            for sw in &self.shockwaves {
                let dx_sw = p.x - sw.x;
                let dy_sw = p.y - sw.y;
                let mut dist_sw = (dx_sw * dx_sw + dy_sw * dy_sw).sqrt();
                if dist_sw == 0.0 { dist_sw = 1.0; }

                let wave_thickness = 40.0;
                let dist_to_wave = (dist_sw - sw.radius).abs();
                if dist_to_wave < wave_thickness {
                    let strength = SHOCKWAVE_PUSH_FORCE * sw.life * (1.0 - dist_to_wave / wave_thickness);
                    sfx += (dx_sw / dist_sw) * strength;
                    sfy += (dy_sw / dist_sw) * strength;
                }
            }

            // --- Tổng hợp và tích phân vận tốc (Khớp thứ tự tính Damping của JS) ---
            p.vx = (p.vx * (1.0 - DAMPING)) + stoch_x + cfx + mfx + sfx;
            p.vy = (p.vy * (1.0 - DAMPING)) + dynamic_gravity + stoch_y + cfy + mfy + sfy;

            p.x += p.vx;
            p.y += p.vy;

            // --- Xử lý va chạm biên (Boundary Collision) ---
            if p.x < PARTICLE_RADIUS {
                p.x = PARTICLE_RADIUS;
                p.vx *= -RESTITUTION;
            } else if p.x > self.width - PARTICLE_RADIUS {
                p.x = self.width - PARTICLE_RADIUS;
                p.vx *= -RESTITUTION;
            }
            if p.y < PARTICLE_RADIUS {
                p.y = PARTICLE_RADIUS;
                p.vy *= -RESTITUTION;
            } else if p.y > self.height - PARTICLE_RADIUS {
                p.y = self.height - PARTICLE_RADIUS;
                p.vy *= -RESTITUTION;
            }

            self.particles[i] = p;
        }

        // VÒNG LẶP II: SPATIAL HASH GRID & XỬ LÝ VA CHẠM HẠT (COLLISION RESOLUTION)
        for cell in self.grid.iter_mut() { cell.clear(); }
        for (i, p) in self.particles.iter().enumerate() {
            let col = (p.x / CELL_SIZE).floor() as isize;
            let row = (p.y / CELL_SIZE).floor() as isize;
            if col >= 0 && col < self.cols as isize && row >= 0 && row < self.rows as isize {
                self.grid[(row as usize) * self.cols + (col as usize)].push(i);
            }
        }

        for i in 0..self.particles.len() {
            let pi = self.particles[i];
            let col = (pi.x / CELL_SIZE).floor() as isize;
            let row = (pi.y / CELL_SIZE).floor() as isize;

            for dr in -1..=1isize {
                for dc in -1..=1isize {
                    let c = col + dc;
                    let r = row + dr;
                    if c < 0 || c >= self.cols as isize || r < 0 || r >= self.rows as isize { continue; }

                    let cell_idx = (r as usize) * self.cols + (c as usize);
                    
                    // 👉 TỐI ƯU VÀNG: Duyệt trực tiếp qua tham chiếu, KHÔNG .clone()
                    for &j in &self.grid[cell_idx] {
                        if i == j { continue; }

                        let (mut p_i, mut p_j) = (self.particles[i], self.particles[j]);
                        let dx = p_i.x - p_j.x;
                        let dy = p_i.y - p_j.y;
                        let dist_sq = dx * dx + dy * dy;
                        let min_dist = PARTICLE_RADIUS * 2.0;

                        if dist_sq < min_dist * min_dist && dist_sq > 0.0001 {
                            let dist = dist_sq.sqrt();
                            let nx = dx / dist;
                            let ny = dy / dist;
                            let overlap = min_dist - dist;

                            // Đẩy vị trí tách nhau ra
                            p_i.x += nx * overlap * 0.5;
                            p_i.y += ny * overlap * 0.5;
                            p_j.x -= nx * overlap * 0.5;
                            p_j.y -= ny * overlap * 0.5;

                            // Xử lý Xung lực phản hồi (Impulse)
                            let dvx = p_j.vx - p_i.vx;
                            let dvy = p_j.vy - p_i.vy;
                            let velocity_along_normal = nx * dvx + ny * dvy;

                            if velocity_along_normal >= 0.0 {
                                let impulse = -(1.0 + RESTITUTION) * velocity_along_normal / 2.0; 
                                p_i.vx -= impulse * nx;
                                p_i.vy -= impulse * ny;
                                p_j.vx += impulse * nx;
                                p_j.vy += impulse * ny;
                            }

                            self.particles[i] = p_i;
                            self.particles[j] = p_j;
                        }
                    }
                }
            }
        }

        // Xuất data ra Render Buffer cho GPU đọc
        for (i, p) in self.particles.iter().enumerate() {
            self.render_buffer[i * 3]     = p.x as f32;
            self.render_buffer[i * 3 + 1] = p.y as f32;
            self.render_buffer[i * 3 + 2] = PARTICLE_RADIUS as f32;
        }
    }

    pub fn get_render_buffer_ptr(&self)    -> *const f32 { self.render_buffer.as_ptr() }
    pub fn get_particle_count(&self)       -> usize      { self.particles.len() }
    pub fn get_shockwave_buffer_ptr(&self) -> *const f32 { self.shockwave_buffer.as_ptr() }
    pub fn get_shockwave_buffer_len(&self) -> usize      { self.shockwave_buffer.len() }
}