# 📜 GEMINI.MD - NGUYÊN TẮC VÀ TIÊU CHUẨN PHÁT TRIỂN DỰ ÁN

Tài liệu này đóng vai trò là bộ khung nguyên tắc cốt lõi và hướng dẫn hành vi cho AI (Gemini) trong suốt vòng đời phát triển dự án **Audio-to-Physics Visualizer**. AI bắt buộc phải tuân thủ nghiêm ngặt các điều khoản dưới đây trong mọi phản hồi và lượt tạo code.

---

## 🔍 1. Nguyên tắc Tra cứu Tài liệu & Đối chiếu Bug

* **Cập nhật Công nghệ Mới nhất:** Mọi giải pháp, hàm (functions), cú pháp (syntax) được đề xuất phải dựa trên tài liệu (Documentation) chính thức và mới nhất của các thư viện trong Tech Stack (React, p5.js, Web Audio API, Vite, Nginx).
* **Xác thực Link Tuyệt đối:** Khi cung cấp link tài liệu hoặc nguồn đối chiếu, AI phải tự kiểm tra liên tục để đảm bảo **link thực sự tồn tại và truy cập được**. Tuyệt đối không tự bịa ra URL (hallucination).
* **Cơ sở Đối chiếu rõ ràng:** Khi giải quyết bug, phải chỉ rõ bug đó vi phạm quy định nào trong tài liệu chính thức, tránh việc phỏng đoán vô căn cứ làm mất thời gian thử nghiệm của lập trình viên.


## 🛠️ 2. Tiêu chuẩn Mã nguồn (Code Quality Standards)

* **Sạch - Đẹp - Dễ hiểu (Clean Code):** Áp dụng nghiêm ngặt các nguyên tắc Clean Code. Tên hàm, tên biến phải mang tính tự giải thích (self-explanatory). Hàm phải ngắn gọn và chỉ thực hiện một nhiệm vụ duy nhất (Single Responsibility Principle).
* **Đồng nhất Kiến trúc (Consistency):** Toàn bộ dự án phải tuân theo một phong cách viết code (Coding Style) đồng nhất từ đầu đến cuối (ví dụ: dùng Functional Components, React Hooks, cách đặt tên Folder theo dạng PascalCase hoặc kebab-case).
* **Luồng dữ liệu tường minh (Data Flow Tracking):** Đến bất kỳ đoạn code nào, AI phải giải thích rõ ràng đầu vào (Inputs) là gì, thuật toán xử lý dữ liệu ra sao, và đầu ra (Outputs) đi về đâu.

## 📐 3. Quản lý Hệ thống & Sơ đồ Kiến trúc (System Design Maintenance)

* **Cập nhật Sơ đồ Toàn diện:** Mỗi khi có sự thay đổi về cấu trúc thư mục, luồng dữ liệu, hoặc cách phân chia module, AI phải cập nhật ngay lập tức sơ đồ thiết kế hệ thống (System Design) để đảm bảo tính đồng bộ và chính xác tuyệt đối.
* **Tầm nhìn Tổng thể:** Luôn kiểm tra xem tính năng mới được thêm vào có phá vỡ tính toàn vẹn của hệ thống hoặc làm giảm hiệu năng (rớt dưới 60fps) hay không.

## 🚀 4. Bổ sung Quy trình Thực chiến (AI Execution Add-ons)

* **Quy tắc Tách biệt Module (Decoupled Architecture):**
* *Audio Module:* Chỉ chịu trách nhiệm phân tích tần số thông qua Web Audio API và lưu dữ liệu vào một mảng đệm (Buffer Array).
* *Physics Engine:* Chỉ lấy dữ liệu từ mảng đệm để map vào các lực vật lý và render lên Canvas. Hai module này không được can thiệp sâu vào vòng đời (Lifecycle) của nhau.


* **Tối ưu hóa State cho Hiệu năng:** Không lưu dữ liệu tần số âm thanh (thay đổi 60 lần/giây) vào React State (`useState`) vì sẽ gây re-render liên tục và làm sập ứng dụng. Bắt buộc phải sử dụng `useRef` hoặc bộ nhớ dùng chung (Shared Memory Buffer) để chuyển tiếp dữ liệu thẳng vào Game Loop.
* **Chế độ Debug Trực quan (Visual Debug Mode):** Hệ thống bắt buộc phải hỗ trợ một công tắc debug, khi bật lên sẽ hiển thị:
* Chỉ số FPS theo thời gian thực.
* Các đường ranh giới của lưới không gian (Spatial Hashing Grid Cells).
* Hộp bao quanh va chạm (Bounding Box) và vector vận tốc của các hạt.
