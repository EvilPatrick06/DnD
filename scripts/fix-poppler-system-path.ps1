$binPath = 'C:\Users\evilp\AppData\Local\Microsoft\WinGet\Packages\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\poppler-25.07.0\Library\bin'
$currentPath = [Environment]::GetEnvironmentVariable('PATH', 'Machine')
if ($currentPath -notlike "*$binPath*") {
    [Environment]::SetEnvironmentVariable('PATH', "$currentPath;$binPath", 'Machine')
    Write-Host "SUCCESS: Added Poppler to System PATH: $binPath" -ForegroundColor Green
} else {
    Write-Host "Already on System PATH" -ForegroundColor Yellow
}
Write-Host "Press any key to close..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
