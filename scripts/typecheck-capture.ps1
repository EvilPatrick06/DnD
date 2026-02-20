$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location C:\Users\evilp\dnd
npx tsc --build --pretty false 2>&1
Write-Host "EXIT_CODE: $LASTEXITCODE"
