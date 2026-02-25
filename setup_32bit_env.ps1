# setup_32bit_env.ps1
param([string]$python32Path)

Write-Host "Configuracion del Entorno de Compilacion de 32 bits para Depilarte" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

if (-not $python32Path) {
    Write-Host "Buscando instalaciones de Python de 32 bits comunes..." -ForegroundColor Yellow
    
    $commonPaths = @(
        "$env:LOCALAPPDATA\Programs\Python\Python38-32\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python39-32\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python310-32\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311-32\python.exe",
        "C:\Python38-32\python.exe",
        "C:\Program Files (x86)\Python38-32\python.exe"
    )

    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $is32 = & $path -c "import struct; print(struct.calcsize('P') * 8)"
            if ($is32 -eq "32") {
                Write-Host "Encontrado Python 32-bit en: $path" -ForegroundColor Green
                $python32Path = $path
                break
            }
        }
    }
}

if (-not $python32Path) {
    Write-Host "No se encontro automaticamente."
    Write-Host "Este script te ayudara a compilar la version de 32 bits."
    Write-Host "Primero, asegurate de haber instalado Python de 32 bits (desde python.org)."
    Write-Host ""
    $python32Path = Read-Host "Por favor, introduce la ruta completa al ejecutable de Python de 32 bits DESPUES DE INSTALARLO`n(ej: C:\Users\TuUsuario\AppData\Local\Programs\Python\Python38-32\python.exe)"
}

# Remove quotes if user added them
$python32Path = $python32Path -replace '"', ''

if (-not (Test-Path $python32Path)) {
    Write-Host "Error: No se encontro el archivo en: $python32Path" -ForegroundColor Red
    Write-Host "Asegurate de instalar Python 32-bit primero." -ForegroundColor Yellow
    Pause
    exit
}

# Verify it is actually 32-bit
try {
    $arch = & $python32Path -c "import struct; print(struct.calcsize('P') * 8)"
    if ($arch -eq "64") {
        Write-Host "Error: El Python seleccionado es de 64 bits. Necesitas una version de 32 bits." -ForegroundColor Red
        Pause
        exit
    }
    Write-Host "Verificado: Python es de 32 bits ($arch)." -ForegroundColor Green
}
catch {
    Write-Host "Error al verificar la arquitectura de Python: $_" -ForegroundColor Red
    Pause
    exit
}

# 2. Create Venv
$venvName = "venv_32bit"
if (Test-Path $venvName) {
    Write-Host "El entorno virtual '$venvName' ya existe. Usandolo." -ForegroundColor Yellow
}
else {
    Write-Host "Creando entorno virtual '$venvName'..."
    & $python32Path -m venv $venvName
}

$pipPath = ".\$venvName\Scripts\pip.exe"

if (-not (Test-Path $pipPath)) {
    Write-Host "Error: No se encontro pip en $pipPath. Algo fallo al crear el venv." -ForegroundColor Red
    Pause
    exit
}

# Upgrade pip first to avoid issues
Write-Host "Actualizando pip..."
& $python32Path -m pip install --upgrade pip

# 3. Create 32-bit specific requirements
Write-Host "Generando requirements para 32-bits (sin dependencias C++ si es posible)..."
# Read requirements, replace uvicorn[standard] with uvicorn to avoid httptools compilation issues on Windows 32-bit
# httptools often requires MSVC which might not be present. uvicorn pure python (h11) is fine.
$reqContent = Get-Content requirements_deploy.txt
$newReqContent = $reqContent -replace "uvicorn\[standard\]", "uvicorn"
$newReqContent | Set-Content requirements_32bit.txt
# Ensure websockets is there if needed (uvicorn[standard] had it)
Add-Content requirements_32bit.txt "websockets"
# Add Pillow for icon conversion
Add-Content requirements_32bit.txt "Pillow"

# 4. Install Requirements
Write-Host "Instalando dependencias desde requirements_32bit.txt..."
& $pipPath install -r requirements_32bit.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error instalando dependencias. Revisa los mensajes arriba." -ForegroundColor Red
    Pause
    exit
}

Write-Host "Instalando PyInstaller..."
& $pipPath install pyinstaller
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error instalando PyInstaller." -ForegroundColor Red
    Pause
    exit
}

# 5. Build
Write-Host "Iniciando compilacion con PyInstaller..."
$pyinstallerPath = ".\$venvName\Scripts\pyinstaller.exe"

# Clean previous build
Remove-Item -Path "build\depilarte" -Recurse -ErrorAction SilentlyContinue
Remove-Item -Path "dist\DepilarteSystem" -Recurse -ErrorAction SilentlyContinue

& $pyinstallerPath depilarte.spec --clean --noconfirm

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "COMPILACION EXITOSA!" -ForegroundColor Green
    Write-Host "El ejecutable de 32 bits esta en: dist\DepilarteSystem\DepilarteSystem.exe" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Cyan
}
else {
    Write-Host "Hubo un error durante la compilacion." -ForegroundColor Red
}

Pause
