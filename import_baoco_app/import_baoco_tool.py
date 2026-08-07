import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import pandas as pd
import pyodbc
import datetime

# Database config
DB_SERVER = "192.168.10.8,14333"
DB_NAME = "VP_2014"
DB_USER = "sa"
DB_PASS = "sql2008@"

def get_connection():
    try:
        conn = pyodbc.connect(
            f'DRIVER={{ODBC Driver 17 for SQL Server}};'
            f'SERVER={DB_SERVER};'
            f'DATABASE={DB_NAME};'
            f'UID={DB_USER};'
            f'PWD={DB_PASS}',
            autocommit=False
        )
    except pyodbc.Error:
        try:
            conn = pyodbc.connect(
                f'DRIVER={{SQL Server}};'
                f'SERVER={DB_SERVER};'
                f'DATABASE={DB_NAME};'
                f'UID={DB_USER};'
                f'PWD={DB_PASS}',
                autocommit=False
            )
        except Exception as e:
            raise e
    return conn

def import_excel(filepath, username):
    try:
        import tempfile
        import shutil
        import os
        
        # Create a temporary file to avoid PermissionError when Excel file is open
        _, ext = os.path.splitext(filepath)
        fd, temp_path = tempfile.mkstemp(suffix=ext if ext else '.xlsx')
        os.close(fd)
        
        try:
            shutil.copy2(filepath, temp_path)
            df = pd.read_excel(temp_path)
        finally:
            try:
                os.remove(temp_path)
            except Exception:
                pass
        
        if len(df.columns) < 6:
            raise ValueError("File Excel cần ít nhất 6 cột (Tên TK, Số TK, Nội dung, Số tiền, Ngày, Mã KH).")
            
        df = df.iloc[:, :6]
        df.columns = ['Ten_Tk', 'So_Tk', 'Noi_Dung', 'So_Tien', 'Ngay', 'Ma_Kh']
        
        def clean_string(series):
            return series.apply(
                lambda x: '' if pd.isna(x) else (str(int(x)) if isinstance(x, float) and x.is_integer() else str(x))
            ).str.strip()
        
        df['Ten_Tk'] = clean_string(df['Ten_Tk'])
        df['So_Tk'] = clean_string(df['So_Tk'])
        df['Noi_Dung'] = clean_string(df['Noi_Dung'])
        df['Ma_Kh'] = clean_string(df['Ma_Kh'])
        
        df['Ngay'] = pd.to_datetime(df['Ngay'], errors='coerce')
        df['So_Tien'] = pd.to_numeric(df['So_Tien'], errors='coerce')
        
        # Bỏ qua các dòng không hợp lệ
        cond_ngay = df['Ngay'].notna()
        cond_tien = df['So_Tien'].notna()
        df = df[cond_ngay & cond_tien].copy()
        
        if len(df) == 0:
            messagebox.showinfo("Thông báo", "Không tìm thấy dữ liệu hợp lệ để import.")
            return

        # Sắp xếp theo ngày để đánh số chứng từ đúng thứ tự
        df = df.sort_values(by='Ngay')
        
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT TOP 1 Ma_DvCs FROM VTSYS.dbo.DmDvCs")
        row = cursor.fetchone()
        ma_dvcs = row[0].strip() if row else '01'
        
        success_count = 0
        
        try:
            # Cache số chứng từ max của mỗi tháng
            max_so_ct_dict = {}
            for index, row in df.iterrows():
                ngay_ct = row['Ngay']
                month_year = (ngay_ct.year, ngay_ct.month)
                
                if month_year not in max_so_ct_dict:
                    # Truy vấn số chứng từ lớn nhất của tháng hiện tại
                    cursor.execute("""
                        SELECT MAX(CAST(So_Ct AS INT)) 
                        FROM dbo.CtT 
                        WHERE Ma_Ct='C3' 
                          AND MONTH(Ngay_Ct) = ? 
                          AND YEAR(Ngay_Ct) = ? 
                          AND ISNUMERIC(So_Ct) = 1
                    """, (ngay_ct.month, ngay_ct.year))
                    res = cursor.fetchone()
                    max_so_ct_dict[month_year] = res[0] if res and res[0] is not None else 0
                
                max_so_ct_dict[month_year] += 1
                new_so_ct = f"{max_so_ct_dict[month_year]:06d}"
                
                # Sinh Stt cho CtTG
                cursor.execute(f"""
                    SET NOCOUNT ON;
                    DECLARE @p_Stt char(20) = '';
                    EXEC VTSYS.dbo.ST_Increase_KeyIndex @p_Ma_DvCs='{ma_dvcs}', @p_Stt=@p_Stt OUTPUT;
                    SELECT @p_Stt AS Stt;
                """)
                row_stt = cursor.fetchone()
                if not row_stt or not row_stt.Stt:
                    raise Exception("Không thể tạo khóa chính (Stt).")
                stt = row_stt.Stt
                
                ngay_str = ngay_ct.strftime('%Y%m%d')
                so_tk = row['So_Tk']
                noi_dung = row['Noi_Dung']
                so_tien = row['So_Tien']
                ma_kh = row['Ma_Kh']
                
                # Query DmDt để lấy thông tin Ông/Bà và Địa chỉ
                cursor.execute("SELECT TOP 1 Ten_Dt, Dia_Chi FROM VTSYS.dbo.DmDt WHERE Ma_Dt = ?", (ma_kh,))
                dt_row = cursor.fetchone()
                ong_ba = dt_row.Ten_Dt if (dt_row and dt_row.Ten_Dt) else ""
                dia_chi = dt_row.Dia_Chi if (dt_row and dt_row.Dia_Chi) else ""
                
                # Insert vào CtT (Header)
                sql_h = """
                    INSERT INTO dbo.CtT 
                    (Stt, Ma_DvCs, Ma_Ct, Ngay_Ct, So_Ct, Ma_Dt0, Ong_Ba, Dia_Chi, Dien_Giai0, TTien, TTien_Nt, TTien0, TTien_Nt0, UserName, Confirmed, Kieu_Ct, Nh_Ct, Ma_Tte, Ty_Gia)
                    VALUES (?, ?, 'C3', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ' ', '1', 'VND', 1)
                """
                cursor.execute(sql_h, (stt, ma_dvcs, ngay_str, new_so_ct, ma_kh, ong_ba, dia_chi, noi_dung, so_tien, so_tien, so_tien, so_tien, username))
                
                # Sinh Stt0 cho CtT0
                cursor.execute(f"""
                    SET NOCOUNT ON;
                    DECLARE @p_Stt0 char(20) = '';
                    EXEC VTSYS.dbo.ST_Increase_KeyIndex @p_Ma_DvCs='{ma_dvcs}', @p_Stt=@p_Stt0 OUTPUT;
                    SELECT @p_Stt0 AS Stt;
                """)
                row_stt0 = cursor.fetchone()
                if not row_stt0 or not row_stt0.Stt:
                    raise Exception("Không thể tạo khóa phụ (Stt0).")
                stt0 = row_stt0.Stt
                
                # Insert vào CtT0 (Detail)
                sql_d = """
                    INSERT INTO dbo.CtT0 
                    (Stt0, Stt, Tk_No, Tk_Co, Tien, Tien_Nt, Dien_Giai, Ma_Dt, Loai_VAT, Dieu_Chinh, Stt_Nv)
                    VALUES (?, ?, '11212', '1311', ?, ?, ?, ?, '1', 'K', 1)
                """
                cursor.execute(sql_d, (stt0, stt, so_tien, so_tien, noi_dung, ma_kh))
                
                # Ghi sổ (Post) chứng từ để cập nhật công nợ và sổ cái
                cursor.execute("""
                    SET NOCOUNT ON;
                    DECLARE @res smallint;
                    EXEC dbo.CtT_Post @p_Stt=?, @p_Result=@res OUTPUT;
                """, (stt,))
                
                success_count += 1
                
            conn.commit()
            messagebox.showinfo("Thành công", f"Import hoàn tất!\nĐã tạo thành công {success_count} chứng từ báo có.")
        except Exception as e:
            conn.rollback()
            messagebox.showerror("Lỗi Database", f"Có lỗi xảy ra trong quá trình ghi dữ liệu:\n{str(e)}\n\nĐã thu hồi (rollback) toàn bộ dữ liệu.")
        finally:
            conn.close()
            
    except Exception as e:
        messagebox.showerror("Lỗi", f"Không thể xử lý file Excel: {str(e)}")


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Công cụ Quản lý và Import Báo Có (Tiền Gửi) VP2014")
        self.geometry("900x450")
        self.eval('tk::PlaceWindow . center')
        
        # === PHẦN XEM DỮ LIỆU ===
        ttk.Label(self, text="TRA CỨU SỔ TIỀN GỬI (11212) - BÁO NỢ / BÁO CÓ", font=("Arial", 14, "bold")).pack(pady=10)
        
        frame_search = tk.Frame(self)
        frame_search.pack(fill="x", padx=10, pady=5)
        
        import datetime
        today = datetime.date.today()
        
        tk.Label(frame_search, text="Từ ngày (dd/mm/yyyy):").pack(side="left", padx=5)
        self.entry_start = tk.Entry(frame_search, width=15)
        self.entry_start.insert(0, today.strftime("%d/%m/%Y"))
        self.entry_start.pack(side="left", padx=5)
        
        tk.Label(frame_search, text="Đến ngày:").pack(side="left", padx=5)
        self.entry_end = tk.Entry(frame_search, width=15)
        self.entry_end.insert(0, today.strftime("%d/%m/%Y"))
        self.entry_end.pack(side="left", padx=5)
        
        btn_search = tk.Button(frame_search, text="Tìm kiếm", bg="#2196F3", fg="white", command=self.on_search)
        btn_search.pack(side="left", padx=15)
        
        # Treeview
        frame_tree = tk.Frame(self)
        frame_tree.pack(fill="both", expand=True, padx=10, pady=5)
        
        cols = ("Ngay", "So_Ct", "KhachHang", "NoiDung", "TienNo", "TienCo", "LuyKe")
        self.tree = ttk.Treeview(frame_tree, columns=cols, show="headings", height=12)
        
        self.tree.heading("Ngay", text="Ngày")
        self.tree.heading("So_Ct", text="Số CT")
        self.tree.heading("KhachHang", text="Khách hàng")
        self.tree.heading("NoiDung", text="Nội dung")
        self.tree.heading("TienNo", text="Báo có")
        self.tree.heading("TienCo", text="Báo nợ")
        self.tree.heading("LuyKe", text="Lũy kế")
        
        self.tree.column("Ngay", width=60, anchor="center")
        self.tree.column("So_Ct", width=40, anchor="center")
        self.tree.column("KhachHang", width=200)
        self.tree.column("NoiDung", width=250)
        self.tree.column("TienNo", width=80, anchor="e")
        self.tree.column("TienCo", width=80, anchor="e")
        self.tree.column("LuyKe", width=80, anchor="e")
        
        scrollbar = ttk.Scrollbar(frame_tree, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscroll=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        self.tree.pack(fill="both", expand=True)
        
        ttk.Separator(self, orient='horizontal').pack(fill='x', pady=10)
        
        # === PHẦN IMPORT ===
        ttk.Label(self, text="IMPORT CHỨNG TỪ BÁO CÓ MỚI (Excel: 1.TênTK | 2.SốTK | 3.Nội dung | 4.Số tiền | 5.Ngày | 6.MãKH)", font=("Arial", 11, "bold")).pack(pady=5)
        
        frame_action = tk.Frame(self)
        frame_action.pack(fill="x", padx=10, pady=5)
        
        tk.Label(frame_action, text="File Excel:").pack(side="left")
        self.entry_file = tk.Entry(frame_action, width=50)
        self.entry_file.insert(0, r"C:\Users\Administrator\OneDrive\ELAN\Import\baoCo\baoCo.xlsx")
        self.entry_file.pack(side="left", padx=5)
        
        tk.Button(frame_action, text="Chọn...", command=self.on_browse).pack(side="left")
        
        tk.Label(frame_action, text=" TK:").pack(side="left", padx=(15, 2))
        self.combo_user = ttk.Combobox(frame_action, values=["KTTH", "ADMIN", "KTCN3", "KTCN"], state="readonly", width=7)
        self.combo_user.current(0)
        self.combo_user.pack(side="left")
        
        btn_import = tk.Button(frame_action, text="Import Dữ Liệu", font=("Arial", 10, "bold"), bg="#4CAF50", fg="white", command=self.on_import)
        btn_import.pack(side="left", padx=15)
        
    def format_money(self, amount):
        if not amount: return "0"
        return "{:,.0f}".format(amount).replace(",", ".")

    def on_search(self):
        start_str = self.entry_start.get().strip()
        end_str = self.entry_end.get().strip()
        
        import datetime
        try:
            start_date = datetime.datetime.strptime(start_str, "%d/%m/%Y").strftime("%Y-%m-%d")
            end_date = datetime.datetime.strptime(end_str, "%d/%m/%Y").strftime("%Y-%m-%d")
        except Exception:
            messagebox.showerror("Lỗi", "Ngày tháng phải đúng định dạng dd/mm/yyyy")
            return
            
        for row in self.tree.get_children():
            self.tree.delete(row)
            
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            # Lấy số dư đầu năm từ CdK
            query_cdk = """
                SELECT 
                    SUM(ISNULL(Du_No0, 0)) - SUM(ISNULL(Du_Co0, 0)) AS Du_Dau_Nam
                FROM dbo.CdK 
                WHERE RTRIM(Tk) = '11212'
            """
            cursor.execute(query_cdk)
            row_cdk = cursor.fetchone()
            du_dau_nam = float(row_cdk.Du_Dau_Nam) if row_cdk and row_cdk.Du_Dau_Nam else 0

            # Lấy phát sinh từ đầu năm đến trước start_date
            query_sd = """
                SELECT 
                    SUM(CASE WHEN RTRIM(Tk_No) = '11212' THEN Tien ELSE 0 END) - 
                    SUM(CASE WHEN RTRIM(Tk_Co) = '11212' THEN Tien ELSE 0 END) AS Phat_Sinh
                FROM dbo.SoCai
                WHERE (RTRIM(Tk_No) = '11212' OR RTRIM(Tk_Co) = '11212') 
                  AND Ngay_Ct < ?
            """
            cursor.execute(query_sd, (start_date,))
            row_sd = cursor.fetchone()
            phat_sinh = float(row_sd.Phat_Sinh) if row_sd and row_sd.Phat_Sinh else 0
            
            luy_ke = du_dau_nam + phat_sinh
            
            self.tree.insert("", "end", values=(
                "", "", "SỐ DƯ ĐẦU KỲ", "", "", "", self.format_money(luy_ke)
            ))
            
            query = """
                SELECT 
                    a.Ngay_Ct, 
                    a.So_Ct, 
                    dbo.fn_TCVNToUnicode(COALESCE(c.Ten_Dt, a.Ong_Ba, a.Ma_Dt0)) AS KhachHang, 
                    dbo.fn_TCVNToUnicode(b.Dien_Giai) AS Dien_Giai, 
                    CASE WHEN b.Tk_No = '11212' THEN b.Tien ELSE 0 END AS TienNo,
                    CASE WHEN b.Tk_Co = '11212' THEN b.Tien ELSE 0 END AS TienCo
                FROM dbo.CtT a
                JOIN dbo.CtT0 b ON a.Stt = b.Stt
                LEFT JOIN VTSYS.dbo.DmDt c ON a.Ma_Dt0 = c.Ma_Dt
                WHERE a.Ma_Ct IN ('C3', 'C4') 
                  AND (b.Tk_No = '11212' OR b.Tk_Co = '11212')
                  AND a.Ngay_Ct >= ? AND a.Ngay_Ct <= ?
                ORDER BY a.Ngay_Ct, a.So_Ct, a.Stt
            """
            cursor.execute(query, (start_date, end_date))
            rows = cursor.fetchall()
            
            for r in rows:
                tien_no = float(r.TienNo) if r.TienNo else 0
                tien_co = float(r.TienCo) if r.TienCo else 0
                luy_ke += (tien_no - tien_co)
                
                ngay_format = r.Ngay_Ct.strftime("%d/%m/%Y") if r.Ngay_Ct else ""
                kh = r.KhachHang.strip() if r.KhachHang else ""
                dg = r.Dien_Giai.strip() if r.Dien_Giai else ""
                
                self.tree.insert("", "end", values=(
                    ngay_format, 
                    r.So_Ct, 
                    kh, 
                    dg, 
                    self.format_money(tien_no), 
                    self.format_money(tien_co), 
                    self.format_money(luy_ke)
                ))
            
        except Exception as e:
            messagebox.showerror("Lỗi Database", str(e))
        finally:
            if 'conn' in locals() and conn:
                conn.close()
                
    def on_browse(self):
        filepath = filedialog.askopenfilename(title="Chọn file Excel", filetypes=[("Excel files", "*.xlsx *.xls *.xlsm")])
        if filepath:
            self.entry_file.delete(0, tk.END)
            self.entry_file.insert(0, filepath)
            
    def on_import(self):
        filepath = self.entry_file.get().strip()
        username = self.combo_user.get().strip()
        
        if not filepath:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn file Excel trước khi Import!")
            return
            
        confirm = messagebox.askyesno("Xác nhận", "Bạn có chắc chắn muốn nạp dữ liệu từ file Excel này vào hệ thống không?")
        if not confirm:
            return
            
        import_excel(filepath, username)
        
        # Tự động search lại để hiển thị dữ liệu vừa import nếu nó thuộc khoảng thời gian đang tra cứu
        self.on_search()

if __name__ == "__main__":
    app = App()
    app.mainloop()
