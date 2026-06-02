@echo off
:: Kill any old servers on these ports first
taskkill /F /IM python.exe /FI "WINDOWTITLE eq http.server*" >nul 2>&1

echo.
echo  EthanExpert — starting server...
echo  Opening: http://localhost:8080/index.html
echo.
echo  Close this window to stop the server.
echo.

start "" "http://localhost:8080/index.html"

"C:\Users\swags\AppData\Local\Python\bin\python.exe" -m http.server 8080 --directory "C:\Users\swags\Documents\ethan_expert"

pause
