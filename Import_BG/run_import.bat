@echo off
echo ==============================================
echo Tool Import Bang Gia tu Excel vao SQL Server
echo ==============================================

if not exist "venv" (
    echo Dang khoi tao moi truong Python ao venv...
    python -m venv venv
)
call venv\Scripts\activate.bat
echo Dang kiem tra va cai dat thu vien...
pip install pandas pyodbc openpyxl xlrd >nul 2>&1

echo Dang khoi dong cong cu...
python import_bang_gia_tool.py
pause
