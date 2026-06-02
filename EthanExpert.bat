@echo off
echo.
echo  EthanExpert — Starting proxy and browser...
echo  ============================================
echo.
echo  Keep this window open while using EthanExpert.
echo  Close it to stop the proxy.
echo.

:: Open browser after short delay
start /b cmd /c "timeout /t 2 /nobreak >nul && start https://stwagstaff.github.io/ethan-expert/"

:: Start the proxy
"C:\Users\swags\AppData\Local\Python\bin\python.exe" "C:\Users\swags\Documents\ethan_expert\proxy.py"

pause
