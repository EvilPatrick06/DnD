$old = 'C:\Users\evilp\dnd\5e References'
$new = 'C:\Users\evilp\dnd\5.5e References'

if (Test-Path $old) {
    Write-Host "Found old folder: $old"
    try {
        Rename-Item -Path $old -NewName '5.5e References' -ErrorAction Stop
        Write-Host "Renamed successfully to: $new"
    } catch {
        Write-Host "ERROR: $_"
    }
} elseif (Test-Path $new) {
    Write-Host "Already renamed: $new exists"
} else {
    # List all directories to help debug
    Write-Host "Neither found. Listing directories:"
    Get-ChildItem -Path 'C:\Users\evilp\dnd' -Directory | ForEach-Object { Write-Host "  $($_.Name)" }
}
