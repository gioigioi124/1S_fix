# Quá Trình Gỡ Lỗi: Tốc độ tìm kiếm danh mục khách hàng trên Form Báo Cáo (kct04.scx)

## 1. Mô tả Vấn đề
- Khi nhập tên/mã khách hàng vào ô tìm kiếm (dropbox xổ xuống) tại form Điều kiện lọc của Báo cáo công nợ (`kct04.scx`), tốc độ phản hồi cực kỳ chậm, bị treo/giật ở từng phím gõ.
- Trong khi đó, tính năng tìm kiếm (Autocomplete) tương tự ở form Hóa đơn xuất bán (`ctbhd.scx`) lại hoạt động tức thời, "nhanh như chớp".

## 2. Nguyên nhân giả định (Hypothesis)
Sự khác biệt về kiến trúc giữa Form Chứng từ (Transactions) và Form Báo cáo (Reports) trong VP2014:
1. **Cache Memory**: Form `ctbhd` (nhập liệu) đã được thiết kế tải sẵn (Pre-load) một phần hoặc toàn bộ danh mục khách hàng (`M_DmDt`) vào bộ nhớ RAM cục bộ (Local Cursor). Autocomplete chỉ việc quét trong RAM.
2. **Network Lag**: Form `kct04` (báo cáo) để tiết kiệm RAM nên **không tải** từ điển. Dẫn đến tính năng Incremental Search phải gửi câu lệnh SQL qua mạng (Network Query) cho SQL Server trên mỗi lượt gõ phím.

## 3. Các Phương Án Đã Thử & Kết Quả

### Phương án 1: Lazy Loading qua ADOCommandSys
- **Giải pháp**: Patch trực tiếp file `FRM\kct04.scx`, chèn lệnh `=ADOCommandSys('DmDt_Get_List')` vào sự kiện `GotFocus` của ô `txtMa_dt`. Nhằm kéo dữ liệu về RAM chỉ khi người dùng bấm vào ô tìm kiếm (tránh lãng phí RAM).
- **Kết quả**: **Thất bại**.
- **Lý do**: Bật lên thông báo lỗi `Execution error from ADOCommandSys`. Cú pháp hàm hoặc stored procedure không tồn tại/không khớp với phiên bản framework hiện hành. Cursor không được tạo, tốc độ giữ nguyên.

### Phương án 2: Chuyển logic tìm kiếm sang ô Tên Khách Hàng (Mô phỏng ctbhd)
- **Giải pháp**: 
  - Khôi phục mã gốc (xóa lỗi của PA1).
  - Mở khóa ô `txtTen_dt` (`ReadOnly = .F.`, `TabStop = .T.`).
  - Cấy toàn bộ logic tìm kiếm `LostFocus` (sử dụng `LookUpControl1.Assign_Value`) của `ctbhd` sang ô `txtTen_dt` để gom 1 lần tìm kiếm khi nhấn Enter.
- **Kết quả**: **Thất bại**. 
- **Lý do**: Tốc độ vẫn rất chậm, bất chấp việc đã thay đổi cách kích hoạt (Trigger). Khả năng cao do bản thân `LookUpControl1` trong DataSession của Report Form vẫn tham chiếu về máy chủ thay vì Cursor tạm, làm tắc nghẽn luồng truy vấn.

## 4. Gợi ý hướng Sửa Chữa Tiếp Theo (Next Steps)
Khi có thời gian tiếp tục khắc phục lỗi này, cần tập trung điều tra các hướng sau:
1. **Tìm hàm nạp từ điển chuẩn của Framework**: Thay vì đoán cú pháp ADO, cần trace (dò) mã nguồn của form `ctbhd.scx` (trong lúc form `Init` hoặc `Load`) để xem chính xác biến/hàm nào (như `sLookup.Load_Table('DmDt')` hay `SQLEXEC(...)`) đã tạo ra cursor `M_DmDt`.
2. **Kéo dữ liệu thô (Raw Query) vào Init**: Thử ép tạo cursor trực tiếp ở sự kiện `Init` của `kct04` bằng lệnh SQL nguyên thủy:
   ```foxpro
   SQLEXEC(oConnDataSource.nHandle, "SELECT Ma_Dt, Ten_Dt FROM DmDt", "M_DmDt")
   INDEX ON Ma_Dt TAG Ma_Dt
   ```
3. **Biến môi trường**: So sánh sự khác biệt của biến toàn cục `M_LOOKUP_DT` hoặc `M_AUTOCOMPLETE` khi mở form báo cáo so với khi mở form chứng từ.
