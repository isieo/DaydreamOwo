echo off

:: Paste your daydream id here, replace "scan" with your daydream id (if you don't have it, just run this bat file with "scan" as the daydream id)
set DAYDREAM_ID=scan
node.exe app.js %DAYDREAM_ID%
pause
