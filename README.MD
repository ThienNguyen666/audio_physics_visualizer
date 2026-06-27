# 🎵 Audio-to-Physics Visualizer

## 📖 1. Giới thiệu Dự án (Concept & Vision)

"Audio-to-Physics Visualizer" là một trình giả lập vật lý theo nốt nhạc. Dự án này ra đời dành cho những ai vừa thích nghe nhạc, vừa đam mê xem các video giải thích định luật vật lý.

Khi bật một bài nhạc lên, các tần số âm thanh (như Bass, Treble) sẽ tác động trực tiếp vào một môi trường vật lý giả lập bao gồm trọng lực, va chạm hạt, hoặc sóng nước. Cảm giác buồn buồn bật bài nhạc mình thích, rồi tự tay code ra những định luật vật lý tương tác trực tiếp với nhịp điệu của bài hát mang lại sự thư giãn tột đỉnh.

Đây là một dự án thuần Frontend, code hoàn toàn chạy trên máy người dùng (Client-side).

## 🛠 2. Tech Stack & Kiến trúc Hệ thống

* 
**Frontend Framework:** React.


* 
**Rendering / Physics Engine:** Pure HTML5 Canvas hoặc thư viện p5.js (bởi vì nó siêu nhẹ và cực hợp để trực quan hóa toán học/vật lý).


* 
**Audio Processing:** Sử dụng Web Audio API để bóc tách tần số bài hát (Bass, Treble).


* 
**Deployment:** Triển khai tĩnh miễn phí trên Cloudflare Pages hoặc GitHub Pages. Hệ thống không cần Backend và Database nên không tốn tiền duy trì server.


audio-physics-visualizer/
├── public/                     # Chứa các file tĩnh (favicon, nhạc mẫu test.mp3)
├── src/
│   ├── components/             # Chứa các UI Component giao diện
│   │   ├── CanvasEngine/       # (Module 2) Component chịu trách nhiệm vẽ và render vật lý lên Canvas
│   │   │   └── PhysicsCanvas.jsx
│   │   ├── Controls/           # Cụm UI điều khiển (Play/Pause, Upload, Bật/Tắt Debug Mode)
│   │   │   ├── AudioPlayer.jsx
│   │   │   └── DebugPanel.jsx
│   │   └── Layout.jsx          # Bố cục chung của web
│   │
│   ├── core/                   # Phần lõi (Core) chứa logic không dính dáng tới UI
│   │   ├── audio/              # (Module 1) Xử lý Web Audio API
│   │   │   └── AudioAnalyzer.js# Hàm trích xuất tần số (trả về dữ liệu qua mảng đệm - Buffer Array)
│   │   ├── physics/            # Logic vật lý thuần túy (Toán học, Công thức)
│   │   │   ├── Particle.js     # Class định nghĩa hạt (Vị trí, vận tốc, phương trình Langevin)
│   │   │   └── SpatialHash.js  # Class xử lý thuật toán phân vùng không gian (Tối ưu O(N))
│   │   └── constants.js        # Chứa hằng số: g_base, kích thước ô lưới lưới, v.v.
│   │
│   ├── hooks/                  # Custom React Hooks
│   │   ├── useAudioStream.js   # Quản lý vòng đời của AudioContext (Dùng useRef, KHÔNG dùng useState)
│   │   └── useGameLoop.js      # Hook gọi requestAnimationFrame liên tục ở 60fps
│   │
│   ├── App.jsx                 # Component gốc ráp nối các module
│   ├── main.jsx                # Entry point
│   └── index.css               # Chứa một ít CSS reset cơ bản
│
├── Dockerfile                  # Nginx Alpine cho lúc Deploy
├── README.md                   # Tài liệu dự án
├── GEMINI.MD                   # Tiêu chuẩn phát triển dự án (Vừa lưu)
├── package.json
└── vite.config.js


## ⚙️ 3. Cơ chế Hoạt động Cốt lõi (Audio-to-Physics Mapping)

Hệ thống sử dụng Web Audio API để phân tích phổ âm thanh theo thời gian thực và map thẳng vào các hằng số vật lý.

* 
**Âm Bass (Tần số thấp):** Tiếng Bass dập mạnh thì hệ số trọng lực tăng lên, làm các hạt electron rơi xuống.


* 
**Âm Treble (Tần số cao):** Tiếng Treble cao thì truyền động năng làm các hạt bay tán loạn theo định luật nhiệt động lực học hoặc chuyển động Brown.



## 📐 4. Toán học & Vật lý Ứng dụng

Hệ thống chạy trên một vòng lặp Game Loop (vẽ lại khung hình 60fps).

### 4.1. Tích phân Số học (Semi-implicit Euler)

Để cập nhật vị trí và vận tốc của các hạt trong mỗi khung hình ($\Delta t$), hệ thống áp dụng Euler bán ẩn nhằm bảo toàn năng lượng:


$$v_{new}=v_{old}+\frac{F}{m}\cdot\Delta t$$

$$p_{new}=p_{old}+v_{new}\cdot\Delta t$$

### 4.2. Cơ học Cổ điển (Dynamic Gravity)

Trọng lực thay đổi theo biên độ âm Bass ($A_{bass}$):


$$g_{dynamic}=g_{base}+k_{bass}\cdot A_{bass}$$

### 4.3. Nhiệt động lực học (Brownian Motion)

Sự tán loạn của hạt do âm Treble ($T_{treble}$) gây ra được mô phỏng qua phương trình Langevin:


$$v_{new}=v_{old}\cdot(1-\gamma)+\sqrt{2\cdot D\cdot T_{treble}}\cdot\xi$$

### 4.4. Phản ứng Va chạm Đàn hồi (Elastic Collision)

Tính toán vận tốc mới ($v_1'$) khi 2 hạt va chạm:


$$v_1'=v_1-\frac{2m_2}{m_1+m_2}\frac{\langle v_1-v_2,p_1-p_2\rangle}{\|p_1-p_2\|^2}(p_1-p_2)$$

## 🚀 5. Tối ưu Hiệu năng với Spatial Hashing

Để render hàng ngàn hạt ở 60fps mà không bị rớt khung hình, hệ thống sẽ **không** dùng vòng lặp $O(N^2)$ để xét va chạm. Thay vào đó, thuật toán **Spatial Hashing (Lưới không gian)** được áp dụng.

Không gian được chia thành một lưới Uniform Grid. Chỉ mục (Index) ô lưới của mỗi hạt được tính bằng:


$$col=\lfloor\frac{x}{cell\_size}\rfloor$$

$$row=\lfloor\frac{y}{cell\_size}\rfloor$$

$$Index=row\cdot total\_cols+col$$


Mỗi hạt chỉ cần kiểm tra va chạm với các hạt lân cận trong cùng ô lưới hoặc 8 ô xung quanh, đưa độ phức tạp về tiệm cận $O(N)$.

## 🐳 6. Chiến lược Docker

Chiến lược Docker cho project này cực kỳ đơn giản.

* Chỉ cần tạo 1 file `Dockerfile` dùng Nginx Alpine.


* Sử dụng lệnh `COPY . [cite_start]/usr/share/nginx/html` là xong.


* Kết quả là một Docker Image siêu nhẹ, với thời gian khởi động chưa tới 1 giây.