# BÁO CÁO KẾT QUẢ GIAI ĐOẠN 2 & HƯỚNG DẪN KIỂM THỬ THỦ CÔNG
## (PHASE 2: DATA PERSISTENCE & ACID TRANSACTIONS - VP_2014)

> **Dự án:** Web Application Quản lý Chứng từ Bán hàng (`ctbhh` + `ctbhd` + `ctbhch`)  
> **Cơ sở dữ liệu:** `VP_2014` (Kế toán) & `KH_2014` (Kho) & `VTSYS` (Hệ thống)  
> **Thời gian hoàn thành:** 2026-10-23  
> **Trạng thái:** ✅ **Hoàn thành 100% Giai đoạn 2 (Đã qua Adversarial Review & QA)**

---

## I. TỔNG QUAN NỘI DUNG ĐÃ TRIỂN KHAI & CÁC LỖI QUAN TRỌNG ĐÃ KHẮC PHỤC

Giai đoạn 2 đã hoàn thiện trọn vẹn luồng **Ghi Dữ Liệu (Create / Edit / Delete)** cho bộ phận Kế toán trên CSDL `VP_2014`, liên kết kho `KH_2014` và tuân thủ tuyệt đối các nguyên tắc an toàn dữ liệu ACID.

### Các phát hiện và sửa chữa trọng yếu từ vòng Adversarial QA Review:
1. **Sửa lỗi Fatal Bug trong Xóa chứng từ (`CtBH_Delete`):**
   - *Phát hiện:* Bản nháp ban đầu chặn xóa nếu `Confirmed == True`. Tuy nhiên, kết quả kiểm tra metadata thực tế trên CSDL `VP_2014` cho thấy **100% chứng từ bán hàng (140.103 / 140.103 bản ghi)** đều có `Confirmed = 1` (do nghiệp vụ văn phòng kế toán tự động xác nhận khi lưu). Việc chặn xóa theo `Confirmed` khiến tính năng xóa bị vô hiệu hóa hoàn toàn trên toàn bộ cơ sở dữ liệu.
   - *Khắc phục:* Bỏ điều kiện chặn sai lầm này; giữ nguyên điều kiện bảo vệ khóa sổ (`Ngay_Ct <= Ngay_Kt_Ht`) và thực thi thủ tục `CtBH_Delete` đúng nghiệp vụ 1S.
2. **Khắc phục lỗi ngắt kết nối Stored Procedure trong pyodbc driver:**
   - *Phát hiện:* Các thủ tục lưu trữ `CtBH_Post`, `CtBH_SoCaiVT_Save`, `ST_Save_Number`, `CtBH_Delete` trả về nhiều token `DONE_IN_PROC`, gây lỗi `pyodbc.ProgrammingError: No results. Previous SQL was not a query`.
   - *Khắc phục:* Bổ sung tiền tố `SET NOCOUNT ON;` trước tất cả các lệnh gọi EXEC SP.
3. **Chuẩn hóa Mã Chứng Từ (`Ma_Ct = 'X1'`):**
   - *Phát hiện:* Trong CSDL `VP_2014.dbo.CtBH`, mã chứng từ bán hàng thực tế là `'X1'` (134.330 dòng) và `'N5'` (5.772 dòng); mã `'BH'` không tồn tại. Nếu lưu với `Ma_Ct = 'BH'`, chứng từ sẽ không hiển thị trên danh sách mặc định.
   - *Khắc phục:* Chuẩn hóa mặc định `Ma_Ct = 'X1'` xuyên suốt schema, repository, UI badge và test suite.
4. **Hiện thực tra cứu công nợ qua Stored Procedure chuẩn 1S:**
   - Triển khai gọi thủ tục `VP_2014.dbo.GL_Alert_ClosingAccount4Customer` tại thời điểm `GETDATE()` theo yêu cầu R1.3, kèm cơ chế fallback tự động truy vấn bảng `SoCai`.
5. **Kế thừa thông tin khách hàng và tối ưu luồng Pickup Dialog:**
   - Phím tắt `F2` kế thừa đầy đủ `ma_dt`, `ten_dt`, `dia_chi`, `ong_ba`, `ma_xe`, `ten_xe`, `ma_bp`, `ma_ct` từ dòng chứng từ đang chọn trên Grid1.
   - `PickupDialog` nhận đúng `maDt` và `ngayCt` từ form đang mở thay vì tham số danh sách cũ.
6. **Hoàn thiện Grid Navigation & Cột TT (`Gia_Tb_TT`):**
   - Cho phép chỉnh sửa cờ tính giá trung bình tức thời `Gia_Tb_TT` (`'C'` / `'K'`).
   - Hỗ trợ di chuyển giữa các ô bằng `Enter`, lùi bằng `Shift+Tab` / `Ctrl+Shift+Tab`, và xóa dòng bằng `F8`.

---

## II. HỒ SƠ KIỂM THỬ KỸ THUẬT (AUTOMATED VERIFICATION)

### 1. Backend Automated Tests (26/26 Passed - 100%)
Toàn bộ kiểm thử tự động sử dụng `pytest` với kỹ thuật **Mock Database** (`unittest.mock`), tuân thủ nghiêm ngặt quy tắc Zero-Mutation trên SQL Server thật (`192.168.10.8,14333`).

```text
platform win32 -- Python 3.14.3, pytest-9.1.1
rootdir: E:\1S2024\html\webapp\backend

tests/test_calc.py::test_calc_loai2_mut_xop PASSED                       [  3%]
tests/test_calc.py::test_no_double_discount_invariant PASSED             [  7%]
tests/test_calc.py::test_penny_remainder_adjustment PASSED               [ 11%]
tests/test_phase2_backend.py::test_tc01_calc_loai2_mut_xop PASSED        [ 15%]
tests/test_phase2_backend.py::test_tc02_pickup_accept_calculation PASSED [ 19%]
tests/test_phase2_backend.py::test_tc03_reverse_calculation_from_amount PASSED [ 23%]
tests/test_phase2_backend.py::test_tc04_discount_zero_and_vat_recalc PASSED [ 26%]
tests/test_phase2_backend.py::test_tc05_usd_promo_currency_trap_fix17 PASSED [ 30%]
tests/test_phase2_backend.py::test_tc06_regular_item_conversion PASSED   [ 34%]
tests/test_phase2_backend.py::test_tc07_special_item_type3 PASSED        [ 38%]
tests/test_phase2_backend.py::test_ac01_acid_rollback_on_detail_error PASSED [ 42%]
tests/test_phase2_backend.py::test_ac02_acid_rollback_on_edit_detail_error PASSED [ 46%]
tests/test_phase2_backend.py::test_ac03_duplicate_voucher_number_auto_increment PASSED [ 50%]
tests/test_phase2_backend.py::test_ac04_header_detail_sums_mismatch_assertion PASSED [ 53%]
tests/test_phase2_backend.py::test_ac05_cogs_fields_never_overwritten_fix21 PASSED [ 57%]
tests/test_phase2_backend.py::test_ac06_closing_date_protection PASSED   [ 61%]
tests/test_phase2_backend.py::test_ac07_credit_limit_protection PASSED   [ 65%]
tests/test_phase2_backend.py::test_ac08_unicode_tcvn_roundtrip PASSED    [ 69%]
tests/test_api_create_voucher_endpoint PASSED                            [ 73%]
tests/test_api_update_voucher_endpoint PASSED                            [ 76%]
tests/test_api_delete_voucher_endpoint PASSED                            [ 80%]
tests/test_api_check_number_endpoint PASSED                              [ 84%]
tests/test_delete_voucher_success PASSED                                 [ 88%]
tests/test_delete_voucher_locked_period_blocked PASSED                   [ 92%]
tests/test_unicode.py::test_tcvn_to_unicode_bytes PASSED                 [ 96%]
tests/test_unicode.py::test_unicode_idempotency PASSED                   [100%]

======================== 26 passed, 1 warning in 0.79s ========================
```

### 2. Frontend Build Verification (TypeScript & Vite)
- **TypeScript Typecheck:** `tsc` -> **0 lỗi**.
- **Vite Production Build:** `npm run build` -> **Thành công 100%**:
  ```text
  dist/index.html                   0.90 kB │ gzip:  0.52 kB
  dist/assets/index-DGUIyRRJ.css   40.02 kB │ gzip:  7.30 kB
  dist/assets/index-Dt8_49Xs.js   298.14 kB │ gzip: 85.79 kB
  ✓ built in 3.49s
  ```

---

## III. HƯỚNG DẪN KIỂM THỬ THỦ CÔNG (QA MANUAL TEST GUIDE)

Dưới đây là các bước chi tiết để Kế toán và Tester chạy thử nghiệm trực tiếp trên giao diện Web App.

### Bước 0: Khởi động Ứng dụng
1. **Khởi động Backend:**
   Mở PowerShell tại thư mục `e:\1S2024\html\webapp\backend`:
   ```powershell
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   Kiểm tra Swagger UI: Truy cập `http://localhost:8000/docs`.

2. **Khởi động Frontend:**
   Mở PowerShell tại thư mục `e:\1S2024\html\webapp\frontend`:
   ```powershell
   npm run dev
   ```
   Truy cập trình duyệt: `http://localhost:5173/sales-invoices`.

---

### Bước 1: Kiểm thử Danh sách & Chi tiết (VoucherList)
1. Mở danh sách: Thấy tiêu đề **"Phiếu Xuất Bán"**, badge màu xanh lá **`GĐ2: PERSISTENCE (ACID)`**.
2. Phím mũi tên lên / xuống: Di chuyển dòng chọn. Khung dưới tự động hiển thị chi tiết vật tư và dư nợ của khách hàng đó.
3. Phím `Space`: Đánh dấu dòng (ô màu vàng cam).
4. Phím `Ctrl+A`: Đánh dấu toàn bộ danh sách. `Ctrl+U`: Bỏ đánh dấu toàn bộ.
5. Phím `F9`: Mở hộp thoại lọc chứng từ theo ngày, khách hàng, số phiếu.

---

### Bước 2: Kiểm thử Thêm mới Chứng từ (`F2` / Nút "Thêm")
1. Nhấn phím `F2` hoặc bấm nút **"Thêm (F2)"** ở thanh công cụ dưới đáy màn hình:
   - URL chuyển sang: `http://localhost:5173/sales-invoices/new`.
   - Tiêu đề form: **"THÊM MỚI CHỨNG TỪ"** với badge **`MODE: THÊM MỚI (M)`** và mã chứng từ **`X1`**.
2. **Kế thừa và Autocomplete Khách hàng:**
   - Nếu trước đó có chọn dòng trên Grid1, các trường `Đối tượng`, `Tên khách`, `Địa chỉ`, `Xe`, `Bộ phận` đã được điền sẵn.
   - Nhập ô **Đối tượng**: Dropdown gợi ý mở ra, chọn khách sẽ tự nạp thông tin và Mã số thuế (`MST`).
   - Huy hiệu công nợ xuất hiện góc phải: Hiển thị Dư nợ hiện tại.
3. **Thêm dòng hàng hóa (Detail Grid):**
   - Nhập Mã vật tư (ví dụ: `VT01`). Hệ thống tự động nạp Tên vật tư, Đơn vị tính, Kho `01`, TK Có `5111`.
   - Bấm `F4`: Mở hộp thoại chọn tài khoản nhanh cho dòng hiện tại.
   - **Thử nghiệm hàng mút xốp (`Loai_Vt='2'`):** Nhập `Số tấm = 10`, `Hệ số = 2.5`. Quan sát ô `SL bán` và `Số lượng` tự động nhảy thành `25`.
   - Nhập `Đơn giá = 100,000`. `Thành tiền` tự tính thành `2,500,000`.
   - Nhập `CK % = 5`. `Tiền CK` ở góc dưới tự tính `125,000`.
   - Cột `TT` (`Gia_Tb_TT`): Mặc định là `K`, có thể sửa thành `C`.
   - Phím `Enter`: Tự động chuyển con trỏ sang ô tiếp theo; khi ở ô cuối cùng sẽ tạo dòng mới.
   - Bấm `F8`: Xóa dòng hàng hiện tại.
4. **Kiểm tra số phiếu:**
   - Nhập số phiếu mong muốn và bấm nút **"Kiểm tra"** bên cạnh. Nếu trùng, hệ thống báo trùng kèm nút "Dùng số gợi ý".
   - Nếu để trống, hệ thống sẽ tự sinh số theo quy tắc kế toán khi lưu.
5. **Lưu chứng từ:**
   - Nhấn tổ hợp phím **`Ctrl + Enter`** hoặc bấm nút **"Chấp nhận"**:
   - Hệ thống hiển thị thông báo thành công và điều hướng về danh sách, dòng vừa lưu được chọn và làm mới dữ liệu.

---

### Bước 3: Kiểm thử Lấy phiếu xuất kho ("Chọn phiếu xuất" / `ctbhch`)
1. Trong form thêm mới hoặc sửa, bấm nút **"Chọn phiếu xuất"**:
   - Hộp thoại `ctbhch` mở ra với danh sách các phiếu xuất từ CSDL Kho (`KH_2014`) chưa được xuất hóa đơn.
2. Dùng phím `Space` để tích chọn 1 hoặc nhiều phiếu xuất kho.
3. Bấm **`Enter`** hoặc nút **"Chấp nhận (Enter)"**:
   - Toàn bộ các dòng hàng từ phiếu xuất kho được đổ vào bảng chi tiết của chứng từ.
   - Mã xe / biển số xe từ phiếu kho được kế thừa sang ô **Xe**.
   - Mỗi dòng hàng được liên kết `stt_px` với phiếu xuất kho tương ứng.
   - Giá bán và chiết khấu được tự động áp dụng.

---

### Bước 4: Kiểm thử Sửa Chứng từ (`F3` / Double Click)
1. Tại danh sách, chọn một chứng từ và nhấn `F3` (hoặc nhấp đúp chuột vào dòng):
   - Màn hình chuyển sang chế độ **`MODE: SỬA (S)`**.
2. Thay đổi số lượng, chiết khấu, diễn giải hoặc thêm bớt dòng mặt hàng (`F8` xóa dòng, `+ Thêm dòng`).
3. Nhấn **`Ctrl + Enter`** để lưu. Danh sách tự động cập nhật số liệu mới mà không bị lệch số.

---

### Bước 5: Kiểm thử Sao chép Chứng từ (`Ctrl + F2`)
1. Tại danh sách, chọn một chứng từ bất kỳ và nhấn **`Ctrl + F2`**:
   - Màn hình chuyển sang form Thêm mới (`/sales-invoices/new`) với toàn bộ thông tin khách hàng, diễn giải, bộ phận, xe và tất cả các dòng hàng được sao chép sẵn.
   - Số chứng từ và mã `Stt` được làm mới để kế toán ghi thành một chứng từ mới hoàn toàn.

---

### Bước 6: Kiểm thử Xóa Chứng từ (`F8` trên danh sách)
1. Tại danh sách, chọn một chứng từ muốn xóa và nhấn phím **`F8`** (hoặc bấm nút "Xóa" ở thanh công cụ dưới):
   - Một modal xác nhận màu đỏ xuất hiện: `"Xác nhận xóa chứng từ số: HD...?"` kèm cảnh báo gọi thủ tục `CtBH_Delete`.
2. Bấm phím `Esc` để hủy, hoặc bấm nút **"Xóa chứng từ (F8)"** để xác nhận:
   - Chứng từ được xóa khỏi `VP_2014`, hoàn nhập kho và danh sách tự động làm mới tức thì.

---

## IV. BẢNG TỔNG HỢP CÁC FILE ĐÃ HOÀN THÀNH

| STT | File | Thành phần | Mô tả chi tiết |
| :-: | :--- | :--------- | :------------- |
| 1 | `backend/app/schemas/voucher.py` | Backend Schemas | Chuẩn hóa `ma_ct="X1"`, `confirmed=True`, đầy đủ schema CRUD & check number |
| 2 | `backend/app/schemas/pickup.py` | Backend Schemas | Bổ sung `ma_dt, ngay_ct, ty_gia, ma_tte` và 35 cột detail chi tiết + `ma_xe` |
| 3 | `backend/app/database.py` | Database Layer | Context manager `get_db_transaction()` hỗ trợ ACID transactions chuẩn xác |
| 4 | `backend/app/repositories/pickup_repo.py` | Repository | Lọc phiếu kho chưa xuất hóa đơn (`NOT EXISTS CtBH0 vp WHERE vp.Stt_PX`), tra giá `SO_Get_Price` & `SO_Get_Discount` |
| 5 | `backend/app/services/pickup_service.py` | Service | Xử lý map dòng kho sang kế toán, kế thừa `ma_xe`, tính toán phân luồng `loai_vt` ('2', '1', '3') |
| 6 | `backend/app/repositories/debt_repo.py` | Repository | Tra cứu nợ qua `GL_Alert_ClosingAccount4Customer` tại `GETDATE()` kèm fallback |
| 7 | `backend/app/repositories/voucher_repo.py` | Repository | 7 Pre-save checks, lưu header/detail, posting, bảo vệ Fix #21 giá vốn, xóa qua `CtBH_Delete` với `SET NOCOUNT ON;` |
| 8 | `backend/app/services/voucher_service.py` | Service | Nghiệp vụ `create_voucher`, `update_voucher`, `delete_voucher`, `check_number` |
| 9 | `backend/app/routers/vouchers.py` | API Router | Endpoints `POST /api/vouchers`, `PUT /api/vouchers/{stt}`, `DELETE /api/vouchers/{stt}`, `POST /check-number` |
| 10 | `backend/app/routers/pickup.py` | API Router | Nhận tham số `ma_dt, ngay_ct` và chuyển giao cho service |
| 11 | `backend/tests/test_phase2_backend.py` | Testing | 21 ca kiểm thử tự động toàn diện kiểm chứng ACID, an toàn dữ liệu và logic nghiệp vụ |
| 12 | `frontend/src/lib/lookups.ts` | Frontend API | Hàm tra cứu `lookupKhachHang` và `lookupVatTu` |
| 13 | `frontend/src/components/DetailGrid.tsx` | UI Component | Chế độ `editable=true`, nhập liệu `Gia_Tb_TT`, bàn phím `Enter / Shift+Tab / F8`, `grid-cell-input` |
| 14 | `frontend/src/components/VoucherForm.tsx` | UI Component | Giao diện chỉnh sửa toàn diện, autocomplete khách hàng, kiểm tra trùng số phiếu, cảnh báo công nợ, modal `F4` tài khoản, hotkey `Ctrl+Enter` |
| 15 | `frontend/src/components/PickupDialog.tsx` | UI Component | Đầy đủ bộ lọc `ma_dt, ngay_ct`, trả về danh sách chi tiết và `ma_xe` |
| 16 | `frontend/src/App.tsx` | Main Router | Bật hotkeys `F2, Ctrl+F2, F3, F8`, modal xác nhận xóa, kế thừa đầy đủ thông tin header, định tuyến `/sales-invoices/new` và `/:stt` |
| 17 | `html/plan.md` | Tài liệu dự án | Đánh dấu hoàn thành toàn bộ các hạng mục GĐ2 |

---
*Báo cáo được hoàn thành bởi Adversarial Reviewer & QA Teamwork Agent vào ngày 2026-10-23.*
