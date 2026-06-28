use wasm_bindgen::prelude::*;
use rand::Rng;

const GRAVITY_BASE: f64 = 0.05;
const BASS_MULTIPLIER: f64 = 3.0;
const TREBLE_MULTIPLIER: f64 = 40.0;
const DAMPING: f64 = 0.01;
const RESTITUTION: f64 = 0.9;
const CELL_SIZE: f64 = 16.0; 
const MID_PULL_FORCE: f64 = 0.25;
const BASS_PUSH_FORCE: f64 = 5.0;
const MOUSE_PULL_FORCE: f64 = 1.5;
const MOUSE_INTERACTION_RADIUS: f64 = 150.0;
const SHOCKWAVE_PUSH_FORCE: f64 = 15.0;
const SHOCKWAVE_EXPANSION_SPEED: f64 = 20.0;
const PARTICLE_RADIUS: f64 = 4.0;

#[derive(Clone, Copy)]
struct Particle {
    x: f64, y: f64,
    vx: f64, vy: f64,
    radius: f64,
}

struct Shockwave {
    x: f64, y: f64,
    radius: f64, life: f64,
}

#[wasm_bindgen]
pub struct Universe {
    particles: Vec<Particle>,
    shockwaves: Vec<Shockwave>,
    width: f64, height: f64,
    render_buffer: Vec<f32>,
    grid: Vec<Vec<usize>>,
    cols: usize,
}

#[wasm_bindgen]
impl Universe {
    pub fn new(width: f64, height: f64, count: usize) -> Universe {
        let (safe_w, safe_h) = (width.max(10.0), height.max(10.0));
        let cols = (safe_w / CELL_SIZE).ceil() as usize;
        let rows = (safe_h / CELL_SIZE).ceil() as usize;

        let mut particles = Vec::with_capacity(count);
        let mut rng = rand::thread_rng();

        for _ in 0..count {
            particles.push(Particle {
                x: rng.gen_range(0.0..safe_w), y: rng.gen_range(0.0..safe_h),
                vx: rng.gen_range(-2.0..2.0), vy: rng.gen_range(-2.0..2.0),
                radius: PARTICLE_RADIUS,
            });
        }

        Universe {
            particles, shockwaves: Vec::new(),
            width: safe_w, height: safe_h,
            render_buffer: vec![0.0; count * 3],
            grid: vec![Vec::with_capacity(4); cols * rows], cols,
        }
    }

    pub fn set_particle_count(&mut self, new_count: usize) {
        let current_count = self.particles.len();
        if new_count > current_count {
            let mut rng = rand::thread_rng();
            for _ in current_count..new_count {
                self.particles.push(Particle {
                    x: rng.gen_range(0.0..self.width), y: rng.gen_range(-50.0..0.0), 
                    vx: rng.gen_range(-2.0..2.0), vy: rng.gen_range(0.0..2.0),
                    radius: PARTICLE_RADIUS,
                });
            }
        } else {
            self.particles.truncate(new_count);
        }
        self.render_buffer.resize(new_count * 3, 0.0);
    }

    pub fn resize_canvas(&mut self, width: f64, height: f64) {
        self.width = width.max(10.0); self.height = height.max(10.0);
        self.cols = (self.width / CELL_SIZE).ceil() as usize;
        self.grid = vec![Vec::with_capacity(4); self.cols * (self.height / CELL_SIZE).ceil() as usize];
    }

    pub fn add_shockwave(&mut self, x: f64, y: f64) {
        self.shockwaves.push(Shockwave { x, y, radius: 10.0, life: 1.0 });
    }

    pub fn tick(&mut self, bass: f64, mid: f64, treble: f64, mouse_x: f64, mouse_y: f64, mouse_active: bool) {
        // Cập nhật Vụ Nổ (Shockwaves)
        for sw in self.shockwaves.iter_mut() { sw.radius += SHOCKWAVE_EXPANSION_SPEED; sw.life -= 0.03; }
        self.shockwaves.retain(|sw| sw.life > 0.0);

        let (center_x, center_y) = (self.width / 2.0, self.height / 2.0);
        let mut rng = rand::thread_rng();

        for cell in self.grid.iter_mut() { cell.clear(); }


        // VÒNG LẶP ĐẦU: TÍNH LỰC & DI CHUYỂN

        for i in 0..self.particles.len() {
            let mut p = self.particles[i];

            // Lực Trung Tâm (Gộp pull & push thành 1 biến net_force)
            let (dx_c, dy_c) = (center_x - p.x, center_y - p.y);
            let dist_c = (dx_c * dx_c + dy_c * dy_c).sqrt().max(1.0);
            let push = if dist_c < 200.0 { bass * BASS_PUSH_FORCE } else { 0.0 };
            let net_c = (mid * MID_PULL_FORCE - push) / dist_c;
            
            p.vx += dx_c * net_c; p.vy += dy_c * net_c;

            // Lực Hố Đen Chuột (Tính gộp phân số đẩy thẳng vào gia tốc)
            if mouse_active {
                let (dx_m, dy_m) = (mouse_x - p.x, mouse_y - p.y);
                let dist_m = (dx_m * dx_m + dy_m * dy_m).sqrt().max(1.0);
                if dist_m < MOUSE_INTERACTION_RADIUS {
                    let force = (MOUSE_INTERACTION_RADIUS - dist_m) * MOUSE_PULL_FORCE / (MOUSE_INTERACTION_RADIUS * dist_m);
                    p.vx += dx_m * force; p.vy += dy_m * force;
                }
            }

            //  Lực Shockwave 
            for sw in &self.shockwaves {
                let (dx_sw, dy_sw) = (p.x - sw.x, p.y - sw.y);
                let dist_sw = (dx_sw * dx_sw + dy_sw * dy_sw).sqrt().max(1.0);
                if dist_sw < sw.radius {
                    let force = (sw.radius - dist_sw) * SHOCKWAVE_PUSH_FORCE * sw.life / (sw.radius * dist_sw);
                    p.vx += dx_sw * force; p.vy += dy_sw * force;
                }
            }

            // Nhiệt năng, Trọng lực & Ma sát (Gộp thành 2 phép tính một dòng)
            let thermal = TREBLE_MULTIPLIER * treble;
            p.vx = (p.vx + rng.gen_range(-0.5..=0.5) * thermal) * (1.0 - DAMPING);
            p.vy = (p.vy + rng.gen_range(-0.5..=0.5) * thermal + GRAVITY_BASE + BASS_MULTIPLIER * bass) * (1.0 - DAMPING);

            // Di chuyển
            p.x += p.vx; p.y += p.vy;

            // Nảy Tường (Tối giản hoàn toàn bằng Clamp)
            if p.x <= p.radius || p.x >= self.width - p.radius { 
                p.vx *= -RESTITUTION; p.x = p.x.clamp(p.radius, self.width - p.radius); 
            }
            if p.y <= p.radius || p.y >= self.height - p.radius { 
                p.vy *= -RESTITUTION; p.y = p.y.clamp(p.radius, self.height - p.radius); 
            }

            self.particles[i] = p;

            // Chèn tọa độ Grid
            let idx = (p.y / CELL_SIZE).floor() as isize * (self.cols as isize) + (p.x / CELL_SIZE).floor() as isize;
            if idx >= 0 && idx < self.grid.len() as isize { self.grid[idx as usize].push(i); }
        }


        // VÒNG LẶP 2: XỬ LÝ VA CHẠM (Spatial Hash)
        for i in 0..self.particles.len() {
            let (col, row) = ((self.particles[i].x / CELL_SIZE).floor() as isize, (self.particles[i].y / CELL_SIZE).floor() as isize);

            for d_row in -1..=1 {
                for d_col in -1..=1 {
                    let (c, r) = (col + d_col, row + d_row);
                    if c >= 0 && c < self.cols as isize && r >= 0 {
                        let idx = r * (self.cols as isize) + c;
                        if idx >= 0 && idx < self.grid.len() as isize {
                            for k in 0..self.grid[idx as usize].len() {
                                let j = self.grid[idx as usize][k];
                                if i != j {
                                    let (mut p_i, mut p_j) = (self.particles[i], self.particles[j]);
                                    
                                    let (dx, dy) = (p_i.x - p_j.x, p_i.y - p_j.y);
                                    let dist = (dx * dx + dy * dy).sqrt();
                                    let min_dist = p_i.radius + p_j.radius;

                                    if dist < min_dist && dist > 0.0001 {
                                        // Tách Vị Trí (Gộp biến overlap & hệ số)
                                        let push = (min_dist - dist) * 0.5 / dist;
                                        p_i.x += dx * push; p_i.y += dy * push;
                                        p_j.x -= dx * push; p_j.y -= dy * push;

                                        // Dội Vận Tốc (Sử dụng Scalar Dot Product thẳng)
                                        let vel_normal = (dx * (p_j.vx - p_i.vx) + dy * (p_j.vy - p_i.vy)) / dist;
                                        if vel_normal >= 0.0 {
                                            let impulse = -(1.0 + RESTITUTION) * vel_normal / (2.0 * dist);
                                            p_i.vx -= dx * impulse; p_i.vy -= dy * impulse;
                                            p_j.vx += dx * impulse; p_j.vy += dy * impulse;
                                        }

                                        self.particles[i] = p_i;
                                        self.particles[j] = p_j;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }


        // ĐỔ DỮ LIỆU RA BUFFER CHO JAVASCRIPT
        for (i, p) in self.particles.iter().enumerate() {
            self.render_buffer[i * 3] = p.x as f32;
            self.render_buffer[i * 3 + 1] = p.y as f32;
            self.render_buffer[i * 3 + 2] = p.radius as f32;
        }
    }

    pub fn get_render_buffer_ptr(&self) -> *const f32 { self.render_buffer.as_ptr() }
    pub fn get_particle_count(&self) -> usize { self.particles.len() }
}