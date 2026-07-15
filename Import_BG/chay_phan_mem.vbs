Set WshShell = CreateObject("WScript.Shell")
' Tham số 0 nghĩa là ẩn hoàn toàn cửa sổ dòng lệnh (no console window)
' Sử dụng pythonw.exe thay vì python.exe để chạy ẩn dưới nền (GUI mode)
WshShell.Run "venv\Scripts\pythonw.exe import_bang_gia_tool.py", 0, False
