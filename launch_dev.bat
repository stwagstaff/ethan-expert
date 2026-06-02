@echo off
echo Launching EthanExpert in Edge with CORS disabled for localhost testing...
echo.

:: Kill any existing Edge instances (optional - comment out if you want to keep existing tabs)
:: taskkill /F /IM msedge.exe >nul 2>&1

:: Launch Edge with web security disabled for local testing
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" ^
  --disable-web-security ^
  --user-data-dir="C:\Users\swags\AppData\Local\Temp\edge-ethan-dev" ^
  --allow-file-access-from-files ^
  --origin-to-force-quic-on=localhost:8080 ^
  "http://localhost:8080/index.html"

echo.
echo Edge launched in dev mode.
echo NOTE: This is only for local testing. Use GitHub Pages for sharing.
