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
- **Lỗi Format PADL**: Hàm `PADL(số, độ dài, '0')` của FoxPro sẽ tự động ép số nguyên sang chuỗi bằng hàm `STR()`, vô tình tạo ra chuỗi chứa dấu cách (VD: `STR(339)` = `"       339"`). Nếu không cẩn thận xử lý, `PADL` sẽ cắt lỗi ra `"HD339"` (mất số 0). Cần xử lý triệt để bằng cách lồng ép kiểu và cắt khoảng trắng: `PADL(ALLTRIM(STR(lnNum_Dup)), lnLenNum_Dup, '0')`. Đồng thời ép độ dài phần số tối thiểu là 4 `MAX(LEN(lcNumStr_Dup), 4)` để dù hóa đơn cũ là `HD1`, số mới sinh ra vẫn sẽ đúng format 4 số là `HD0002`.

## 10. Sửa Lỗi Tổng Tiền Trên Phiếu In Bị Thành Tổng Cột `Thành tiền`

### Hiện Tượng

Trên phiếu in bán hàng/xuất bán, dòng `Tổng tiền` bị in bằng tổng cột `Thành tiền` trước chiết khấu thay vì tổng cột `Thanh toán` sau chiết khấu.

Ví dụ có 2 dòng:

```text
Dòng 1:
Thành tiền = 8,430,000
CK         = 54%
Thanh toán = 3,877,800

Dòng 2:
Thành tiền = 2
Thanh toán = 2
```

Phiếu in sai:

```text
Tổng tiền = 8,430,002
```

Đúng phải là:

```text
Tổng tiền = 3,877,802
```

### Nguyên Nhân

Mẫu in `RPT\cthd.frx`, `RPT\ctpxg.frx`, `RPT\cttl.frx`... dùng:

- Cột `Thanh toán`: `Tien_Nt2`
- Dòng tổng: `m.TTien_Nt2`
- Cột `Thành tiền`: `Tien_Nt9`

Trong bản sửa chiết khấu trước đó, 2 block trong form `FRM\ctbhd.scx` đã tính lại header sai:

- `RECNO 46`: `Chiet_Khau.LostFocus`
- `RECNO 59`: `Cmgnhan_huy1.Command1.Click`, ngay trước `Save_Ct()`

Code lỗi:

```foxpro
SELECT SUM(Tien_Nt9) FROM K_CtTemp WHERE NOT DELETED() INTO ARRAY laDscAmt
SELECT SUM(Tien9) FROM K_CtTemp WHERE NOT DELETED() INTO ARRAY laDscAmt2
REPLACE TTien_Nt2 WITH NVL(laDscAmt[1], 0), ;
        TTien2 WITH NVL(laDscAmt2[1], 0) IN K_PhTemp1
```

`TTien_Nt2` là tổng cột `Thanh toán`, nhưng lại bị gán bằng `SUM(Tien_Nt9)`, tức tổng cột `Thành tiền`. Vì mẫu in lấy dòng tổng từ `m.TTien_Nt2`, số in ra bị sai.

Ngoài ra, khi `TTien_Nt2` đã được hiểu là tổng thanh toán sau CK, công thức sau cũng có nguy cơ trừ chiết khấu lần hai:

```foxpro
REPLACE TTien_Nt0 WITH TTien_Nt2 + TTien_Nt3 - TTien_Nt4, ;
        TTien0 WITH TTien2 + TTien3 - TTien4 IN K_PhTemp1
```

### Cách Đã Sửa

Trong cả 2 block `RECNO 46` và `RECNO 59`, đổi phần tính tổng từ `Tien_Nt9/Tien9` sang `Tien_Nt2/Tien2`:

```foxpro
SELECT SUM(Tien_Nt2) FROM K_CtTemp WHERE NOT DELETED() INTO ARRAY laDscAmt
SELECT SUM(Tien2) FROM K_CtTemp WHERE NOT DELETED() INTO ARRAY laDscAmt2
REPLACE TTien_Nt2 WITH NVL(laDscAmt[1], 0), ;
        TTien2 WITH NVL(laDscAmt2[1], 0) IN K_PhTemp1
```

Đồng thời đổi công thức tổng cuối sang không trừ CK lần hai:

```foxpro
REPLACE TTien_Nt0 WITH TTien_Nt2 + TTien_Nt3, ;
        TTien0 WITH TTien2 + TTien3 IN K_PhTemp1
```

Sau khi sửa, compile lại:

```foxpro
COMPILE FORM e:\1S2024\FRM\ctbhd.scx
```

### Lưu Ý Về Dữ Liệu Đã Lưu Sai

Lỗi này không chỉ ảnh hưởng giao diện/form tại thời điểm in. Nếu phiếu đã được lưu bằng bản lỗi, header trong database có thể đã bị ghi sai:

```text
CtBH.TTien_Nt2 = SUM(CtBH0.Tien_Nt9)
```

Do đó, dù quay về phần mềm cũ, phiếu vẫn có thể in sai vì mẫu in đọc lại `TTien_Nt2` đã nằm sai trong database.

Khi cần đối soát phiếu đã bị ảnh hưởng:

```sql
SELECT h.So_Ct, h.TTien_Nt2,
       SUM(d.Tien_Nt2) AS SumThanhToan,
       SUM(d.Tien_Nt9) AS SumThanhTien,
       SUM(d.Tien_Nt4) AS SumCK
FROM CtBH h
JOIN CtBH0 d ON d.Stt = h.Stt
WHERE RTRIM(h.So_Ct) = '<SO_CT>'
GROUP BY h.So_Ct, h.TTien_Nt2;
```

Nếu `h.TTien_Nt2 = SUM(d.Tien_Nt9)` nhưng khác `SUM(d.Tien_Nt2)`, cần cập nhật lại header theo tổng thanh toán:

```text
TTien_Nt2 = SUM(CtBH0.Tien_Nt2)
TTien2    = SUM(CtBH0.Tien2)
TTien_Nt4 = SUM(CtBH0.Tien_Nt4)
TTien4    = SUM(CtBH0.Tien4)
TTien_Nt0 = TTien_Nt2 + TTien_Nt3
TTien0    = TTien2 + TTien3
```

## 11. Hướng Dẫn Tối Ưu Tốc Độ Lookup Báo Cáo (Chống Giật Lag, Lỗi Không Tìm Thấy & Object Not Found)

### Hiện Tượng Thường Gặp Ở Các Form Báo Cáo

Khác với form chứng từ (đã preload sẵn các danh mục vào RAM), các form điều kiện báo cáo (như `kct04.scx`) thường không preload danh mục (ví dụ `DmDt` - Khách hàng, `DmVt` - Vật tư). Hậu quả là khi người dùng gõ từng ký tự vào ô tìm kiếm, framework lookup (`KTV.VCT`) phải liên tục gửi câu lệnh SQL động (`SELECT * FROM...`) lên server để tạo dropdown. Điều này gây ra độ trễ lớn, giao diện bị giật/treo ngắn.

Ngoài ra, nếu cố gắng tự fix bằng cách viết đè thuộc tính hoặc tạo index thủ công, thường sẽ vướng phải các lỗi:

1. **Lỗi hiển thị TCVN3**: Chữ có dấu bị biến dạng khi ép hoa.
2. **Lỗi "Không tìm thấy" (Mã khách không hợp lệ)**: Dù chọn đúng mã từ dropdown nhưng phần mềm vẫn báo lỗi do xung đột khoảng trắng (padding).
3. **Lỗi "Object OCURSORDMDT is not found" hoặc "Alias is not found"**: Do xung đột biến toàn cục (cross-contamination) khi drill-down từ báo cáo sang chứng từ.

### Giải Pháp Tối Ưu Chuẩn (Dùng Cho Mọi Form Tương Tự Trong Tương Lai)

Để giải quyết triệt để tốc độ và tính chính xác cho các lookup dạng này, hãy áp dụng đúng công thức sau:

#### Bước 1: Preload Cursor Bằng Thuộc Tính Cục Bộ (`THIS.AddProperty`)

Trong method `Init` của form báo cáo, thêm đoạn code sau để tải trước toàn bộ danh mục vào bộ nhớ cục bộ của form. (Ví dụ dưới đây áp dụng cho danh mục khách hàng `DmDt`):

```foxpro
PROCEDURE Init
DODEFAULT()

* 1. Khai báo thuộc tính cục bộ để tránh đụng độ (cross-contamination) với form khác
IF TYPE('THIS.oCursorDmDt') = 'U'
   THIS.AddProperty('oCursorDmDt')
ENDIF

* 2. Gọi Stored Procedure chuẩn để nạp dữ liệu
IF NOT USED('M_DmDt') OR TYPE('THIS.oCursorDmDt') <> 'O'
   TRY
      * LƯU Ý: Phải truyền ĐỦ tham số, đặc biệt là @p_UserName để không bị sót dữ liệu phân quyền
      THIS.oCursorDmDt = CREATEOBJECT('ADOCursorSys', 'M_DmDt', [EXECUTE DmDt_Get @p_Ma_Dt = '', @p_Ma_Nh_Dt = '', @p_UserName = ?M_Name])
   CATCH
   ENDTRY
ENDIF
ENDPROC
```

_Lưu ý quan trọng về Scope:_ Tuyệt đối không dùng `PUBLIC oCursorDmDt`. Nếu dùng `PUBLIC`, khi người dùng từ báo cáo bấm mở chi tiết một phiếu chứng từ, form chứng từ sẽ ghi đè lên biến `PUBLIC` này, làm object cũ bị hủy và tự động đóng mất cursor `M_DmDt` của form báo cáo. Điều này gây lỗi văng form khi thoát chứng từ quay lại báo cáo.

#### Bước 2: TUYỆT ĐỐI KHÔNG TẠO INDEX THỦ CÔNG

Nhiều lập trình viên có thói quen chèn thêm `INDEX ON Ma_Dt TAG Ma_Dt` ngay sau khi `CREATEOBJECT` để tăng tốc tìm kiếm. **ĐÂY LÀ SAI LẦM NGHIÊM TRỌNG TRÊN FORM BÁO CÁO.**

- Các form báo cáo luôn chạy ngầm lệnh `SET EXACT ON` để chốt tham số chính xác.
- Khi có Index, framework sẽ dùng lệnh `SEEK`. VFP sẽ so sánh nghiêm ngặt cả khoảng trắng thừa của field `CHAR(20)`. Nếu mã gõ vào chỉ có 8 ký tự, lệnh `SEEK` sẽ thất bại -> Gây ra lỗi "Không tìm thấy" dù mã có trong danh sách.
- **Cách đúng:** Không tạo Index. Khi không có Index, framework sẽ tự fallback sang dùng lệnh `LOCATE FOR`. Lệnh `LOCATE` tự động triệt tiêu khoảng trắng thừa, hoạt động hoàn hảo dưới môi trường `SET EXACT ON`. Tốc độ `LOCATE` trên vài ngàn dòng RAM vẫn là tức thời (<1ms).

#### Bước 3: Dọn Dẹp Các Thuộc Tính Thừa Trên Control Textbox

Để framework hoạt động chuẩn xác theo cấu hình metadata của `ST_File`:

1. **Xóa `Format = "!"`**: Cài đặt này ép chữ hoa bằng cơ chế ANSI của VFP, làm hỏng các ký tự có dấu của bảng mã TCVN3 (ví dụ `Trường` thành `TRASNG`). Việc tìm kiếm case-insensitive đã được framework tự xử lý.
2. **Xóa các thiết lập filter thủ công**: Xóa hết các giá trị ở `_fieldlist`, `_filterfieldlist`, `_filtertype`, `_startpos`. Chỉ cần giữ lại các giá trị cơ bản:

```foxpro
ControlSource = "M.Ma_Dt"
InputMask = (P16)
_tablename = DmDt
Name = "txtMa_dt"
```

#### Bước 4: Khai Báo Biến PRIVATE Cho oCursor Khi Xảy Ra Lỗi Tìm Kiếm Thất Bại (Chặn Lỗi Object Not Found)

- **Lỗi phát sinh khi tìm kiếm thất bại:**
  Khi người dùng nhập một mã khách hàng không tồn tại trong cơ sở dữ liệu rồi nhấn `Enter` hoặc chuyển focus, hệ thống ném ra lỗi của chương trình: `Object OCURSORDMDT is not found.` thay vì hiển thị form nhóm khách hàng để chọn.
- **Nguyên nhân:**
  Khi danh mục đã được preload vào form (`USED('M_DmDt') = .T.`), framework lookup (`assign_value` của `KTV.VCX`) nhảy vào nhánh `ELSE` của logic nạp dữ liệu và kiểm tra:

  ```foxpro
  IF TYPE('oCursorDmDt') = 'O' AND oCursorDmDt.BaseClass = 'Cursoradapter'
  ```

  Vì `oCursorDmDt` được lưu ở dạng thuộc tính của form (`THISFORM.oCursorDmDt`), hàm `TYPE('oCursorDmDt')` đánh giá theo ngữ cảnh form và trả về `'O'`, nhưng biểu thức `oCursorDmDt.BaseClass` lại cố tìm kiếm biến cục bộ/toàn cục `oCursorDmDt` và thất bại, ném ra lỗi `Object not found`.

- **Giải pháp:**
  Khai báo biến `PRIVATE oCursorDmDt` trong các sự kiện nhập liệu (`Valid` và `LostFocus` của `txtMa_dt`), gán giá trị bằng `THISFORM.oCursorDmDt` trước khi gọi `DODEFAULT()`. Sự kế thừa phạm vi động (dynamic scoping) của FoxPro giúp truyền tham chiếu biến này xuống các cấp hàm con một cách an toàn và tự động dọn dẹp biến khi hoàn thành.

  Mã chèn vào sự kiện của `txtMa_dt`:

  ```foxpro
  PROCEDURE Valid
  PRIVATE oCursorDmDt
  IF TYPE('THISFORM.oCursorDmDt') = 'O'
     oCursorDmDt = THISFORM.oCursorDmDt
  ENDIF
  RETURN DODEFAULT()
  ENDPROC

  PROCEDURE LostFocus
  DODEFAULT()
  PRIVATE oCursorDmDt
  IF TYPE('THISFORM.oCursorDmDt') = 'O'
     oCursorDmDt = THISFORM.oCursorDmDt
  ENDIF
  THISFORM.LookUpControl1.Assign_Value([K], [DmDt], [M_DmDt], [], [Ma_Dt], [Ten_Dt], [M.Ma_Dt], [M.Ten_Dt],[])
  ENDPROC

  PROCEDURE When
  RETURN EMPTY(m.Ma_Nh_Dt)
  ENDPROC
  ```

  Sau đó biên dịch lại form bằng `COMPILE FORM e:\1S2024\FRM\kct04.scx`.

- **Nguyên tắc áp dụng cho các báo cáo khác:**
  Khi tối ưu hóa tốc độ tìm kiếm cho bất cứ textbox/dialog báo cáo nào bằng cách preload danh mục (ví dụ Vật tư `M_DmVt` -> `oCursorDmVt`, Tài khoản `M_DmTk` -> `oCursorDmTk`, v.v.), nếu xảy ra lỗi `Object OCURSORDM... is not found` khi tìm kiếm thất bại, hãy áp dụng đúng công thức khai báo biến `PRIVATE` tương ứng trỏ tới thuộc tính form ngay tại sự kiện `Valid` và `LostFocus` của textbox nhập liệu.

## 12. Thêm Hotkey (F11) Bật/Tắt In Giá Trực Tiếp Trên Form Chứng Từ

### Hiện Tượng Cần Giải Quyết

Người dùng muốn thay đổi tuỳ chọn "In giá" hay "Không in giá" (thường là một checkbox hoặc textbox nhận giá trị 0/1) bằng một phím tắt (VD: F11) một cách tiện lợi, thay vì phải dùng chuột click. Tuy nhiên, việc tự thêm code phím tắt vào form thường xuyên vướng phải lỗi `Command contains unrecognized phrase/keyword` hoặc `No PARAMETER statement is found`.

### Nguyên Nhân Lỗi Khi Can Thiệp

1. **Lỗi `Command contains unrecognized phrase/keyword`:** Do VFP (đặc biệt là bản 8.0 trở xuống) không hỗ trợ tốt Unicode UTF-8 trên editor. Nếu copy code có chứa tiếng Việt có dấu (ví dụ comment có tiếng Việt) dán vào Form Designer, chuỗi tiếng Việt bị lỗi font sẽ làm compiler của FoxPro không nhận diện được cú pháp.
2. **Lỗi `No PARAMETER statement is found`:** Xảy ra khi dùng script tự động chèn code vào trường `methods` của file SCX mà vô tình tạo ra một dòng trống (khoảng trắng/newline) ở **ngay dòng đầu tiên** của memo field (trước từ khóa `PROCEDURE` đầu tiên). FoxPro sẽ tự động ngầm gán đoạn trống đó thành method mặc định (`Init`), đè mất method `Init` gốc có chứa các tham số truyền vào, làm ứng dụng văng lỗi khi mở form lên.

### Giải Pháp Tối Ưu (Thực Hành Chuẩn)

Chèn mã xử lý phím tắt vào sự kiện `KeyPress` của cấp Form (như `frmdocitemh` trong `ctbhh.scx`). Mã này phải tuân thủ nghiêm ngặt hai điều kiện:

- Tuyệt đối không dùng tiếng Việt có dấu trong code (kể cả phần comment) nếu phải copy-paste thủ công.
- Tận dụng `VARTYPE` để kiểm tra an toàn kiểu dữ liệu trước khi thay đổi, tránh văng lỗi nếu Control chưa kịp nạp.

Đoạn code chuẩn (English Only) chèn vào cuối `PROCEDURE KeyPress` (vào trong khối `DO CASE` hoặc cấu trúc IF nếu có):

```foxpro
	CASE nKeyCode = 133
		NODEFAULT
		IF VARTYPE(THISFORM.txtinGia.Value) = 'C'
			THISFORM.txtinGia.Value = IIF(THISFORM.txtinGia.Value = '1', '0', '1')
		ENDIF
		IF VARTYPE(THISFORM.txtinGia.Value) = 'N'
			THISFORM.txtinGia.Value = IIF(THISFORM.txtinGia.Value = 1, 0, 1)
		ENDIF
		THISFORM.txtinGia.Refresh()
```

_Lưu ý: Nếu form không dùng cấu trúc DO CASE mà dùng IF cho KeyPress, chỉ cần đổi `CASE` thành `IF ... ENDIF` nhưng phải đảm bảo lệnh `DODEFAULT(nKeyCode, nShiftAltCtrl)` gốc của hệ thống vẫn được gọi ở cuối hàm để không làm mất các phím tắt khác._

## 13. Sửa Lỗi Không Cập Nhật Bộ Phận Khi Thêm Mới Bằng F2 (Để Nguyên Mã Đối Tượng)

### Hiện Tượng

Khi đang xem danh sách chứng từ ở `ctbhh.scx`, người dùng chọn một chứng từ của khách hàng nào đó rồi nhấn F2 để thêm mới. Dữ liệu của khách hàng đang chọn được điền vào form `ctbhd.scx`.
Tuy nhiên, phần ô nhập "Bộ phận" (`txtMa_Bp`) và nhãn hiển thị tên bộ phận (`txtTen_Bp`) lại bị trống. Nếu người dùng nhấn `Enter` để đi qua ô "Mã đối tượng" (`txtMa_Dt`) mà không thay đổi mã đối tượng (giữ nguyên mã đối tượng cũ), bộ phận vẫn tiếp tục bị trống và không tự động cập nhật/hiển thị.

### Nguyên Nhân

1. Khi thêm mới chứng từ (`_Moi_Sua = 'M'`), hàm của hệ thống `=Add_One_Voucher(THIS)` được gọi để tạo và sao chép thông tin khách hàng từ danh sách chứng từ sang chứng từ mới trong cursor `K_PhTemp1`, tuy nhiên trường bộ phận (`Ma_Bp`, `Ten_Bp`) không được gán sẵn giá trị mặc định của khách hàng đó từ danh mục đối tượng.
2. Tại `txtMa_Dt.LostFocus`, logic cập nhật thông tin bộ phận (`DmDt_Get_1Item`) chỉ chạy khi thoả mãn điều kiện:
   ```foxpro
   IF EMPTY(K_PhTemp1.Ma_Dt) OR THISFORM._Ma_Change
   ```
   Do người dùng không thay đổi mã khách hàng, `THISFORM._Ma_Change` là `.F.`. Mã khách hàng đã được sao chép sẵn nên `EMPTY(K_PhTemp1.Ma_Dt)` cũng là `.F.`. Kết quả là điều kiện trên trả về `.F.`, hệ thống bỏ qua việc lấy thông tin bộ phận mặc định của đối tượng từ SQL Server.

### Cách Đã Sửa

Sửa đổi trên form `FRM\ctbhd.scx` / `FRM\ctbhd.SCT` tại 2 điểm:

1. **Trong method `Init` của Form (`frmdocitemd`)**:
   Sau khi gọi `=Add_One_Voucher(THIS)` tạo chứng từ mới thành công, kiểm tra nếu mã đối tượng (`K_PhTemp1.Ma_Dt`) đã được điền nhưng bộ phận đang trống, thì lập tức tự động truy vấn lấy bộ phận mặc định của khách hàng đó:

   ```foxpro
   IF THIS._Moi_Sua = 'M'
   	=Add_One_Voucher(THIS)
   	IF NOT EMPTY(K_PhTemp1.Ma_Dt) AND (EMPTY(K_PhTemp1.Ma_Bp) OR ISNULL(K_PhTemp1.Ma_Bp))
   		STORE [] TO lcMa_Bp, lcTen_Bp
   		=ADOCommandSys('DmDt_Get_1Item', [@p_Ma_Dt = ?K_PhTemp1.Ma_Dt, @p_Ma_Bp = ?@lcMa_Bp, @p_Ten_Bp = ?@lcTen_Bp])
   		REPLACE Ma_Bp WITH lcMa_Bp, Ten_Bp WITH lcTen_Bp IN K_PhTemp1
   	ENDIF
   ELSE
   	=Edit_One_Voucher(THIS)
   ENDIF
   ```

   _Điều này giúp ngay khi form thêm mới mở lên, thông tin bộ phận mặc định đã được điền và hiển thị sẵn mà người dùng không cần phải nhấn bất kỳ phím nào._

2. **Trong method `LostFocus` của textbox `txtMa_Dt`**:
   Bổ sung thêm điều kiện cập nhật bộ phận nếu đang thêm mới và bộ phận trống:
   ```foxpro
   IF EMPTY(K_PhTemp1.Ma_Dt) OR THISFORM._Ma_Change OR (THISFORM._Moi_Sua = 'M' AND (EMPTY(K_PhTemp1.Ma_Bp) OR ISNULL(K_PhTemp1.Ma_Bp)))
   ```
   _Bảo đảm nếu bộ phận vì lý do gì chưa được cập nhật lúc mở form, khi người dùng enter qua ô Mã đối tượng, hệ thống sẽ tự động cập nhật lại._

Sau khi sửa, biên dịch lại form bằng:

```foxpro
COMPILE FORM e:S2024\FRM\ctbhd.scx
```

## 14. Sửa Lỗi Không Tự Lấy Mã Xe Khi Thêm Mới Bằng F2 Từ Danh Sách Bán Hàng

### Hiện Tượng

Khi đang chọn một phiếu bán hàng ở `ctbhh.scx` rồi nhấn `F2` để thêm mới, form nhập liệu `ctbhd.scx` mở ra và đã lấy được một số thông tin từ phiếu đang chọn. Tuy nhiên ô "Mã xe" (`txtMa_Xe`) và tên xe (`txtTen_Xe`) vẫn bị trống.

### Thông Tin Schema Đã Kiểm Tra

- `ctbhh.scx` đang hiển thị dữ liệu từ bảng `CtBH`.
- Trong `vp2014_schema.md`, bảng `CtBH` có cột `Ma_Xe`.
- Bảng `CtBH0` trong schema hiện tại là bảng chi tiết vật tư/hàng hóa và không có cột `Ma_Xe`.
- Trên form `ctbhd.scx`, control `txtMa_Xe` đang bind vào `K_PhTemp1.Ma_Xe`, còn `txtTen_Xe` bind vào `K_PhTemp1.Ten_Xe`. Vì vậy phải cập nhật cursor header `K_PhTemp1`, tương ứng dữ liệu header `CtBH`, không cập nhật `K_CtTemp`/`CtBH0`.
- Danh mục xe là `DmXe`, có `Ma_Xe` và `Ten_Xe`.

### Cách Đã Sửa

Sửa trong method `Init` của form `FRM\ctbhd.scx`, object `frmdocitemd`, ngay sau `=Add_One_Voucher(THIS)` và sau block tự lấy bộ phận `Ma_Bp/Ten_Bp`.

Logic mới:

```foxpro
IF TYPE('K_PhTemp1.Ma_Xe') <> 'U'
	LOCAL lcMa_Xe, lcTen_Xe, lcStt_Old, loRS_Xe, lcSQL_Xe
	STORE [] TO lcMa_Xe, lcTen_Xe, lcStt_Old, lcSQL_Xe
	IF USED('K_PhTemp')
		IF TYPE('K_PhTemp.Ma_Xe') <> 'U'
			lcMa_Xe = NVL(K_PhTemp.Ma_Xe, [])
		ENDIF
		IF TYPE('K_PhTemp.Ten_Xe') <> 'U'
			lcTen_Xe = NVL(K_PhTemp.Ten_Xe, [])
		ENDIF
		IF EMPTY(lcMa_Xe) AND TYPE('K_PhTemp.Stt') <> 'U'
			lcStt_Old = NVL(K_PhTemp.Stt, [])
		ENDIF
	ENDIF
	IF EMPTY(lcMa_Xe) AND NOT EMPTY(lcStt_Old)
		TRY
			lcSQL_Xe = [SELECT Ma_Xe FROM CtBH WHERE Stt = ] + CHR(39) + STRTRAN(ALLTRIM(lcStt_Old), CHR(39), CHR(39) + CHR(39)) + CHR(39)
			loRS_Xe = oConnDataSource.Execute(lcSQL_Xe)
			IF NOT loRS_Xe.EOF
				lcMa_Xe = NVL(loRS_Xe.Fields('Ma_Xe').Value, [])
			ENDIF
			loRS_Xe.Close()
			loRS_Xe = NULL
		CATCH
		ENDTRY
	ENDIF
	IF NOT EMPTY(lcMa_Xe)
		IF EMPTY(lcTen_Xe) AND USED('M_DmXe')
			IF SEEKSQL(lcMa_Xe, 'M_DmXe', 'Ma_Xe')
				lcTen_Xe = NVL(M_DmXe.Ten_Xe, [])
			ENDIF
		ENDIF
		REPLACE Ma_Xe WITH lcMa_Xe IN K_PhTemp1
		IF TYPE('K_PhTemp1.Ten_Xe') <> 'U'
			REPLACE Ten_Xe WITH lcTen_Xe IN K_PhTemp1
		ENDIF
	ENDIF
ENDIF
```

Cách này ưu tiên lấy trực tiếp `Ma_Xe/Ten_Xe` từ cursor phiếu đang chọn `K_PhTemp`. Nếu cursor danh sách không mang sẵn `Ma_Xe`, hệ thống dùng `Stt` của phiếu đang chọn để truy vấn lại `CtBH.Ma_Xe`, sau đó lấy tên xe từ cursor danh mục `M_DmXe` nếu đã được nạp.

Sau khi sửa, đã compile lại form:

```foxpro
COMPILE FORM e:\1S2024\FRM\ctbhd.scx
```

## 15. Kế Hoạch Điền Sẵn Mã Nhập Xuất 131 Và Tài Khoản Nợ 1311 Khi Thêm Mới Bằng F2

### Mục Tiêu

Khi người dùng đang ở danh sách `ctbhh.scx` và nhấn `F2` để thêm mới chứng từ bán hàng trong `ctbhd.scx`, form mở ra phải tự điền sẵn:

- Mã nhập xuất: `131`
- Tài khoản Nợ: `1311`

Người dùng vẫn có thể sửa lại thủ công nếu cần.

### Thông Tin Đã Xác Minh Trên Form Và Schema

- Control "Mã nhập xuất" là `txtMa_Nx`.
- `txtMa_Nx.ControlSource = "K_PhTemp1.Ma_Nx"`.
- Tên mã nhập xuất hiển thị ở `txtTen_Nx.ControlSource = "K_PhTemp1.Ten_Nx"`.
- Control "Tài khoản Nợ" là `txtTk2`.
- `txtTk2.ControlSource = "K_PhTemp1.Tk2"`.
- Tên tài khoản hiển thị ở `txtTen_Tk2.ControlSource = "K_PhTemp1.Ten_Tk2"`.
- Trong `vp2014_schema.md`, bảng header `CtBH` có các cột `Ma_Nx` và `Tk2`. Vì vậy cần cập nhật `K_PhTemp1`, không cập nhật cursor chi tiết `K_CtTemp`.
- `txtMa_Nx.LostFocus` hiện có logic lookup `DmNx` và tự gán `Tk2 = M_DmNx.Tk` nếu tài khoản còn trống. Tuy nhiên khi điền bằng code trong `Init`, event `LostFocus` có thể không chạy, nên kế hoạch phải tự gán cả mã, tên và tài khoản.

### Vị Trí Sửa Dự Kiến

Sửa trong method `Init` của form `FRM\ctbhd.scx`, object `frmdocitemd`, trong nhánh:

```foxpro
IF THIS._Moi_Sua = 'M'
	=Add_One_Voucher(THIS)
	...
ELSE
	=Edit_One_Voucher(THIS)
ENDIF
```

Đặt block mới sau các block đang tự điền thêm khi F2, cụ thể sau block lấy `Ma_Bp/Ten_Bp` và sau block lấy `Ma_Xe/Ten_Xe`, trước `ELSE =Edit_One_Voucher(THIS)`.

### Logic Dự Kiến

1. Chỉ chạy khi `_Moi_Sua = 'M'`.
2. Gán mặc định `K_PhTemp1.Ma_Nx = '131'`.
3. Lookup `M_DmNx` theo `Ma_Nx = '131'` để lấy:
   - `Ten_Nx` điền vào `K_PhTemp1.Ten_Nx`.
   - `Posted = IIF(M_DmNx.Dinh_Khoan = 'C', .T., .F.)`, giống logic hiện có trong `txtMa_Nx.LostFocus`.
4. Gán mặc định `K_PhTemp1.Tk2 = '1311'`.
5. Lookup `M_DmTk` theo `Tk = '1311'` để lấy `Ten_Tk2`.
6. Refresh các control liên quan nếu tồn tại:
   - `txtMa_Nx`
   - `txtTen_Nx`
   - `txtTk2`
   - `txtTen_Tk2`

### Đoạn Code Dự Kiến

```foxpro
IF TYPE('K_PhTemp1.Ma_Nx') <> 'U'
	REPLACE Ma_Nx WITH '131' IN K_PhTemp1
	IF USED('M_DmNx') AND SEEKSQL('131', 'M_DmNx', 'Ma_Nx')
		REPLACE Ten_Nx WITH M_DmNx.Ten_Nx, ;
			Posted WITH IIF(M_DmNx.Dinh_Khoan = 'C', .T., .F.) IN K_PhTemp1
	ENDIF
ENDIF

IF TYPE('K_PhTemp1.Tk2') <> 'U'
	REPLACE Tk2 WITH '1311' IN K_PhTemp1
	IF USED('M_DmTk') AND SEEKSQL('1311', 'M_DmTk', 'Tk')
		REPLACE Ten_Tk2 WITH M_DmTk.Ten_Tk IN K_PhTemp1
	ENDIF
ENDIF

IF PEMSTATUS(THISFORM, 'txtMa_Nx', 5)
	THISFORM.txtMa_Nx.Refresh()
	THISFORM.txtTen_Nx.Refresh()
	THISFORM.txtTk2.Refresh()
	THISFORM.txtTen_Tk2.Refresh()
ENDIF
```

### Điểm Cần Kiểm Tra Khi Thực Hiện

- Nếu `M_DmNx` chưa được nạp tại thời điểm `Init`, cần fallback bằng SQL/query hoặc chỉ điền `Ma_Nx/Tk2` rồi để lookup xử lý khi người dùng đi qua control.
- Kiểm tra `Ma_Nx = '131'` có tồn tại trong danh mục `DmNx`.
- Kiểm tra `Tk = '1311'` có tồn tại trong danh mục `DmTk` và thỏa filter hiện tại của `txtTk2`: `Loai_Tk = 'C'`.
- Test F2 từ `ctbhh`: form mở lên phải thấy `131` và `1311` ngay, không cần enter qua ô.
- Test nhánh sửa chứng từ cũ: mở sửa phiếu không được tự đổi `Ma_Nx/Tk2`.
- Compile lại form sau khi sửa:

```foxpro
COMPILE FORM e:\1S2024\FRM\ctbhd.scx
```

### Trạng Thái Đã Thực Hiện

Đã sửa `FRM\ctbhd.scx` / `FRM\ctbhd.SCT` theo kế hoạch trên. Trong `frmdocitemd.Init`, ngay sau các block tự điền `Ma_Bp/Ten_Bp` và `Ma_Xe/Ten_Xe`, đã thêm block mặc định:

- `K_PhTemp1.Ma_Nx = '131'`
- `K_PhTemp1.Tk2 = '1311'`
- Nếu cursor `M_DmNx` đã nạp, tự lấy `Ten_Nx` và cập nhật `Posted` theo `M_DmNx.Dinh_Khoan`.
- Nếu cursor `M_DmTk` đã nạp và tài khoản `1311` có `Loai_Tk = 'C'`, tự lấy `Ten_Tk2`.
- Refresh các control `txtMa_Nx`, `txtTen_Nx`, `txtTk2`, `txtTen_Tk2`.

Đã compile lại form thành công:

```foxpro
COMPILE FORM e:\1S2024\FRM\ctbhd.scx
```
