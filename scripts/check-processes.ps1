Write-Host "=== Electron processes ==="
Get-Process -Name "electron*" -ErrorAction SilentlyContinue | Format-Table Id, ProcessName, StartTime -AutoSize

Write-Host "=== Node processes ==="
Get-Process -Name "node*" -ErrorAction SilentlyContinue | Format-Table Id, ProcessName, StartTime -AutoSize

Write-Host "=== All processes with 'dnd' or 'electron' in path ==="
Get-Process | Where-Object { $_.Path -like "*dnd*" -or $_.ProcessName -like "*electron*" -or $_.ProcessName -like "*node*" } | Format-Table Id, ProcessName, Path -AutoSize
