# 📊 Kế hoạch & Yêu cầu tính năng Import Bảng giá từ Excel (Database VP_2014)

Tài liệu này chi tiết hóa kế hoạch phát triển, cấu trúc tệp Excel đầu vào, quy tắc ánh xạ cơ sở dữ liệu và các biện pháp bảo vệ an toàn dữ liệu cho tính năng **Import Bảng giá** từ Excel.

---

## 1. Yêu cầu cấu trúc Tệp Excel đầu vào

Dựa trên cấu trúc thực tế của tệp Excel import bảng giá, dữ liệu được phân bổ trên các cột từ A đến G như sau:

| Cột Excel | Tên trường dữ liệu         |  Kiểu dữ liệu   | Ví dụ            | Diễn giải                                                              |
| :-------: | :------------------------- | :-------------: | :--------------- | :--------------------------------------------------------------------- |
|   **A**   | Ngày lập bảng giá          | Date (dd/MM/yy) | `01/04/26`       | Ngày hiệu lực của bảng giá (`Ngay_Ct` và `Ngay_Ct1`)                   |
|   **B**   | Tên bảng giá / Số chứng từ |     String      | `BG001`          | Mã định danh đợt bảng giá (`So_Ct`)                                    |
|   **C**   | Mã Khách Hàng              |     String      | `CAO`            | Đối tượng áp dụng bảng giá (`Ma_Dt`)                                   |
|   **D**   | Mã Khu Vực                 |     String      |                  | Khu vực áp dụng bảng giá (`Ma_Vm`)                                     |
|   **E**   | Mã Hàng Hóa                |     String      | `05010510019008` | Mã vật tư sản phẩm (`Ma_Vt`). Cho phép mã chưa khai báo trên phần mềm. |
|   **F**   | Đơn giá                    |     Numeric     | `100,000`        | Giá bán chưa chiết khấu (`Gia`)                                        |
|   **G**   | Chiết khấu %               |     Numeric     | `10`             | Tỷ lệ chiết khấu phần trăm (`CK`)                                      |

> [!IMPORTANT]
> **Quy tắc ràng buộc đặc biệt (Business Rules):**
>
> 1. **Loại trừ lẫn nhau (Mutual Exclusivity):** Mã Khách Hàng (Cột C) và Mã Khu Vực (Cột D) **không thể cùng tồn tại** trên cùng một dòng. Một bảng giá chỉ được áp dụng cho một Khách hàng cụ thể HOẶC cho một Khu vực cụ thể.
> 2. **Chấp nhận mã hàng chưa khai báo:** Nếu Mã hàng hóa (Cột E) chưa tồn tại trong danh mục vật tư (`DmVt`), phần mềm vẫn cho phép import bình thường (Đơn vị tính `Dvt` sẽ được để trống hoặc gán mặc định).

---

## 2. Cấu trúc ánh xạ Cơ sở dữ liệu (SQL Server)

Dữ liệu sẽ được import vào hai bảng liên kết cha-con: **`BG`** (Header) và **`BG0`** (Detail) thuộc database `VP_2014`.

### Bảng 1: `dbo.BG` (Thông tin đợt bảng giá - Header)

Mỗi đợt bảng giá (nhóm theo `So_Ct` ở Cột B) sẽ tạo ra **duy nhất 1 dòng** trong bảng này:

- **`Stt` (char(20), Primary Key):** Khóa chính duy nhất, được sinh tự động bằng cách gọi Stored Procedure `ST_Increase_KeyIndex` trên hệ thống.
- **`Ma_DvCs` (char(2)):** Mã đơn vị cơ sở, lấy từ biến hệ thống `M_Ma_DvCs` (mặc định `'01'`).
- **`Ngay_Ct` (datetime):** Ngày lập bảng giá, lấy từ **Cột A** của Excel.
- **`So_Ct` (char(20)):** Tên bảng giá / Số chứng từ, lấy từ **Cột B** của Excel.
- **`Ma_Dt` (char(16), Nullable):** Mã khách hàng, lấy từ **Cột C** của Excel (nếu có).
- **`Ma_Vm` (char(8), Nullable):** Mã khu vực, lấy từ **Cột D** của Excel (nếu có).
- **`Ma_Tte` (char(3)):** Loại tiền tệ, mặc định là `'VND'`.
- **`Ty_Gia` (numeric):** Tỷ giá, mặc định là `1`.
- **`Ngay_Ct1` (datetime):** Ngày bắt đầu hiệu lực, lấy từ **Cột A** của Excel.
- **`Ngay_Ct2` (datetime, Nullable):** Ngày kết thúc hiệu lực, mặc định để `NULL` (vô hạn).
- **`UserName` (char(16)):** Tài khoản thực hiện import, lấy từ biến hệ thống `M_Name`.
- **`Confirmed` (bit):** Trạng thái duyệt, mặc định là `1` (Đã duyệt).
- **`Closed` (char(1)):** Trạng thái đóng, mặc định là `'0'`.

### Bảng 2: `dbo.BG0` (Chi tiết đơn giá sản phẩm - Detail)

Mỗi dòng sản phẩm trong tệp Excel sẽ tạo ra 1 dòng tương ứng trong bảng này, liên kết với bảng cha qua trường `Stt`:

- **`Stt0` (char(20), Primary Key):** Khóa chính duy nhất của dòng chi tiết, được sinh tự động bằng cách gọi Stored Procedure `ST_Increase_KeyIndex`.
- **`Stt` (char(20)):** Khóa ngoại liên kết với bảng cha `BG`.
- **`Ma_Vt` (char(16)):** Mã hàng hóa, lấy từ **Cột E** của Excel.
- **`Dvt` (varchar(8), Nullable):** Đơn vị tính.
  - Nếu `Ma_Vt` đã có trên phần mềm: Lấy đơn vị tính mặc định từ danh mục `VTSYS.dbo.DmVt`.
  - Nếu `Ma_Vt` chưa có trên phần mềm: Để trống (`""`).
- **`Gia` (numeric):** Đơn giá bán, lấy từ **Cột F** của Excel.
- **`CK` (numeric):** Tỷ lệ chiết khấu %, lấy từ **Cột G** của Excel.

---

## 3. Thuật toán xử lý an toàn & Tối ưu hiệu năng

Để đảm bảo tính an toàn tối đa cho hệ thống cơ sở dữ liệu và tránh các lỗi xung đột hệ thống, thuật toán import sẽ tuân thủ các quy tắc sau:

### 3.1. Chống lỗi tranh chấp File (File Lock)

- Trước khi mở file Excel, chương trình sẽ tạo một tệp tạm thời trong thư mục `TEMP` của Windows (ví dụ: `~$temp_import.xls`).
- Copy toàn bộ nội dung file Excel của người dùng sang file tạm này và thực hiện đọc dữ liệu trên file tạm.
- Điều này giúp quá trình import **không bao giờ bị treo** hoặc bị crash `C0000005` kể cả khi người dùng đang mở file Excel đó trên màn hình hoặc có tiến trình Excel ngầm đang chạy khóa file.

### 3.2. Gom nhóm đợt bảng giá (Grouping & Deduplication)

- **Gom nhóm theo số chứng từ:** Chương trình sẽ quét toàn bộ file Excel và gom các dòng có cùng `So_Ct` (Cột B) vào cùng một đợt bảng giá.
- **Xử lý trùng lặp sản phẩm:** Trong cùng một đợt bảng giá (`So_Ct`), nếu xuất hiện nhiều dòng có cùng một mã sản phẩm (`Ma_Vt`), chương trình sẽ tự động lọc bỏ các dòng trùng lặp phía trước và **chỉ giữ lại dòng cuối cùng** (chứa giá và chiết khấu mới nhất) để insert vào database, tránh lỗi trùng lặp dữ liệu.
- **Xác thực loại trừ Cột C và D:** Nếu phát hiện dòng nào có cả Mã khách hàng và Mã khu vực, chương trình sẽ tự động ưu tiên Mã khách hàng (`Ma_Dt`), xóa trắng Mã khu vực (`Ma_Vm`) và ghi log cảnh báo cho người dùng.

### 3.3. Bảo vệ dữ liệu bằng Giao dịch SQL (SQL Transaction)

- Toàn bộ quá trình insert dữ liệu vào hai bảng `BG` và `BG0` trên SQL Server sẽ được bọc trong một **Transaction** thông qua ADO Connection (`oConnDataSource`).
- Cơ chế hoạt động:
  ```foxpro
  oConnDataSource.BeginTrans()
  * Thực hiện Insert bảng BG (Header)
  * Quét qua các dòng chi tiết và Insert bảng BG0 (Detail)
  * Nếu tất cả thành công -> oConnDataSource.CommitTrans()
  * Nếu có bất kỳ lỗi nào xảy ra -> oConnDataSource.RollbackTrans() (Hoàn tác toàn bộ)
  ```
- **Lợi ích:** Đảm bảo tính toàn vẹn dữ liệu tuyệt đối. Nếu file Excel có hàng ngàn dòng và dòng thứ 999 bị lỗi, toàn bộ dữ liệu đã ghi trước đó của đợt bảng giá đó sẽ bị xóa sạch khỏi database, không để lại dữ liệu rác hay bảng giá mồ côi (chỉ có header không có detail).

### 3.4. Báo cáo kết quả chi tiết cho người dùng

- Sau khi quá trình import kết thúc (hoặc thất bại), hệ thống sẽ hiển thị hộp thoại thông báo rõ ràng kết quả:
  - Số dòng import thành công vào database.
  - Số dòng trùng lặp sản phẩm đã tự động xử lý.
  - Số dòng bị bỏ qua hoặc điều chỉnh do lỗi định dạng.

### 3.5. Quy tắc xác thực và làm sạch dữ liệu (Data Cleaning & Validation)

- **Xử lý số nguyên bị biến thành số thập phân:** Công cụ tự động ép kiểu xử lý triệt để hiện tượng thư viện đọc nhầm mã hàng thành số thập phân (ví dụ `9715571` bị biến thành `9715571.0`), đảm bảo mã gốc được giữ nguyên vẹn 100%.
- **Bỏ qua dòng thiếu dữ liệu:** Chương trình sẽ từ chối import và bỏ qua ngay lập tức các dòng vi phạm một trong các điều kiện sau:
  - Thiếu **Ngày lập** (Cột A) hoặc **Số chứng từ** (Cột B).
  - Thiếu CẢ **Khách hàng** (Cột C) LẪN **Khu vực** (Cột D) (vì không xác định được đối tượng áp dụng).
  - Thiếu **Mã hàng** (Cột E) hoặc **Đơn giá** (Cột F).

---

## 4. Công cụ Import Độc lập bằng Python (Giải pháp tối ưu)

Nhằm khắc phục triệt để các hạn chế của Visual FoxPro và ADO COM (như lỗi Firehose Cursor, lỗi kẹt tiến trình Excel ngầm), một công cụ hoàn toàn độc lập bằng Python đã được xây dựng để thay thế màn hình Import cũ. Các tệp liên quan bao gồm:

- **`import_bang_gia_tool.py`**: Tệp mã nguồn chính chứa giao diện đồ họa (Tkinter) và logic xử lý dữ liệu. Sử dụng thư viện `pandas` để xử lý siêu tốc và `pyodbc` để tương tác an toàn với SQL Server. Tự động truy xuất `Ma_DvCs` và sinh `Stt` chuẩn xác.
- **`run_import.bat`**: Mã kịch bản (Script) tự động hóa chạy bằng 1-click. Nó sẽ tự động thiết lập môi trường ảo (`venv`), tải các thư viện mã nguồn mở (`pandas`, `pyodbc`, `openpyxl`, `xlrd`) và khởi chạy công cụ mà không cần người dùng can thiệp bằng dòng lệnh.

---

## 5. Các lỗi kỹ thuật đã giải quyết (Troubleshooting & Lessons Learned)

Quá trình phát triển tool này đã giải quyết thành công các lỗi hạ tầng nghiêm trọng của hệ thống cũ:

1. **Lỗi "Firehose Cursor" của ADO (Visual FoxPro):**
   - **Triệu chứng:** Khi dùng vòng lặp Insert hàng loạt bản ghi trong một Transaction, OLEDB/ODBC driver báo lỗi không thể mở kết nối mới (kẹt chế độ Cursor).
   - **Giải quyết:** Chuyển sang dùng Python (`pyodbc`) với cơ chế quản lý Connection và Cursor độc lập, triệt tiêu hoàn toàn sự lệ thuộc vào bộ máy của Visual FoxPro cũ kỹ.
2. **Lỗi `Previous SQL was not a query` (PyODBC):**
   - **Triệu chứng:** Khi chạy Stored Procedure `ST_Increase_KeyIndex` để lấy số thứ tự (`Stt`), Python ném lỗi không lấy được kết quả.
   - **Giải quyết:** Bổ sung cờ khóa miệng `SET NOCOUNT ON;` vào câu lệnh SQL. Do SQL Server trả về dòng chữ ngầm định `(1 row affected)` trước khi trả về kết quả Output, khiến thư viện của Python bị nhầm lẫn. Việc bật NoCount giúp driver chỉ nhận đúng giá trị `Stt`.
3. **Lỗi `Cannot insert the value NULL into column 'Stt'`:**
   - **Triệu chứng:** Quá trình Import ném lỗi báo `Stt` bị rỗng (NULL) dẫn đến việc Rollback toàn bộ dữ liệu.
   - **Giải quyết:** Phát hiện nguyên nhân do hệ thống cũ truyền cứng mã Đơn Vị Cơ Sở (Công ty) là `'01'`, trong khi Database thực tế lại sử dụng mã `'S1'`. Đã khắc phục bằng cách thiết lập mã tự động query lấy đúng `Ma_DvCs` trực tiếp từ bảng `VTSYS.dbo.DmDvCs`, đảm bảo Stored Procedure luôn sinh ra số `Stt` chuẩn xác.

---

## 6. Công cụ Import Báo Có (Tiền Gửi) từ Excel

Công cụ mới (`import_baoco_tool.py`) được thiết kế để tự động hóa việc nhập liệu các chứng từ báo có ngân hàng từ file Excel.

### 6.1. Cấu trúc ánh xạ Cơ sở dữ liệu

Mỗi dòng trong file Excel tương ứng với một chứng từ báo có độc lập (Bao gồm 1 dòng Header và 1 dòng Detail):

- **Bảng Header:** `CtT` (Bảng Thu tiền, lưu thông tin chung của chứng từ)
- **Bảng Detail:** `CtT0` (Bảng chi tiết, lưu số tiền và tài khoản ngân hàng `Tk_No`)
- **Loại Chứng Từ (Ma_Ct):** `C3` (Báo Có - Thu qua ngân hàng)
> *Ghi chú:* Trước đây dự kiến dùng bảng `CtTG` và `CtTG0`, tuy nhiên qua kiểm tra dữ liệu thực tế trên SQL Server (VP_2014), bảng `CtTG` không có dữ liệu, các giao dịch Báo Có thực tế được phần mềm lưu tại bảng `CtT` và `CtT0` với mã chứng từ là `C3`.
- **Tài khoản nợ (`Tk_No`):** Luôn được gán cứng là `11212` trong bảng Detail (`CtT0`).
- **Tài khoản có (`Tk_Co`):** Luôn được gán cứng là `1311` trong bảng Detail (`CtT0`).
- **Mã khách hàng (`Ma_Dt0`, `Ma_Dt`):** Lưu ở Header (`CtT.Ma_Dt0`) và Detail (`CtT0.Ma_Dt`). 
- **Ông/Bà (`Ong_Ba`) & Địa chỉ (`Dia_Chi`):** Được tool tự động truy vấn từ danh mục khách hàng (`VTSYS.dbo.DmDt`) dựa vào Mã khách hàng để điền vào Header (`CtT`).
- **Diễn giải (`Dien_Giai0`, `Dien_Giai`):** Được ánh xạ từ cột "Nội dung".

| Cột Excel | Tên trường tương ứng      | Diễn giải                                                           |
| :-------: | :------------------------ | :------------------------------------------------------------------ |
|   **A**   | Không gán                 | Tên tài khoản (Chỉ mang tính chất tham khảo, không lưu vào DB).     |
|   **B**   | Không gán                 | Số tài khoản (Chỉ mang tính chất tham khảo, không lưu vào DB).      |
|   **C**   | `Dien_Giai0`, `Dien_Giai` | Nội dung giao dịch, lưu vào `CtT.Dien_Giai0` và `CtT0.Dien_Giai`.   |
|   **D**   | `TTien`, `Tien`           | Số tiền giao dịch, lưu vào cả Header (`CtT`) và Detail (`CtT0`).    |
|   **E**   | `Ngay_Ct`                 | Ngày lập chứng từ, lưu vào `CtT`.                                   |
|   **F**   | `Ma_Dt0`, `Ma_Dt`         | Mã khách hàng, lưu vào `CtT.Ma_Dt0` và `CtT0.Ma_Dt`.                |

### 6.2. Cơ chế Đóng gói Giao dịch (SQL Transaction & Rollback)

Toàn bộ quá trình import được thiết kế tuân thủ nghiêm ngặt nguyên tắc ACID thông qua cơ chế **đóng gói Giao dịch duy nhất (Single Transaction)**:

- Tính năng `autocommit=False` được thiết lập mặc định trong cấu hình `pyodbc`.
- Xuyên suốt quá trình chạy lặp qua các dòng Excel, phần mềm chỉ "gửi" câu lệnh `INSERT` xuống bộ nhớ đệm (Transaction Log) của SQL Server.
- Khi và chỉ khi **TẤT CẢ** các dòng chứng từ đều được xử lý mà không xảy ra lỗi, lệnh `conn.commit()` mới được gọi để đóng gói và lưu thực sự vào CSDL.
- Nếu có bất kỳ sự cố kỹ thuật nào (như thiếu Data type, sinh khóa chính `Stt` thất bại, mất kết nối...), hệ thống tự động nhảy vào khối lệnh và thực hiện `conn.rollback()`. Nhờ đó, database sẽ hoàn tác (xóa) toàn bộ các dữ liệu rác, ngăn chặn tình trạng có Header nhưng thiếu Detail hoặc chứng từ bị nửa vời.

### 6.3. Logic Sinh Số Chứng Từ (`So_Ct`)

- **Tự động tăng trưởng theo Tháng:** Mã chứng từ yêu cầu luôn cố định 6 chữ số (`000000`).
- Khi import một loạt chứng từ của bất kỳ tháng nào, công cụ sẽ query lấy ra mã `So_Ct` (đã được ép kiểu `CAST(So_Ct AS INT)`) lớn nhất hiện tại của tháng đó.
- Nếu là chứng từ đầu tiên của tháng, hệ thống cấp số `000001`. Nếu đã có chứng từ lớn nhất là `000128`, chứng từ từ file Excel sẽ bắt đầu tịnh tiến từ `000129`, `000130`... bảo đảm thứ tự phát sinh là nhất quán kể cả khi file Excel sắp xếp lộn xộn.
