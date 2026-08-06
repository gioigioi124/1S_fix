Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c call venv\Scripts\activate && python import_baoco_tool.py", 0, False
