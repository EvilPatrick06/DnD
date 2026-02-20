Write-Host "=== All processes with dnd in path ==="
Get-Process | Where-Object { $_.Path -like "*dnd*" } | Format-Table Id, ProcessName, Path -AutoSize

Write-Host "`n=== Processes in AppData\Local\dnd ==="
Get-Process | Where-Object { $_.Path -like "*dnd-vtt*" -or $_.Path -like "*dnd_vtt*" } | Format-Table Id, ProcessName, Path -AutoSize

Write-Host "`n=== Any installer/updater/setup processes ==="
Get-Process | Where-Object { $_.ProcessName -like "*setup*" -or $_.ProcessName -like "*install*" -or $_.ProcessName -like "*Update*" -or $_.ProcessName -like "*nsis*" -or $_.ProcessName -like "*elevate*" } | Format-Table Id, ProcessName, Path -AutoSize

Write-Host "`n=== Electron-builder related ==="
Get-Process | Where-Object { $_.ProcessName -like "*electron*" -or $_.ProcessName -like "*squirrel*" } | Format-Table Id, ProcessName, Path -AutoSize
