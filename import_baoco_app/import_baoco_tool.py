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
        fd, temp_path = tempfile.mkstemp(suffix='.xlsx')
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
        self.title("Công cụ Import Báo Có (Tiền Gửi) VP2014")
        self.geometry("600x350")
        self.eval('tk::PlaceWindow . center')
        
        ttk.Label(self, text="IMPORT CHỨNG TỪ BÁO CÓ", font=("Arial", 16, "bold")).pack(pady=15)
        ttk.Label(self, text="File Excel phải chứa ít nhất 6 cột theo thứ tự:").pack()
        ttk.Label(self, text="1. Tên TK   2. Số TK   3. Nội dung   4. Số tiền   5. Ngày   6. Mã KH", foreground="blue").pack(pady=5)
        
        # Frame cho File Excel
        frame_file = tk.Frame(self)
        frame_file.pack(fill="x", padx=20, pady=10)
        
        tk.Label(frame_file, text="File Excel:").pack(side="left", padx=5)
        self.entry_file = tk.Entry(frame_file, width=50)
        self.entry_file.insert(0, r"C:\Users\Administrator\OneDrive\ELAN\Import\baoCo\baoCo.xlsx")
        self.entry_file.pack(side="left", padx=5)
        
        btn_browse = tk.Button(frame_file, text="Chọn...", command=self.on_browse)
        btn_browse.pack(side="left", padx=5)
        
        # Frame cho tuỳ chọn User
        frame_user = tk.Frame(self)
        frame_user.pack(fill="x", padx=20, pady=10)
        
        tk.Label(frame_user, text="Tài khoản nhập:").pack(side="left", padx=5)
        self.combo_user = ttk.Combobox(frame_user, values=["KTTH", "ADMIN", "KTCN3", "KTCN"], state="readonly", width=15)
        self.combo_user.current(0)
        self.combo_user.pack(side="left", padx=5)
        
        btn_import = tk.Button(self, text="Import Dữ Liệu", font=("Arial", 10, "bold"), bg="#4CAF50", fg="white", width=15, command=self.on_import)
        btn_import.pack(pady=20)
        
    def on_browse(self):
        filepath = filedialog.askopenfilename(title="Chọn file Excel", filetypes=[("Excel files", "*.xlsx *.xls")])
        if filepath:
            self.entry_file.delete(0, tk.END)
            self.entry_file.insert(0, filepath)
            
    def on_import(self):
        filepath = self.entry_file.get().strip()
        username = self.combo_user.get().strip()
        
        if not filepath:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn file Excel trước khi Import!")
            return
            
        import_excel(filepath, username)

if __name__ == "__main__":
    app = App()
    app.mainloop()
