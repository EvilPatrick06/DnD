$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
# Try to find what's locking the folder
$folder = 'C:\Users\evilp\dnd\5e References'

# Check if any processes have files open in this directory
$handles = Get-Process | Where-Object {
    try {
        $_.Modules | Where-Object { $_.FileName -like "$folder*" }
    } catch { $null }
} | Select-Object -Property Id, ProcessName

if ($handles) {
    Write-Host "Processes with handles in folder:"
    $handles | Format-Table
} else {
    Write-Host "No process modules found in folder."
}

# Try alternative: move instead of rename
Write-Host "`nAttempting move..."
try {
    Move-Item -Path $folder -Destination 'C:\Users\evilp\dnd\5.5e References' -Force -ErrorAction Stop
    Write-Host "Move succeeded!"
} catch {
    Write-Host "Move failed: $_"
    Write-Host "`nTrying cmd.exe rename..."
    $result = cmd /c "rename `"$folder`" `"5.5e References`"" 2>&1
    Write-Host "cmd result: $result"
    if (Test-Path 'C:\Users\evilp\dnd\5.5e References') {
        Write-Host "cmd rename succeeded!"
    } else {
        Write-Host "cmd rename also failed."
    }
}
