@echo off
echo ==============================================
echo CAI DAT MOI TRUONG CHO PHAN MEM IMPORT BANG GIA
echo ==============================================

if not exist "venv" (
    echo [1/3] Dang khoi tao moi truong Python ao venv...
    python -m venv venv
) else (
    echo [1/3] Moi truong venv da ton tai.
)

echo [2/3] Kich hoat moi truong ao...
call venv\Scripts\activate.bat

echo [3/3] Dang cai dat/cap nhat thu vien (pandas, pyodbc, openpyxl, xlrd)...
pip install pandas pyodbc openpyxl xlrd

echo ==============================================
echo CAI DAT HOAN TAT CHUAN BI!
echo Bay gio ban co the click dup vao "chay_phan_mem.vbs" de mo giao dien (khong hien man hinh den).
echo ==============================================
pause
