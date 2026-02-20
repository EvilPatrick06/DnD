$binPath = 'C:\Users\evilp\AppData\Local\Microsoft\WinGet\Packages\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\poppler-25.07.0\Library\bin'
$currentPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
if ($currentPath -notlike "*$binPath*") {
    [Environment]::SetEnvironmentVariable('PATH', "$currentPath;$binPath", 'User')
    Write-Host "Added to User PATH permanently: $binPath"
} else {
    Write-Host "Already on PATH"
}
