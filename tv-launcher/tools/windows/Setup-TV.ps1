# TV Home setup for Windows. Double-click "Setup TV.bat" (same folder) to run this.
# Works on Windows PowerShell 5.1. Nothing here deletes anything from the TV; ad apps are only switched off.
# Continue: adb prints harmless warnings on stderr, which 'Stop' would turn into fatal errors in PowerShell 5.1.
$ErrorActionPreference = 'Continue'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Pkg = 'com.gary.tvhome'
Set-Location $Here

function Say($t, $c = 'Gray') { Write-Host $t -ForegroundColor $c }
function Title($t) { Write-Host ''; Write-Host "== $t ==" -ForegroundColor Cyan }

# ---------- adb (downloads Google's platform-tools on first run) ----------
function Get-Adb {
  $cmd = Get-Command adb -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $local = Join-Path $Here 'platform-tools\adb.exe'
  if (Test-Path $local) { return $local }
  Title 'First run: downloading Android platform-tools (about 7 MB)'
  $zip = Join-Path $Here 'platform-tools.zip'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip' -OutFile $zip -UseBasicParsing -ErrorAction Stop
  Expand-Archive $zip -DestinationPath $Here -Force
  Remove-Item $zip
  return $local
}
$Adb = Get-Adb

function Tv { param([Parameter(ValueFromRemainingArguments = $true)] $a) & $Adb -s $script:Serial @a 2>&1 }
function TvSh { param([Parameter(ValueFromRemainingArguments = $true)] $a) (& $Adb -s $script:Serial shell @a 2>&1 | Out-String).Trim() }

# ---------- connect ----------
$ipFile = Join-Path $Here 'tv-ip.txt'
$saved = '192.168.2.19'
if (Test-Path $ipFile) { $saved = (Get-Content $ipFile -Raw).Trim() }
Title 'Connect to the TV'
Say 'TV: Settings > System > About > press Build 7 times; then Developer options > USB debugging ON.'
Say 'TV IP address: Settings > Network & Internet > your Wi-Fi.'
$prompt = 'TV IP address'
if ($saved) { $prompt = "TV IP address [Enter = $saved]" }
$ip = Read-Host $prompt
if (-not $ip) { $ip = $saved }
if (-not $ip) { Say 'No IP entered.' 'Red'; exit 1 }
Set-Content $ipFile $ip
if ($ip -notmatch ':') { $script:Serial = "${ip}:5555" } else { $script:Serial = $ip }

for ($i = 0; $i -lt 3; $i++) {
  & $Adb connect $script:Serial | Out-Host
  $state = (& $Adb -s $script:Serial get-state 2>&1 | Out-String).Trim()
  if ($state -eq 'device') { break }
  Say 'Look at the TV: choose "Always allow from this computer" and OK. Waiting 10 seconds...' 'Yellow'
  Start-Sleep 10
}
if ($state -ne 'device') { Say "Could not connect ($state). Check the IP and that USB debugging is on." 'Red'; exit 1 }
Say ("Connected: " + (TvSh getprop ro.product.manufacturer) + ' ' + (TvSh getprop ro.product.model) + ', Android ' + (TvSh getprop ro.build.version.release)) 'Green'

# ---------- package lists (same as tools/debloat.sh) ----------
$Keep = @('com.android.providers.tv','com.google.android.gms','com.google.android.gsf','com.android.vending','com.google.android.tvlauncher.setup',
  'com.google.android.tv.remote.service','com.android.tv.settings','com.google.android.katniss','com.google.android.inputmethod.latin',
  'com.google.android.leanbackime','com.android.systemui','com.google.android.tungsten.setupwraith','com.droidlogic.tvinput')
$Safe = @('com.google.android.tvrecommendations','com.google.android.leanbacklauncher.recommendations','com.google.android.apps.tv.dreamx',
  'com.google.android.backdrop','com.google.android.play.games','com.google.android.videos','com.google.android.apps.mediashell.ads','com.android.dreams.basic',
  'com.tcl.tvweishi','com.tcl.esticker','com.tcl.gallery','com.tcl.ui_mediaCenter','com.tcl.partnercustomizer','com.tcl.guard',
  'com.hisense.tv.vidaa.ads','com.jamdeo.tv.vod','com.sony.dtv.promos','com.sony.dtv.sonyselect','com.sony.dtv.recommendation',
  'com.mitv.tvhome.atv','com.xiaomi.mitv.upgrade','com.netflix.partner.activation')
$Stock = @('com.google.android.apps.tv.launcherx','com.google.android.leanbacklauncher','com.google.android.tvlauncher')
$Streaming = @('com.netflix.ninja','com.google.android.youtube.tv','com.disney.disneyplus','com.amazon.amazonvideo.livingroom',
  'com.amazon.avod.thirdpartyclient','com.cbs.ott','com.cbs.app','com.paramount.plus')

function Installed { (TvSh pm list packages) -split "`n" | ForEach-Object { $_.Trim() -replace '^package:', '' } }

function Show-Info {
  Title 'TV information (send this to Claude)'
  'Brand:    ' + (TvSh getprop ro.product.manufacturer) | Out-Host
  'Model:    ' + (TvSh getprop ro.product.model) | Out-Host
  'Device:   ' + (TvSh getprop ro.product.device) | Out-Host
  'Android:  ' + (TvSh getprop ro.build.version.release) + ' (SDK ' + (TvSh getprop ro.build.version.sdk) + ')' | Out-Host
  'Home app: ' + (TvSh cmd package resolve-activity --brief -c android.intent.category.HOME -a android.intent.action.MAIN) | Out-Host
  $pk = Installed
  Say 'Streaming apps found:'
  foreach ($p in $Streaming) { if ($pk -contains $p) { "   $p" | Out-Host } }
  Say 'HDMI-CEC devices (the soundbar usually shows up here by name):'
  $cec = TvSh dumpsys hdmi_control
  ($cec -split "`n") | Where-Object { $_ -match 'DeviceInfo|osdName|Audio|Vendor' } | Select-Object -First 15 | ForEach-Object { "   " + $_.Trim() } | Out-Host
  $out = Join-Path $Here ('tv-info-' + (Get-Date -Format 'yyyyMMdd') + '.txt')
  ("Brand " + (TvSh getprop ro.product.manufacturer)), ("Model " + (TvSh getprop ro.product.model)), ("Android " + (TvSh getprop ro.build.version.release)), "", $cec | Set-Content $out
  ($pk -join "`n") | Add-Content $out
  Say "Saved everything to $out" 'Green'
}

function Find-Apk {
  $apk = Get-ChildItem -Path $Here, (Split-Path $Here -Parent), "$env:USERPROFILE\Downloads" -Filter '*.apk' -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match 'tv-home|app-debug' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($apk) { return $apk.FullName }
  $p = Read-Host 'Drag the tv-home-debug.apk file into this window and press Enter'
  return $p.Trim('"', ' ')
}

function Install-App {
  Title 'Installing TV Home'
  $apk = Find-Apk
  if (-not (Test-Path $apk)) { Say "APK not found: $apk" 'Red'; return }
  Say "Using $apk"
  Tv install -r $apk | Out-Host
  TvSh pm grant $Pkg android.permission.READ_TV_LISTINGS | Out-Null
  TvSh appops set $Pkg GET_USAGE_STATS allow | Out-Null
  Say 'Permissions: continue watching + watch-time stats granted' 'Green'
  $r = TvSh cmd package set-home-activity "$Pkg/.HomeActivity"
  if ($r -match 'Success') { Say 'TV Home is now the home screen' 'Green' } else { Say 'Press HOME on the remote and choose TV Home > Always' 'Yellow' }
  TvSh settings put secure screensaver_components "$Pkg/.dream.TvHomeDream" | Out-Null
  TvSh settings put secure screensaver_enabled 1 | Out-Null
  Say 'Screensaver set to the Washi scene' 'Green'
  TvSh am start -n "$Pkg/.HomeActivity" | Out-Null
  Say 'Done. Press HOME on the remote.' 'Green'
}

function Debloat([bool]$withStock) {
  Title 'Remove ads and junk (switches apps off, nothing is deleted)'
  $pk = Installed
  $targets = @($Safe | Where-Object { $pk -contains $_ })
  if ($withStock) {
    $homeApp = TvSh cmd package resolve-activity --brief -c android.intent.category.HOME -a android.intent.action.MAIN
    if ($homeApp -notmatch $Pkg) { Say 'Install TV Home and press HOME once before switching off the stock home screen.' 'Red'; return }
    $targets += @($Stock | Where-Object { $pk -contains $_ })
  }
  $targets = @($targets | Where-Object { $Keep -notcontains $_ })
  if ($targets.Count -eq 0) { Say 'Nothing on the list is installed on this TV. Use option 5 and send Claude the file.' 'Yellow'; return }
  $targets | ForEach-Object { "   $_" } | Out-Host
  if ((Read-Host "Switch these $($targets.Count) off? (y/n)") -ne 'y') { return }
  $undo = Join-Path $Here 'undo-list.txt'
  foreach ($p in $targets) {
    $r = TvSh pm disable-user --user 0 $p
    if ($r -match 'disabled') { Say "   off  $p" 'Green'; Add-Content $undo $p } else { Say "   skip $p ($r)" 'Yellow' }
  }
  Say 'Done. Option 7 switches them all back on.' 'Green'
}

function Undo-Debloat {
  $undo = Join-Path $Here 'undo-list.txt'
  if (-not (Test-Path $undo)) { Say 'Nothing to undo.'; return }
  Get-Content $undo | Sort-Object -Unique | ForEach-Object { TvSh pm enable $_ | Out-Null; Say "   on   $_" 'Green' }
  Remove-Item $undo
}

function Soundbar {
  Title 'Soundbar turns on with the TV (Samsung HW-J355)'
  Say 'This soundbar has no HDMI or Wi-Fi. It wakes itself in one of two ways, depending on the cable:'
  Say ''
  Say 'A) OPTICAL cable (thin cable, red light in the plug) - Auto Power Link:' 'Cyan'
  Say '   1. Soundbar remote: press SOURCE until the display says D.IN.'
  Say '   2. Press AUTO POWER (or hold LEFT on the round pad for 5 s) until it says ON-POWER LINK.'
  Say '   3. TV: Settings > Display & Sound > Audio output: choose Optical/SPDIF, format PCM (Hisense menu names vary a little).'
  Say '   Test: soundbar off, TV off, wait 10 s, TV on. The soundbar should wake within a few seconds.'
  Say ''
  Say 'B) BLUETOOTH - Bluetooth Power On:' 'Cyan'
  Say '   1. Soundbar on, press the BT POWER button on the soundbar remote until it says ON-BLUETOOTH POWER.'
  Say '   2. TV: Settings > Remotes & Accessories > pair "[Samsung] Soundbar J-Series" if not already paired.'
  Say '   The TV reconnects when it wakes, and that wakes the soundbar. The TV remote then controls volume too.'
  Say ''
  Say 'Current audio devices the TV can see:'
  ((TvSh dumpsys audio) -split "`n" | Where-Object { $_ -match 'Devices:|spdif|bt_a2dp|BLUETOOTH_A2DP|SPDIF|hdmi' } | Select-Object -First 8) | ForEach-Object { '   ' + $_.Trim() } | Out-Host
}

function Push-Config {
  $cfg = Join-Path (Split-Path $Here -Parent) 'config.json'
  if (-not (Test-Path $cfg)) { $cfg = Join-Path $Here 'config.json' }
  if (-not (Test-Path $cfg)) {
    Copy-Item (Join-Path (Split-Path $Here -Parent) 'config.example.json') (Join-Path $Here 'config.json')
    Say "Created config.json here. Open it in Notepad, fill it in, then run this option again." 'Yellow'; return
  }
  $json = Get-Content $cfg -Raw | ConvertFrom-Json | ConvertTo-Json -Depth 20 -Compress
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
  TvSh am broadcast -a com.gary.tvhome.SETUP -n "$Pkg/.setup.SetupReceiver" --es b64 $b64 | Out-Host
  Say 'Sent. The home screen reloads with your settings.' 'Green'
}

function Restore-Google {
  Title 'Go back to the original home screen'
  foreach ($p in $Stock) { TvSh pm enable $p | Out-Null }
  if ((Read-Host 'Also uninstall TV Home? (y/n)') -eq 'y') { Tv uninstall $Pkg | Out-Host }
  Say 'Press HOME and pick the Google home screen.' 'Green'
}

while ($true) {
  Title 'TV Home setup'
  Say '  1  Install TV Home (app, permissions, home screen, screensaver)'
  Say '  2  Remove ads and junk apps'
  Say '  3  Also switch off the old Google home screen (only after TV Home works)'
  Say '  4  Soundbar: steps so it turns on with the TV'
  Say '  5  Show TV info (model, apps, soundbar name) and save it to a file'
  Say '  6  Send my settings (config.json)'
  Say '  7  Undo: switch the removed apps back on'
  Say '  8  Go back to the original home screen'
  Say '  Q  Quit'
  switch ((Read-Host 'Choose').ToUpper()) {
    '1' { Install-App } '2' { Debloat $false } '3' { Debloat $true } '4' { Soundbar } '5' { Show-Info }
    '6' { Push-Config } '7' { Undo-Debloat } '8' { Restore-Google } 'Q' { exit 0 } default { Say 'Pick 1-8 or Q' }
  }
}
