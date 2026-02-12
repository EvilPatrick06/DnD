$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location C:\Users\evilp\dnd
npx electron-builder --win 2>&1
