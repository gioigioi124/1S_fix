import tkinter as tk
from tkinter import filedialog, messagebox
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

def import_excel(filepath):
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
        
        # Validate data
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
        
        # Get actual Ma_DvCs
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
                    VALUES (?, '{ma_dvcs}', ?, ?, ?, ?, 'VND', 1, ?, NULL, 'ADMIN', 1, '0')
                """
                ngay_str = ngay_ct.strftime('%Y%m%d')
                cursor.execute(sql_h, (stt, ngay_str, so_ct, ma_dt, ma_vm, ngay_str))
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
        self.geometry("500x250")
        self.resizable(False, False)
        
        self.eval('tk::PlaceWindow . center')
        
        lbl_title = tk.Label(self, text="IMPORT BẢNG GIÁ EXCEL VÀO PHẦN MỀM 1S", font=("Arial", 14, "bold"), fg="blue")
        lbl_title.pack(pady=20)
        
        lbl_desc = tk.Label(self, text="Đọc và Import dữ liệu bằng Python + Pandas\nCột: Ngày | Số CT | Khách Hàng | Khu Vực | Mã Hàng | Giá | CK", justify="center")
        lbl_desc.pack(pady=5)
        
        btn_import = tk.Button(self, text="Chọn File Excel & Import", font=("Arial", 12), bg="#4CAF50", fg="white", width=25, height=2, command=self.on_import)
        btn_import.pack(pady=20)
        
        # lbl_footer = tk.Label(self, text="An toàn tuyệt đối - Tránh lỗi Firehose của VFP", font=("Arial", 8), fg="gray")
        # lbl_footer.pack(side="bottom", pady=10)

    def on_import(self):
        filepath = filedialog.askopenfilename(
            title="Chọn file Bảng Giá Excel",
            filetypes=[("Excel files", "*.xlsx *.xls")]
        )
        if not filepath:
            return
            
        import_excel(filepath)

if __name__ == "__main__":
    app = App()
    app.mainloop()
