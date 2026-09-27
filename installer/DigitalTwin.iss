; Inno Setup script for the outer Windows installer.
; Compile after: scripts\fetch-ffmpeg.ps1, scripts\export-nodeodm.ps1, apps\desktop npm run dist
; Docker Desktop Installer.exe must be placed in installer\payload\

#define MyAppName "Digital Twin"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "Team ICARUS"

[Setup]
AppId={{9C2E4B1A-7D18-4F3A-9B51-A8C0DE4A11C0}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\DigitalTwin
DefaultGroupName={#MyAppName}
OutputDir=..\dist-installer
OutputBaseFilename=DigitalTwin-Setup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern

[Files]
Source: "..\apps\desktop\release\win-unpacked\*"; DestDir: "{app}"; Flags: recursesubdirs
Source: "..\third_party\ffmpeg.exe"; DestDir: "{app}\resources"; Flags: skipifsourcedoesntexist
Source: "..\third_party\nodeodm.tar"; DestDir: "{app}\third_party"; Flags: skipifsourcedoesntexist
Source: "payload\Docker Desktop Installer.exe"; DestDir: "{tmp}"; Flags: skipifsourcedoesntexist
Source: "..\scripts\provision-docker.ps1"; DestDir: "{app}\scripts"
Source: "..\scripts\detect-virtualization.ps1"; DestDir: "{app}\scripts"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\Digital Twin.exe"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\Digital Twin.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Desktop shortcut"; GroupDescription: "Shortcuts:"

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\provision-docker.ps1"" -InstallerExe ""{tmp}\Docker Desktop Installer.exe"" -NodeOdmTar ""{app}\third_party\nodeodm.tar"""; Flags: runhidden waituntilterminated
Filename: "{app}\Digital Twin.exe"; Description: "Launch Digital Twin"; Flags: nowait postinstall skipifsilent
