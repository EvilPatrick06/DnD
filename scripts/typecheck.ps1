$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location C:\Users\evilp\dnd
npx tsc --build 2>&1
exit $LASTEXITCODE
