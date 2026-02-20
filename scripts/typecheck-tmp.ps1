$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location C:\Users\evilp\dnd
$output = npx tsc --build --force 2>&1
$output | Out-String | Set-Content -Path C:\Users\evilp\dnd\tsc-check.txt -Encoding utf8
if ($output) { Write-Host $output }
exit $LASTEXITCODE
