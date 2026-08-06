@echo off
echo ==========================================
echo DANG CAI DAT MOI TRUONG PYTHON...
echo ==========================================
python -m venv venv
call venv\Scripts\activate
pip install pandas pyodbc openpyxl xlrd
echo ==========================================
echo CAI DAT HOAN TAT!
echo ==========================================
pause
