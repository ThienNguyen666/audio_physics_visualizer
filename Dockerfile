# ==========================================
# STAGE 1: Lò rèn Rust & WebAssembly
# ==========================================
FROM rust:1.76-slim AS rust-builder
WORKDIR /app/physics-core

# Cài đặt wasm-pack
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Copy source code Rust vào và Build
COPY physics-core/ ./
RUN wasm-pack build --target web

# ==========================================
# STAGE 2: Nhà máy đóng gói Vite & React
# ==========================================
FROM node:20-alpine AS node-builder
WORKDIR /app

# Cài dependencies cho Node
COPY package*.json ./
RUN npm install

# Copy toàn bộ code Frontend
COPY . .

# COPY thành phẩm file .wasm từ STAGE 1 sang STAGE 2
COPY --from=rust-builder /app/physics-core/pkg ./physics-core/pkg

# Build Vite để ra thư mục /dist tĩnh
RUN npm run build

# ==========================================
# STAGE 3: Web Server siêu tốc Nginx (Production)
# ==========================================
FROM nginx:alpine
# Lấy thành phẩm cuối cùng từ STAGE 2 bỏ vào Nginx
COPY --from=node-builder /app/dist /usr/share/nginx/html

# Cấu hình Nginx để hiểu file WASM (Cực kỳ quan trọng)
RUN echo 'types { application/wasm wasm; }' > /etc/nginx/conf.d/wasm.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]