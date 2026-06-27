# Hướng dẫn Export Bảng Giá ra Excel (Database VP_2014)

Tài liệu này lưu trữ cấu trúc, quy tắc và đoạn mã chuẩn để xuất bảng giá từ hệ thống phần mềm VFP ra file Excel. Bất cứ khi nào cần export bảng giá, AI hãy đọc kỹ các nguyên tắc này.

## Yêu cầu và Quy tắc quan trọng

1. **Sắp xếp Mã Hàng Hóa (Bắt buộc)**
   - Phần mềm VFP gốc hiển thị hàng hóa sắp xếp theo nguyên tắc chuỗi (alphabetical string) từ mã hàng hóa (chữ cái và số từ thấp đến cao, bỏ qua giá trị độ lớn số học). 
   - Ví dụ: `1xx` luôn xếp trước `2xx`. Mã `8171160200` sẽ được nhóm cùng `8171180200353843`.
   - **Mã SQL**: Luôn sử dụng mệnh đề `ORDER BY b.Stt, RTRIM(b0.Ma_Vt) ASC`. Tuyệt đối không dùng `b0.Stt0` (thứ tự dòng nhập) để sắp xếp vì nó sẽ làm sai lệch cách hiển thị với phần mềm.

2. **Cấu trúc File Excel**
   - **Tách Sheet**: Mỗi đợt bảng giá (có thể phân biệt bằng cột `Stt` của bảng `BG`) phải được xuất ra **một sheet riêng biệt**. 
   - **Tên Sheet**: Đặt tên kết hợp giữa `So_Ct` và `Ma_Vm` để dễ nhìn. Đảm bảo tên sheet phải được xử lý độ dài tối đa (31 ký tự), xóa các ký tự không hợp lệ `[ ] / \ ? * :` và xử lý trùng tên sheet (thêm `_1`, `_2` nếu cần).
   - **Bảo toàn dữ liệu**: Cột "Mã Vật Tư" khi đưa vào Excel bắt buộc phải ép kiểu thành văn bản (Trong PowerShell Excel COM: `$sheet.Columns.Item(3).NumberFormat = "@"`). Nếu bỏ qua bước này, Excel sẽ tự động convert mã hàng thành số khoa học (như `8.17E+15`) làm hỏng dữ liệu.

3. **Thông tin Database & Bảng dữ liệu**
   - Chuỗi kết nối mẫu: `Server=192.168.10.8,14333;Database=VP_2014;User Id=sa;Password=sql2008@;Connection Timeout=10`
   - Thông tin bảng giá (Header): Bảng `VP_2014.dbo.BG` (bí danh `b`)
   - Chi tiết mã hàng, đơn giá: Bảng `VP_2014.dbo.BG0` (bí danh `b0`)
   - Tên hàng hóa từ Master Data: Bảng `VTSYS.dbo.DmVt` (bí danh `v`)

## Câu lệnh SQL Chuẩn

Sử dụng câu lệnh sau và thay đổi điều kiện `b.Ngay_Ct` cho phù hợp:

```sql
SELECT 
    RTRIM(b.Stt) AS [Stt_ID], 
    RTRIM(b.So_Ct) AS [So_Ct], 
    RTRIM(b.Ma_Vm) AS [Khu_Vuc], 
    RTRIM(b.Ma_Dt) AS [Doi_Tuong], 
    RTRIM(b0.Ma_Vt) AS [Ma_Vat_Tu], 
    RTRIM(v.Ten_Vt) AS [Ten_Vat_Tu], 
    RTRIM(b0.Dvt) AS [DVT], 
    b0.Gia AS [Gia_Ban], 
    b0.CK AS [Chiet_Khau_Phan_Tram] 
FROM VP_2014.dbo.BG b 
JOIN VP_2014.dbo.BG0 b0 ON b.stt = b0.stt 
LEFT JOIN VTSYS.dbo.DmVt v ON b0.Ma_Vt = v.Ma_Vt 
WHERE b.Ngay_Ct = '2026-04-01'
ORDER BY b.Stt, RTRIM(b0.Ma_Vt) ASC
```

## Hướng dẫn thực thi

1. Hệ thống không có sẵn `Invoke-Sqlcmd`, do đó quy trình tối ưu là viết một file script Powershell để kết nối qua `.NET` (`System.Data.SqlClient.SqlConnection`).
2. Query dữ liệu ra một đối tượng `DataTable`, sau đó dùng lệnh `$grouped = $dt | Group-Object -Property Stt_ID` để tách sheet.
3. Mở Excel qua `New-Object -ComObject Excel.Application`, tạo mảng đa chiều 2D `$data` tương đương kích cỡ hàng x cột, và nạp thẳng vào thông qua thuộc tính `$range.Value2 = $data` để tối đa hóa tốc độ xuất file.

---

# Báo cáo: Sửa lỗi "Ngưỡng Làm Tròn Thành Tiền" (Amount Threshold Bug) trên Chứng từ Bán Hàng (`ctbhd.scx`)

## 1. Phân tích Hiện tượng & Nguyên nhân Lỗi

- **Hiện tượng**: Khi người dùng thao tác trực tiếp trên lưới nhập liệu của form "Chứng từ bán hàng" (`ctbhd.scx`), nếu họ thay đổi Đơn giá (`Gia_Nt9`) hoặc Số lượng (`So_Luong9`) một lượng cực kỳ nhỏ (ví dụ: đổi giá từ 2 xuống 1 với số lượng 1), cột Thành tiền (`Tien_Nt9`) **không tự động cập nhật lại** kết quả đúng là 1, mà vẫn giữ nguyên là 2.
- **Cơ chế gốc của phần mềm (Root Cause)**:
  - Khi một trường (Số lượng / Đơn giá) bị mất tiêu điểm (sự kiện `LostFocus`), form sẽ gọi hàm lõi `So_Luong2(THISFORM)` hoặc `So_Luong3(THISFORM)` để tính lại các giá trị tổng (Thành tiền, Tiền thuế, Tiền chiết khấu).
  - Hàm `So_Luong2()` được viết trong file lõi `.APP` có áp dụng một cơ chế **Ngưỡng bỏ qua (Threshold Bypass)**: Nó sẽ tính `Thành tiền mới` và đem trừ đi `Thành tiền hiện tại`. Nếu độ lệch (sai số) quá nhỏ (dưới một ngưỡng nhất định, thường là < 5.0), hàm sẽ "hiểu lầm" đây chỉ là sai số do làm tròn tỷ giá tiền tệ và sẽ **ngay lập tức `RETURN` (bỏ qua)** mà không thèm ghi đè số tiền mới, cũng như không tính lại Thuế.
  - Cơ chế này vô tình kích hoạt sự sai lệch khi người dùng **cố ý** sửa các mặt hàng có giá trị rất nhỏ.

## 2. Giải pháp Vá lỗi (Workaround / Patching)

Do hàm tính toán gốc `So_Luong2()` đã bị đóng gói nhị phân (compiled) và không thể sửa thẳng, chúng ta áp dụng chiến thuật **"Đánh lừa ngưỡng làm tròn" (Threshold Bypass)** bằng cách can thiệp vào tầng ngoài (giao diện form `ctbhd.scx`):

**Thuật toán can thiệp:**
1. Chèn mã vào sự kiện `LostFocus` của cột Đơn giá và Số lượng, ngay TRƯỚC KHI lệnh gọi `So_Luong2()` được kích hoạt.
2. Tự tính nhẩm: `Tien_Moi_Dung = ROUND(Số Lượng * Đơn Giá, 2)`.
3. Nếu `Tien_Moi_Dung` có khác biệt với `Thành tiền cũ` (nghĩa là thực sự có sự thay đổi do người dùng gõ phím), ta sẽ cố ý cộng thêm một con số ảo khổng lồ (Ví dụ: `+ 1.000.000`) vào `Thành tiền cũ`.
4. Lúc này, khi form gọi đến hàm `So_Luong2()`, hàm này tính toán và so sánh thấy độ lệch lên tới tận một triệu (vượt qua cái ngưỡng 5.0 bé tí kia). Thế là nó ngoan ngoãn bắt tay vào việc: Ghi đè lại Thành tiền chuẩn xác (xóa đi cái 1 triệu ảo), đồng thời cẩn thận tính lại toàn bộ Tiền Thuế và Chiết khấu cho khớp.

## 3. Nội dung Mã Patch (Inject Code)

Đoạn mã sau đã được viết vào script và dùng hàm `STRTRAN` để chèn tự động vào 7 vị trí (objects) liên quan đến `GIA_NT9`, `SO_LUONG9` bên trong file `ctbhd.scx`:

```foxpro
* WORKAROUND: Force recalculation threshold bypass
IF TYPE('THISFORM._VARREAD2') = 'C' AND INLIST(THISFORM._VARREAD2, 'GIA_NT9', 'SO_LUONG9', 'SO_LUONG8')
    IF TYPE('K_CtTemp.Tien_Nt9') = 'N' AND TYPE('K_CtTemp.Gia_Nt9') = 'N' AND TYPE('K_CtTemp.So_Luong9') = 'N'
        LOCAL lnCalcTien
        lnCalcTien = ROUND(K_CtTemp.Gia_Nt9 * K_CtTemp.So_Luong9, 2)
        IF ABS(K_CtTemp.Tien_Nt9 - lnCalcTien) > 0.001
            REPLACE Tien_Nt9 WITH K_CtTemp.Tien_Nt9 + 1000000 IN K_CtTemp
        ENDIF
    ENDIF
ENDIF
IF K_CtTemp.Loai_Vt = '3'
    =So_Luong3(THISFORM)
...
```

*Lưu ý: Mọi chỉnh sửa đều đã được Compile thành công vào file `ctbhd.scx`. Người dùng chỉ việc mở phần mềm lên lập phiếu là lỗi đã hoàn toàn biến mất.*

---

# Báo cáo: Sửa lỗi "Bảng giá hết hạn vẫn được áp dụng" (Price List Expiration Bug) trên Chứng từ Bán Hàng

## 1. Phân tích Hiện tượng & Nguyên nhân Lỗi

- **Hiện tượng**: Khi người dùng lập phiếu xuất bán (form `ctbhd.scx`), nếu bảng giá đã qua "ngày kết thúc" hiệu lực (`Ngay_Ct2` quy định trong CSDL), phần mềm vẫn điềm nhiên lấy đơn giá cũ áp dụng vào hóa đơn mới thay vì từ chối hoặc trả về 0.
- **Cơ chế gốc của phần mềm (Root Cause)**:
  - Form gọi một hàm Stored Procedure tên là `SO_Get_Price` (và `SO_Get_Discount` cho chiết khấu) trên SQL Server để truy vấn giá.
  - Tuy nhiên, SP này đã bị thiếu logic kiểm tra ngày kết thúc (`Ngay_Ct2`), hoặc được lập trình viên cũ viết cứng để lấy giá gần nhất bỏ qua ngày hết hạn.
  - **Vấn đề cốt lõi**: Các SP này trên SQL Server đã bị **mã hóa (Encrypted)**. Do đó, chúng ta không thể mở ra dùng lệnh `ALTER PROCEDURE` trên SQL Server để chèn thêm câu lệnh kiểm tra điều kiện ngày được.

## 2. Giải pháp Vá lỗi (Client-side Validation Workaround)

Do "cửa chính" ở tầng Database Server (SQL) đã bị khóa, chúng ta buộc phải xử lý chặn ở "cửa sổ" tầng Client (ngay trên Form VFP). 

**Chiến thuật thực hiện:**
1. **Viết thư viện kiểm duyệt rời (`SO_Price_Fix.PRG`)**: 
   - Tạo một đoạn mã độc lập dùng `ADODB.Recordset` để móc trực tiếp vào SQL Server (chỉ dùng lệnh `SELECT` để đảm bảo an toàn tuyệt đối, không ghi đè dữ liệu). 
   - Hàm `CheckPriceExpiry` sẽ nhận vào: *Mã khách hàng, Mã vật tư, Ngày lập hóa đơn* và *Đơn giá gốc* do phần mềm vừa lấy ra. 
   - Nó sẽ quét qua bảng `BG` (Header bảng giá) và `BG0` (Chi tiết bảng giá). Nếu phát hiện hóa đơn lập sau ngày hết hạn (`Ngay_Ct > Ngay_Ct2`), nó sẽ thẳng tay ép Đơn giá về `0`. (Làm tương tự cho Chiết khấu).
2. **Biên dịch**: File `.PRG` được VFP biên dịch thành `SO_Price_Fix.FXP` nằm song song trong thư mục phần mềm.
3. **Patch Form (`ctbhd.scx`)**: Dùng mã lệnh tự động (Script) chèn thêm một đoạn code vào form để "đón lõng" kết quả. Ngay sau khi phần mềm lấy giá sai từ SQL Server về, ta ép nó phải đi qua trạm kiểm duyệt (file `.FXP` của chúng ta) trước khi điền lên giao diện.

## 3. Nội dung Mã Patch

**Mã chèn vào form `ctbhd.scx` (Trạm đón lõng giá):**
```foxpro
ADOCommand('SO_Get_Price', '@p_Ngay_Ct = ?K_PhTemp1.Ngay_Ct, ... @p_Gia = ?@_Gia')
* --- BẮT ĐẦU MÃ CHÈN THÊM ---
SET PROCEDURE TO SO_Price_Fix ADDITIVE
_Gia = CheckPriceExpiry(K_PhTemp1.Ngay_Ct, K_PhTemp1.Ma_Dt, m.Ma_Vt, _Gia)
* --- KẾT THÚC MÃ CHÈN THÊM ---
REPLACE Gia_Nt9 WITH _Gia IN K_CtTemp
```
*(Cấu trúc đón lõng tương tự được áp dụng cho tính năng Chiết khấu `SO_Get_Discount`)*

## 4. Lưu ý Vận hành & Bảo trì

- **Tính phụ thuộc**: Bản vá này yêu cầu phần mềm luôn phải đi kèm file `SO_Price_Fix.FXP`. Nếu mất hoặc lỡ xóa file này, khi lập phiếu bán hàng phần mềm sẽ báo lỗi không tìm thấy hàm `CheckPriceExpiry`. Do đó khi di chuyển hoặc copy phần mềm sang máy khác, bắt buộc phải copy bộ 3 file: `ctbhd.scx`, `ctbhd.sct`, và `SO_Price_Fix.FXP`.
- **Giới hạn với POS**: Các form Bán lẻ (`docPosd.scx`) không thể áp dụng cách can thiệp mã này vì toàn bộ mã nguồn bên trong form đã bị xóa trắng (stripped) bởi lập trình viên gốc để bảo mật. Hiện tại chỉ có form Chứng từ bán hàng (`ctbhd.scx`) là còn nguyên mã nguồn để sửa.

---

# Báo cáo: Sửa "Lỗi loại trừ số 0" (Zero-Exclusion Bug) khi xóa chiết khấu trên Chứng từ Bán Hàng

## 1. Phân tích Hiện tượng & Nguyên nhân Gốc rễ

- **Hiện tượng**: Trên form `ctbhd.scx`, khi xóa chiết khấu (đặt `Chiet_Khau = 0`), cột `Tiền chiết khấu` (`Tien_Nt4`), `Tổng chiết khấu` (`TTien_Nt4`) và `Tổng thanh toán` (`TTien_Nt`) **không được cập nhật**. Lỗi đặc biệt rõ khi chỉ có **duy nhất 1 dòng** có chiết khấu.
- **Nguyên nhân gốc rễ (Root Cause)**: Hàm hệ thống `=Chiet_Khau(THISFORM, .T.)` có **2 lỗi nghiêm trọng**:
  1. **Lỗi bỏ qua giá trị 0**: Khi tổng chiết khấu bằng 0, hàm không cập nhật header (do điều kiện `IF > 0`).
  2. **Lỗi ghi đè ngược (Overwrite Bug)**: Ngay cả khi code patch đã ép `Tien_Nt4 = 0` trước, hàm hệ thống khi chạy sẽ **GHI ĐÈ `Tien_Nt4` về giá trị cũ** từ cache nội bộ. Mọi bản vá đặt TRƯỚC lệnh gọi hàm đều bị vô hiệu hóa.

## 2. Giải pháp Triệt để (Definitive Fix - 2026-06-24)

**Chiến lược: Bypass hoàn toàn hàm hệ thống khi `Chiet_Khau = 0`.**

Thay vì gọi `=Chiet_Khau(THISFORM, .T.)` rồi cố sửa kết quả (cách cũ, thất bại), bản vá mới **KHÔNG gọi hàm hệ thống** khi chiết khấu bằng 0, tự xử lý toàn bộ:

### 2.1. Code trong `LostFocus` của cột `% Chiết khấu` (RECNO 46):

```foxpro
PROCEDURE LostFocus
DODEFAULT()
* === FIX TRIET DE: Bypass ham he thong khi chiet khau = 0 ===
IF TYPE('K_CtTemp.Chiet_Khau') = 'N' AND K_CtTemp.Chiet_Khau = 0
    REPLACE Tien_Nt4 WITH 0, Tien4 WITH 0 IN K_CtTemp
    LOCAL ARRAY laFixCk[1], laFixCk2[1]
    STORE 0 TO laFixCk[1], laFixCk2[1]
    SELECT SUM(Tien_Nt4) FROM K_CtTemp INTO ARRAY laFixCk
    SELECT SUM(Tien4) FROM K_CtTemp INTO ARRAY laFixCk2
    REPLACE TTien_Nt4 WITH NVL(laFixCk[1], 0), TTien4 WITH NVL(laFixCk2[1], 0) IN K_PhTemp1
    =So_Luong3(THISFORM)
    THISFORM.Refresh()
ELSE
    * Chiet khau > 0: goi ham he thong binh thuong (van hoat dong dung)
    =Chiet_Khau(THISFORM, .T.)
ENDIF
ENDPROC
```

### 2.2. Code an toàn trong `Command1.Click` (Nút Lưu):

Bổ sung **2 lớp bảo vệ** ngay trước lệnh `=Save_Ct()`:

**Lớp 1 - Flush Buffer (ép ghi giá trị từ ô đang soạn xuống CSDL tạm):**
```foxpro
IF TYPE('THISFORM.ActiveControl.Name') = 'C'
    LOCAL loControl
    loControl = THISFORM.ActiveControl
    IF UPPER(loControl.BaseClass) = 'GRID'
        LOCAL loColumn, loCell, lcSource
        loColumn = loControl.Columns(loControl.ActiveColumn)
        loCell = EVALUATE('loColumn.' + loColumn.CurrentControl)
        lcSource = loColumn.ControlSource
        IF NOT EMPTY(lcSource)
            REPLACE (lcSource) WITH loCell.Value
        ENDIF
    ENDIF
    THISFORM.txtNgay_Ct.SetFocus()
ENDIF
```

**Lớp 2 - Quét toàn bộ lưới (SCAN) trước khi lưu:**
```foxpro
SELECT K_CtTemp
lnSaveRecno2 = RECNO()
SCAN FOR NOT DELETED()
    IF Chiet_Khau = 0 AND (Tien_Nt4 <> 0 OR Tien4 <> 0)
        REPLACE Tien_Nt4 WITH 0, Tien4 WITH 0
    ENDIF
ENDSCAN
SELECT SUM(Tien_Nt4) FROM K_CtTemp INTO ARRAY laDscFix
REPLACE TTien_Nt4 WITH NVL(laDscFix[1], 0) IN K_PhTemp1
GO lnSaveRecno2 IN K_CtTemp
=So_Luong3(THISFORM)
```

## 3. Lịch sử Sửa lỗi & Bài học

| Lần | Phương pháp | Kết quả | Nguyên nhân thất bại |
|-----|-------------|---------|---------------------|
| 1 | Ép `Tien_Nt4=0` TRƯỚC `=Chiet_Khau()` | ❌ Thất bại | Hàm hệ thống ghi đè ngược |
| 2 | Thêm SUM check SAU `=Chiet_Khau()` | ❌ Thất bại | Hàm hệ thống ghi Tien_Nt4 ≠ 0, SUM ≠ 0, bỏ qua fix |
| 3 | Dùng toán thủ công (TTien_Nt + TTien_Nt4) | ❌ Thất bại | Sai khi nhiều trường thay đổi đồng thời |
| 4 | SetFocus vào nút Lưu | ❌ Lỗi runtime | Nút Lưu nằm trong CommandGroup |
| 5 | SetFocus vào txtNgay_Ct | ⚠️ Một phần | Chỉ fix Ctrl+Enter, không fix Enter |
| **6** | **BYPASS hàm hệ thống + SCAN trước lưu** | **✅ Thành công** | **Không gọi hàm lỗi → không bị ghi đè** |

> **Bài học quan trọng**: Khi hàm hệ thống có bug, **KHÔNG BAO GIỜ** cố sửa output của nó. Hãy **BYPASS hoàn toàn** và tự xử lý.

---

# Tính năng: Tự động Xóa chiết khấu cho Hàng khuyến mại (Đơn giá 1-10)

## 1. Mô tả

Khi xuất khuyến mại, đơn giá được đặt từ 1 đến 10 để đánh dấu. Tính năng này tự động chuyển chiết khấu về 0 khi phát hiện đơn giá nằm trong khoảng [1, 10], tiết kiệm thao tác thủ công.

## 2. Code (chèn vào LostFocus các cột Giá/Số lượng)

```foxpro
IF TYPE('THISFORM._VARREAD2') = 'C' AND THISFORM._VARREAD2 = 'GIA_NT9'
    IF BETWEEN(K_CtTemp.Gia_Nt9, 1, 10) AND (K_CtTemp.Chiet_Khau <> 0 OR K_CtTemp.Tien_Nt4 <> 0)
        REPLACE Chiet_Khau WITH 0, Tien_Nt4 WITH 0, Tien4 WITH 0 IN K_CtTemp
        * Tinh lai tong CK header
        LOCAL ARRAY laFixP[1], laFixP2[1]
        STORE 0 TO laFixP[1], laFixP2[1]
        SELECT SUM(Tien_Nt4) FROM K_CtTemp INTO ARRAY laFixP
        SELECT SUM(Tien4) FROM K_CtTemp INTO ARRAY laFixP2
        REPLACE TTien_Nt4 WITH NVL(laFixP[1], 0), TTien4 WITH NVL(laFixP2[1], 0) IN K_PhTemp1
        =So_Luong3(THISFORM)
        THISFORM.Refresh()
    ENDIF
ENDIF
```

---

# Danh sách File phụ thuộc

| File | Vai trò |
|------|---------|
| `ctbhd.scx` + `ctbhd.sct` | Form chính (đã patch tất cả bản vá) |
| `SO_Price_Fix.FXP` | Thư viện kiểm tra hạn bảng giá |

> **Cảnh báo**: Khi copy phần mềm sang máy khác, bắt buộc phải copy đủ 3 file trên.

---

# Báo cáo: Sửa lỗi Giá/Chiết khấu bị giữ lại khi Đổi Mã Hàng Hóa

## 1. Mô tả Lỗi
Trên form `ctbhd.scx`, khi người dùng đổi mã hàng hóa (hoặc tên hàng) trên một dòng đã có sẵn dữ liệu, đơn giá và chiết khấu của mã cũ không bị xóa đi. Điều này dẫn đến việc hệ thống không tra cứu giá mới cho mã hàng vừa thay đổi (trừ khi người dùng phải tự xóa giá về 0 trước).

## 2. Phân tích Nguyên nhân
Đoạn code trong sự kiện `LostFocus` của cột Mã hàng (`Ma_Vt`) và Tên hàng (`Ten_Vt`) có logic như sau:
```foxpro
IF ISNULL(K_CtTemp.Gia_Nt9) OR EMPTY(K_CtTemp.Gia_Nt9)
    ADOCommand('SO_Get_Price', ...)
```
Điều kiện này chỉ cho phép tra cứu giá mới khi ô đơn giá **đang trống hoặc bằng 0**. Khi đổi mã hàng trên dòng đã có sẵn dữ liệu, đơn giá đang có giá trị lớn hơn 0, nên toàn bộ quá trình tra cứu giá bị bỏ qua. Ý đồ ban đầu của đoạn code này là để bảo vệ mức giá nhập tay khỏi bị ghi đè, nhưng nó lại gây tác dụng phụ khi người dùng thực sự muốn đổi mã hàng.

## 3. Giải pháp Triệt để (Fix - 2026-06-24)
Chèn thêm lệnh tự động xóa sạch giá và chiết khấu cũ ngay khi phát hiện người dùng thay đổi mã hàng (biến `_Ma_vt_change` hoặc `_ten_vt_change` là `.T.`). Việc này đảm bảo điều kiện tra cứu giá luôn thỏa mãn đối với mã hàng mới.

**Mã Patch (đã chèn vào `LostFocus` của cột `Ma_Vt` và `Ten_Vt`):**
```foxpro
* FIX: Xoa gia/chiet khau cu khi doi ma hang de tra cuu lai gia moi
REPLACE Gia_Nt9 WITH 0, Chiet_Khau WITH 0, Tien_Nt4 WITH 0, Tien4 WITH 0 IN K_CtTemp
```

---

# Báo cáo: Sửa lỗi Giới hạn Nợ bị Cache (Stale Credit Limit Bug)

## 1. Mô tả Lỗi
Trên form `ctbhd.scx`, khi người dùng nhập mã khách hàng hoặc lưu chứng từ, hệ thống kiểm tra dư nợ thực tế so với Giới hạn nợ. Nếu người dùng mở một tab khác của phần mềm để nâng Giới hạn nợ lên, sau đó quay lại form xuất hàng (không đóng form) và nhấn Lưu, hệ thống vẫn báo lỗi "Quá giới hạn nợ!". Người dùng bắt buộc phải thoát form và vào lại thì giới hạn nợ mới được cập nhật.

## 2. Phân tích Nguyên nhân
Khi kiểm tra giới hạn nợ, hệ thống sử dụng 2 nguồn dữ liệu:
- **Dư nợ thực tế**: Lấy trực tiếp từ SQL Server (thông qua hàm `GL_Alert_ClosingAccount4Customer`). Số liệu này luôn mới nhất.
- **Giới hạn nợ (`Gioi_Han`, `Toi_Han`)**: Lấy từ cursor cục bộ `M_DmDt` (hoặc `M_DmNhDtKS` đối với nhóm khách hàng). Cursor này được tải vào RAM khi form vừa mở ra và **không bao giờ tự làm mới**.

Hệ thống so sánh Dư nợ (Mới) với Giới hạn nợ (Cũ), dẫn đến việc chặn sai dù đã nâng hạn mức.

## 3. Giải pháp Triệt để (Fix - 2026-06-27)
Thay vì đọc `Gioi_Han` và `Toi_Han` từ cursor cục bộ bị cache, ta sử dụng ADO (thông qua đối tượng `oConnDataSource` có sẵn của form) để query trực tiếp SQL Server (`VTSYS.dbo.DmDt` và `VTSYS.dbo.DmNhDt`) ngay tại thời điểm nhấn nút Lưu hoặc khi nhập mã khách hàng.

**Mã Patch (đã chèn vào `LostFocus` của `txtMa_Dt` và `Click` của nút Lưu):**
```foxpro
* FIX: Lay Gioi_Han tu SQL Server thay vi cursor cu
LOCAL loRS_GH2, lcSQL_GH2
lcSQL_GH2 = "SELECT Gioi_Han, Toi_Han FROM VTSYS.dbo.DmDt WHERE Ma_Dt = '" + ALLTRIM(tcMa_Dt) + "'"
TRY
    loRS_GH2 = oConnDataSource.Execute(lcSQL_GH2)
    IF NOT loRS_GH2.EOF
        _Gioi_Han = NVL(loRS_GH2.Fields("Gioi_Han").Value, 0)
        _Toi_Han = NVL(loRS_GH2.Fields("Toi_Han").Value, 0)
    ENDIF
    loRS_GH2.Close()
    loRS_GH2 = NULL
CATCH
    * Fallback: Neu loi (nhu rot mang), quay ve dung cursor cu de khong lam treo app
    _Gioi_Han = M_DmDt.Gioi_Han
    _Toi_Han = M_DmDt.Toi_Han
ENDTRY
```
Giải pháp này an toàn vì không làm thay đổi hay tạo Stored Procedure rác trên SQL Server, và có cơ chế `TRY...CATCH` tự động lùi về phiên bản cũ (fallback) nếu query bị lỗi.

---

# Báo cáo: Tăng tốc tìm kiếm khách hàng trên Form Báo Cáo Công Nợ (`kct04.scx`)

## 1. Mô tả lỗi

Trên form điều kiện lọc của báo cáo công nợ (`FRM\kct04.scx`), ô tìm khách hàng `txtMa_dt` phản hồi rất chậm khi gõ tên hoặc mã khách hàng. Tình trạng dễ thấy nhất khi nhập từng ký tự trong dropdown/autocomplete: giao diện bị giật hoặc treo ngắn theo từng phím.

Trong khi đó, form chứng từ bán hàng (`ctbhd.scx`) tìm khách hàng rất nhanh với cùng danh mục `DmDt`.

## 2. Nguyên nhân

Khác biệt chính nằm ở cách form được cấp dữ liệu tra cứu:

- `ctbhd.scx` thuộc nhóm form chứng từ. Khi form hoạt động, hệ thống đã có cursor cục bộ `M_DmDt` trong RAM. Các thao tác lookup/seek như `SEEKSQL(...)`, `LOOKUP(...)` hoặc `LookUpControl1.Assign_Value(...)` được xử lý chủ yếu trên cursor local.
- `kct04.scx` là form điều kiện báo cáo. Form này không preload danh mục khách hàng, trong khi form báo cáo chạy trong private data session. Vì vậy lookup generic có xu hướng đi qua cơ chế truy vấn động/metadata và chậm hơn đáng kể.
- Stored procedure đúng để lấy danh mục là `DmDt_Get`, không phải `DmDt_Get_List`. `DmDt_Get` có tồn tại và có thể trả toàn bộ danh mục khi gọi `EXECUTE DmDt_Get`.

## 3. Các hướng đã thử

### Hướng 1: Gọi `ADOCommandSys('DmDt_Get_List')` khi focus vào ô khách hàng

Kết quả: thất bại.

Lý do: không tồn tại stored procedure `DmDt_Get_List`, dẫn đến lỗi `Execution error from ADOCommandSys`.

### Hướng 2: Mở khóa ô tên khách hàng `txtTen_dt` và chuyển logic tìm sang tên

Kết quả: thất bại.

Lý do: bản thân lookup vẫn chạy trong data session của form báo cáo và vẫn không có cursor `M_DmDt` đã preload, nên tốc độ không cải thiện đáng kể.

### Hướng 3: Override property lookup trên `txtMa_dt`

Đã thử các property như:

```foxpro
_fieldlist = Ma_Dt, Ten_Dt
_filterfieldlist = Ma_Dt, Ten_Dt
_filtertype = .T.
_startpos = 1
```

Kết quả: có nhanh hơn nhưng không đạt yêu cầu nghiệp vụ.

Vấn đề phát sinh:

- Không tìm được giữa chuỗi, ví dụ tên khách hàng là `nguyễn thị bình` nhưng gõ `Thị bình` không ra.
- Không tìm được theo địa chỉ vì đã bỏ `Dia_Chi` khỏi `FilterFieldList`.
- Khi trả lại `Dia_Chi` và `_filtertype = .F.`, phát sinh lỗi runtime `Operator/operand type mismatch` trong một số tình huống lookup.

Kết luận: không nên override logic lookup trên control này. Nên để framework dùng metadata chuẩn `ST_File` cho `DMDT`.

### Hướng 4: Bỏ `Format = "!"` để sửa lỗi hiển thị TCVN3

Kết quả: thành công và cần giữ lại.

Lý do: `Format = "!"` ép chữ hoa theo cơ chế ANSI/VFP. Với font/bảng mã TCVN3, thao tác uppercase làm hỏng dấu tiếng Việt. Ví dụ nhập `Tr­êng` có thể bị hiện thành `TR­ÊNG`.

Giải pháp: xóa `Format = "!"` khỏi `txtMa_dt`. Việc này chỉ ảnh hưởng hiển thị/ép hoa, không làm thay đổi logic lookup.

## 4. Giải pháp thành công

Preload cursor `M_DmDt` trong `Init` của chính form `frmKct04`, dùng đúng stored procedure `DmDt_Get`, rồi tạo index local theo `Ma_Dt`.

Mã đã chèn vào `frmKct04.Init`:

```foxpro
PROCEDURE Init
DODEFAULT()
IF NOT USED([M_DmDt])
   TRY
      IF TYPE([THIS.oCursorDmDt]) = [U]
         THIS.AddProperty([oCursorDmDt], .NULL.)
      ENDIF
      THIS.oCursorDmDt = CREATEOBJECT([ADOCursorSys], [M_DmDt], [EXECUTE DmDt_Get])
      IF USED([M_DmDt])
         SELECT M_DmDt
         INDEX ON Ma_Dt TAG Ma_Dt
      ENDIF
   CATCH
   ENDTRY
ENDIF
ENDPROC
```

Đồng thời, `txtMa_dt` được giữ ở trạng thái tối thiểu:

```foxpro
ControlSource = "M.Ma_Dt"
InputMask = (P16)
_tablename = DmDt
Name = "txtMa_dt"
```

Không còn:

```foxpro
Format = "!"
_fieldlist = ...
_filterfieldlist = ...
_filtertype = ...
_startpos = ...
```

## 5. Kết quả

- Tốc độ tìm khách hàng trên `kct04.scx` cải thiện rõ rệt.
- Vẫn giữ được logic tìm kiếm chuẩn của framework, bao gồm tìm theo tên và địa chỉ theo metadata `ST_File`.
- Không còn lỗi hiển thị TCVN3 do ép chữ hoa.
- Nếu preload thất bại, `TRY...CATCH` giúp form vẫn mở được, chỉ quay lại cơ chế lookup cũ.

## 6. File đã thay đổi

| File | Vai trò |
|------|---------|
| `FRM\kct04.scx` | Form điều kiện báo cáo công nợ, đã thêm `Init` preload `M_DmDt` và bỏ `Format = "!"` trên `txtMa_dt` |
| `FRM\kct04.SCT` | Memo/compiled companion của form, được compile lại sau khi patch |

## 7. Lưu ý vận hành

Sau khi copy bản vá, cần đóng hẳn VP2014 rồi mở lại để chương trình load `kct04.SCT` mới. Nếu chỉ đóng/mở lại riêng màn hình báo cáo trong cùng session cũ, có thể vẫn đang dùng form đã cache trong bộ nhớ.
