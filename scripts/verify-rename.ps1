if (Test-Path 'C:\Users\evilp\dnd\5.5e References') { Write-Host "5.5e References: EXISTS" }
else { Write-Host "5.5e References: NOT FOUND" }

if (Test-Path 'C:\Users\evilp\dnd\5e References') { Write-Host "5e References: STILL EXISTS" }
else { Write-Host "5e References: GONE" }
