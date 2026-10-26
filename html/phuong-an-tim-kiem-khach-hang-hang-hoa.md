# Phương án tìm kiếm khách hàng và hàng hóa (React + FastAPI + SQL Server)

Ràng buộc:

- Dùng nội bộ, **tuyệt đối không động vào SQL** (không thêm cột, index, trigger, view...). User SQL của web chỉ cần quyền SELECT.
- Các bảng **không có cột ngày sửa** hay cột theo dõi thay đổi nào.
- Tìm kiếm **không bỏ dấu tiếng Việt**: người dùng gõ có dấu thì khớp có dấu, không phân biệt hoa/thường.
- Dữ liệu không cần tươi ngay lập tức, nhưng ô nhập phải **hiện kết quả tức thì** như VFP.

## 1. Tổng quan

| Đối tượng             | Quy mô **thật (đã đo)**                                 | Cách làm                                                                                                                   | Độ tươi                              |
| --------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Khách hàng            | **5.199 dòng** (`VTSYS.dbo.DmDt`, PK `DTID`)            | Tải hết vào RAM trình duyệt, lọc bằng `includes`                                                                           | Làm mới 5 phút/lần hoặc khi thêm/sửa |
| Hàng hóa (tìm khi gõ) | **36.995 dòng** (`VTSYS.dbo.DmVt`, PK `VTID`)           | Index gọn (id, mã, tên) trong RAM trình duyệt (Web Worker) + IndexedDB; FastAPI giữ bản chụp, tự so sánh và tự cấp version | 30-60 giây                           |
| Giá hàng hóa          | **Bảng giá `VP_2014.dbo.BG` (header) + `BG0` (detail)** | Đọc trực tiếp `BG`/`BG0` theo `Ma_Dt`/`Ma_Vm` + `Ngay_Ct`, chọn bảng giá mới nhất còn hiệu lực; không đưa vào index        | Lấy tại thời điểm cần                |

Nguyên tắc chung:

- Chỉ tải các cột cần để tìm/chọn, không `SELECT *`.
- Chỉ hiện tối đa 30-50 kết quả.
- Mọi truy vấn xuống SQL đều chỉ là `SELECT`.

### Quy tắc cho ô nhập mã khách hàng và mã hàng hóa

- **Click hoặc focus vào ô không mở dropdown và không tải/hiển thị danh sách gì cả.**
- Dropdown chỉ mở (và kết quả chỉ được tính/hiển thị) khi **người dùng gõ phím hoặc giá trị thay đổi** (sự kiện `onChange`/`input`, kể cả xóa bớt ký tự). Xóa hết ký tự thì đóng dropdown.
- Dán (paste) hoặc nhận giá trị từ form trung gian cũng tính là thay đổi nếu muốn tìm theo giá trị đó.
- Đóng dropdown khi mất focus (`blur`), nhấn `Esc` hoặc sau khi đã chọn một dòng. Click lại vào ô sau khi đã có chữ thì không tự mở lại, chỉ mở khi gõ tiếp.
- Lưu ý: đây chỉ là quy tắc về **hiển thị dropdown**. Việc nạp dữ liệu nền vào RAM (danh sách khách hàng, index hàng hóa) vẫn diễn ra khi app khởi động như đã mô tả, để lúc gõ có kết quả ngay. Nếu muốn nạp dữ liệu cũng chỉ bắt đầu khi gõ phím đầu tiên thì chỉ cần dời lệnh nạp vào sự kiện thay đổi đầu tiên, nhưng lần gõ đầu sẽ phải chờ tải.

```jsx
// Mẫu dùng chung cho ô mã khách hàng / mã hàng hóa
const [q, setQ] = useState("");
const [open, setOpen] = useState(false);

<input
  value={q}
  onChange={(e) => {
    const v = e.target.value;
    setQ(v);
    setOpen(v.trim().length > 0); // chỉ mở khi có chữ do người dùng gõ/đổi
  }}
  onBlur={() => setOpen(false)}
  onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
  // KHÔNG đặt onFocus / onClick để mở dropdown
/>;
{
  open && <Dropdown items={ketqua} />;
}
```

### Về tiếng Việt có dấu

- **Tiền đề quan trọng (đã kiểm chứng):** các cột tên (`Ten_Dt`, `Ten_Vt`, `Dia_Chi`, `Dvt`…) là `nvarchar` nhưng **nội dung lưu ở bảng mã TCVN3** (không phải Unicode). Đọc thô bằng `pyodbc` sẽ ra mojibake kiểu `'Kh¸ch s¹n H¶i Phßng'`; muốn ra "Khách sạn Hải Phòng" phải gọi hàm chuyển mã của chính DB:
  ```sql
  SELECT VP_2014.dbo.fn_TCVNToUnicode(Ten_Dt) FROM VTSYS.dbo.DmDt
  ```
  (`fn_TCVNToUnicode` **định nghĩa ở `VP_2014`** — phải qualify tên đầy đủ kể cả khi kết nối vào `VTSYS`, nếu không sẽ lỗi `Invalid object name`.)
- Hàm này trả về Unicode **NFC** → server trả JSON thuần Unicode cho trình duyệt, nên phía client chỉ cần `normalize("NFC")` như dưới đây (giữ cho chắc).
- Chuẩn hóa chuỗi về dạng **NFC** (`s.normalize("NFC")`) cả khi dựng index lẫn khi so khớp, vì cùng một chữ có thể được lưu ở dạng dựng sẵn hoặc dạng tổ hợp, nếu lệch dạng thì tìm không ra.
- Đổi sang chữ thường bằng `toLowerCase()` (Python: `.lower()`), không cần bỏ dấu.
- Hệ quả: gõ "nguyen" sẽ **không** ra "Nguyễn" (collation DB là `SQL_Latin1_General_CP1_CI_AS` → chỉ bỏ qua hoa/thường, không bỏ dấu: `LIKE N'%nguyen%'` trả 0 dòng). Người dùng quen gõ tiếng Việt có dấu (Unikey/Telex) nên thường không thành vấn đề; nếu sau này cần tìm không dấu thì chỉ thêm một hàm bỏ dấu ở phía client/FastAPI, không liên quan tới SQL.

---

## 2. Khách hàng (5.199 dòng — `VTSYS.dbo.DmDt`)

> ⚠️ Bảng danh mục khách hàng **KHÔNG nằm ở `VP_2014`** mà ở **`VTSYS.dbo.DmDt`**
> (danh mục nhân sự/kế toán tách riêng). Các bảng theo `VTSYS`: `DmDt`, `DmVt`, `DmKho`,
> `DmBp`, `DmNhDt`, `DmXe`... Xem phụ lục E.

### Backend

```python
from fastapi.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.get("/api/customers/lookup")
def customers_lookup():
    # SELECT Ma_Dt, fn_TCVNToUnicode(Ten_Dt), fn_TCVNToUnicode(Dia_Chi), Ms_Thue
    #   FROM VTSYS.dbo.DmDt     <-- chu y DB VTSYS, khong phai VP_2014
    ...

@app.get("/api/customers/{ma}")
def customer_detail(ma: str):
    # lấy đủ thông tin khi người dùng đã chọn
    ...
```

### Frontend

```jsx
const chuan = (s) => (s || "").normalize("NFC").toLowerCase();

const { data: customers = [] } = useQuery({
  queryKey: ["customers-lookup"],
  queryFn: () => fetch("/api/customers/lookup").then((r) => r.json()),
  staleTime: 5 * 60 * 1000,
});

const indexed = useMemo(
  () =>
    customers.map((c) => ({
      ...c,
      _k: chuan(`${c.ma_dt} ${c.ten_dt} ${c.dia_chi}`),
    })),
  [customers],
);

const [q, setQ] = useState("");
const dq = useDeferredValue(q);
const ketqua = useMemo(() => {
  const words = chuan(dq).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return indexed
    .filter((c) => words.every((w) => c._k.includes(w)))
    .slice(0, 50);
}, [indexed, dq]);
```

### Prefetch và làm mới

```jsx
// main.jsx (sau khi đăng nhập nếu có token)
queryClient.prefetchQuery({
  queryKey: ["customers-lookup"],
  queryFn: () => fetch("/api/customers/lookup").then((r) => r.json()),
  staleTime: 5 * 60 * 1000,
});
// sau khi thêm/sửa khách:
queryClient.invalidateQueries({ queryKey: ["customers-lookup"] });
```

Thời gian tải ước tính trong LAN: 0,1-0,5 giây.

---

## 3. Hàng hóa: ô input gõ là hiện ngay ~30 mã

> Nguồn: **`VTSYS.dbo.DmVt`** — **36.995 dòng**, PK **`VTID`** (bigint IDENTITY).
> Tên/ĐVT là TCVN3 → đọc qua `VP_2014.dbo.fn_TCVNToUnicode(...)` như mục 2.

Mô hình giống VFP: cursor trong RAM + index + SEEK.

```
SQL Server (chỉ SELECT)
   └─ FastAPI: giữ bản chụp trong RAM, tự so sánh định kỳ, tự cấp version
        └─ /api/products/changes?since=<version>
             └─ Trình duyệt: Web Worker giữ index, lưu IndexedDB
                  └─ Ô input: gửi chuỗi gõ cho worker, nhận ≤30 kết quả
```

### 3.1 Backend: bản chụp + version (không sửa SQL, không cần cột ngày sửa)

Vì bảng không có cột nào cho biết dòng đổi lúc nào, FastAPI **tự phát hiện thay đổi bằng cách so sánh**:

- Khi khởi động: đọc `VTID, Ma_Vt, Ten_Vt` của toàn bộ hàng hóa vào dict `{VTID: (Ma_Vt, Ten_Vt)}`, `version = 0`.
- Mỗi 30-60 giây (task nền): đọc lại toàn bộ 3 cột, so sánh với bản chụp. Dòng thêm, sửa, xóa đều được ghi vào danh sách `changes`, mỗi thay đổi gắn `version` tăng dần **do FastAPI cấp**.
- Đọc **36.995 dòng** x 3 cột trong LAN mất khoảng vài chục ms mỗi lần, chạy nền nên người dùng không thấy. Xóa cứng cũng phát hiện được vì dòng không còn trong lần đọc mới.
- `VTID` là `bigint IDENTITY` và là **khóa chính** của `DmVt` → làm khóa ổn định luôn (không lo sửa mã hàng). Tương tự `DmDt` có PK `DTID`.
- Giảm tải SQL (tùy chọn): trước mỗi vòng đọc, chạy một câu `SELECT` rẻ để lấy "dấu vân tay":
  ```sql
  SELECT COUNT(*), CHECKSUM_AGG(CHECKSUM(Ma_Vt, Ten_Vt)) FROM VTSYS.dbo.DmVt
  ```
  Giống lần trước thì bỏ qua vòng đọc đầy đủ. Vì `CHECKSUM_AGG` có thể bỏ sót thay đổi hiếm gặp, vẫn đọc đầy đủ định kỳ 5-10 phút.
- Thay đổi do chính web ghi (nếu web có thêm/sửa hàng hóa): cập nhật bản chụp và tăng version ngay, không chờ vòng quét. Thay đổi từ VFP có độ trễ 30-60 giây.

Phác thảo:

```python
changes = []     # [{"v": 12, "id": ..., "ma": "ABC1", "k": "abc1 áo thun", "del": False}]
snapshot = {}    # id -> (ma, ten)
version = 0
epoch = int(time.time())   # đổi mỗi lần server khởi động

def chuan(s: str) -> str:
    return unicodedata.normalize("NFC", s or "").lower()

def refresh():
    global version
    rows = query_all()   # SELECT VTID, Ma_Vt, Ten_Vt FROM VTSYS.dbo.DmVt
    new = {r.VTID: (r.Ma_Vt, r.Ten_Vt) for r in rows}
    for id_, val in new.items():
        if snapshot.get(id_) != val:
            version += 1
            changes.append({"v": version, "id": id_, "ma": chuan(val[0]).upper(),
                            "k": chuan(f"{val[0]} {val[1]}"), "del": False})
    for id_ in snapshot.keys() - new.keys():
        version += 1
        changes.append({"v": version, "id": id_, "del": True})
    snapshot.clear(); snapshot.update(new)

@app.get("/api/products/changes")
def products_changes(since: int = 0, epoch_c: int = 0):
    if epoch_c != epoch or since == 0 or (changes and since < changes[0]["v"] - 1):
        full = [{"id": i, "ma": chuan(v[0]).upper(), "k": chuan(f"{v[0]} {v[1]}")}
                for i, v in snapshot.items()]
        return {"full": True, "items": full, "max_v": version, "epoch": epoch}
    return {"full": False, "items": [c for c in changes if c["v"] > since],
            "max_v": version, "epoch": epoch}
```

Lưu ý:

- **Chạy một tiến trình uvicorn duy nhất** cho phần này. Nhiều worker thì mỗi tiến trình có bản chụp và version riêng, sẽ lệch nhau.
- Cắt bớt `changes` cũ (giữ khoảng vài giờ). Client có `since` quá cũ hoặc `epoch` khác sẽ nhận `full` và tải lại toàn bộ.
- Server khởi động lại thì client tải lại toàn bộ một lần (3-4 MB gzip). Muốn tránh thì lưu bản chụp + version vào một file SQLite cục bộ của FastAPI (không phải SQL Server).
- Chạy `refresh()` trong thread/executor để không chặn event loop.
- Tốn thêm RAM cho FastAPI (36.995 dòng x 3 cột chỉ vài MB).

### 3.2 Trình duyệt: Web Worker

- Index gồm `{id, ma (IN HOA, NFC), k (mã + tên, chữ thường, NFC)}`, sắp xếp theo `ma`.
- Gõ **mã**: tìm nhị phân (lower bound) rồi lấy tối đa 30 dòng liên tiếp khớp đầu mã. Nhanh như `SEEK`.
- Gõ **tên**: quét `includes` mọi từ, dừng ngay khi đủ 30 kết quả.
- Thứ tự hiển thị: khớp đầu mã trước, khớp trong mã/tên sau.
- Dùng `Map` theo `id` để sửa mã chỉ là ghi đè, không bị trùng.

```js
// search.worker.js
let map = new Map(); // id -> {id, ma, k}
let items = []; // sắp theo ma
let since = 0,
  epoch = 0;

const chuan = (s) => (s || "").normalize("NFC").toLowerCase();

function rebuild() {
  items = [...map.values()].sort((a, b) =>
    a.ma < b.ma ? -1 : a.ma > b.ma ? 1 : 0,
  );
}

function lowerBound(prefix) {
  let lo = 0,
    hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (items[mid].ma < prefix) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function search(q) {
  const LIMIT = 30;
  const out = [],
    seen = new Set();
  const P = chuan(q).trim().toUpperCase();
  if (!P) return out;

  // 1) khớp đầu mã (tìm nhị phân)
  for (
    let i = lowerBound(P);
    i < items.length && items[i].ma.startsWith(P) && out.length < LIMIT;
    i++
  ) {
    out.push(items[i]);
    seen.add(items[i].id);
  }
  // 2) khớp mọi từ trong mã + tên
  if (out.length < LIMIT) {
    const words = chuan(q).split(/\s+/).filter(Boolean);
    for (const it of items) {
      if (seen.has(it.id)) continue;
      if (words.every((w) => it.k.includes(w))) {
        out.push(it);
        if (out.length === LIMIT) break;
      }
    }
  }
  return out;
}

async function sync() {
  const r = await fetch(
    `/api/products/changes?since=${since}&epoch_c=${epoch}`,
  ).then((r) => r.json());
  if (r.full) map = new Map();
  if (!r.full && !r.items.length) return;
  for (const it of r.items) {
    if (it.del) map.delete(it.id);
    else map.set(it.id, { id: it.id, ma: it.ma, k: it.k });
  }
  since = r.max_v;
  epoch = r.epoch;
  rebuild();
  // saveToIndexedDB({ items: [...map.values()], since, epoch });
}

onmessage = async ({ data }) => {
  if (data.type === "init") {
    // 1) nạp IndexedDB (nếu có) -> map, since, epoch -> rebuild()
    // 2) await sync()
    postMessage({ type: "ready" });
  }
  if (data.type === "sync") {
    await sync();
    postMessage({ type: "synced" });
  }
  if (data.type === "search")
    postMessage({ type: "result", id: data.id, items: search(data.q) });
};
```

---

### 3.3 Khi nào gọi sync

- Khi app khởi động (sau khi nạp IndexedDB).
- Mỗi 30-60 giây bằng `setInterval`.
- Khi quay lại tab (`visibilitychange`) hoặc mở form phiếu bán.
- Nút "Làm mới danh mục" (xóa `since` để tải lại toàn bộ).

### 3.4 Ô input

- **Không debounce** (hoặc tối đa 30 ms). Mỗi phím gửi `{type:"search", id, q}` cho worker, chỉ hiển thị kết quả có `id` mới nhất.
- Dropdown tối đa 30 dòng, điều khiển bằng phím mũi tên/Enter.
- **Click/focus vào ô thì không hiện dropdown**, chỉ gửi truy vấn cho worker và mở dropdown khi người dùng gõ phím hoặc giá trị thay đổi (xem "Quy tắc cho ô nhập" ở mục 1). Không có gợi ý "mã gần đây" khi focus.
- Trong lúc index chưa sẵn sàng (lần đầu tải): hiện "Đang tải danh mục..." và tạm dùng `GET /api/products/search?q=` làm phương án dự phòng, truy vấn:
  ```sql
  SELECT TOP 30 Ma_Vt, VP_2014.dbo.fn_TCVNToUnicode(Ten_Vt) AS Ten_Vt
  FROM VTSYS.dbo.DmVt WITH (NOLOCK)
  WHERE Ma_Vt LIKE ? + '%' OR VP_2014.dbo.fn_TCVNToUnicode(Ten_Vt) LIKE N'%' + ? + N'%'
  ```
  Collation `SQL_Latin1_General_CP1_CI_AS` không phân biệt hoa/thường nên câu này chạy được ngay (nhưng **vẫn phân biệt dấu**), và **không dùng được index** vì có bọc hàm chuyển mã bên vế trái — chỉ dùng khi client chưa tải xong index.

### 3.5 Hàng mới chưa kịp có trong index

Gõ mã chính xác rồi Enter: nếu không có trong index thì gọi `GET /api/products/by-code/{ma}` hỏi thẳng SQL (`SELECT` theo mã), rồi bổ sung vào index.

---

## 4. Giá hàng hóa trong grid phiếu bán — đọc trực tiếp bảng giá `BG`/`BG0`

Mã hàng do form trung gian truyền xuống nên đây là **tra cứu chính xác theo mã**, không cần tìm mờ.

### 4.1. Nguồn dữ liệu: `VP_2014.dbo.BG` + `BG0`

Bảng giá văn phòng nằm ở **`VP_2014`** (không phải `VTSYS`):

| Bảng              | Vai trò                                | Cột chính                                                                                                                                                                       |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VP_2014.dbo.BG`  | Header — một dòng cho mỗi đợt bảng giá | `Stt` (PK), `Ma_DvCs`, `Ngay_Ct`, `So_Ct`, `Ma_Dt` char(16) NULL, `Ma_Vm` char(8) NULL, `Ma_Tte`, `Ty_Gia`, `Ngay_Ct1` NULL, `Ngay_Ct2` NULL, `UserName`, `Confirmed`, `Closed` |
| `VP_2014.dbo.BG0` | Detail — một dòng cho mỗi mặt hàng     | `Stt0` (PK), `Stt` (FK → `BG.Stt`), `Ma_Vt` char(16), `Dvt` varchar(8), `Gia` numeric, `CK` numeric                                                                             |

Quy tắc nghiệp vụ (đã kiểm chứng từ dữ liệu thật + `a_import_python_app.md`):

- **`Ma_Dt` và `Ma_Vm` loại trừ lẫn nhau**: một đợt bảng giá áp cho **một khách hàng** HOẶC **một khu vực**, không bao giờ cả hai.
- `Ma_Vm` của khách lấy từ **`VTSYS.dbo.DmDt.Ma_Vm`** (liên kết khách hàng ↔ khu vực; danh mục khu vực là `VTSYS.dbo.DmVm`).
- `Ngay_Ct1`/`Ngay_Ct2` = ngày bắt đầu/kết thúc hiệu lực; `Ngay_Ct2 = NULL` = vô hạn.
- `Gia` = đơn giá bán chưa chiết khấu; `CK` = tỷ lệ chiết khấu %.

> ⚠️ **Sửa lại thông tin cũ:** trước đây tài liệu ghi "KHÔNG có bảng giá — chỉ có SP mã hóa". Thực tế **`BG`/`BG0` là bảng giá vật lý**; các SP `SO_Get_Price`/`SO_Get_Discount` (mã hóa `WITH ENCRYPTION`) chỉ là lớp đọc `BG`/`BG0` bên trong. Webapp **đọc trực tiếp `BG`/`BG0`** để kiểm soát và tài liệu hóa được logic.

### 4.2. Thuật toán chọn bảng giá (khớp VFP `SO_Get_Price` + `SO_Price_Fix`)

VFP gọi `SO_Get_Price` rồi lọc qua `CheckPriceExpiry`/`CheckDiscountExpiry` (trong `SO_Price_Fix.FXP`). Webapp tái hiện đúng thứ tự:

1. Chỉ xét các đợt bảng giá có **`Ngay_Ct <= ngay_ct`** (không lấy bảng giá tương lai).
2. Lọc theo đối tượng áp dụng: **khớp khách hàng** (`RTRIM(BG.Ma_Dt) = ma_dt`) **HOẶC khớp khu vực** (`BG.Ma_Dt` rỗng và `RTRIM(BG.Ma_Vm) = DmDt.Ma_Vm`).
3. Ưu tiên **khách hàng > khu vực**; trong cùng mức ưu tiên lấy **`Ngay_Ct` mới nhất** (tie-break `Stt` DESC).
4. Nếu bảng giá đã **hết hiệu lực** (`Ngay_Ct2` khác NULL và `Ngay_Ct > Ngay_Ct2`) → **ép `Gia = 0`, `CK = 0`** (giống `CheckPriceExpiry`).

Câu SQL gom cho nhiều mã (một lượt):

```sql
SELECT RTRIM(b0.Ma_Vt) AS Ma_Vt, b0.Gia, b0.CK,
       b.Ma_Dt, b.Ma_Vm, b.Ngay_Ct, b.Ngay_Ct2, b.Stt
FROM VP_2014.dbo.BG  b  WITH (NOLOCK)
JOIN VP_2014.dbo.BG0 b0 WITH (NOLOCK) ON b0.Stt = b.Stt
WHERE RTRIM(b0.Ma_Vt) IN (?, ?, ...)
  AND b.Ngay_Ct <= ?
  AND (RTRIM(ISNULL(b.Ma_Dt,'')) = ?
       OR (RTRIM(ISNULL(b.Ma_Dt,'')) = '' AND RTRIM(ISNULL(b.Ma_Vm,'')) = ?))
```

Việc chọn "bảng giá tốt nhất" (ưu tiên khách > khu vực, `Ngay_Ct` mới nhất, ép 0 khi hết hạn) làm **trong Python** sau khi gom dòng theo mã — xem `backend/app/repositories/price_repo.py`.

### 4.3. Điều kiện áp giá trên form (khớp VFP)

- **Chỉ tự điền đơn giá khi ô Đơn giá đang trống/0** (VFP: `IF ISNULL(Gia_Nt9) OR EMPTY(Gia_Nt9)`). Nếu người dùng đã nhập giá thì **không ghi đè**.
- Chiết khấu (`Chiet_Khau`) điền cùng lúc với đơn giá.
- Sau khi điền, `calcLoai2Item` (frontend) tự tính `Tien_Nt9 = So_LuongBan * Gia_Nt9` và các trường dẫn xuất.
- Nút **"Tra giá lại"** ở toolbar grid: tra lại cho các dòng đang trống đơn giá (hữu ích sau khi đổi khách/ngày). Không tự động ghi đè dòng đã có giá.

### 4.4. Endpoint

- `GET /api/prices/{ma_vt}?ma_dt=&ngay_ct=` → `{success, data: {ma_vt, gia, chiet_khau, expired, source, ngay_ct, ngay_ct2} | null}`.
- `POST /api/prices/batch` body `{ma_dt, ngay_ct, ma_vt_list}` → `{success, data: {ma_dt, ngay_ct, items: [...]}}` (dùng khi đổ dòng từ phiếu xuất).

### 4.5. Ghi chú

- **Chỉ `SELECT` + `WITH (NOLOCK)`**; `RTRIM` mọi cột `char(n)` trước khi so khớp/trả JSON.
- Không có bảng giá áp dụng → trả `data = null` (frontend để đơn giá trống cho người dùng nhập tay).
- Giá phụ thuộc **độ dày** (`SO_Get_PriceByThickness`) hiện **chưa** hỗ trợ — nếu cần, bổ sung đọc `BG0` theo quy cách hoặc gọi SP tương ứng.

---

## 5. Triển khai

- Dev: `uvicorn main:app --reload --port 8000` và `npm run dev` (Vite proxy `/api` sang `localhost:8000`).
- Production: `npm run build` ra `dist/`, FastAPI phục vụ `dist/` (route `/api/...` khai báo trước, rồi mount `/assets` và route bắt tất cả trả `index.html`). Mỗi lần build xóa `dist/` cũ rồi chép bản mới.
- Chạy FastAPI như service (NSSM hoặc Task Scheduler trên Windows), **một tiến trình** để bản chụp hàng hóa không bị lệch version.

## 6. Thứ tự làm & trạng thái triển khai

| #   | Hạng mục                                                | Trạng thái                                              |
| --- | ------------------------------------------------------- | ------------------------------------------------------- |
| 1   | Endpoint khách hàng + component chọn khách              | ✅ Đã có (`/api/lookups/khach-hang`, thêm `ma_vm`)      |
| 2   | Endpoint `/api/products/search` (`TOP 30`) làm dự phòng | ✅ Đã có (`/api/products/search`)                       |
| 3   | Bản chụp + `/api/products/changes` trong FastAPI        | ✅ Đã có (`product_index_service`, quét nền 45s)        |
| 4   | Web Worker + IndexedDB + ô input hàng hóa               | ✅ Đã có (`productSearch.worker.ts`, `productIndex.ts`) |
| 5   | Tra giá `BG`/`BG0` cho grid (`/api/prices/*`)           | ✅ Đã có (`price_repo`, `prices` router)                |
| 6   | Đo thực tế bằng F12 > Network/Performance               | ⏳ Người dùng tự kiểm thử                               |

**File code đã thêm/sửa**

- Backend mới: `repositories/price_repo.py`, `services/price_service.py`, `routers/prices.py`, `schemas/price.py`, `services/product_index_service.py`, `routers/products.py`.
- Backend sửa: `main.py` (router + GZip + lifespan quét nền), `schemas/lookup.py` (+`ma_vm`), `repositories/lookup_repo.py` (+`ma_vm`), `routers/lookups.py` (+`limit`).
- Frontend mới: `workers/productSearch.worker.ts`, `lib/productIndex.ts`, `lib/customerIndex.ts`.
- Frontend sửa: `lib/lookups.ts` (+`fetchPrice`/`fetchPriceBatch`/`fetchProductByCode`/`fetchVatTuServerSearch`), `components/ui/Autocomplete.tsx` (+`openOnTypeOnly`/`debounceMs`/`maxResults`), `components/DetailGrid.tsx` (+`onLookupPrice`, dùng index), `components/VoucherForm.tsx` (wiring + nút "Tra giá lại"), `types/lookup.ts` (+`ma_vm`, `PriceItem`).

---

## PHỤ LỤC A — Bản đồ database THẬT (đã kiểm chứng read-only ngày 2026-10-24)

Kết nối: `192.168.10.8,14333`, driver `{ODBC Driver 17 for SQL Server}`.
Ba database, **cùng collation `SQL_Latin1_General_CP1_CI_AS`**:

| Database  | Vai trò                                                                  | Số bảng | Ghi được?                                |
| --------- | ------------------------------------------------------------------------ | ------- | ---------------------------------------- |
| `VP_2014` | Kế toán (chứng từ, sổ cái)                                               | 41      | ✅ webapp ghi (CtBH/CtBH0/SoCai/SoCaiVT) |
| `VTSYS`   | **Danh mục hệ thống** (DmDt, DmVt, DmKho, DmBp, DmXe…) + counter `DmStt` | 67      | ❌ chỉ SELECT                            |
| `KH_2014` | Kho (phiếu xuất, tồn)                                                    | 41      | ❌ chỉ SELECT                            |

> ⚠️ **Sai lầm dễ mắc #1:** tưởng `DmDt`/`DmVt` nằm ở `VP_2014`. **Không phải** — chúng ở **`VTSYS`**.
> Câu `SELECT ... FROM VP_2014.dbo.DmDt` sẽ ném `Invalid object name 'VP_2014.dbo.DmDt'`.

### Bảng & cột dùng cho tìm kiếm

| Bảng (DB)          | Số dòng    | PK                       | Cột tên                                   | Cột mã           | Ghi chú                                                           |
| ------------------ | ---------- | ------------------------ | ----------------------------------------- | ---------------- | ----------------------------------------------------------------- |
| `VTSYS.dbo.DmDt`   | **5.199**  | `DTID` (bigint IDENTITY) | `Ten_Dt`, `Ten_Dt2`, `Dia_Chi`, `Doi_Tac` | `Ma_Dt char(16)` | +`Ms_Thue`,`Gioi_Han`,`Toi_Han`,`Han_Tt`,`Ma_Nh_Dt`               |
| `VTSYS.dbo.DmVt`   | **36.995** | `VTID` (bigint IDENTITY) | `Ten_Vt`, `Ten_Vt2`                       | `Ma_Vt char(16)` | +`Loai_Vt`,`Dvt`,`Dvt_Ban`,`He_So0/1/2`,`Tk_Vt/Tk_Gv/Tk_Dt/Tk_Ck` |
| `VTSYS.dbo.DmKho`  | —          | —                        | `Ten_Kho`                                 | `Ma_Kho`         |                                                                   |
| `VTSYS.dbo.DmBp`   | —          | —                        | `Ten_Bp`                                  | `Ma_Bp`          |                                                                   |
| `VTSYS.dbo.DmNhDt` | —          | —                        | —                                         | `Ma_Nh_Dt`       | nhóm khách, có `Ma_Bp`,`Gioi_HanN`,`Toi_HanN`                     |

Đặc điểm cột `char(16)` của mã: **độ dài cố định 16, có khoảng trắng đuôi**
(`SELECT '<'+Ma_Dt+'>'` → `'<00000001        >'`, `DATALENGTH=16`, `LEN=8`).
→ **Luôn `.strip()`/`RTRIM()` trước khi so khớp hoặc trả JSON.** 0/5.199 mã có ký tự lạ.

### Bảng mã tiếng Việt — TCVN3 chứ không phải Unicode

`Ten_Dt`, `Ten_Vt`, `Dia_Chi`, `Dvt`… kiểu `nvarchar`/`varchar` **nhưng nội dung lưu ở TCVN3**.
Đọc thô ra mojibake: `'Kh¸ch s¹n H¶i Phßng'`. Phải chuyển mã **bằng hàm của DB**:

```sql
SELECT VP_2014.dbo.fn_TCVNToUnicode(Ten_Dt) FROM VTSYS.dbo.DmDt
-- => 'Khách sạn Hải Phòng'   (Unicode NFC)
```

- Hàm `fn_TCVNToUnicode` (& `fn_UnicodeToTCVN`) **định nghĩa ở `VP_2014`** → phải ghi tên đầy đủ
  `VP_2014.dbo.fn_TCVNToUnicode(...)`, kể cả khi kết nối vào `VTSYS`, nếu không sẽ `Invalid object name`.
- Kết quả là **NFC** (đã kiểm: `value == NFC(value)` = True, NFD = False). Kết hợp trực tiếp với
  `normalize("NFC")` phía client là an toàn.
- `fn_UnicodeToTCVN(NULL)` và `fn_UnicodeToTCVN('')` đều trả **NULL**.
- Vì collation `..._CI_AS` **không bỏ dấu**: `LIKE N'%nguyễn%'` = 217 dòng, `LIKE N'%nguyen%'` = 0 dòng.

### Giá & chiết khấu — bảng giá `BG`/`BG0` (đã xác minh lại)

Bảng giá vật lý nằm ở **`VP_2014`**: `dbo.BG` (header) + `dbo.BG0` (detail) — xem **Phụ lục F**.
Không tồn tại bảng `DmGia`/`GiaVt`/`BangGia` nào (tên khác). Các SP sau là **lớp đọc `BG`/`BG0`**
(mã hóa `WITH ENCRYPTION`, không đọc được definition) — webapp **không dùng** mà đọc trực tiếp `BG`/`BG0`:

| SP (ở `VP_2014` **và** `KH_2014`)                                                                   | Vai trò                     |
| --------------------------------------------------------------------------------------------------- | --------------------------- |
| `dbo.SO_Get_Price`                                                                                  | Giá bán (đọc `BG`/`BG0`)    |
| `dbo.SO_Get_PriceByThickness`                                                                       | Giá theo độ dày             |
| `dbo.SO_Get_Discount`                                                                               | Chiết khấu (đọc `BG`/`BG0`) |
| `dbo.SO_CreatePriceList`                                                                            | Tạo bảng giá                |
| `dbo.IN_Calculate_FIFOPrice`, `IN_Calculate_MonthAveragePrice`, `IN_Calculate_MovementAveragePrice` | Giá vốn xuất kho            |

→ Webapp tra giá bằng `SELECT` trực tiếp `VP_2014.dbo.BG`/`BG0` (xem §4 và Phụ lục F).

### Bẫy pyodbc & Stored Procedure

SQL Server trả về nhiều token `DONE_IN_PROC` cho mỗi SP. **Mọi lệnh gọi `EXEC` PHẢI có `SET NOCOUNT ON;`**
ở đầu batch, nếu không pyodbc sẽ ném `ProgrammingError: No results. Previous SQL was not a query`,
khiến code rơi vào nhánh fallback sai (đã từng làm `Stt` sinh ra khác hoàn toàn VFP).

```python
cur.execute(f"SET NOCOUNT ON; EXEC {db}.dbo.SP_Name @p_X=?, @p_Y=?", [a, b])
```

Nếu SP có tham số `OUTPUT` + `SELECT` kết quả, phải `DECLARE` biến rồi `SELECT` cuối batch:

```python
cur.execute("SET NOCOUNT ON; DECLARE @p_Stt char(20)=''; "
            "EXEC VTSYS.dbo.ST_Increase_KeyIndex @p_Ma_DvCs=?, @p_Stt=@p_Stt OUTPUT; "
            "SELECT @p_Stt AS Stt;", [ma_dvcs])
stt = cur.fetchone()[0]
```

### Ba database hay bị nhầm

- `fn_TCVNToUnicode` / `fn_UnicodeToTCVN` → ở **`VP_2014`**.
- Danh mục `DmDt`/`DmVt`/`DmKho`/`DmBp`/`DmXe`/`DmNhDt` → ở **`VTSYS`**.
- Counter cấp `Stt` (`ST_Increase_KeyIndex`, bảng `DmStt`) → ở **`VTSYS`**.
- Bảng chứng từ `CtBH`/`CtBH0`/`SoCai`/`SoCaiVT` → ở **`VP_2014`**.
- **Bảng giá `BG`/`BG0` → ở `VP_2014`** (KHÔNG phải `VTSYS`).
- Phiếu xuất kho `CtBH`/`CtBH0` → ở **`KH_2014`** (đọc: `Stt_PX` liên kết về `VP_2014`).

---

## PHỤ LỤC B — Quy tắc viết code truy vấn để tránh lỗi

1. **Luôn qualify tên DB + schema + bảng** (`VTSYS.dbo.DmDt`) và **qualify hàm**
   (`VP_2014.dbo.fn_TCVNToUnicode`). Khi kết nối mặc định vào `VTSYS`, hàm ở `VP_2014` sẽ
   `Invalid object name` nếu không ghi đủ tên.
2. **Luôn `RTRIM()`/`.strip()`** cột `char(n)` trước khi so khớp, `MAX`, `LIKE` hay trả JSON.
   So khớp `Ma_Dt = ?` vẫn OK vì đuôi khoảng trắng bị cắt theo ngữ nghĩa so sánh của `char`.
3. **Không `SELECT *`** — chỉ lấy cột cần; cột danh mục thì bọc `fn_TCVNToUnicode`.
4. **Ghi (INSERT/UPDATE):** văn bản Unicode phải bọc `VP_2014.dbo.fn_UnicodeToTCVN(?)` ngay trong SQL
   (SP không tự chuyển mã). Xem `voucher_repo.save_voucher`.
5. **Mọi `EXEC` SP → `SET NOCOUNT ON;`** (Phụ lục A).
6. **Tìm kiếm không cần bỏ dấu** (không có yêu cầu) — chỉ `lower()` + `NFC`; DB cũng không bỏ dấu.
7. **Chỉ `SELECT`** cho phần tìm kiếm/danh mục; không `WITH (UPDLOCK)`/`HOLDLOCK` gây khóa bảng.
   Đọc danh mục dùng `WITH (NOLOCK)` như code hiện có để không chặn VFP.
8. **`LIMIT`/`TOP`** bắt buộc cho mọi truy vấn gợi ý (≤ 200; UI chỉ hiện ≤ 30-50).
9. **Ngày/tiền:** dùng `decimal`/`float` đúng như schema; không tự đổi kiểu.
10. **Thay đổi phải chạy `pytest` + `tsc --noEmit` + `npm run build`** trước khi kết luận xong.

---

## PHỤ LỤC C — Checklist tự kiểm trước khi ghi code

- [ ] Bảng này nằm ở `VP_2014` / `VTSYS` / `KH_2014`? (đã đúng chưa — Phụ lục A)
- [ ] Có cột `char(n)` nào bị dính khoảng trắng đuôi chưa → đã `RTRIM`/`.strip()`?
- [ ] Cột text tiếng Việt đã bọc `VP_2014.dbo.fn_TCVNToUnicode(...)` chưa?
- [ ] Có gọi `EXEC` SP nào chưa thêm `SET NOCOUNT ON;`?
- [ ] Câu SELECT có `NOLOCK` + `TOP`/`LIMIT` chưa?
- [ ] Có lỡ `VTSYS.dbo.` cho bảng chứng từ hay `VP_2014.dbo.` cho danh mục chưa?
- [ ] Thay đổi frontend: `npx tsc --noEmit` sạch?

---

## PHỤ LỤC D — Các lỗi đã từng xảy ra (để không tái phạm)

| #   | Triệu chứng                                                 | Nguyên nhân                                                                                                      | Cách đúng                                                                                                   |
| --- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | `Stt` webapp khác VFP (`S11…` thay `S10…`)                  | `EXEC ST_Increase_KeyIndex` **thiếu `SET NOCOUNT ON`** → pyodbc `No results` → rơi vào fallback `time.time_ns()` | Thêm `SET NOCOUNT ON` + `SELECT @p_Stt AS Stt`                                                              |
| 2   | `Ma_Dt` ghi thành **tên khách** → `Ten_Dt` NULL khi đọc     | Form nhận text thay vì mã; không validate tồn tại `DmDt`                                                         | Dùng `cust.ma_dt` + backend chặn FK (validate `UPPER(RTRIM(Ma_Dt))` ∈ `DmDt`)                               |
| 3   | Phiếu đã lưu **không vào công nợ**                          | SP ghi `SoCai` là `VP_2014.dbo.CtBH_SoCai`; webapp bỏ qua, tưởng `CtBH_Post` ghi                                 | `CtBH_Post` KHÔNG ghi `SoCai`; phải gọi `CtBH_SoCai` (Nợ `Tk2`=1311 / Có `Tk_Du2`=5112, tiền = `TTien_Nt2`) |
| 4   | Sửa phiếu làm **nhân đôi** sổ cái                           | `CtBH_SoCai` gọi lại sẽ append thêm dòng                                                                         | Chế độ Sửa: `DELETE dbo.SoCai/SoCaiVT WHERE Stt=?` **trước** khi post lại                                   |
| 5   | `SELECT ... FROM VP_2014.dbo.DmDt` → `Invalid object name`  | Danh mục ở `VTSYS`, không ở `VP_2014`                                                                            | Dùng `VTSYS.dbo.DmDt`                                                                                       |
| 6   | Hàm chuyển mã báo không tồn tại khi đọc `VTSYS`             | `fn_TCVNToUnicode` định nghĩa ở `VP_2014`                                                                        | Ghi đủ `VP_2014.dbo.fn_TCVNToUnicode(...)`                                                                  |
| 7   | Đơn giá tự về 0 khi bấm ra ngoài ô                          | Hàm enrich async dùng snapshot cũ ghi đè trường người dùng đã nhập                                               | Dùng `itemsRef` đọc bản mới nhất, chỉ hợp nhất trường danh mục                                              |
| 8   | Mã hàng `char(16)` trả JSON dính khoảng trắng / so khớp sai | Không `RTRIM`/`.strip()` trước khi trả/so                                                                        | `RTRIM` trong SQL hoặc `.strip()` khi map                                                                   |
| 9   | Người dùng gõ không dấu không ra kết quả                    | Collation không bỏ dấu; TCVN3 cũng không bỏ dấu                                                                  | Ghi rõ hành vi; nếu cần thì thêm hàm bỏ dấu phía app (không đụng DB)                                        |

---

## PHỤ LỤC E — Vị trí file code liên quan

- Backend config kết nối 3 DB: `backend/app/config.py` (`DB_VP`,`DB_SYS`,`DB_KH`), `app/database.py`
  (`get_db_cursor` = chỉ đọc autocommit; `get_db_transaction` = ACID).
- Danh mục/lookup: `backend/app/repositories/lookup_repo.py` (đã bọc `fn_TCVNToUnicode`, đã `strip`).
- Chuyển mã TCVN3↔Unicode (Python): `backend/app/utils/unicode.py`.
- Ghi chứng từ (đầy đủ CHỐT + `CtBH_SoCai`): `backend/app/repositories/voucher_repo.py`.
- Hủy phiếu xuất kho: `backend/app/repositories/pickup_repo.py`.
- Node SP mã hóa: xem bằng `SELECT definition FROM sys.sql_modules` sẽ trả `NULL` (encrypted).

**Bổ sung (2026-10-26) — tìm kiếm tức thì + tra giá `BG`/`BG0`:**

- Tra giá bảng giá: `backend/app/repositories/price_repo.py`, `services/price_service.py`,
  `routers/prices.py`, `schemas/price.py`.
- Bản chụp/version danh mục vật tư: `backend/app/services/product_index_service.py`,
  `routers/products.py` (đăng ký + GZip + lifespan quét nền trong `main.py`).
- Frontend: `frontend/src/workers/productSearch.worker.ts`, `lib/productIndex.ts`,
  `lib/customerIndex.ts`, `lib/lookups.ts` (thêm `fetchPrice`/`fetchPriceBatch`/`fetchProductByCode`),
  `components/ui/Autocomplete.tsx` (`openOnTypeOnly`/`debounceMs`/`maxResults`),
  `components/DetailGrid.tsx` (`onLookupPrice`), `components/VoucherForm.tsx` (wiring + "Tra giá lại").

---

## PHỤ LỤC F — Bảng giá `VP_2014.dbo.BG` / `BG0` (chi tiết)

### F.1. Cấu trúc bảng

**`VP_2014.dbo.BG`** (header — một dòng cho mỗi đợt bảng giá)

| Cột         | Kiểu     | Null | Ghi chú                                            |
| ----------- | -------- | ---- | -------------------------------------------------- |
| `Stt`       | char(20) | NO   | **PK** — sinh bởi `VTSYS.dbo.ST_Increase_KeyIndex` |
| `Ma_DvCs`   | char(2)  | NO   | Mã đơn vị cơ sở (mặc định `'01'`)                  |
| `Ngay_Ct`   | datetime | NO   | Ngày lập bảng giá                                  |
| `So_Ct`     | char(20) | YES  | Số/tên chứng từ bảng giá                           |
| `Ma_Dt`     | char(16) | YES  | Mã khách hàng áp dụng (**loại trừ với `Ma_Vm`**)   |
| `Ma_Vm`     | char(8)  | YES  | Mã khu vực áp dụng (**loại trừ với `Ma_Dt`**)      |
| `Ma_Tte`    | char(3)  | NO   | Loại tiền tệ (mặc định `'VND'`)                    |
| `Ty_Gia`    | numeric  | NO   | Tỷ giá (mặc định `1`)                              |
| `Ngay_Ct1`  | datetime | YES  | Ngày bắt đầu hiệu lực                              |
| `Ngay_Ct2`  | datetime | YES  | Ngày kết thúc hiệu lực (`NULL` = vô hạn)           |
| `UserName`  | char(16) | YES  | Người tạo                                          |
| `Confirmed` | bit      | YES  | Trạng thái duyệt                                   |
| `Closed`    | char(1)  | YES  | Trạng thái đóng                                    |

**`VP_2014.dbo.BG0`** (detail — một dòng cho mỗi mặt hàng)

| Cột     | Kiểu       | Null | Ghi chú                                             |
| ------- | ---------- | ---- | --------------------------------------------------- |
| `Stt0`  | char(20)   | NO   | **PK** — sinh bởi `ST_Increase_KeyIndex`            |
| `Stt`   | char(20)   | NO   | **FK → `BG.Stt`**                                   |
| `Ma_Vt` | char(16)   | YES  | Mã vật tư (cho phép mã chưa khai báo trong `DmVt`)  |
| `Dvt`   | varchar(8) | YES  | Đơn vị tính (lấy từ `DmVt`, rỗng nếu chưa khai báo) |
| `Gia`   | numeric    | YES  | Đơn giá bán chưa chiết khấu                         |
| `CK`    | numeric    | YES  | Tỷ lệ chiết khấu %                                  |

### F.2. Liên kết khách hàng ↔ khu vực

- `VTSYS.dbo.DmDt.Ma_Vm` char(8) NULL → khu vực của khách hàng.
- `VTSYS.dbo.DmVm` (`VMID` PK, `Ma_Vm` char(8), `Ten_Vm`, `Ten_Vm2`) → danh mục khu vực.
- Khi tra giá: lấy `Ma_Vm` của khách từ `DmDt`, rồi khớp `BG.Ma_Vm`.

### F.3. Ví dụ dữ liệu thật (trích `SCT_OUTPUT/BG_data.txt`, `BG0_data.txt`)

```
-- BG (header)
Stt                    Ngay_Ct     So_Ct  Ma_Dt       Ma_Vm    Ma_Tte  Ngay_Ct1  Ngay_Ct2
S1000000000013789761   2026-04-01  001    NULL        NPP01    VND     NULL      NULL
S1000000000013812494   2026-04-01  001    21000007    NULL     VND     NULL      NULL

-- BG0 (detail)
Stt0                   Stt                    Ma_Vt            Dvt   Gia          CK
S1000000000013789763   S1000000000013789761   1300105100190    Cái   2080000.0000 54.00
```

### F.4. Quy tắc chọn bảng giá (tóm tắt)

1. `Ngay_Ct <= ngay_ct` (không lấy bảng giá tương lai).
2. Khớp `Ma_Dt` (khách) **hoặc** `Ma_Vm` (khu vực của khách).
3. Ưu tiên **khách > khu vực**, rồi `Ngay_Ct` mới nhất (tie-break `Stt` DESC).
4. Hết hiệu lực (`Ngay_Ct2` khác NULL và `Ngay_Ct > Ngay_Ct2`) → **ép `Gia = 0`, `CK = 0`**.

### F.5. Lưu ý khi viết code

- `Ma_Dt`/`Ma_Vm`/`Ma_Vt`/`Stt`/`Stt0` là `char(n)` → **luôn `RTRIM`/`.strip()`**.
- Chỉ `SELECT` + `WITH (NOLOCK)`; không ghi vào `BG`/`BG0` từ webapp.
- `Dvt` trong `BG0` là `varchar` (không phải TCVN3 như `DmVt.Dvt`) — không cần `fn_TCVNToUnicode`.
