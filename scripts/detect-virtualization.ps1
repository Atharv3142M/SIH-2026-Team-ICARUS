#requires -Version 5.1
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$virt = $cpu.VirtualizationFirmwareEnabled
$hyperv = (Get-CimInstance Win32_ComputerSystem).HypervisorPresent
[pscustomobject]@{
  VirtualizationFirmwareEnabled = [bool]$virt
  HypervisorPresent = [bool]$hyperv
} | ConvertTo-Json
if (-not $virt -and -not $hyperv) {
  Write-Host "Enable Intel VT-x / AMD-V in BIOS/UEFI, then reboot. Docker cannot do this for you."
  exit 2
}
