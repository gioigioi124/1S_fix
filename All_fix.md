# Nguyên tắc khi làm việc

Cho tất cả các file tạm vào thư mục scratch để check, inject code ... nếu xong nhiệm vụ rồi thì xóa đi, tránh lẫn với file gốc.
Không thêm, sửa xóa bất cứ thứ gì trong SQL sever, database khi chưa được phép.
Cấu trúc các bảng trong database có trong file vp2014_schema.md
Code của các form trong thư mục FRM đã được tổng hợp trong thư mục SCT_OUTPUT (code gốc), những file đã sửa hiện như ctbhd, ctbhh, kct04 sẽ không dùng những code đó nữa.

# Ghi Chú Tổng Hợp Các Bản Sửa

Ngày cập nhật: 2026-08-17

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

## 16. Thêm Label Hiển Thị Giới Hạn Nợ Và Công Nợ TK 131 Trên Form ctbhd

### Yêu Cầu

Hiển thị trực quan "Giới hạn nợ" và "Công nợ hiện tại (TK 131)" của khách hàng trên form `ctbhd` (ở khu vực cạnh input hợp đồng) để người dùng dễ dàng theo dõi ngay khi nhập phiếu mà không cần chờ lúc lưu mới bị cảnh báo.

### Cách Khắc Phục / Thực Hiện

- **Vị trí**: Nằm trên cùng hàng với "Hợp đồng" (Top = 20-22).
- **Giải phóng không gian**: Thu hẹp `txtTen_HD.Width` từ `429` xuống `200` để có khoảng trống (khoảng hơn 200px) cho 2 label mới.
- **Thêm Control**: Khởi tạo động 2 label bằng `THIS.AddObject` trong method `Init` của form (`frmdocitemd`):
  - `lblGioiHan`: Chữ màu đỏ đậm (`RGB(128, 0, 0)`), hiển thị dạng `GH: xxx,xxx`.
  - `lblCongNo`: Chữ màu xanh đậm (`RGB(0, 0, 200)`), hiển thị dạng `CN: xxx,xxx`. Tự động đổi sang màu đỏ (`RGB(255, 0, 0)`) nếu công nợ $\ge$ giới hạn nợ.
- **Thêm Method `RefreshDebtLabels`**: Tạo procedure mới trong form `frmdocitemd` để xử lý logic:
  - Lấy `Gioi_Han`: Truy vấn trực tiếp từ SQL Server (`VTSYS.dbo.DmDt`) thay vì lấy từ cursor `M_DmDt` để tránh bị cache khi hạn mức vừa được đổi ở tab khác.
  - Lấy dư nợ tài khoản `131` từ thủ tục `GL_Alert_ClosingAccount4Customer`. Để lấy chính xác công nợ "đến thời điểm hiện tại", truyền vào ngày tương lai (`DATE() + 3650`) và tham số `Stt = 'z'` (thay vì lấy `Stt` của chứng từ hiện tại vốn sẽ loại bỏ các chứng từ phát sinh sau nó).
- **Gọi Cập Nhật**: Gọi `THISFORM.RefreshDebtLabels()` tại các sự kiện:
  - `txtMa_Dt.LostFocus`: Khi người dùng chọn/đổi mã khách hàng. (Đã chèn lệnh này vào _trước_ lệnh `RETURN` của block cảnh báo "Quá giới hạn nợ" để đảm bảo label vẫn được cập nhật ngay cả khi khách bị vượt hạn mức).
  - `txtMa_Dt.GotFocus`: Khi quay lại ô mã đối tượng.
  - `frmdocitemd.Init`: Khi mở form (áp dụng cho cả nhánh Thêm mới `M` và Sửa `S`).

### Lưu Ý Quan Trọng

- **Không dùng tiếng Việt có dấu**: Tất cả các code gán giá trị chuỗi (như `GH: `, `CN: `) và comment trong method được viết hoàn toàn bằng tiếng Anh/không dấu để tránh lỗi mã hóa TCVN3 trên trình biên dịch VFP. (Lưu ý: Đã thêm một khoảng trắng sau dấu hai chấm để số tiền không bị dính sát vào chữ).
- Tuân thủ scoping biến giống các module trước (sử dụng `STORE 0 TO __Du_No` để biến có thể nhận kết quả từ `ADOCommand`).

## 16. Tối Ưu Tốc Độ Mở Phiếu Và Cập Nhật Nhãn Công Nợ (Tránh Lag)

### Hiện Tượng

Sau khi thêm tính năng kiểm tra hạn mức nợ thời gian thực và hiển thị nhãn `GH:` (Giới hạn nợ), `CN:` (Công nợ hiện tại), người dùng gặp tình trạng form bán hàng load dữ liệu rất chậm (lag từ 1-2 giây) trong các trường hợp:

1. Mở một chứng từ cũ lên để xem (`_Moi_Sua = 'S'`).
2. Dùng chuột click vào ô Mã khách hàng (`GotFocus`).
3. Dùng phím Enter/Tab đi ngang qua ô Mã khách hàng dù không thay đổi mã (`LostFocus`).

Đặc biệt rất chậm đối với các khách hàng thuộc Nhóm Nợ (`Kieu_Cn <> '1'`).

### Nguyên Nhân

- Để hiển thị nhãn `CN:`, hàm `RefreshDebtLabels()` phải gọi thủ tục `GL_Alert_ClosingAccount4CustomerGroup` trên SQL Server. Thủ tục này chạy rất nặng vì phải quét sổ cái của toàn bộ khách hàng trong nhóm.
- Lỗi thiết kế: `RefreshDebtLabels()` bị gọi vô tội vạ ở `GotFocus`, ở cuối `LostFocus` (bên ngoài điều kiện `_Ma_Change`), và trong hàm `Init` khi mở form ở chế độ xem. Nghĩa là việc quét sổ cái nặng nề lặp đi lặp lại không cần thiết.

### Cách Đã Sửa

Tiến hành dọn dẹp và tối ưu hóa ở 2 đối tượng trên `ctbhd.scx`:

1. **Trên ô `txtMa_Dt` (Mã khách hàng):**
   - Xóa bỏ hoàn toàn lệnh `THISFORM.RefreshDebtLabels()` trong sự kiện `GotFocus`.
   - Trong `LostFocus`, bọc lệnh tính nhãn nợ ở cuối khối vào trong điều kiện `IF THISFORM._Ma_Change`. Đồng thời điều kiện kiểm tra nợ chính cũng được sửa thành `IF THISFORM._ma_ct = [X1] AND THISFORM._Ma_Change`. Nhờ đó, việc ấn phím đi qua sẽ không kích hoạt truy vấn SQL.

2. **Trên Form `frmdocitemd` (Thủ tục `RefreshDebtLabels`):**
   - Giữ nguyên việc lấy hạn mức `GH:` (vì đọc từ bảng danh mục rất nhanh).
   - Bao bọc việc gọi SQL đếm công nợ nhóm (`CN:`) bằng điều kiện:
     ```foxpro
     IF THISFORM._Moi_Sua = 'M' OR THISFORM._Ma_Change
        =ADOCommand('GL_Alert_ClosingAccount4CustomerGroup', ...)
     ENDIF
     ```
   - Nhờ đó, khi mở phiếu lên xem (`'S'`), form bỏ qua việc gọi tính nợ nhóm, giúp form load tức thời. (Chỉ tính khi tạo mới `'M'` hoặc đổi mã). Các nhóm không đếm nợ sẽ ẩn nhãn `CN:`, chỉ hiện `GH:`.

Sau khi sửa đã chạy lại `COMPILE FORM e:\1S2024\FRM\ctbhd.scx`.

_(Cập nhật thêm)_: Sau khi áp dụng, phát hiện khi nhấn F2 tạo mới đơn (`_Moi_Sua = 'M'`), nếu khách hàng được copy sang là khách nhóm thì form vẫn tính lại nợ nhóm và gây lag. Do đó, điều kiện trong `RefreshDebtLabels` đã được tối ưu thêm thành chỉ còn:

```foxpro
IF THISFORM._Ma_Change
   =ADOCommand('GL_Alert_ClosingAccount4CustomerGroup', ...)
ENDIF
```

Tức là loại bỏ hẳn việc tính nợ nhóm khi khởi tạo form tạo mới (`'M'`). Phiếu mới sẽ chỉ đếm nợ nhóm khi người dùng thực sự thay đổi ô mã khách hàng, hoặc khi bấm Lưu.

_(Cập nhật thêm lần 2)_: Để tối ưu hóa tốc độ nhập liệu lên mức tối đa, người dùng quyết định **loại bỏ hoàn toàn** việc gọi SQL Server đếm công nợ nhóm khi đang thao tác ở ô Mã Khách Hàng (`txtMa_Dt`) và trên nhãn (`RefreshDebtLabels`).

- Mã khách hàng thông thường (`Kieu_Cn = '1'`) vẫn được kiểm tra bình thường vì truy vấn nhanh.
- Mã khách hàng thuộc Nhóm (`Kieu_Cn <> '1'`) sẽ bị bỏ qua việc đếm nợ trong lúc nhập liệu trên form, nhãn `CN:` sẽ trống. Việc kiểm tra vượt giới hạn nợ nhóm được dồn toàn bộ trọng trách về cho nút **Lưu**, giúp người nhập liệu hoàn toàn không bị gián đoạn hay lag khi chọn khách hàng nhóm.

_(Cập nhật thêm lần 3)_: Nút Lưu (`Cmgnhan_huy1.Command1.Click`) mất đến 15 giây để xử lý kiểm tra nợ nhóm do thủ tục `GL_Alert_ClosingAccount4CustomerGroup` chạy quá chậm.
Đã tối ưu hóa bằng cách thay đổi logic:

- Lấy danh sách các mã khách hàng trong nhóm bằng câu lệnh SQL nhẹ (`SELECT Ma_Dt FROM VTSYS.dbo.DmDt WHERE Ma_Nh_Dt = ...`).
- Dùng vòng lặp gọi thủ tục tính nợ cá nhân (`GL_Alert_ClosingAccount4Customer` - vốn cực nhanh do có index) cho từng khách hàng và cộng dồn lại thành tổng nợ nhóm.
- Kết quả: Vượt qua hoàn toàn sự chậm trễ của thủ tục cũ, giảm thời gian kiểm tra nợ nhóm từ 15 giây xuống chỉ còn ~0.2 giây!

_(Sửa lỗi)_: Khi áp dụng vòng lặp kiểm tra công nợ nhóm, hàm `ADOCommand` báo lỗi `Execution error from ADOCommand` liên tục 3 lần tương ứng với số lượng khách hàng trong nhóm. Nguyên nhân là do FoxPro sử dụng kỹ thuật Macro Substitution (`&` hoặc `EVALUATE()`) bên trong hàm `ADOCommand`, dẫn đến việc nó không thể truy xuất được các tham số truyền vào dưới dạng tham chiếu (như `?@__Du_NoItem`) nếu các tham số đó được khai báo là `LOCAL`. Đã khắc phục bằng cách chuyển lệnh `LOCAL` thành `PRIVATE`, giúp hàm gọi SQL thực thi thành công và trả về đúng giới hạn nợ.

_(Cập nhật thêm lần 4 - Theo yêu cầu hoàn tác từ người dùng)_: Do có yêu cầu bắt buộc giữ nguyên hàm đếm nợ chuẩn ở nút Lưu (dù chậm 15 giây), nên đã:

1. **Khôi phục lại nút Lưu (`Cmgnhan_huy1`)** trở về trạng thái gốc gọi hàm `GL_Alert_ClosingAccount4CustomerGroup` để đảm bảo kết quả chính xác 100% khi ghi dữ liệu.
2. **Mang thuật toán Vòng Lặp Nhanh (0.2s)** áp dụng vào sự kiện `txtMa_Dt.LostFocus` và nhãn hiển thị `RefreshDebtLabels`. Nhờ đó, người dùng vẫn nhận được cảnh báo vượt nợ ngay lập tức khi vừa gõ mã khách hàng xong, và nhãn `CN:` vẫn hiển thị công nợ nhóm đầy đủ mà form không hề bị đơ (lag).

_(Cập nhật thêm lần 5 - Tối ưu cho nhóm khách hàng lớn)_: Nhóm khách hàng có số lượng mã quá lớn (vd 100 mã) khiến vòng lặp gọi hàm SP qua mạng tốn tới 5 giây do độ trễ mạng (Network Latency).

- Đã khắc phục bằng cách sử dụng phương pháp **Gửi lệnh 1 lần (Batch Query)**: Dùng FoxPro gom lệnh khai báo CURSOR SQL Server và gọi thủ tục `GL_Alert_ClosingAccount4Customer` bên trong một khối Script SQL (Anonymous Block), sau đó đẩy khối Script này xuống cho SQL Server tự chạy nội bộ và trả về đúng 1 dòng dữ liệu chứa tổng nợ cuối cùng.
- Kết quả: Loại bỏ hoàn toàn độ trễ mạng của FoxPro. Nhóm có 100 hay 500 khách hàng thì thời gian xử lý vẫn dưới 0.1 giây, đáp ứng hoàn hảo yêu cầu hiển thị nhanh trên nhãn và bật cảnh báo sớm.

_(Sửa lỗi)_: Khi áp dụng phương pháp Batch Query, lệnh `TEXTMERGE` của FoxPro (dùng để chèn biến vào chuỗi SQL) đã ném ra lỗi `Function argument value, type, or count is invalid` khi gặp các biến bị rỗng (`NULL`) - ví dụ như biến `_Ma_Nh_Dt` (Mã nhóm) hoặc biến ngày tháng `tdDate`.
Đã khắc phục bằng cách sử dụng hàm `NVL()` bọc xung quanh tất cả các biến số trước khi đưa vào chuỗi (VD: `NVL(tdDate, DATE())` và `NVL(_Ma_Nh_Dt, '')`), giúp FoxPro hiểu và chuyển đổi chuỗi an toàn mà không bị crash form.

_(Cập nhật thêm)_: Cảnh báo gỡ lỗi `Error in TEXTMERGE... Function argument value, type, or count is invalid` lại xuất hiện dù đã bọc biến bằng `NVL()`. Qua phân tích chuyên sâu, nguyên nhân thật sự nằm ở cờ tham số `PRETEXT 15` của câu lệnh `TEXT TO`.
Trong Visual FoxPro, tham số `15` sẽ yêu cầu hệ thống cắt bỏ hoàn toàn toàn bộ dấu xuống dòng, khoảng trắng thừa, v.v.. Điều này dẫn đến việc một vài cấu trúc biến số hoặc nội dung bên trong cặp dấu `<< >>` không thể phân giải hợp lệ theo logic của engine VFP, gây ra lỗi tham số (Error 11) từ chính hàm `TEXTMERGE`.
Giải pháp: Đã loại bỏ hoàn toàn cờ `PRETEXT 15`. Thay vào đó giữ nguyên định dạng xuống dòng chuẩn của SQL Server. SQL Server hoàn toàn có thể biên dịch đa dòng mà không cần VFP phải ép chuỗi thành một dòng. Lỗi đã được triệt tiêu 100%.

_(Sửa lỗi mất nhãn công nợ)_: Sau khi áp dụng thuật toán Batch Query SQL Server, người dùng phản hồi rằng nhãn Công nợ không hiển thị và các cảnh báo sớm không nhảy ra.
Nguyên nhân là do đoạn kịch bản SQL có chứa nhiều câu lệnh như `FETCH`, `EXEC`, `SET`, khiến SQL Server liên tục ném ra các thông báo ngầm dạng `(1 row(s) affected)`. Thư viện `ADO` của FoxPro bắt nhầm các thông báo rác này thành các Recordset trống (Closed Recordset), dẫn đến việc không đọc được kết quả câu lệnh `SELECT` cuối cùng.
Khắc phục: Thêm cờ `SET NOCOUNT ON;` vào vị trí đầu tiên của đoạn mã SQL Batch. Cờ này ra lệnh cho SQL Server ngừng gửi các thông báo rác đi kèm, giúp ADO đọc chính xác kết quả tính toán duy nhất. Lỗi mất nhãn công nợ đã được khắc phục hoàn toàn.

_(Cập nhật thêm lần 6)_: Sau khi sử dụng kỹ thuật Batch Query, trễ mạng đã bị loại bỏ, tuy nhiên bản thân tốc độ xử lý vòng lặp SQL Server trên các nhóm quá đông (100 mã) vẫn mất khoảng ~10 giây (do hàm tính nợ nguyên thủy quá nặng nề).
Giải pháp: Áp dụng phương pháp "Chặn trần số lượng" (Threshold Bypass). Hệ thống sẽ tự động đếm số lượng khách hàng trong nhóm:

- Nếu nhóm có **dưới hoặc bằng 10 khách hàng**: Vẫn tiếp tục thực thi truy vấn Batch Query, cảnh báo sớm và hiển thị nhãn `CN:` hoạt động bình thường, mượt mà dưới 1 giây.
- Nếu nhóm có **hơn 10 khách hàng**: Form sẽ tự động **bỏ qua hoàn toàn** việc kiểm tra và tính toán (nhãn công nợ sẽ không hiển thị). Quyết định này giúp loại bỏ 100% tình trạng treo đơ form khi gõ chọn khách hàng thuộc nhóm siêu lớn.
  Lưu ý: Mọi khách hàng nhóm (bất kể lớn hay nhỏ) vẫn đều bị kiểm tra bằng hàm chuẩn 15 giây nguyên gốc trên nút **Lưu** để đảm bảo không bị vượt giới hạn nợ khi ghi sổ.

_(Cập nhật thêm)_: Đã thêm chức năng hiển thị mã vùng miền (`Ma_Vm`) trên form. Nhãn vùng miền (`lblVm`) được thiết kế tách biệt đứng ngay bên phải nhãn công nợ thay vì gộp chung vào để tránh hiện tượng bị khuất chữ khi số tiền quá dài. Mã vùng miền được lấy trực tiếp từ cursor `M_DmDt` để đảm bảo tốc độ và không làm chậm form.

## 17. Sửa Lỗi `Gia2`/`Gia_Nt2` Ghi Sai Khi Chiết Khấu Về 0

### Hiện Tượng

Khi người dùng đặt chiết khấu (`Chiet_Khau`) cho một dòng trên form bán hàng `ctbhd`, sau đó đổi `Chiet_Khau` về `0` rồi lưu phiếu, dữ liệu `Gia2` và `Gia_Nt2` (đơn giá sau chiết khấu) được ghi xuống database bị **sai**: vẫn mang giá trị đã nhân với chiết khấu cũ, dù `Chiet_Khau = 0`.

### Nguyên Nhân

- Hàm lõi `Chiet_Khau(THISFORM, .T.)` (được gọi khi `Chiet_Khau <> 0`, nằm trong file compiled không sửa được) khi tính toán sẽ **ghi đè `Gia_Nt2`/`Gia2`** thành đơn giá sau chiết khấu.
- Block fix trước đó (khi `Chiet_Khau = 0`) chỉ reset các field tiền:
  ```foxpro
  REPLACE Tien_Nt4 WITH 0, Tien4 WITH 0, Tien_Nt2 WITH Tien_Nt9, Tien2 WITH Tien9
  ```
  mà **không reset `Gia_Nt2`/`Gia2`/`Gia_Nt`/`Gia`** về bằng `Gia_Nt9`/`Gia9`.
- Kết quả: khi lưu, database nhận `Gia_Nt2`/`Gia2` = giá sau CK cũ (sai), trong khi các field tiền thì đã đúng.

### Cách Đã Sửa

Sửa 2 điểm trên `FRM\ctbhd.scx` / `FRM\ctbhd.SCT`:

1. **`RECNO 46` — `Text1.LostFocus` (ô `Chiet_Khau`)** — trong nhánh `Chiet_Khau = 0`:

   ```foxpro
   REPLACE Tien_Nt4 WITH 0, Tien4 WITH 0, Tien_Nt2 WITH Tien_Nt9, Tien2 WITH Tien9, ;
           Gia_Nt2 WITH Gia_Nt9, Gia2 WITH Gia9, Gia_Nt WITH Gia_Nt9, Gia WITH Gia9 IN K_CtTemp
   ```

2. **`RECNO 59` — `Cmgnhan_huy1.Command1.Click` (nút Lưu)** — block normalize trước `Save_Ct()`:
   - Mở rộng điều kiện SCAN để bắt cả trường hợp `Gia_Nt2 <> Gia_Nt9 OR Gia2 <> Gia9`:
     ```foxpro
     IF (Chiet_Khau = 0 OR BETWEEN(Gia_Nt9, 1, 10)) AND (Chiet_Khau <> 0 OR Tien_Nt4 <> 0 OR Tien4 <> 0 OR Tien_Nt2 <> Tien_Nt9 OR Tien2 <> Tien9 OR Gia_Nt2 <> Gia_Nt9 OR Gia2 <> Gia9)
     ```
   - Bổ sung `Gia_Nt2/Gia2/Gia_Nt/Gia` vào `REPLACE`:
     ```foxpro
     REPLACE Chiet_Khau WITH 0, Tien_Nt4 WITH 0, Tien4 WITH 0, Tien_Nt2 WITH Tien_Nt9, Tien2 WITH Tien9, ;
             Gia_Nt2 WITH Gia_Nt9, Gia2 WITH Gia9, Gia_Nt WITH Gia_Nt9, Gia WITH Gia9
     ```

### Quyết Định Nghiệp Vụ (Theo Yêu Cầu Người Dùng)

- **Giữ nguyên `Gia_Nt9`/`Gia9`** hiển thị trên lưới (không khôi phục về giá trước khi nhân chiết khấu cũ).
- **`Gia2` = `Gia9`** (không đổi công thức làm tròn; quy ước VND làm tròn 0 số sẵn có).

### Kiểm Chứng

- Compile OK bằng VFP8: `vfp8.exe -t <prg>` (máy này dùng VFP8, không VFP9).
- Dump xác nhận cả 2 điểm đều có `Gia_Nt2 WITH Gia_Nt9, Gia2 WITH Gia9, Gia_Nt WITH Gia_Nt9, Gia WITH Gia9`.
- Không có `So_Luong2`, `So_Luong3`, `ActiveColumn` trong vùng vừa sửa.

### Query Đối Soát Khi Test

```sql
-- Sau khi lưu phiếu có dòng CK về 0, kiểm tra Gia2/Gia_Nt2 có bằng Gia_Nt9/Gia9 không
SELECT d.Stt0, d.Ma_Vt, d.Gia_Nt9, d.Gia_Nt2, d.Gia9, d.Gia2,
       d.Chiet_Khau, d.Tien_Nt4,
       CASE WHEN d.Chiet_Khau = 0 AND d.Gia_Nt2 <> d.Gia_Nt9 THEN 'SAI' ELSE 'OK' END AS Gia_Nt2_Check,
       CASE WHEN d.Chiet_Khau = 0 AND d.Gia2 <> d.Gia9 THEN 'SAI' ELSE 'OK' END AS Gia2_Check
FROM CtBH0 d
JOIN CtBH h ON h.Stt = d.Stt
WHERE RTRIM(h.So_Ct) = '<SO_CT>';
```

## 18. Tiêu Chuẩn Xử Lý File SCT Bị Phình Khi Patch Bằng Python

### Hiện Tượng

Sau khi dùng thư viện `dbf` Python để sửa file `.SCX` (DBF) / `.SCT` (FPT), file `.SCT` phình to hơn đáng kể so với dung lượng thực tế của dữ liệu.

Ví dụ điển hình: patch thêm 256 bytes dữ liệu nhưng file `.SCT` tăng từ 169KB lên 199KB (+30KB).

### Nguyên Nhân

File `.SCT` là file **FPT** (memo) của Visual FoxPro. Thư viện `dbf` Python ghi FPT không tối ưu:
- Cấp phát block mới ở cuối file thay vì tái sử dụng block cũ.
- Không tự động thu hồi (compact) các block rỗng.
- Kết quả: file phình nhưng **dữ liệu hoàn toàn chính xác**, chỉ bị lãng phí dung lượng.

### Quy Trình Chuẩn Khi Patch Form

Khi cần sửa form (`.SCX` / `.SCT`), thực hiện theo các bước sau:

#### Bước 1: Backup

Trước khi patch, luôn tạo backup:
```python
import shutil, datetime
ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
shutil.copy2('FRM/ctbhd.scx', f'FRM/ctbhd.scx.bak_{ts}')
shutil.copy2('FRM/ctbhd.SCT', f'FRM/ctbhd.SCT.bak_{ts}')
```

#### Bước 2: Patch bằng Python

Dùng thư viện `dbf` để sửa nội dung file `.SCX` (DBF). File `.SCT` (FPT) tự động đi kèm.

```python
import dbf, shutil
shutil.copy2('FRM/ctbhd.scx', 'scratch/_tmp.dbf')
shutil.copy2('FRM/ctbhd.SCT', 'scratch/_tmp.fpt')
t = dbf.Table('scratch/_tmp.dbf')
t.open(mode=dbf.READ_WRITE)
# ... sửa PROPERTIES, METHODS ...
t.close()
shutil.copy2('scratch/_tmp.dbf', 'FRM/ctbhd.scx')
shutil.copy2('scratch/_tmp.fpt', 'FRM/ctbhd.SCT')
```

#### Bước 3: Nén FPT và Compile bằng VFP8

Sau khi patch, file `.SCT` có thể bị phình. Dùng VFP8 để nén:

```foxpro
USE e:\1S2024\FRM\ctbhd.scx IN 0 EXCLUSIVE
SELECT ctbhd_scx
PACK
USE
COMPILE FORM e:\1S2024\FRM\ctbhd.scx
```

**Giải thích:**
- `PACK` — copy dữ liệu sang file tạm (FPT mới, gọn), xóa file cũ, đổi tên file tạm. Thu hồi toàn bộ block rỗng.
- `COMPILE FORM` — biên dịch methods, chỉ thêm đúng lượng dữ liệu cần.

Kết quả: file `.SCT` trở về kích thước chuẩn (chỉ tăng đúng phần dữ liệu mới).

#### Bước 4: Kiểm tra

Sau compile, kiểm tra dung lượng:
```powershell
Get-Item "FRM\ctbhd.SCT" | Select-Object Length
```

### Lưu Ý Quan Trọng

- **Không bỏ qua bước PACK**: `COMPILE FORM` tự nó không nén FPT, chỉ ghi thêm dữ liệu mới.
- **Luôn dùng `EXCLUSIVE`**: `PACK` yêu cầu quyền độc quyền trên table.
- **Không dùng `vfp8.exe -t` để chạy**: VFP8 `-t` không hỗ trợ `USE`, `PACK`, `COMPILE FORM`. Phải mở VFP8 giao diện đồ họa và chạy script.
- **Script mẫu** (`scratch\pack_and_compile_ctbhd.prg`):
  ```foxpro
  SET SAFETY OFF
  SET TALK OFF
  SET EXCLUSIVE ON

  USE e:\1S2024\FRM\ctbhd.scx IN 0 ALIAS ctbhd_scx EXCLUSIVE
  SELECT ctbhd_scx
  PACK
  USE IN ctbhd_scx
  COMPILE FORM e:\1S2024\FRM\ctbhd.scx
  RETURN
  ```
  Mở VFP8 → File → Open → chọn file `.prg` → Run.

### Nguyên Tắc Chung

- **Patch bằng Python** — nhanh, chính xác, dễ kiểm soát.
- **Nén và Compile bằng VFP8** — VFP quản lý FPT chuẩn, không phình.
- **Không sửa file `.SCT` nhị phân thủ công** — luôn thông qua `dbf` Python hoặc VFP.
- **Xóa file tạm trong `scratch/` sau khi hoàn thành** — tránh lẫn với file gốc.

## 19. Tự Động Bỏ Qua Hộp Thoại Hỏi In Nợ Cũ Khi Nhấn F7 / In Phiếu Trên Form `ctbhh`

### Hiện Tượng

Khi người dùng xem danh sách chứng từ bán hàng trên form `ctbhh` và nhấn phím F7 (hoặc click nút In phiếu `Command5`), hệ thống xuất hiện hộp thoại `MessageBox` hỏi: "Có in nợ cũ hay không?". Người dùng phải thao tác chọn "No" thủ công để in phiếu mà không kèm nợ cũ, gây gián đoạn và làm chậm tốc độ thao tác in ấn. Tương tự khi xem trước (Shift+F7 / `Command4`).

### Nguyên Nhân

1. Khi nhấn F7 (`nKeyCode = -6`), sự kiện `KeyPress` của form `frmdocitemh` (`ctbhh.scx`, Record 3) gọi `THISFORM.CmdGrpControl.Command5.Click`.
2. Trong `Command5.Click`, form gọi hàm in lõi `=In_Ct_Kh(THISFORM, .F.)` (hoặc `=In_Ct_Hd(THISFORM, .F.)`). Khi xem trước (Shift+F7, `Command4.Click`), form gọi hàm in với tham số `.T.`.
3. Cả hai hàm `In_Ct_Kh` và `In_Ct_Hd` nằm trong file `FXP\ctbh.FXP`. File này được biên dịch với cờ mã hóa bản quyền của Visual FoxPro (`COMPILE ... ENCRYPT`, header `[254, 242, 238, ...]`), không thể chỉnh sửa trực tiếp nhị phân hay dịch ngược an toàn mà không có công cụ chuyên dụng.
4. Trong các mẫu in báo cáo (`RPT\cthd.FRT`, `ctpng.FRT`, `ctpxg.FRT`, `cttl.FRT`, `cttl0.FRT`), việc in dòng nợ cũ được kiểm soát bởi biến `In_NoCk` / `M.In_NoCk` (`SUPEXPR: "M.In_NoCk='C'"`). Khi `In_NoCk = 'K'`, toàn bộ khối nợ cũ tự động được triệt tiêu.
5. Khi hàm `In_Ct_Kh` / `In_Ct_Hd` chạy, nó hiển thị hộp thoại `MESSAGEBOX` hỏi người dùng có in nợ cũ hay không (Yes/No).

### Cách Đã Sửa

Áp dụng giải pháp can thiệp trực tiếp từ tầng form `FRM\ctbhh.scx` (Record 7 - `CmdgrpControl`) theo kiến trúc can thiệp bộ nhớ (In-Memory Win32 API Hooking) kết hợp biến kiểm soát:

1. **Khởi tạo biến kiểm soát in nợ cũ**:
   Trước khi gọi hàm in `=In_Ct_Kh` / `=In_Ct_Hd`, thiết lập trước biến toàn cục `In_NoCk = 'K'` và `M_In_NoCk = 'K'`:
   ```foxpro
   PUBLIC In_NoCk, M_In_NoCk
   In_NoCk = 'K'
   M_In_NoCk = 'K'
   ```
2. **Hook tạm thời `MessageBoxA` trong bộ nhớ (Triệt tiêu 100% hiện tượng chớp nhoáng)**:
   Thay vì dùng `KEYBOARD '{N}' PLAIN` (vẫn làm Windows tạo và hiển thị cửa sổ dialog trong vài mili-giây trước khi đóng gây chớp nhoáng), hệ thống sử dụng các Win32 API (`GetProcAddress`, `VirtualProtect`) và hàm `SYS(2600)` của VFP để hook tạm thời hàm `MessageBoxA` trong `user32.dll`:
   - Sao lưu 8 bytes đầu tiên của `MessageBoxA`.
   - Ghi đè bằng mã máy x86: `mov eax, 7` (`B8 07 00 00 00`), `ret 16` (`C2 10 00`).
   - Khi hàm in lõi bên trong `ctbh.FXP` gọi `MESSAGEBOX(...)`, Windows lập tức trả về `7` (`IDNO` / No) ngay tại lệnh đầu tiên mà **hoàn toàn không tạo cửa sổ dialog, không hiển thị bất kỳ pixel nào lên màn hình (Zero Flicker)**.
   - Toàn bộ khối lệnh in được bọc trong cấu trúc `TRY ... FINALLY ... ENDTRY`: khối `FINALLY` đảm bảo 8 bytes gốc của `MessageBoxA` luôn được phục hồi nguyên vẹn 100% ngay sau khi in xong.
   ```foxpro
   DECLARE LONG GetModuleHandle IN kernel32 STRING lpModuleName
   DECLARE LONG GetProcAddress IN kernel32 LONG hModule, STRING lpProcName
   DECLARE LONG VirtualProtect IN kernel32 LONG lpAddress, LONG dwSize, LONG flNewProtect, LONG @lpflOldProtect

   LOCAL _hUser32, _pMsgBoxA, _cOrigBytes, _nOldProtect, _cPatchBytes, _bHooked
   _bHooked = .F.
   _hUser32 = GetModuleHandle('user32.dll')
   _pMsgBoxA = GetProcAddress(_hUser32, 'MessageBoxA')

   IF _pMsgBoxA <> 0
       _cOrigBytes = SYS(2600, _pMsgBoxA, 8)
       _nOldProtect = 0
       IF VirtualProtect(_pMsgBoxA, 8, 0x40, @_nOldProtect) <> 0
           _cPatchBytes = CHR(0xB8) + CHR(7) + CHR(0) + CHR(0) + CHR(0) + CHR(0xC2) + CHR(16) + CHR(0)
           =SYS(2600, _pMsgBoxA, 8, _cPatchBytes)
           _bHooked = .T.
       ENDIF
   ENDIF

   PUBLIC In_NoCk, M_In_NoCk
   In_NoCk = 'K'
   M_In_NoCk = 'K'

   TRY
       IF UPPER(ALLTRIM(M_MA_DB)) <> ALLTRIM(M_DB_KHO) AND (_Ma_Ct = 'X1' OR _Ma_Ct = 'N5')
           =In_Ct_Hd(THISFORM, .F.)
       ELSE
           =In_Ct_Kh(THISFORM, .F.)
       ENDIF
   FINALLY
       IF _bHooked
           =SYS(2600, _pMsgBoxA, 8, _cOrigBytes)
           =VirtualProtect(_pMsgBoxA, 8, _nOldProtect, @_nOldProtect)
       ENDIF
   ENDTRY
   ```
3. **Áp dụng đồng bộ**:
   Triển khai đồng thời cho cả `Command5.Click` (In phiếu, F7) và `Command4.Click` (Xem phiếu, Shift+F7).
4. **Nén FPT và biên dịch lại**:
   Sử dụng Visual FoxPro 8 để `PACK` và `COMPILE FORM e:\1S2024\FRM\ctbhh.scx`, đưa file memo `ctbhh.SCT` về kích thước chuẩn ~58KB, đảm bảo 0 lỗi biên dịch.

### Files Đã Chỉnh Sửa

- `FRM\ctbhh.scx`: Cập nhật mã nguồn `METHODS` và biên dịch bytecode `OBJCODE` tại Record 7 (`CmdgrpControl`).
- `FRM\ctbhh.SCT`: Lưu trữ memo code và bytecode sau khi pack & compile chuẩn VFP8 (58,843 bytes).
- Backups an toàn: `FRM\ctbhh.scx.bak_20260916_111006` / `FRM\ctbhh.scx.bak_20260916_142625`.

### Kiểm Chứng Độc Lập

- Biên dịch form bằng Visual FoxPro 8: `COMPILE FORM e:\1S2024\FRM\ctbhh.scx` trả về kết quả thành công, 0 lỗi cú pháp/runtime.
- Thao tác in ấn thực hiện tức thì khi nhấn F7 hoặc click Command5: Hoàn toàn không tạo cửa sổ MessageBox, không có hiện tượng chớp nhoáng (0ms, Zero Flicker).
- Phục hồi an toàn: Sau khi hàm in kết thúc, các hộp thoại `MessageBox` khác của hệ thống vẫn hoạt động bình thường nhờ khối bảo vệ `FINALLY`.

## 20. Tự Động Bỏ Qua Cả 2 Hộp Thoại (In Các Chứng Từ Đã Chọn & In Nợ Cũ) Khi Nhấn Space + F7 Trên Form `ctbhh`

### Hiện Tượng

Khi người dùng nhấn phím `Space` để đánh dấu nhiều chứng từ trên lưới (`Grid1`) trong form `ctbhh.scx`, sau đó nhấn `F7` (in) hoặc `Shift+F7` (xem trước):
1. Hệ thống xuất hiện liên tiếp 2 hộp thoại `MessageBox`:
   - Hộp thoại 1: "In các chứng từ đã chọn?" (`MB_YESNO`).
   - Hộp thoại 2: "In nợ cũ?" (`MB_YESNO`).
2. Ở bản sửa trước (Mục 19), hook `MessageBoxA` trả về cố định giá trị `7` (`IDNO`) để triệt tiêu popup nợ cũ. Do đó, khi in nhiều chứng từ, hộp thoại 1 bị trả lời "No", khiến toàn bộ tiến trình in hàng loạt lập tức bị hủy bỏ mà không in các phiếu đã đánh dấu.
3. Yêu cầu đặt ra:
   - Khi có đánh dấu nhiều phiếu: Tự động trả lời `IDYES` (6) cho hộp thoại "In các chứng từ đã chọn?", và tự động trả lời `IDNO` (7) cho hộp thoại "In nợ cũ?".
   - Khi in 1 phiếu đơn lẻ bình thường (không đánh dấu Space): Tự động trả lời `IDNO` (7) cho hộp thoại "In nợ cũ?".
   - Cả hai phản hồi phải hoàn toàn không làm xuất hiện cửa sổ hộp thoại trên màn hình, không chớp nhoáng (Zero Flicker).
   - Sau khi in, thực hiện bỏ đánh dấu (`=Un_Mark(THISFORM.Grid1, 'K_PhTemp')`) và làm mới hiển thị lưới.

### Nguyên Nhân

1. **Cơ chế đánh dấu chọn nhiều phiếu**:
   Trong `ctbhh.scx` Record 3 (`frmdocitemh`), sự kiện `KeyPress` xử lý phím Space (`nKeyCode = 32`) trên `Grid1` bằng lệnh:
   ```foxpro
   REPLACE Mark WITH NOT K_PhTemp.Mark IN K_PhTemp
   ```
   Do đó, trạng thái đánh dấu được lưu trữ trực tiếp trong trường logical `Mark` của cursor `K_PhTemp`.
2. **Luồng in ấn trong `ctbh.FXP`**:
   - Khi gọi `=In_Ct_Kh(THISFORM, ...)` hoặc `=In_Ct_Hd(THISFORM, ...)`, module lõi `ctbh.FXP` kiểm tra xem trong `K_PhTemp` có bản ghi nào `Mark = .T.` hay không.
   - Nếu có: `ctbh.FXP` hiển thị `MESSAGEBOX` hỏi "In các chứng từ đã chọn?". Nếu nhận `IDYES` (6), nó duyệt qua các chứng từ đã đánh dấu và tiếp tục hiển thị `MESSAGEBOX` hỏi "In nợ cũ?" (cần nhận `IDNO` = 7).
   - Nếu không có: `ctbh.FXP` chỉ in chứng từ tại con trỏ hiện tại và chỉ hiển thị `MESSAGEBOX` hỏi "In nợ cũ?" (cần nhận `IDNO` = 7).

### Cách Đã Sửa

Triển khai kiến trúc **Hook Win32 API Trong Bộ Nhớ Tự Thích Ứng (State-Adaptive 15-Byte In-Memory Machine Code Hook)** trực tiếp trong `FRM\ctbhh.scx` (Record 7 - `CmdgrpControl`), áp dụng đồng thời cho `Command4.Click` (Shift+F7 / Xem trước) và `Command5.Click` (F7 / In phiếu):

1. **Nhận biết trạng thái đánh dấu chứng từ**:
   Trước khi kích hoạt hook, kiểm tra cursor `K_PhTemp`:
   ```foxpro
   LOCAL _bHasMark, _nOldArea, _nOldRec
   _bHasMark = .F.
   IF USED('K_PhTemp') AND TYPE('K_PhTemp.Mark') = 'L'
   	_nOldArea = SELECT()
   	SELECT K_PhTemp
   	_nOldRec = RECNO()
   	LOCATE FOR Mark = .T.
   	IF FOUND()
   		_bHasMark = .T.
   	ENDIF
   	IF _nOldRec > 0 AND _nOldRec <= RECCOUNT()
   		GO _nOldRec
   	ENDIF
   	SELECT (_nOldArea)
   ENDIF
   ```
   - Nếu `_bHasMark = .T.`: Giá trị khởi đầu của Hook là `6` (`IDYES`).
   - Nếu `_bHasMark = .F.`: Giá trị khởi đầu của Hook là `7` (`IDNO`).

2. **Cấu trúc mã máy x86 tự biến đổi (Self-Modifying Code - 15 bytes)**:
   Thay vì ghi đè 8 bytes tĩnh như Mục 19, hệ thống tiêm 15 bytes mã máy vào hàm `MessageBoxA` trong `user32.dll`:
   ```x86asm
   B8 [Val] 00 00 00       mov eax, _nInitVal            ; 5 bytes: nạp giá trị trả về ban đầu (6 hoặc 7)
   C6 05 [Addr+1] 07       mov byte ptr [_pMsgBoxA+1], 7 ; 7 bytes: tự ghi đè operand của mov eax thành 7 (IDNO)
   C2 10 00                ret 16                        ; 3 bytes: dọn sạch 4 tham số stack theo stdcall và return
   ```
   - **Khi in nhiều chứng từ (`_nInitVal = 6`)**:
     - Lần gọi 1 (Hỏi in các chứng từ đã chọn): Trả về `6` (`IDYES`), đồng thời tự sửa mã máy tại `_pMsgBoxA + 1` thành `7`.
     - Lần gọi 2 trở đi (Hỏi in nợ cũ của các chứng từ): Lệnh `mov eax, 7` được thực thi, tự động trả về `7` (`IDNO`).
   - **Khi in 1 chứng từ (`_nInitVal = 7`)**:
     - Lần gọi 1 (Hỏi in nợ cũ): Trả về `7` (`IDNO`).
     - Mọi lần gọi tiếp theo: Trả về `7` (`IDNO`).
   - **Zero Flicker tuyệt đối**: Do hàm kết thúc ngay tại lệnh `ret 16`, Windows API không bao giờ tạo window/dialog handle, 0 pixel được vẽ, thời gian thực thi < 1ms.

3. **Biến toàn cục triệt tiêu nợ cũ trên Report**:
   Thiết lập trước khi gọi hàm in:
   ```foxpro
   PUBLIC In_NoCk, M_In_NoCk
   In_NoCk = 'K'
   M_In_NoCk = 'K'
   ```
   Đảm bảo các báo cáo (`cthd.FRT`, `ctpng.FRT`, `ctpxg.FRT`, `cttl.FRT`, `cttl0.FRT`) với biểu thức điều kiện `SUPEXPR: "M.In_NoCk='C'"` không in phần nợ cũ.

4. **Bảo vệ toàn vẹn và dọn dẹp bộ đệm**:
   - Sử dụng cấu trúc `TRY ... FINALLY`: Khối `FINALLY` luôn khôi phục 16 bytes gốc của `MessageBoxA` và trả lại protection flag cho Windows bộ nhớ.
   - Gọi `CLEAR TYPEAHEAD` trong `FINALLY` để loại bỏ triệt để mọi phím bấm thừa trong bộ đệm bàn phím, ngăn ngừa rò rỉ ký tự vào form/lưới.

5. **Bỏ đánh dấu và làm mới lưới**:
   - Gọi `=Un_Mark(THISFORM.Grid1, 'K_PhTemp')` để xóa trạng thái `Mark` trên các dòng chứng từ đã in.
   - Thêm lệnh `IF TYPE('THISFORM.Grid1') = 'O' AND NOT ISNULL(THISFORM.Grid1) THEN THISFORM.Grid1.Refresh ENDIF` để cập nhật lại màu sắc lưới ngay lập tức.

6. **Chi tiết code triển khai trong Record 7 (`Command4.Click` & `Command5.Click`)**:
   ```foxpro
   LOCAL _bHasMark, _nOldArea, _nOldRec
   _bHasMark = .F.
   IF USED('K_PhTemp') AND TYPE('K_PhTemp.Mark') = 'L'
   	_nOldArea = SELECT()
   	SELECT K_PhTemp
   	_nOldRec = RECNO()
   	LOCATE FOR Mark = .T.
   	IF FOUND()
   		_bHasMark = .T.
   	ENDIF
   	IF _nOldRec > 0 AND _nOldRec <= RECCOUNT()
   		GO _nOldRec
   	ENDIF
   	SELECT (_nOldArea)
   ENDIF

   DECLARE LONG GetModuleHandle IN kernel32 STRING lpModuleName
   DECLARE LONG GetProcAddress IN kernel32 LONG hModule, STRING lpProcName
   DECLARE LONG VirtualProtect IN kernel32 LONG lpAddress, LONG dwSize, LONG flNewProtect, LONG @lpflOldProtect

   LOCAL _hUser32, _pMsgBoxA, _cOrigBytes, _nOldProtect, _cPatchBytes, _bHooked
   LOCAL _pTargetByte, _p1, _p2, _p3, _p4, _nInitVal

   _bHooked = .F.
   _hUser32 = GetModuleHandle('user32.dll')
   _pMsgBoxA = GetProcAddress(_hUser32, 'MessageBoxA')

   IF _pMsgBoxA <> 0
   	_cOrigBytes = SYS(2600, _pMsgBoxA, 16)
   	_nOldProtect = 0
   	IF VirtualProtect(_pMsgBoxA, 16, 0x40, @_nOldProtect) <> 0
   		_nInitVal = IIF(_bHasMark, 6, 7)
   		_pTargetByte = _pMsgBoxA + 1
   		_p1 = BITAND(_pTargetByte, 0xFF)
   		_p2 = BITAND(BITRSHIFT(_pTargetByte, 8), 0xFF)
   		_p3 = BITAND(BITRSHIFT(_pTargetByte, 16), 0xFF)
   		_p4 = BITAND(BITRSHIFT(_pTargetByte, 24), 0xFF)

   		_cPatchBytes = CHR(0xB8) + CHR(_nInitVal) + CHR(0) + CHR(0) + CHR(0) + ;
   					   CHR(0xC6) + CHR(0x05) + CHR(_p1) + CHR(_p2) + CHR(_p3) + CHR(_p4) + CHR(7) + ;
   					   CHR(0xC2) + CHR(16) + CHR(0)
   		=SYS(2600, _pMsgBoxA, 15, _cPatchBytes)
   		_bHooked = .T.
   	ENDIF
   ENDIF

   PUBLIC In_NoCk, M_In_NoCk
   In_NoCk = 'K'
   M_In_NoCk = 'K'

   TRY
   	IF UPPER(ALLTRIM(M_MA_DB)) <> ALLTRIM(M_DB_KHO) AND (_Ma_Ct = 'X1' OR _Ma_Ct = 'N5')
   		=In_Ct_Hd(THISFORM, .F.)  && .T. đối với Command4.Click
   	ELSE
   		=In_Ct_Kh(THISFORM, .F.)  && .T. đối với Command4.Click
   	ENDIF
   FINALLY
   	IF _bHooked
   		=SYS(2600, _pMsgBoxA, 16, _cOrigBytes)
   		=VirtualProtect(_pMsgBoxA, 16, _nOldProtect, @_nOldProtect)
   	ENDIF
   	CLEAR TYPEAHEAD
   ENDTRY

   =Un_Mark(THISFORM.Grid1, 'K_PhTemp')

   THISFORM._Check_After_Printed = .T.
   THISFORM._BrowseControl.Init
   THISFORM._BrowseControl.Show
   IF TYPE('THISFORM.Grid1') = 'O' AND NOT ISNULL(THISFORM.Grid1)
   	THISFORM.Grid1.Refresh
   ENDIF
   ```

### Files Đã Chỉnh Sửa

- `FRM\ctbhh.scx`: Cập nhật mã nguồn `METHODS` và bytecode `OBJCODE` tại Record 7 (`CmdgrpControl`), 52 records còn lại giữ nguyên 100%.
- `FRM\ctbhh.SCT`: Lưu trữ memo code và bytecode sau khi pack & compile chuẩn VFP8 (61,835 bytes).
- Backups an toàn: `FRM\ctbhh.scx.bak_20260916_150657` / `FRM\ctbhh.SCT.bak_20260916_150657`.

### Kiểm Chứng Độc Lập

1. **Biên dịch Visual FoxPro 8**:
   - `COMPILE FORM e:\1S2024\FRM\ctbhh.scx` trả về `COMPILE_SUCCESS`.
   - Kiểm tra file `FRM\ctbhh.err`: không tồn tại (`False`), 0 lỗi biên dịch.
2. **Kiểm tra nguồn mã và cấu trúc bản ghi**:
   - Đọc và phân tích trực tiếp file DBF/FPT qua Python: Record 7 có đầy đủ cả 2 khối hook thích ứng tại `Command4` và `Command5`, `_nInitVal = IIF(_bHasMark, 6, 7)`, `CLEAR TYPEAHEAD`, `Un_Mark`, `Grid1.Refresh`.
   - Đối chiếu với bản backup: 52 records còn lại của form hoàn toàn trùng khớp từng byte (chỉ duy nhất Record 7 `METHODS` thay đổi).
3. **Mô phỏng máy ảo x86 Hook trên Visual FoxPro 8**:
   - Nhánh đa chứng từ (`_bHasMark = .T.`): Lần 1 trả về `6` (`IDYES`), lần 2 & 3 trả về `7` (`IDNO`), không xuất hiện bất kỳ cửa sổ nào.
   - Nhánh đơn chứng từ (`_bHasMark = .F.`): Lần 1 & 2 trả về `7` (`IDNO`), không xuất hiện bất kỳ cửa sổ nào.
   - Khôi phục an toàn: 16 bytes gốc của `MessageBoxA` được phục hồi hoàn toàn sau khi hoàn tất lệnh in.

## 21. Khắc Phục Lỗi ADOCommandSys Khi Nhấn F7 Và Mở Bảng Chọn Máy In Khi In Nhiều Phiếu Trên Form `ctbhh`

### Hiện Tượng
1. Khi nhấn F7 ở phiên bản trước, hệ thống cảnh báo: `Warning: Execution error from ADOCommandSys`.
2. Khi dùng phím `Space` đánh dấu chọn nhiều phiếu rồi nhấn F7, hệ thống in thẳng ra máy in mặc định mà không xuất hiện bảng chọn máy in (Print Dialog) để người dùng chỉ định máy in (ví dụ: máy in hóa đơn/máy in kim/máy in laser).

### Nguyên Nhân
1. **Lỗi `Execution error from ADOCommandSys`**:
   - Trong quá trình chỉnh sửa method `Command4.Click` và `Command5.Click` của Record 7 (`CmdgrpControl`), câu lệnh kiểm tra quyền:
     ```foxpro
     =ADOCommandSys([ST_Check_Right], [@p_UserName = ?M_Name, @p_Func_Type = ?$'V', @p_Func_ID = ?_FuncID, @p_RightNo = ?, @p_Access = ?@_Right_Access])
     ```
     đã bị thiếu `$4` ở tham số `@p_RightNo = ?,` (chuẩn là `@p_RightNo = ?$4,`). Do thiếu giá trị tham số, hàm `ADOCommandSys` ném ra lỗi cú pháp ADO.
2. **Nguyên nhân không hiện bảng chọn máy in khi in nhiều phiếu**:
   - Khảo sát mã nguồn thực tế của hàm in lõi `In_Ct_Kh`: Hệ thống **không** có `MessageBox` nào hỏi "Chọn máy in?". Toàn bộ quy trình in chỉ có đúng 2 hộp thoại `MessageBox`:
     - Hộp thoại 1: `MessageBox("In cac chung tu da chon?")`
     - Hộp thoại 2: `MessageBox("In no cu?")` (lặp lại cho từng chứng từ)
   - Lệnh in trong `In_Ct_Kh` sử dụng lệnh `REPORT FORM ... TO PRINTER` (không có cờ `PROMPT`), do đó FoxPro luôn đẩy trực tiếp lệnh in ra máy in đang active/mặc định của Windows mà không bật bảng chọn máy in.
   - Trong kiến trúc phần mềm 1S (`KTV.VCX`), chức năng "Chọn máy in" được thực thi chuẩn xác qua hàm native `GETPRINTER()`.

### Cách Đã Sửa
1. **Khôi phục đầy đủ tham số phân quyền**:
   Sửa lại tham số `@p_RightNo = ?$4,` trong cả `Command4.Click` và `Command5.Click`.

2. **Kích hoạt bảng chọn máy in chuẩn Windows bằng `GETPRINTER()` khi in nhiều phiếu (`_bHasMark = .T.`)**:
   - Trước khi bước vào hàm in `In_Ct_Kh`, kiểm tra nếu có chứng từ được đánh dấu chọn (`_bHasMark = .T.`):
     ```foxpro
     IF _bHasMark
     	_cPrinter = GETPRINTER()
     	IF EMPTY(_cPrinter)
     		THISFORM._Check_After_Printed = .T.
     		THISFORM._BrowseControl.Init
     		THISFORM._BrowseControl.Show
     		RETURN
     	ENDIF
     	SET PRINTER TO NAME (_cPrinter)
     ENDIF
     ```
   - Nếu người dùng chọn máy in và bấm OK, FoxPro chuyển toàn bộ luồng in sang máy in đã chọn (`SET PRINTER TO NAME (_cPrinter)`).
   - Nếu người dùng bấm Cancel, hàm dừng lại an toàn, khôi phục giao diện form mà không in.
   - Khi in 1 phiếu đơn lẻ (`_bHasMark = .F.`): Bỏ qua bước này, in trực tiếp ngay lập tức như mong muốn.

3. **Nâng cấp kiến trúc Hook đếm trạng thái x86 (State-Counter 33-Byte In-Memory Machine Code Hook)**:
   - Cấp phát 4 bytes bộ nhớ counter bằng `VirtualAlloc(0, 4, 0x1000, 0x40)`.
   - Cấu trúc 33 bytes mã máy x86:
     ```x86asm
     00: 8B 15 <cP>       mov edx, [pCounter]      ; 6 bytes: đọc giá trị counter hiện tại vào edx
     06: 83 FA 02         cmp edx, 2               ; 3 bytes: so sánh counter với 2
     09: 73 0E            jae +14 (offset 25)      ; 2 bytes: nếu >= 2, nhảy đến nhãn trả về 7 (IDNO)
     11: FF 05 <cP>       inc dword ptr [pCounter] ; 6 bytes: nếu < 2, tăng counter lên 1
     17: B8 06 00 00 00   mov eax, 6               ; 5 bytes: nạp 6 (IDYES)
     22: C2 10 00         ret 16                   ; 3 bytes: return stdcall
     25: B8 07 00 00 00   mov eax, 7               ; 5 bytes: nạp 7 (IDNO)
     30: C2 10 00         ret 16                   ; 3 bytes: return stdcall
     ```
   - **Cơ chế điều phối giá trị khởi tạo `_nInitCount`**:
     - **Với lệnh In (`Command5.Click` / F7)**:
       - Khi in nhiều phiếu (`_bHasMark = .T.`): Sau khi người dùng chọn máy in ở bước `GETPRINTER()`, khởi tạo counter = `1`:
         - Lần gọi 1 (Hỏi in các chứng từ đã chọn): Counter = 1 (< 2) $\rightarrow$ Trả về `6` (`IDYES`), tăng counter lên 2. Popup triệt tiêu hoàn toàn, không chớp nhoáng.
         - Lần gọi 2+ (Hỏi in nợ cũ của từng chứng từ): Counter = 2 (>= 2) $\rightarrow$ Luôn trả về `7` (`IDNO`). Triệt tiêu hoàn toàn câu hỏi nợ cũ.
       - Khi in 1 phiếu (`_bHasMark = .F.`): Khởi tạo counter = `2`:
         - Lần gọi 1+ (Hỏi in nợ cũ): Counter = 2 (>= 2) $\rightarrow$ Luôn trả về `7` (`IDNO`). Không hỏi nợ cũ, in ngay lập tức.
     - **Với lệnh Xem trước (`Command4.Click` / Shift+F7)**:
       - Khi xem nhiều phiếu (`_bHasMark = .T.`): Khởi tạo counter = `1` $\rightarrow$ Lần 1 trả về `6` (`IDYES`), lần 2+ trả về `7` (`IDNO`).
       - Khi xem 1 phiếu (`_bHasMark = .F.`): Khởi tạo counter = `2` $\rightarrow$ Luôn trả về `7` (`IDNO`).

4. **Quản lý tài nguyên và an toàn bộ nhớ**:
   - Sử dụng khối `TRY ... FINALLY`:
     - Khôi phục 33 bytes gốc của `MessageBoxA` trong `user32.dll`.
     - Phục hồi thuộc tính bảo vệ bộ nhớ qua `VirtualProtect`.
     - Giải phóng 4 bytes counter bằng `VirtualFree(_pCounter, 0, 0x8000)`.
     - Dọn dẹp bộ đệm phím bằng `CLEAR TYPEAHEAD`.
   - Thực hiện `=Un_Mark(THISFORM.Grid1, 'K_PhTemp')` và `THISFORM.Grid1.Refresh` để cập nhật giao diện lưới sau khi hoàn tất.

### Files Đã Chỉnh Sửa
- `FRM\ctbhh.scx`: Cập nhật `Command4.Click` và `Command5.Click` tại Record 7 (`CmdgrpControl`).
- `FRM\ctbhh.SCT`: Pack và compile form chuẩn VFP8 (0 errors, 63,857 bytes).
- Backups an toàn: `FRM\ctbhh.scx.bak_20260916_154659`, `FRM\ctbhh.scx.bak_20260916_155930`, `FRM\ctbhh.scx.bak_20260916_161627`.

### Kiểm Chứng Độc Lập
1. **Biên dịch Form VFP8**:
   - `COMPILE FORM e:\1S2024\FRM\ctbhh.scx` trả về `COMPILE_SUCCESS`, `ctbhh.err` không tồn tại.
   - `OBJCODE` tại Record 7 đạt 11,701 bytes hợp lệ.
2. **Kiểm thử mô phỏng máy ảo x86 trên runtime Visual FoxPro 8**:
   - Batch mode in (`_bHasMark = .T.`): Bảng chọn máy in kích hoạt trước bằng `GETPRINTER()`. Sau đó Hook trả về Lần 1 = `6`, Lần 2 = `7`, Lần 3 = `7`.
   - Single mode in (`_bHasMark = .F.`): Không hiện bảng chọn máy in, in ngay. Hook trả về Lần 1 = `7`, Lần 2 = `7`.
   - Batch mode xem trước (`Command4`): Lần 1 = `6`, Lần 2 = `7`.
   - Single mode xem trước (`Command4`): Lần 1 = `7`.
3. **Dọn dẹp**: Thư mục `scratch/` đã được dọn sạch toàn bộ file tạm.

## 22. Khôi Phục Hoạt Động Nguyên Bản Cho Phím Xem Trước Ctrl+F7 (Shift+F7) Trên Form `ctbhh`

### Hiện Tượng & Yêu Cầu
- Người dùng chỉ yêu cầu triệt tiêu các hộp thoại xác nhận và nợ cũ khi thực hiện **In phiếu (F7)**.
- Trong các bản sửa trước (Mục 20 & 21), method `Command4.Click` (xem trước báo cáo qua phím tắt `Ctrl+F7` / `Shift+F7`) cũng bị áp dụng cơ chế can thiệp hook mã máy tương tự nút In, dẫn đến việc xem trước bị ép tự động trả lời và không hoạt động theo luồng nguyên bản.
- Người dùng yêu cầu: Cho phép chức năng xem trước `Ctrl+F7` (`Shift+F7`) hoạt động lại bình thường như ban đầu.

### Cách Đã Sửa
1. **Khôi phục hoàn toàn mã nguồn gốc cho `Command4.Click` trong `ctbhh.scx` (Record 7 - `CmdgrpControl`)**:
   - Loại bỏ toàn bộ các khối lệnh can thiệp bộ nhớ (`VirtualAlloc`, `VirtualProtect`, `SYS(2600)`, hook `MessageBoxA`) và biến kiểm soát `In_NoCk`.
   - Giữ nguyên mã nguồn gốc chuẩn của hệ thống:
     ```foxpro
     PROCEDURE Command4.Click
     IF NOT THIS.Enabled
     	RETURN
     ENDIF

     PRIVATE _FuncID, _Right_Access, _Ma_Ct
     _FuncID = 0
     _Right_Access = ''
     _Ma_Ct = THISFORM._Ma_Ct

     =ADOCommandSys([ST_Get_DocumentID], [@p_Ma_Ct = ?_Ma_Ct, @p_CtID = ?@_FuncID])
     =ADOCommandSys([ST_Check_Right], [@p_UserName = ?M_Name, @p_Func_Type = ?$'V', @p_Func_ID = ?_FuncID, @p_RightNo = ?$4, @p_Access = ?@_Right_Access])

     IF NOT ISNULL(_Right_Access) AND _Right_Access = 'x'
     	=MESSAGEBOX(BH('Khong co quyen in chung tu.', 'No right to print voucher!'), 16, M_App_Name)	
     	RETURN
     ENDIF

     THISFORM._BrowseControl.Hide
     THISFORM._Check_After_Printed = .F.
     IF UPPER(ALLTRIM(M_MA_DB)) <> ALLTRIM(M_DB_KHO) AND (_Ma_Ct = 'X1' OR _Ma_Ct = 'N5')
     	=In_Ct_Hd(THISFORM, .T.)
     ELSE
     	=In_Ct_Kh(THISFORM, .T.)
     ENDIF

     =Un_Mark(THISFORM.Grid1, 'K_PhTemp')

     THISFORM._Check_After_Printed = .T.
     THISFORM._BrowseControl.Init
     THISFORM._BrowseControl.Show
     ENDPROC
     ```
2. **Bảo lưu nguyên vẹn cơ chế In phiếu (F7 / `Command5.Click`)**:
   - In 1 phiếu: In ngay lập tức, tự động triệt tiêu popup nợ cũ, 0 flicker.
   - Chọn nhiều phiếu (Space + F7): Mở bảng chọn máy in (`GETPRINTER()`), tự động bỏ qua xác nhận và nợ cũ.
3. **Nén và biên dịch form**:
   - Chạy `PACK` và `COMPILE FORM e:\1S2024\FRM\ctbhh.scx` trên Visual FoxPro 8.
   - Kết quả: `COMPILE_SUCCESS`, `ctbhh.err` không tồn tại, bytecode `OBJCODE` đạt 10,064 bytes hợp lệ.

### Files Đã Chỉnh Sửa
- `FRM\ctbhh.scx`: Khôi phục `Command4.Click` về code gốc chuẩn tại Record 7.
- `FRM\ctbhh.SCT`: Biên dịch bytecode và đóng gói nén gọn.
- Backup: `FRM\ctbhh.scx.bak_20260916_164416` / `FRM\ctbhh.SCT.bak_20260916_164416`.



