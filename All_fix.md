# Ghi Chú Tổng Hợp Các Bản Sửa

Ngày cập nhật: 2026-07-03

Tài liệu này tổng hợp các lỗi đã sửa trong đợt làm việc với form chứng từ bán hàng `FRM\ctbhd.scx` / `FRM\ctbhd.SCT`. Mục tiêu là để sau này có thể tham chiếu lại: lỗi là gì, nguyên nhân nằm ở đâu, đã sửa như thế nào, và những điều cần tránh để không lặp lại regression.

## Nguyên Tắc Chung Khi Sửa `ctbhd`

- `SCX/SCT` là form Visual FoxPro dạng table/memo, không sửa nhị phân thủ công.
- Mọi thay đổi đều thực hiện qua VFP COM/script, sau đó chạy `COMPILE FORM e:\1S2024\FRM\ctbhd.scx`.
- Chỉ sửa đúng vùng liên quan, tránh chèn block lớn làm file `SCT` phình không kiểm soát.
- Không gọi `So_Luong2(THISFORM)` hoặc `So_Luong3(THISFORM)` trong vùng xử lý chiết khấu hoặc nút Lưu, vì các hàm này có side effect làm nhảy sai số lượng mặt hàng loại 2/3.
- Không dùng flush grid bằng `ActiveColumn`/`EVALUATE()` vì cột trên form có thể bị đổi thứ tự hiển thị; cách an toàn là đổi focus ra control ngoài grid, ví dụ `txtNgay_Ct.SetFocus()`.
- Sau mỗi bước quan trọng cần dump lại method liên quan và kiểm tra không có `So_Luong2`, `So_Luong3`, `ActiveColumn` trong vùng vừa sửa.

## 1. Sửa Lỗi Giới Hạn Nợ Bị Cache

### Hiện Tượng

Khi mở form bán hàng, danh mục khách hàng `M_DmDt` được nạp vào cursor cục bộ. Nếu người dùng mở tab khác để nâng `Gioi_Han` / `Toi_Han`, sau đó quay lại form cũ và bấm Lưu, form vẫn dùng hạn mức cũ trong cursor và báo sai `Qua gioi han no!`.

### Nguyên Nhân

- Dư nợ thực tế được lấy mới từ SQL Server qua `GL_Alert_ClosingAccount4Customer`.
- Giới hạn nợ lại đọc từ cursor local `M_DmDt` / `M_DmNhDtKS`, bị stale.
- Kết quả là so sánh dư nợ mới với hạn mức cũ.

### Cách Đã Sửa

Sửa 2 điểm kiểm tra nợ:

- `txtMa_Dt.LostFocus`
- `Cmgnhan_huy1.Command1.Click` (nút Lưu)

Ở cả khách lẻ và nhóm khách hàng:

- Vẫn lấy giá trị từ cursor cũ làm fallback.
- Sau đó query trực tiếp SQL Server để lấy hạn mức mới nhất:
  - `VTSYS.dbo.DmDt`: `Gioi_Han`, `Toi_Han`
  - `VTSYS.dbo.DmNhDt`: `Gioi_HanN`, `Toi_HanN`
- Có `TRY...CATCH`; nếu ADO lỗi thì giữ fallback cũ, không làm form treo.
- Chuỗi mã khách/nhóm được escape dấu nháy đơn bằng `STRTRAN(..., "'", "''")`.

### Kiểm Chứng

- Compile OK.
- Dump xác nhận có đúng 2 block refresh khách lẻ và 2 block refresh nhóm trong 2 nơi kiểm tra.
- Không chèn lặp block.

## 2. Kiểm Tra Công Nợ Mới Nhất Thay Vì Ngày Chứng Từ

### Hiện Tượng

Khi sửa phiếu cũ, form kiểm tra nợ tại ngày của chứng từ (`K_PhTemp1.Ngay_Ct`). Nếu tại ngày đó khách vượt hạn mức, form vẫn chặn lưu, dù hiện tại khách không còn vượt hạn mức.

### Cách Đã Sửa

Trong 2 điểm kiểm tra nợ, đổi:

```foxpro
tdDate = K_PhTemp1.Ngay_Ct
```

thành:

```foxpro
tdDate = DATE()
```

Nghĩa là `GL_Alert_ClosingAccount4Customer` và bản group dùng ngày hiện tại để lấy công nợ mới nhất.

### Lưu Ý

Dòng kiểm tra khóa kỳ/ngày chứng từ ở đầu nút Lưu vẫn giữ nguyên `K_PhTemp1.Ngay_Ct`, vì đó là nghiệp vụ khác.

## 3. Sửa Lỗi Cảnh Báo Tới Hạn Nợ Khi `Toi_Han = 0`

### Hiện Tượng

Nếu cấu hình `Toi_Han = 0`, form vẫn hiện `Den han muc thanh toan!` khi khách có dư nợ dương.

### Nguyên Nhân

Điều kiện cũ:

```foxpro
IF _No_Cu >= _Toi_Han AND _No_Cu < _Gioi_han
```

Khi `_Toi_Han = 0`, mọi dư nợ dương đều thỏa `_No_Cu >= 0`.

### Cách Đã Sửa

Đổi điều kiện cảnh báo trong 2 nơi:

```foxpro
IF _No_Cu >= _Toi_Han AND _No_Cu < _Gioi_han AND _Toi_Han <> 0
```

Phần chặn lưu khi vượt `Gioi_Han` không đổi.

## 4. Focus Vào Tên Khách Hàng Khi Bấm Lưu Bị Quá Giới Hạn Nợ

### Yêu Cầu

Khi bấm Lưu và bị `Qua gioi han no!`, focus vào ô tên khách hàng, không vào mã khách hàng.

### Cách Đã Sửa

Chỉ thêm trong nhánh nút Lưu:

```foxpro
MESSAGEBOX('Qua gioi han no!', 0+16, M_App_Name)
THISFORM.txtTen_Dt.SetFocus
RETURN
```

Không sửa hành vi khi rời ô mã khách hàng.

## 5. Sửa Lỗi Xóa Chiết Khấu Về 0 Vẫn Còn Chiết Khấu Ẩn

### Hiện Tượng Ban Đầu

Nếu phiếu chỉ có 1 dòng có chiết khấu, khi sửa `Chiet_Khau = 0`:

- `Tien_Nt4` / `Tien4` có thể vẫn còn giá trị ẩn.
- `TTien_Nt4` / `TTien4` có thể không về 0.
- Tổng tiền vẫn bị trừ chiết khấu cũ.
- Nếu chỉ bấm `Ctrl+Enter` lưu nhanh, tổng tiền có thể không cập nhật đúng.

### Regression Cần Tránh

Lần sửa cũ từng gây lỗi mặt hàng loại vật tư 2/3:

- Hàng mút loại 2 có `So_Tam`, hệ số, `SL bán`.
- Gọi `So_Luong2()` / `So_Luong3()` ngoài ngữ cảnh làm số lượng nhảy về sai.
- Vì vậy bản sửa lần này tuyệt đối không gọi các hàm số lượng trong chiết khấu hoặc nút Lưu.

### Nguyên Nhân Thực Tế Sau Khi Debug

Có nhiều lớp dữ liệu cần đồng bộ:

- Detail:
  - `K_CtTemp.Chiet_Khau`
  - `K_CtTemp.Tien_Nt4`, `K_CtTemp.Tien4`
  - `K_CtTemp.Tien_Nt2`, `K_CtTemp.Tien2`
  - `K_CtTemp.Tien_Nt9`, `K_CtTemp.Tien9`
- Header:
  - `K_PhTemp1.TTien_Nt2`, `K_PhTemp1.TTien2`
  - `K_PhTemp1.TTien_Nt4`, `K_PhTemp1.TTien4`
  - `K_PhTemp1.TTien_Nt0`, `K_PhTemp1.TTien0`

Phát hiện quan trọng:

- Ô "Tiền hàng" trên form bind với `K_PhTemp1.TTien_Nt`.
- Ô "Tổng tiền" màu đỏ trong ảnh bind với `K_PhTemp1.TTien_Nt0`.
- Sau khi xóa chiết khấu, `Tien_Nt4` có thể sạch nhưng `Tien_Nt2` của dòng chi tiết vẫn bị trừ ngầm.
- Khi đi qua các ô trước cột CK, hàm gốc tính lại từ `Tien_Nt2`, làm tổng tiền bị kéo xuống.

Ví dụ phiếu `HD0110-1` trước khi sửa sạch dữ liệu:

```text
Dòng 5043160200:
Tien_Nt9 = 756,000
Tien_Nt2 = 317,520
Chênh    = 438,480
```

Sau khi sửa và lưu lại, dòng này đã về:

```text
Tien_Nt9 = 756,000
Tien_Nt2 = 756,000
Chênh    = 0
```

### Cách Đã Sửa Ở `Chiet_Khau.LostFocus`

Tại `RECNO 46`, khi `K_CtTemp.Chiet_Khau = 0`:

- Không gọi `Chiet_Khau(THISFORM, .T.)`.
- Ép dòng hiện tại:

```foxpro
REPLACE Tien_Nt4 WITH 0, ;
        Tien4 WITH 0, ;
        Tien_Nt2 WITH Tien_Nt9, ;
        Tien2 WITH Tien9 IN K_CtTemp
```

- Tính lại tổng tiền hàng:

```foxpro
SELECT SUM(Tien_Nt9) FROM K_CtTemp WHERE NOT DELETED() INTO ARRAY laFixAmt
SELECT SUM(Tien9) FROM K_CtTemp WHERE NOT DELETED() INTO ARRAY laFixAmt2
REPLACE TTien_Nt2 WITH NVL(laFixAmt[1], 0), ;
        TTien2 WITH NVL(laFixAmt2[1], 0) IN K_PhTemp1
```

- Tính lại tổng chiết khấu:

```foxpro
SELECT SUM(Tien_Nt4) FROM K_CtTemp WHERE NOT DELETED() INTO ARRAY laFixCk
SELECT SUM(Tien4) FROM K_CtTemp WHERE NOT DELETED() INTO ARRAY laFixCk2
REPLACE TTien_Nt4 WITH NVL(laFixCk[1], 0), ;
        TTien4 WITH NVL(laFixCk2[1], 0) IN K_PhTemp1
```

- Tính lại tổng thanh toán:

```foxpro
REPLACE TTien_Nt0 WITH TTien_Nt2 + TTien_Nt3 - TTien_Nt4, ;
        TTien0 WITH TTien2 + TTien3 - TTien4 IN K_PhTemp1
```

- Bảo toàn `SELECT()` và `RECNO()` để không làm lệch dòng đang đứng.
- Nếu `Chiet_Khau <> 0`, vẫn gọi logic gốc:

```foxpro
=Chiet_Khau(THISFORM, .T.)
```

### Cách Đã Sửa Trước `Save_Ct()`

Ngay trước:

```foxpro
=Save_Ct(THISFORM._Moi_Sua)
```

Thêm block normalize:

- Đổi focus ra `txtNgay_Ct` để VFP tự xả giá trị đang gõ trong grid.
- Quét toàn bộ `K_CtTemp`.
- Dòng nào `Chiet_Khau = 0` mà còn bất kỳ dấu vết cũ nào thì ép sạch:

```foxpro
IF Chiet_Khau = 0 AND ;
   (Tien_Nt4 <> 0 OR Tien4 <> 0 OR Tien_Nt2 <> Tien_Nt9 OR Tien2 <> Tien9)

    REPLACE Tien_Nt4 WITH 0, ;
            Tien4 WITH 0, ;
            Tien_Nt2 WITH Tien_Nt9, ;
            Tien2 WITH Tien9
ENDIF
```

- Sau đó tính lại:
  - `TTien_Nt2` / `TTien2`
  - `TTien_Nt4` / `TTien4`
  - `TTien_Nt0` / `TTien0`
- Bảo toàn `SELECT()` và `RECNO()`.

### Kiểm Chứng Với Phiếu `HD0110-1`

Sau khi sửa, truy vấn SQL riêng phiếu `HD0110-1` cho kết quả:

Header:

```text
TTien_Nt0 = 2,109,000
TTien_Nt2 = 2,109,000
TTien_Nt4 = 0 / NULL
TTien0    = 2,109,000
TTien2    = 2,109,000
TTien4    = 0 / NULL
```

Chi tiết:

```text
5043160200:
Tien_Nt9 = 756,000
Tien_Nt2 = 756,000
Tien_Nt4 = 0 / NULL
Diff     = 0

5024160200:
Tien_Nt9 = 1,353,000
Tien_Nt2 = 1,353,000
Tien_Nt4 = 0 / NULL
Diff     = 0
```

Tổng:

```text
SUM(Tien_Nt9) = 2,109,000
SUM(Tien_Nt2) = 2,109,000
SUM(Tien_Nt4) = 0
SUM(Chiet_Khau) = 0
```

Kết luận: riêng phiếu này không còn chênh lệch chiết khấu ẩn.

## 6. Kết Quả Audit/Dọn Dẹp Code Sau Khi Sửa Chiết Khấu

Đã kiểm tra riêng 2 vùng nguy cơ:

- `Chiet_Khau.LostFocus` (`RECNO 46`)
- `Cmgnhan_huy1.Command1.Click` (nút Lưu)

Kết quả:

```text
DiscountFixStepCount=0
DiscountSoLuong2=0
DiscountSoLuong3=0
DiscountActiveColumn=0
SaveFixStepCount=0
SaveSoLuong2=0
SaveSoLuong3=0
SaveActiveColumn=0
SaveNormalizeCount=1
```

Ý nghĩa:

- Không còn comment thử nghiệm `FIX STEP`.
- Không có `So_Luong2/So_Luong3` trong vùng chiết khấu hoặc nút Lưu.
- Không có `ActiveColumn`.
- Nút Lưu chỉ còn 1 block normalize zero-discount.

## 7. Các File Chính Đã Thay Đổi

- `FRM\ctbhd.scx`
- `FRM\ctbhd.SCT`

Các script `.prg/.FXP` tạm tạo trong quá trình patch gần đây đã được xóa sau khi compile/kiểm tra. Các script/log lịch sử cũ hơn trong thư mục gốc chưa xóa vì có thể là tài liệu tham chiếu cũ.

## 8. Checklist Kiểm Tra Lại Khi Có Lỗi Tương Tự

Khi gặp lại lỗi "xóa chiết khấu về 0 nhưng tổng tiền vẫn sai":

1. Kiểm tra detail:

```sql
SELECT d.Stt0, d.Ma_Vt, d.Tien_Nt9, d.Tien_Nt2, d.Chiet_Khau, d.Tien_Nt4,
       ISNULL(d.Tien_Nt9,0) - ISNULL(d.Tien_Nt2,0) AS Diff
FROM CtBH h
JOIN CtBH0 d ON d.Stt = h.Stt
WHERE RTRIM(h.So_Ct) = '<SO_CT>';
```

2. Nếu `Chiet_Khau = 0`, `Tien_Nt4 = 0` nhưng `Tien_Nt2 <> Tien_Nt9`, đó là chiết khấu ẩn nằm trong tiền hàng detail.

3. Kiểm tra header:

```sql
SELECT TTien_Nt0, TTien_Nt2, TTien_Nt4, TTien0, TTien2, TTien4
FROM CtBH
WHERE RTRIM(So_Ct) = '<SO_CT>';
```

4. Kiểm tra tổng detail:

```sql
SELECT SUM(ISNULL(Tien_Nt9,0)) AS SumTienNt9,
       SUM(ISNULL(Tien_Nt2,0)) AS SumTienNt2,
       SUM(ISNULL(Tien_Nt4,0)) AS SumCkNt
FROM CtBH0
WHERE Stt = '<STT_HEADER>';
```

5. Nếu cần sửa form, không gọi `So_Luong2/So_Luong3`; chỉ đồng bộ các field tiền và tổng tiền.

## 9. Chống Trùng Số Chứng Từ Khi Lưu Đồng Thời

### Hiện Tượng

Nếu 2 người dùng mở phiếu bán hàng cùng một lúc, form sẽ cấp phát cùng một số chứng từ (ví dụ: HD2854). Khi cả hai cùng bấm Lưu, số chứng từ sẽ bị trùng lặp trong cơ sở dữ liệu do hệ thống cũ chỉ kiểm tra khóa chính (Stt/GUID) mà không chặn trùng lặp số phiếu.

### Cách Đã Sửa

- Chèn một vòng lặp kiểm tra (`DO WHILE`) ngay trước dòng `=Save_Ct(THISFORM._Moi_Sua)` trong nút Lưu (`Cmgnhan_huy1.Command1.Click`).
- Logic chỉ kích hoạt khi tạo mới phiếu (`THISFORM._Moi_Sua = 'M'`).
- Bỏ qua các lệnh truy vấn `SELECT` thủ công (để tránh lỗi ép kiểu trên SQL Server). Thay vào đó, gọi trực tiếp hàm kiểm tra chuẩn của hệ thống: `ADOCommand('ST_Check_Number', ...)`.
- Nếu phát hiện số phiếu đã tồn tại (`_Check_Dup = 1`), FoxPro sẽ tự động tách số (bằng hàm `VAL()`), cộng thêm 1, ghép lại với tiền tố, và cập nhật vào `K_PhTemp1.So_Ct`.
- Vòng lặp tiếp tục gọi `ST_Check_Number` với số vừa sinh ra cho đến khi tìm được số trống hoàn toàn, sau đó mới cho phép hàm `Save_Ct` chạy.

### Lưu Ý Quan Trọng (Scoping trong VFP)

- Khi gọi `ADOCommand` của hệ thống, các tham số truyền vào bằng macro substitution (ví dụ: `?_Moi_Sua_Dup`, `?@_Check_Dup`) **phải được khai báo là `PRIVATE`** thay vì `LOCAL`.
- Trong FoxPro, biến `LOCAL` bị ẩn với các hàm được gọi (như `ADOCommand` / `SQLEXEC`), dẫn đến lỗi "Execution error from ADODataCommand". Khai báo `PRIVATE` giúp hàm kết nối database nhận diện được biến để trả kết quả về đúng.
- Không dùng `MAX(CAST(...))` trên SQL Server để tránh văng lỗi (Conversion failed) do trong bảng `CtBH` có thể chứa các số chứng từ cũ sai định dạng (có lẫn chữ hoặc sai độ dài). Việc tăng số trực tiếp trên bộ nhớ FoxPro bằng hàm `VAL()` an toàn tuyệt đối.

