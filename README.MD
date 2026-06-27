# 🎵 Audio-to-Physics Visualizer

Trình giả lập vật lý tương tác trực tiếp với tần số âm thanh theo thời gian thực. Bật bài nhạc yêu thích của bạn lên và quan sát các định luật cơ học (trọng lực, va chạm hạt đàn hồi, chuyển động Langevin/Brown) "nhảy múa" theo từng nhịp điệu của dải âm Bass và Treble.

![Khung hình Demo](./public/demo.png)

## 📖 1. Giới thiệu Dự án (Concept & Vision)

**Audio-to-Physics Visualizer** ra đời dành cho những ai vừa đam mê âm nhạc, vừa bị cuốn hút bởi vẻ đẹp của các mô phỏng vật lý trực quan. Dự án bóc tách phổ âm thanh (Audio Spectrum) thông qua Web Audio API, sau đó ánh xạ (mapping) trực tiếp các dải tần số này thành các biến số động lực học trong một vũ trụ giả lập. 

Đây là một dự án **Pure Frontend**, toàn bộ logic tính toán vật lý và render đồ họa được xử lý 100% ở phía client-side (trình duyệt của người dùng) bằng một vòng lặp Game Loop tối ưu, đảm bảo trải nghiệm mượt mà không cần tới hạ tầng Backend hay Database đắt đỏ.

## 🛠 2. Tech Stack & Công nghệ Cốt lõi

* **Frontend Framework:** React (Được scaffolding bằng Vite giúp tăng tốc độ khởi động và HMR).
* **Rendering & Physics Engine:** Pure HTML5 Canvas API (Không dùng thư viện ngoài để ép hiệu năng render thô ở mức cao nhất).
* **Audio Processing:** Web Audio API (Sử dụng thuật toán Fast Fourier Transform - FFT để trích xuất dữ liệu biên độ tần số).
* **Thuật toán Tối ưu Không gian:** Spatial Hashing Grid (Giảm độ phức tạp thuật toán xét va chạm từ $O(N^2)$ xuống gần $O(N)$).
* **DevOps Ready:** Docker (Cấu trúc Multi-stage build kết hợp server tĩnh Nginx Alpine siêu nhẹ).

---

## 📂 3. Cấu trúc Hệ thống & Kiến trúc Phân lớp (Project Tree)

Kiến trúc dự án tuân thủ nghiêm ngặt nguyên lý **Decoupled Architecture** (Tách biệt hoàn toàn Module Âm thanh, Logic Vật lý và Giao diện UI). Dữ liệu tần số âm thanh thay đổi 60 lần/giây được chuyển tiếp trực tiếp vào bộ đệm, tuyệt đối **không lưu vào React State** để tránh re-render liên tục gây sập hoặc nghẽn ứng dụng.

```text
audio-physics-visualizer/
├── public/                     # Thư mục chứa các tài nguyên tĩnh
├── src/
│   ├── components/             # Các thành phần giao diện UI Overlay
│   │   ├── CanvasEngine/       # Nơi quản lý Canvas và vòng lặp đồ họa
│   │   │   └── PhysicsCanvas.jsx
│   │   ├── Controls/           # Các bảng điều khiển tương tác
│   │   │   ├── AudioPlayer.jsx
│   │   │   └── DebugPanel.jsx
│   │   └── Layout.jsx          # Cấu trúc Wrapper phân chia lớp z-index
│   │
│   ├── core/                   # Lõi Logic thuần xử lý (Không chứa React Lifecycle)
│   │   ├── audio/              # Xử lý Audio Context và bóc tách dải phổ FFT
│   │   │   └── AudioAnalyzer.js
│   │   ├── physics/            # Động lực học hạt và cấu trúc dữ liệu lưới
│   │   │   ├── Particle.js
│   │   │   └── SpatialHash.js
│   │   └── constants.js        # Nơi cấu hình các hằng số Vũ trụ (Trọng lực, Đàn hồi...)
│   │
│   ├── hooks/                  # Các Custom Hooks quản lý vòng đời React
│   │   ├── useAudioStream.js   # Quản lý luồng stream audio độc lập
│   │   └── useGameLoop.js      # Kích hoạt requestAnimationFrame (Khóa cứng 60FPS)
│   │
│   ├── App.jsx                 # Điểm hội tụ các Module hạ tầng
│   ├── index.css               # Reset CSS chuyên dụng chống cuộn cho Canvas
│   └── main.jsx                # Entry point của ứng dụng
│
├── Dockerfile                  # Cấu hình đóng gói Nginx tối ưu RAM
└── README.md

```

---

## ⚙️ 4. Cơ chế Hoạt động & Toán học Vật lý (Physics Core)

Hệ thống bắt dữ liệu sóng âm thông qua Node phân tích tần số (`AnalyserNode`) với kích thước `fftSize = 256`, tạo ra 128 dải tần số riêng biệt. Từ đó, hai dải năng lượng chính được bóc tách và chuẩn hóa về khoảng $[0, 1]$ là **Bass** (tần số thấp, từ index 0 đến 10) và **Treble** (tần số cao, từ index 50 đến 100).

### 4.1. Tích phân Số học (Semi-implicit Euler Integration)

Để cập nhật vị trí và vận tốc của hàng ngàn hạt sau mỗi khung hình (khung thời gian $\Delta t$), hệ thống áp dụng phương pháp tích phân số học Euler bán tường minh nhằm đảm bảo tính bảo toàn năng lượng tốt hơn Euler thông thường:

$$v_{new} = v_{old} + a \cdot \Delta t$$

$$p_{new} = p_{old} + v_{new} \cdot \Delta t$$

### 4.2. Cơ học Cổ điển & Trọng lực Động (Dynamic Gravity)

Âm Bass dập mạnh đại diện cho sự gia tăng khối lượng hoặc lực hấp dẫn của toàn môi trường. Trọng lực thay đổi tuyến tính theo biên độ âm Bass ($A_{bass}$):

$$g_{dynamic} = g_{base} + k_{bass} \cdot A_{bass}$$

*Trong đó: $g_{base}$ là trọng lực nền cơ bản, $k_{bass}$ là hệ số khuếch đại âm Bass.*

### 4.3. Nhiệt động lực học & Chuyển động Brown (Langevin Equation)

Sự hỗn loạn và tán loạn của các hạt ở tần số cao (âm Treble - $T_{treble}$) được mô phỏng chính xác thông qua phương trình vi phân Langevin, đóng vai trò như nhiệt năng cung cấp vào hệ thống làm các hạt chuyển động ngẫu nhiên:

$$v_{new} = v_{old} \cdot (1 - \gamma) + \sqrt{2 \cdot D \cdot T_{treble}} \cdot \xi$$

*Trong đó: $\gamma$ là hệ số tiêu tán (Damping), $D$ là hệ số khuếch tán nhiệt lượng, và $\xi$ là biến ngẫu nhiên tuân theo phân phối chuẩn Gaussian (Stochastic Noise) đại diện cho va chạm phân tử ngẫu nhiên.*

### 4.4. Phản ứng Va chạm Đàn hồi (Elastic Collision)

Khi khoảng cách giữa 2 tâm hạt nhỏ hơn tổng bán kính của chúng, một va chạm thực thể xảy ra. Hệ thống sẽ tính toán lại vector vận tốc mới ($v_1'$) dựa trên định luật bảo toàn động lượng và bảo toàn động năng trong không gian 2 chiều:

$$v_1' = v_1 - \frac{2m_2}{m_1+m_2} \frac{\langle v_1-v_2, p_1-p_2 \rangle}{\|p_1-p_2\|^2} (p_1-p_2)$$

---

## 🚀 5. Tối ưu Hiệu năng vượt trội bằng Spatial Hashing

Nếu xét va chạm bằng phương pháp duyệt cặp thông thường (Brute-force), độ phức tạp thuật toán sẽ là $O(N^2)$. Khi số lượng hạt tăng lên tới $N = 1000$, hệ thống phải thực hiện $1.000.000$ phép tính khoảng cách trên mỗi khung hình, gây ra hiện tượng rớt FPS nghiêm trọng.

Để khóa cứng tốc độ render ở **60FPS mượt mà**, dự án triển khai cấu trúc dữ liệu **Spatial Hashing (Lưới không gian đồng nhất)**:

1. Toàn bộ không gian màn hình được chia nhỏ thành một mạng lưới các ô (Uniform Grid) có kích thước cố định bằng `SPATIAL_CELL_SIZE`.
2. Ở đầu mỗi khung hình, tọa độ thực $(x, y)$ của từng hạt được băm (hash) để xác định chỉ mục ô lưới tương ứng:

$$\text{Col} = \lfloor \frac{x}{\text{CellSize}} \rfloor, \quad \text{Row} = \lfloor \frac{y}{\text{CellSize}} \rfloor$$

$$\text{Key} = \text{Cols} \cdot \text{Row} + \text{Col}$$

3. Khi một hạt cần tìm kiếm va chạm, nó không cần duyệt qua toàn bộ $N$ hạt trong mảng mà **chỉ truy vấn các hạt nằm chung ô lưới với nó và 8 ô lưới lân cận bao quanh**. Giải pháp này đưa độ phức tạp lý thuyết về mức tiệm cận $O(N)$, giải phóng hoàn toàn sức mạnh tính toán của CPU/GPU tích hợp trên trình duyệt.

---

## 🎮 6. Hướng dẫn Cài đặt & Chạy Local

Chạy ứng dụng trên môi trường local của bạn vô cùng đơn giản với 3 bước:

```bash
# 1. Clone mã nguồn dự án về máy cá nhân
git clone [https://github.com/YOUR_USERNAME/audio-physics-visualizer.git](https://github.com/YOUR_USERNAME/audio-physics-visualizer.git)

# 2. Di chuyển vào thư mục dự án và cài đặt toàn bộ dependencies
cd audio-physics-visualizer
npm install

# 3. Kích hoạt môi trường Local Development Server (Vite)
npm run dev

```

> Trình duyệt sẽ tự động mở hoặc bạn có thể truy cập bằng tay vào đường link `http://localhost:5173`. Tiến hành upload một file nhạc định dạng bất kỳ (mp3, wav...), bấm nút **Play** và trải nghiệm!

## 🐳 7. Khởi chạy thông qua Đóng gói Docker

Dự án đã tích hợp sẵn tệp cấu hình Docker đa tầng (Multi-stage build) giúp tối ưu hóa dung lượng production image chỉ còn vài chục Megabytes bằng cách loại bỏ toàn bộ `node_modules` thừa và chỉ giữ lại mã nguồn tĩnh được chạy trên nền web server Nginx:

```bash
# Thực hiện Build Docker Image chuyên dụng
docker build -t audio-visualizer .

# Khởi chạy Container, map cổng 80 của container ra cổng 8080 của máy host
docker run -d -p 8080:80 audio-visualizer

```

Sau đó truy cập `http://localhost:8080` trên trình duyệt để kiểm tra kết quả deploy local container.

```