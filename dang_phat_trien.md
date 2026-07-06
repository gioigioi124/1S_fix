# [CẦN KIỂM TRA] Audit tính toán/lưu dữ liệu trong `ctbhd.scx`

Ngày ghi chú: 2026-07-06.

Trạng thái: Chưa xử lý hết, chỉ mới sửa lỗi tổng tiền in ra bị lấy tổng cột `Thành tiền` thay vì cột `Thanh toán`.

## 1. Bối cảnh

Đã so sánh `FRM\ctbhd.SCX/SCT` hiện tại với bản cũ trong `Old ctbhd\ctbhd.SCX/SCT`.

Kết quả tổng quan:

- Không thấy thay đổi `PROPERTIES`/binding control đáng chú ý.
- Khác biệt nằm ở `METHODS` của 10 object.
- Các thay đổi có khả năng ảnh hưởng tính toán/lưu dữ liệu nằm ở các `RECNO`: `22`, `24`, `30`, `32`, `34`, `42`, `44`, `46`, `59`.

## 2. Đã sửa ngay

Lỗi tổng tiền trên phiếu in:

- Nguyên nhân: block mới trong `RECNO 46` và `RECNO 59` từng tính `TTien_Nt2/TTien2` bằng `SUM(Tien_Nt9/Tien9)`, làm tổng in ra thành tổng cột `Thành tiền` trước chiết khấu.
- Đã sửa: đổi sang `SUM(Tien_Nt2/Tien2)`.
- Đồng bộ thêm: `TTien_Nt0 = TTien_Nt2 + TTien_Nt3`, `TTien0 = TTien2 + TTien3` để không trừ chiết khấu lần hai.
- Đã compile lại form `FRM\ctbhd.scx`.

Cần lưu ý: các phiếu đã lưu bằng bản lỗi có thể đã bị ghi sai header trong database (`CtBH.TTien_Nt2`). Quay về phần mềm cũ vẫn in sai nếu dữ liệu header đã sai. Khi cần đối soát, so sánh:

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

## 3. Rủi ro cần kiểm tra sau

### 3.1. Workaround cộng tạm `1,000,000` vào `Tien_Nt9`

Xuất hiện trong các `RECNO`: `22`, `24`, `30`, `32`, `34`, `42`, `44`.

Mẫu code:

```foxpro
REPLACE Tien_Nt9 WITH K_CtTemp.Tien_Nt9 + 1000000 IN K_CtTemp
=So_Luong2(THISFORM)
* hoặc
=So_Luong3(THISFORM)
```

Mục đích ban đầu: ép hàm gốc `So_Luong2/3` vượt ngưỡng bỏ qua sai số nhỏ để tính lại `Tien_Nt9`.

Rủi ro: nếu `So_Luong2/3` lỗi, return sớm, hoặc không ghi đè lại `Tien_Nt9` như kỳ vọng, dữ liệu chi tiết có thể bị lưu với `Tien_Nt9` tăng thêm 1,000,000.

Hướng kiểm tra:

- Tạo phiếu test thay đổi `Gia_Nt9`, `So_Luong9`, `So_Luong8`, `So_Tam` với vật tư loại 2/3.
- Sau khi rời ô và trước/sau lưu, kiểm tra `Tien_Nt9` có bằng `Gia_Nt9 * So_Luong9` không.
- Nên cân nhắc thêm guard trước `Save_Ct()` để chặn các dòng có `Tien_Nt9` lệch bất thường.

### 3.2. Block dọn chiết khấu bằng 0 có thể ghi đè `Tien_Nt2`

Xuất hiện trong:

- `RECNO 46`: cột CK `LostFocus`.
- `RECNO 59`: nút Lưu trước `Save_Ct()`.

Mẫu code đang cần theo dõi:

```foxpro
IF Chiet_Khau = 0 AND (Tien_Nt4 <> 0 OR Tien4 <> 0 OR Tien_Nt2 <> Tien_Nt9 OR Tien2 <> Tien9)
    REPLACE Tien_Nt4 WITH 0, ;
            Tien4 WITH 0, ;
            Tien_Nt2 WITH Tien_Nt9, ;
            Tien2 WITH Tien9
ENDIF
```

Mục đích ban đầu: xóa "chiết khấu ẩn" khi CK đã về 0.

Rủi ro: nếu có nghiệp vụ hợp lệ mà `Chiet_Khau = 0` nhưng `Tien_Nt2 <> Tien_Nt9` vì lý do khác, block này sẽ ép mất chênh lệch.

Hướng kiểm tra:

- Xác định trong hệ thống `Tien_Nt2` có luôn là thanh toán sau CK không.
- Kiểm tra các trường hợp khuyến mãi/gia đặc biệt/làm tròn thuế/ngoại tệ.
- Nếu chỉ "chiết khấu ẩn" mới tạo chênh lệch này thì block chấp nhận được; nếu không, cần thu hẹp điều kiện.

### 3.3. Phụ thuộc `SO_Price_Fix.FXP`

Xuất hiện trong `RECNO 22`, `RECNO 24`:

```foxpro
SET PROCEDURE TO SO_Price_Fix ADDITIVE
_Gia = CheckPriceExpiry(...)
_CK = CheckDiscountExpiry(...)
```

Rủi ro:

- File `so_price_fix.FXP` phải đi kèm khi deploy.
- Hiện chỉ thấy FXP, không thấy PRG nguồn để audit logic.
- Nếu FXP thiếu hoặc trả về giá/CK sai, dữ liệu đơn giá/chiết khấu sẽ sai ngay khi chọn hàng.

Hướng kiểm tra:

- Tìm/lưu lại source `SO_Price_Fix.PRG` nếu còn.
- Test khi FXP bị thiếu để biết form lỗi ra sao.
- Đối chiếu giá/CK trả về với bảng giá thực tế, đặc biệt quanh ngày hết hiệu lực.

### 3.4. Đổi ngày kiểm tra công nợ sang `DATE()`

Xuất hiện trong `txtMa_Dt.LostFocus` và nút Lưu.

Thay đổi:

```foxpro
tdDate = DATE()
```

thay cho:

```foxpro
tdDate = K_PhTemp1.Ngay_Ct
```

Rủi ro: không trực tiếp làm sai tiền/hàng, nhưng thay đổi nghiệp vụ chặn lưu/cảnh báo công nợ khi sửa chứng từ cũ.

Hướng kiểm tra:

- Xác nhận yêu cầu nghiệp vụ: công nợ để cảnh báo/chặn lưu phải tính tại ngày hiện tại hay ngày chứng từ.
- Test sửa phiếu cũ khi công nợ hiện tại và công nợ tại ngày chứng từ khác nhau.

## 4. Checklist khi có thời gian

1. Audit lại các block `Tien_Nt9 + 1000000`; ưu tiên thay bằng cách tính lại an toàn hơn hoặc thêm guard trước lưu.
2. Audit nghĩa dữ liệu của `Tien_Nt2`/`Tien_Nt9` trong tất cả mẫu in và bảng `CtBH0`.
3. Đối soát các phiếu đã lưu trong giai đoạn bản lỗi: header `CtBH.TTien_Nt2` so với `SUM(CtBH0.Tien_Nt2)`.
4. Tìm source `SO_Price_Fix.PRG` hoặc ghi lại checksum/nguồn gốc của `so_price_fix.FXP`.
5. Lập bộ phiếu test: CK %, CK = 0, khuyến mãi giá 1/2 đồng, vật tư loại 2/3, sửa phiếu cũ, Ctrl+Enter lưu nhanh.

---

# [HOÀN TẤT] Quá Trình Gỡ Lỗi: "Execution error from ADODataCommand" khi lưu phiếu

## 0. Trạng thái hoàn tất

- **Ngày hoàn tất**: 2026-06-29.
- **Mô tả lỗi**: Khi bấm nút "Lưu" (Chấp nhận) ở tất cả các form nhập liệu (bán hàng, thu chi, xuất kho...), phần mềm hiện cảnh báo "Execution error from ADODataCommand", dù phiếu vẫn lưu thành công.
- **Quá trình chẩn đoán**:
  - Ban đầu thử bọc lệnh `Save_Ct()` trong các form bằng `TRY...CATCH` (thông qua script `patch_save_trycatch.prg`) nhưng không chặn được lỗi. Lý do là phần mã lỗi bị hàm nội bộ trong `.APP` chặn lại và ném ra thành `MessageBox`, không văng ra ngoài thành Exception của VFP.
  - Chuyển hướng sang theo dõi trực tiếp trên máy chủ bằng **SQL Server Extended Events** (script `get_xevents.ps1`).
- **Nguyên nhân gốc rễ (Root Cause)**: Bắt được log từ SQL Server báo lỗi `2812 (Could not find stored procedure)`. Hệ thống ngầm gọi các Stored Procedure ghi lịch sử (ví dụ: `History_CtBH_Save`, `History_CtTP_Save`, `History_CtT_Save`...) nhưng các thủ tục này hoàn toàn không tồn tại trong database `VP_2014` và `KH_2014`.
- **Giải pháp áp dụng**: Dùng PowerShell script (`create_dummy_sps.ps1`) để tự động tạo một loạt Stored Procedure "rỗng" (Dummy SP) trên tất cả các databases (VP_2014, KH_2014, VTSYS).
  ```sql
  CREATE PROCEDURE dbo.History_CtBH_Save (@stt nvarchar(20) = NULL, @user nvarchar(10) = NULL) AS BEGIN SET NOCOUNT ON; END
  ```
- **Kết quả**: Hệ thống tìm thấy SP khi ghi lịch sử nên không còn văng lỗi, quá trình lưu phiếu mượt mà trở lại. Hoàn toàn không sửa đổi bảng hay dữ liệu nào của hệ thống hiện tại.
- **Tài liệu chi tiết**: Đã được ghi chép vào mục 7 trong file `EXPORT_BANG_GIA_GUIDE.md`.

---

# [HOÀN TẤT] Quá Trình Gỡ Lỗi: Tốc độ tìm kiếm danh mục khách hàng trên Form Báo Cáo (kct04.scx)

## 0. Trạng thái hoàn tất

- **Ngày hoàn tất**: 2026-06-27.
- **File đã sửa**: `FRM\kct04.scx` và `FRM\kct04.SCT`.
- **Kết quả**: Tốc độ tìm kiếm khách hàng trên form báo cáo công nợ đã nhanh hơn rõ rệt sau khi preload cursor local `M_DmDt` trong `frmKct04.Init`.
- **Giải pháp cuối cùng**: Gọi đúng stored procedure `DmDt_Get` bằng `ADOCursorSys`, tạo cursor `M_DmDt` trong data session của chính form `kct04`, sau đó index local theo `Ma_Dt`.
- **Fix đi kèm**: Xóa `Format = "!"` khỏi `txtMa_dt` để không ép chữ hoa làm sai hiển thị TCVN3.
- **Tài liệu chi tiết**: Đã ghi vào `EXPORT_BANG_GIA_GUIDE.md`, mục "Tăng tốc tìm kiếm khách hàng trên Form Báo Cáo Công Nợ (`kct04.scx`)".

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
