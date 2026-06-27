# ==========================================
# STAGE 1: BUILD MÔI TRƯỜNG REACT/VITE
# ==========================================
FROM node:18-alpine AS builder

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Copy các file cấu hình package vào trước để tận dụng Docker Cache
COPY package.json package-lock.json ./

# Cài đặt các dependencies
RUN npm install

# Copy toàn bộ mã nguồn vào container
COPY . .

# Chạy lệnh build của Vite (sẽ tạo ra thư mục /dist)
RUN npm run build

# ==========================================
# STAGE 2: SERVE BẰNG NGINX (SIÊU NHẸ)
# ==========================================
FROM nginx:alpine

# Xóa trang web mặc định của Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copy thư mục tĩnh (dist) đã build từ Stage 1 sang thư mục của Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 ra ngoài
EXPOSE 80

# Chạy Nginx ở chế độ foreground
CMD ["nginx", "-g", "daemon off;"]