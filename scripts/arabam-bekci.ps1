# OtoPiyasa Arabam Bekcisi - Gorev Zamanlayici kurulumu / kaldirma / durum
#   arabam-bekci-kur.bat     -> bilgisayar acilip oturum acilinca otomatik baslar
#   arabam-bekci-kaldir.bat  -> gorevi siler ve calisan bekciyi durdurur
#   arabam-bekci-durum.bat   -> calisiyor mu, son gunluk satirlari
# (Dosya bilerek ASCII: Windows PowerShell 5.1 Turkce karakterli BOM'suz dosyayi bozuyor.)
param([ValidateSet("kur", "kaldir", "durum")][string]$Islem = "durum")

$ErrorActionPreference = "Stop"
$TaskName = "OtoPiyasa Arabam Bekcisi"
$Root = Split-Path -Parent $PSScriptRoot
$Launcher = Join-Path $PSScriptRoot "arabam-bekci-gizli.vbs"
$LogFile = Join-Path $Root "logs\arabam-bekci.log"
$LockFile = Join-Path $Root "logs\arabam-bekci.lock"
$User = "$env:USERDOMAIN\$env:USERNAME"

function Get-WatcherPid {
    if (-not (Test-Path $LockFile)) { return $null }
    try { $p = (Get-Content $LockFile -Raw | ConvertFrom-Json).pid } catch { return $null }
    if ($p -and (Get-Process -Id $p -ErrorAction SilentlyContinue)) { return $p }
    return $null
}

function Stop-Watcher {
    $p = Get-WatcherPid
    if ($p) {
        & taskkill /PID $p /T /F | Out-Null
        Write-Host "Calisan bekci durduruldu (PID $p)."
    }
}

function Show-Status {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($task) {
        $info = Get-ScheduledTaskInfo -TaskName $TaskName
        Write-Host "Gorev    : kurulu ($($task.State)), son baslatma: $($info.LastRunTime)"
    } else {
        Write-Host "Gorev    : kurulu degil (arabam-bekci-kur.bat ile kur)"
    }
    $p = Get-WatcherPid
    if ($p) { Write-Host "Bekci    : calisiyor (PID $p)" } else { Write-Host "Bekci    : calismiyor" }
    if (Test-Path $LogFile) {
        Write-Host "Son gunluk satirlari ($LogFile):"
        Get-Content $LogFile -Tail 8 -Encoding UTF8 | ForEach-Object { Write-Host "  $_" }
    } else {
        Write-Host "Gunluk   : henuz yok"
    }
}

switch ($Islem) {
    "kur" {
        if (-not (Test-Path (Join-Path $Root "node_modules\mongoose"))) {
            throw "node_modules yok. Once proje klasorunde 'npm install' calistir."
        }
        if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
            throw "Node.js (npx) bulunamadi. Node.js kurulu olmali."
        }
        if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
            Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        }
        $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument ('"{0}"' -f $Launcher) -WorkingDirectory $Root
        $trigger = New-ScheduledTaskTrigger -AtLogOn -User $User
        $trigger.Delay = "PT1M"   # internetin gelmesi icin 1 dk bekle
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
            -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
        $principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
            -Principal $principal -Force -Description "Arabam ilanlarini ev internetinden ~8 sn arayla kontrol eder (OtoPiyasa)." | Out-Null
        Write-Host "Gorev kuruldu: her oturum acilisinda (1 dk sonra) kendiliginden baslar."
        # Calisan eski kopya varsa durdurulur; yeni kod ile yeniden baslar (kodu guncelleyince de ayni komut).
        Stop-Watcher
        Start-ScheduledTask -TaskName $TaskName
        Write-Host "Bekci simdi baslatildi."
        Write-Host ""
        Show-Status
    }
    "kaldir" {
        if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
            Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
            Write-Host "Gorev silindi."
        } else {
            Write-Host "Gorev zaten kurulu degil."
        }
        Stop-Watcher
    }
    "durum" { Show-Status }
}
