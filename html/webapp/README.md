# Web App Quản Lý Chứng Từ Bán Hàng 1S (`ctbhh` + `ctbhd`)

## Giới thiệu
Hệ thống Web Application hiện đại thay thế/mở rộng chức năng của 2 form Visual FoxPro 8.0 `ctbhh.scx` (danh sách chứng từ) và `ctbhd.scx` (nhập liệu chứng từ) trên nền tảng phần mềm kế toán 1S.

- **Backend:** FastAPI + pyodbc (Python 3)
- **Frontend:** React 18 + Vite + TypeScript + TailwindCSS
- **Cơ sở dữ liệu:** Microsoft SQL Server 2014 (`VP_2014`, `KH_2014`, `VTSYS`)
- **Giai đoạn hiện tại:** **Giai đoạn 1 (100% READ-ONLY)**

---

## 🔒 Nguyên tắc an toàn dữ liệu (Giai đoạn 1)
- Tuyệt đối **KHÔNG có bất kỳ câu lệnh INSERT, UPDATE, DELETE** nào vào CSDL trong Giai đoạn 1.
- Mọi truy vấn CSDL đều là `SELECT ... WITH (NOLOCK)`.
- Chức năng thêm mới/sửa/xóa trên giao diện được bảo vệ ở chế độ xem an toàn.

---

## 🚀 Hướng dẫn cài đặt & Khởi chạy

### 1. Khởi chạy 1-Click
Nhấp đúp vào file `run.bat` tại thư mục gốc:
```bat
e:\1S2024\html\webapp\run.bat
```
Script sẽ tự động khởi động:
- Backend Uvicorn tại `http://localhost:8000` (Swagger UI tại `http://localhost:8000/docs`)
- Frontend Vite tại `http://localhost:5173`
- Mở trình duyệt web truy cập tự động.

### 2. Khởi chạy thủ công
#### Backend:
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend:
```bash
cd frontend
npm install
npm run dev
```

---

## ⌨️ Bảng phím tắt chuẩn VFP
Toàn bộ phím tắt được thiết kế giữ nguyên thói quen Visual FoxPro:
- `F2`: Xem chi tiết chứng từ đang chọn
- `F3`: Mở hộp thoại bộ lọc nâng cao
- `F4`: Thêm mới (Thông báo khóa ở GĐ1)
- `F7`: In chứng từ bán hàng
- `Ctrl+F7`: Xem trước mẫu in (Alias Shift+F7)
- `F8`: Xóa chứng từ (Thông báo khóa ở GĐ1)
- `F9`: Mở hộp thoại bộ lọc chứng từ
- `Enter`: Mở dòng đang chọn / Chấp nhận
- `Space`: Chọn / Đánh dấu dòng
- `Ctrl+A`: Chọn tất cả dòng
- `Ctrl+U`: Bỏ chọn tất cả dòng
- `Esc`: Đóng form / Đóng dialog / Quay lại danh sách

---

## 📐 Quy chuẩn Nghiệp vụ & Kỹ thuật
1. **Đẳng thức tổng thanh toán tối hậu:**  
   $$\mathbf{TTien\_Nt0 = TTien\_Nt2 + TTien\_Nt3}$$  
   Triệt tiêu hoàn toàn lỗi trừ kép chiết khấu lịch sử.
2. **Quy chuẩn bảo vệ giá vốn (Fix #21):**  
   Tuyệt đối không gán giá vốn `Gia_Nt` từ đơn giá bán `Gia_Nt9`.
3. **Quy cách hàng Mút xốp (`Loai_Vt = '2'`):**  
   Thuật toán `Calc_Loai2`: $\text{Số lượng} = \text{Số tấm} \times \text{Hệ số độ dày}$.
4. **Chuyển đổi Unicode hai chiều:**  
   Xử lý TCVN3 sang Unicode NFC thông qua module `app.utils.unicode`.
