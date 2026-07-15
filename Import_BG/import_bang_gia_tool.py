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

def search_bg(from_date_str, to_date_str):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        sql = "SELECT Stt, So_Ct, Ngay_Ct, Ma_Dt, Ma_Vm, UserName FROM dbo.BG WHERE Ngay_Ct >= ? AND Ngay_Ct <= ? ORDER BY Ngay_Ct DESC"
        cursor.execute(sql, (from_date_str, to_date_str))
        rows = cursor.fetchall()
        result = []
        for r in rows:
            ngay = r.Ngay_Ct.strftime('%d/%m/%Y') if r.Ngay_Ct else ""
            result.append((r.Stt, r.So_Ct, ngay, r.Ma_Dt or '', r.Ma_Vm or '', r.UserName or ''))
        return result
    finally:
        conn.close()

def import_excel_update(filepath, selected_stt_list):
    try:
        df = pd.read_excel(filepath)
        
        # Thích ứng nếu file có 7 cột chuẩn hoặc ít nhất 3 cột (Mã, Giá, CK)
        if len(df.columns) >= 7:
            df = df.iloc[:, [4, 5, 6]]
            df.columns = ['Ma_Vt', 'Gia', 'CK']
        elif len(df.columns) >= 3:
            df = df.iloc[:, :3]
            df.columns = ['Ma_Vt', 'Gia', 'CK']
        else:
            raise ValueError("File Excel cập nhật cần có ít nhất 3 cột (Mã Hàng, Giá, CK).")
            
        def clean_string(series):
            return series.apply(
                lambda x: '' if pd.isna(x) else (str(int(x)) if isinstance(x, float) and x.is_integer() else str(x))
            ).str.strip().str.upper().replace('NAN', '')
            
        df['Ma_Vt'] = clean_string(df['Ma_Vt'])
        df['Gia'] = pd.to_numeric(df['Gia'], errors='coerce')
        df['CK'] = pd.to_numeric(df['CK'], errors='coerce').fillna(0)
        
        # Validate
        cond_E_F = (df['Ma_Vt'] != '') & df['Gia'].notna()
        df = df[cond_E_F].copy()
        
        # Bỏ trùng lặp hàng hóa (lấy giá mới nhất cuối cùng)
        df = df.drop_duplicates(subset=['Ma_Vt'], keep='last')
        
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT TOP 1 Ma_DvCs FROM VTSYS.dbo.DmDvCs")
        row = cursor.fetchone()
        ma_dvcs = row[0].strip() if row else '01'
        
        success_details = 0
        try:
            for stt in selected_stt_list:
                for _, detail_row in df.iterrows():
                    cursor.execute(f"""
                        SET NOCOUNT ON;
                        DECLARE @p_Stt char(20) = '';
                        EXEC VTSYS.dbo.ST_Increase_KeyIndex @p_Ma_DvCs='{ma_dvcs}', @p_Stt=@p_Stt OUTPUT;
                        SELECT @p_Stt AS Stt;
                    """)
                    row0 = cursor.fetchone()
                    if not row0 or not row0.Stt:
                        raise Exception("Không thể tạo số thứ tự Stt0.")
                    stt0 = row0.Stt
                    
                    ma_vt = detail_row['Ma_Vt']
                    gia = detail_row['Gia']
                    ck = detail_row['CK']
                    
                    sql_d = """
                        INSERT INTO dbo.BG0 (Stt0, Stt, Ma_Vt, Dvt, Gia, CK)
                        VALUES (?, ?, ?, ISNULL((SELECT TOP 1 Dvt FROM VTSYS.dbo.DmVt WHERE Ma_Vt = ?), ''), ?, ?)
                    """
                    cursor.execute(sql_d, (stt0, stt, ma_vt, ma_vt, gia, ck))
                    success_details += 1
            conn.commit()
            messagebox.showinfo("Thành công", f"Cập nhật hoàn tất!\nĐã thêm {success_details} dòng chi tiết vào {len(selected_stt_list)} bảng giá.")
        except Exception as e:
            conn.rollback()
            messagebox.showerror("Lỗi Database", f"Có lỗi xảy ra:\n{str(e)}\n\nĐã thu hồi (rollback).")
        finally:
            conn.close()
    except Exception as e:
        messagebox.showerror("Lỗi Xử lý Excel", f"Lỗi: {str(e)}")

def import_excel_new(filepath):
    username = "ADMIN"
    try:
        df = pd.read_excel(filepath)
        
        if len(df.columns) < 7:
            raise ValueError("File Excel cần ít nhất 7 cột (Ngày, Số CT, Khách hàng, Khu vực, Mã Hàng, Giá, CK).")
            
        df.columns = ['Ngay_Ct', 'So_Ct', 'Ma_Dt', 'Ma_Vm', 'Ma_Vt', 'Gia', 'CK']
        
        total_rows = len(df)
        
        def clean_string(series):
            return series.apply(
                lambda x: '' if pd.isna(x) else (str(int(x)) if isinstance(x, float) and x.is_integer() else str(x))
            ).str.strip().str.upper().replace('NAN', '')
        
        df['So_Ct'] = clean_string(df['So_Ct'])
        df['Ma_Dt'] = clean_string(df['Ma_Dt'])
        df['Ma_Vm'] = clean_string(df['Ma_Vm'])
        df['Ma_Vt'] = clean_string(df['Ma_Vt'])
        
        df['Ngay_Ct'] = pd.to_datetime(df['Ngay_Ct'], errors='coerce')
        df['Gia'] = pd.to_numeric(df['Gia'], errors='coerce')
        df['CK'] = pd.to_numeric(df['CK'], errors='coerce').fillna(0)
        
        cond_A_B = df['Ngay_Ct'].notna() & (df['So_Ct'] != '')
        cond_C_D = (df['Ma_Dt'] != '') | (df['Ma_Vm'] != '')
        cond_E_F = (df['Ma_Vt'] != '') & df['Gia'].notna()
        
        df_valid = df[cond_A_B & cond_C_D & cond_E_F].copy()
        skipped_rows = total_rows - len(df_valid)
        df = df_valid
        
        df.loc[(df['Ma_Dt'] != '') & (df['Ma_Vm'] != ''), 'Ma_Vm'] = ''
        
        len_before_dedup = len(df)
        df = df.drop_duplicates(subset=['Ngay_Ct', 'So_Ct', 'Ma_Dt', 'Ma_Vm', 'Ma_Vt'], keep='last')
        duplicate_rows = len_before_dedup - len(df)
        
        groups = df.groupby(['Ngay_Ct', 'So_Ct', 'Ma_Dt', 'Ma_Vm'])
        
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT TOP 1 Ma_DvCs FROM VTSYS.dbo.DmDvCs")
        row = cursor.fetchone()
        ma_dvcs = row[0].strip() if row else '01'
        
        success_headers = 0
        success_details = 0
        
        try:
            for (ngay_ct, so_ct, ma_dt, ma_vm), group_df in groups:
                cursor.execute(f"""
                    SET NOCOUNT ON;
                    DECLARE @p_Stt char(20) = '';
                    EXEC VTSYS.dbo.ST_Increase_KeyIndex @p_Ma_DvCs='{ma_dvcs}', @p_Stt=@p_Stt OUTPUT;
                    SELECT @p_Stt AS Stt;
                """)
                row = cursor.fetchone()
                if not row or not row.Stt:
                    raise Exception("Không thể tạo số thứ tự Stt.")
                stt = row.Stt
                
                sql_h = f"""
                    INSERT INTO dbo.BG (Stt, Ma_DvCs, Ngay_Ct, So_Ct, Ma_Dt, Ma_Vm, Ma_Tte, Ty_Gia, Ngay_Ct1, Ngay_Ct2, UserName, Confirmed, Closed)
                    VALUES (?, '{ma_dvcs}', ?, ?, ?, ?, 'VND', 1, ?, NULL, ?, 1, '0')
                """
                ngay_str = ngay_ct.strftime('%Y%m%d')
                cursor.execute(sql_h, (stt, ngay_str, so_ct, ma_dt, ma_vm, ngay_str, username))
                success_headers += 1
                
                for _, detail_row in group_df.iterrows():
                    cursor.execute(f"""
                        SET NOCOUNT ON;
                        DECLARE @p_Stt char(20) = '';
                        EXEC VTSYS.dbo.ST_Increase_KeyIndex @p_Ma_DvCs='{ma_dvcs}', @p_Stt=@p_Stt OUTPUT;
                        SELECT @p_Stt AS Stt;
                    """)
                    row0 = cursor.fetchone()
                    if not row0 or not row0.Stt:
                        raise Exception("Không thể tạo số thứ tự Stt0.")
                    stt0 = row0.Stt
                    
                    ma_vt = detail_row['Ma_Vt']
                    gia = detail_row['Gia']
                    ck = detail_row['CK']
                    
                    sql_d = """
                        INSERT INTO dbo.BG0 (Stt0, Stt, Ma_Vt, Dvt, Gia, CK)
                        VALUES (?, ?, ?, ISNULL((SELECT TOP 1 Dvt FROM VTSYS.dbo.DmVt WHERE Ma_Vt = ?), ''), ?, ?)
                    """
                    cursor.execute(sql_d, (stt0, stt, ma_vt, ma_vt, gia, ck))
                    success_details += 1
                    
            conn.commit()
            msg = f"Import hoàn tất!\n\nSố bảng giá (Header): {success_headers}\nSố dòng chi tiết (Detail): {success_details}"
            if skipped_rows > 0:
                msg += f"\nSố dòng bỏ qua do thiếu dữ liệu: {skipped_rows}"
            if duplicate_rows > 0:
                msg += f"\nSố dòng bỏ qua do trùng lặp: {duplicate_rows}"
            messagebox.showinfo("Thành công", msg)
        except Exception as e:
            conn.rollback()
            messagebox.showerror("Lỗi Database", f"Có lỗi xảy ra trong quá trình ghi dữ liệu:\n{str(e)}\n\nĐã thu hồi (rollback) toàn bộ dữ liệu.")
        finally:
            conn.close()
            
    except Exception as e:
        messagebox.showerror("Lỗi Xử lý Excel", f"Lỗi: {str(e)}")

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Tool Import Bảng Giá Excel - VP2014")
        self.geometry("700x500")
        self.resizable(False, False)
        
        self.eval('tk::PlaceWindow . center')
        
        lbl_title = tk.Label(self, text="IMPORT & UPDATE BẢNG GIÁ EXCEL", font=("Arial", 14, "bold"), fg="blue")
        lbl_title.pack(pady=10)
        
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(expand=True, fill="both", padx=10, pady=10)
        
        self.tab_new = ttk.Frame(self.notebook)
        self.tab_update = ttk.Frame(self.notebook)
        
        self.notebook.add(self.tab_new, text="Tạo Bảng Giá Mới")
        self.notebook.add(self.tab_update, text="Cập Nhật Bảng Giá Cũ")
        
        self.setup_tab_new()
        self.setup_tab_update()

    def setup_tab_new(self):
        lbl_desc = tk.Label(self.tab_new, text="Tạo đợt Bảng giá mới từ Excel (Ghi cả thông tin đợt BG và Chi tiết mặt hàng)\nCột: Ngày | Số CT | Khách Hàng | Khu Vực | Mã Hàng | Giá | CK", justify="center")
        lbl_desc.pack(pady=25)
        
        frame_file = tk.Frame(self.tab_new)
        frame_file.pack(pady=20)
        
        tk.Label(frame_file, text="File Excel:").pack(side="left", padx=5)
        self.entry_file_new = tk.Entry(frame_file, width=45)
        self.entry_file_new.pack(side="left", padx=5)
        
        btn_browse = tk.Button(frame_file, text="Chọn...", command=self.on_browse_new)
        btn_browse.pack(side="left", padx=5)
        
        btn_import = tk.Button(frame_file, text="Import Mới", font=("Arial", 10, "bold"), bg="#4CAF50", fg="white", width=12, command=self.on_import_new)
        btn_import.pack(side="left", padx=5)

    def setup_tab_update(self):
        frame_search = tk.Frame(self.tab_update)
        frame_search.pack(fill="x", padx=10, pady=10)
        
        today = datetime.date.today()
        first_day = today.replace(day=1)
        
        tk.Label(frame_search, text="Từ ngày (DD/MM/YYYY):").pack(side="left")
        self.entry_from = tk.Entry(frame_search, width=12)
        self.entry_from.insert(0, first_day.strftime("%d/%m/%Y"))
        self.entry_from.pack(side="left", padx=5)
        
        tk.Label(frame_search, text="Đến ngày:").pack(side="left", padx=5)
        self.entry_to = tk.Entry(frame_search, width=12)
        self.entry_to.insert(0, today.strftime("%d/%m/%Y"))
        self.entry_to.pack(side="left", padx=5)
        
        btn_search = tk.Button(frame_search, text="Tìm Kiếm", command=self.on_search)
        btn_search.pack(side="left", padx=10)
        
        columns = ("Stt", "So_Ct", "Ngay_Ct", "Ma_Dt", "Ma_Vm", "UserName")
        self.tree = ttk.Treeview(self.tab_update, columns=columns, show="headings", selectmode="extended", height=10)
        self.tree.heading("Stt", text="Stt")
        self.tree.heading("So_Ct", text="Số CT")
        self.tree.heading("Ngay_Ct", text="Ngày lập")
        self.tree.heading("Ma_Dt", text="Mã KH")
        self.tree.heading("Ma_Vm", text="Mã Vùng")
        self.tree.heading("UserName", text="Người tạo")
        
        self.tree.column("Stt", width=0, stretch=tk.NO)
        self.tree.column("So_Ct", width=120)
        self.tree.column("Ngay_Ct", width=100)
        self.tree.column("Ma_Dt", width=100)
        self.tree.column("Ma_Vm", width=100)
        self.tree.column("UserName", width=100)
        
        self.tree.pack(fill="both", expand=True, padx=10, pady=5)
        
        frame_file = tk.Frame(self.tab_update)
        frame_file.pack(fill="x", padx=10, pady=10)
        
        tk.Label(frame_file, text="File Excel:").pack(side="left")
        self.entry_file_update = tk.Entry(frame_file, width=40)
        self.entry_file_update.pack(side="left", padx=5)
        
        btn_browse = tk.Button(frame_file, text="Chọn...", command=self.on_browse_update)
        btn_browse.pack(side="left", padx=5)
        
        btn_update = tk.Button(frame_file, text="Cập Nhật", font=("Arial", 10, "bold"), bg="#FF9800", fg="white", width=12, command=self.on_update)
        btn_update.pack(side="right", padx=5)

    def on_browse_new(self):
        filepath = filedialog.askopenfilename(title="Chọn file Excel", filetypes=[("Excel files", "*.xlsx *.xls")])
        if filepath:
            self.entry_file_new.delete(0, tk.END)
            self.entry_file_new.insert(0, filepath)
            
    def on_browse_update(self):
        filepath = filedialog.askopenfilename(title="Chọn file Excel", filetypes=[("Excel files", "*.xlsx *.xls")])
        if filepath:
            self.entry_file_update.delete(0, tk.END)
            self.entry_file_update.insert(0, filepath)

    def on_import_new(self):
        filepath = self.entry_file_new.get().strip()
        if not filepath:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn file Excel trước khi Import!")
            return
        import_excel_new(filepath)

    def on_search(self):
        from_d = self.entry_from.get().strip()
        to_d = self.entry_to.get().strip()
        
        try:
            from_date_sql = datetime.datetime.strptime(from_d, "%d/%m/%Y").strftime("%Y-%m-%d")
            to_date_sql = datetime.datetime.strptime(to_d, "%d/%m/%Y").strftime("%Y-%m-%d")
        except ValueError:
            messagebox.showwarning("Cảnh báo", "Ngày không hợp lệ. Vui lòng nhập định dạng DD/MM/YYYY")
            return
            
        for item in self.tree.get_children():
            self.tree.delete(item)
            
        try:
            results = search_bg(from_date_sql, to_date_sql)
            for r in results:
                self.tree.insert("", "end", values=r)
            if not results:
                messagebox.showinfo("Thông báo", "Không tìm thấy bảng giá nào trong khoảng thời gian này.")
        except Exception as e:
            messagebox.showerror("Lỗi", f"Lỗi tìm kiếm:\n{str(e)}")

    def on_update(self):
        selected_items = self.tree.selection()
        if not selected_items:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn ít nhất 1 bảng giá trên danh sách để cập nhật!")
            return
            
        filepath = self.entry_file_update.get().strip()
        if not filepath:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn file Excel chứa dữ liệu hàng hóa để cập nhật!")
            return
            
        stt_list = [self.tree.item(item, "values")[0] for item in selected_items]
        
        confirm = messagebox.askyesno("Xác nhận", f"Bạn chuẩn bị thêm hàng hóa từ file Excel vào {len(stt_list)} bảng giá đã chọn.\nTiếp tục?")
        if confirm:
            import_excel_update(filepath, stt_list)

if __name__ == "__main__":
    app = App()
    app.mainloop()
