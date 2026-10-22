param(
  [Parameter(Mandatory=$true)][ValidateSet('Create','Verify')][string]$Mode,
  [Parameter(Mandatory=$true)][string]$ManifestPath
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Test-SafeArchivePath([string]$Value) {
  if ($Value -notmatch '^[A-Za-z0-9][A-Za-z0-9._/-]{0,499}$') { return $false }
  foreach ($part in $Value.Split('/')) {
    if (-not $part -or $part -eq '.' -or $part -eq '..' -or $part.EndsWith('.') -or $part -match '^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)') { return $false }
  }
  return $true
}

function Read-BoundedHash {
  param([IO.Stream]$InputStream, [long]$ExpectedBytes, [IO.Stream]$OutputStream = $null)
  $buffer = [byte[]]::new(81920)
  [long]$count = 0
  $hasher = [Security.Cryptography.SHA256]::Create()
  try {
    while ($true) {
      # Read at most one byte beyond the declared length to detect forged ZIP
      # sizes without inflating the rest of an untrusted entry.
      $requested = [int][Math]::Min($buffer.Length, $ExpectedBytes - $count + 1)
      $read = $InputStream.Read($buffer, 0, $requested)
      if ($read -eq 0) { break }
      $count += $read
      if ($count -gt $ExpectedBytes -or $count -gt 52428800) { throw 'Stream expanded bytes exceed declared entry size' }
      [void]$hasher.TransformBlock($buffer, 0, $read, $buffer, 0)
      if ($null -ne $OutputStream) { $OutputStream.Write($buffer, 0, $read) }
    }
    if ($count -ne $ExpectedBytes) { throw 'Stream expanded bytes differ from declared entry size' }
    [void]$hasher.TransformFinalBlock([byte[]]::new(0), 0, 0)
    return [pscustomobject]@{bytes=$count; hash=[BitConverter]::ToString($hasher.Hash).Replace('-','')}
  } finally { $hasher.Dispose() }
}

$manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
$entries = @($manifest.entries)
if ($entries.Count -lt 2 -or $entries.Count -gt 65) { throw 'Invalid archive entry count' }
$expected = @{}
[long]$total = 0
foreach ($item in $entries) {
  if (-not (Test-SafeArchivePath $item.path) -or $expected.ContainsKey($item.path)) { throw 'Unsafe or duplicate archive path' }
  if ($item.sha256 -notmatch '^[a-fA-F0-9]{64}$' -or $item.file_size -isnot [ValueType] -or $item.file_size -is [bool] -or $item.file_size -le 0 -or $item.file_size -gt 52428800 -or $item.file_size -ne [Math]::Floor([double]$item.file_size)) { throw 'Invalid archive entry metadata' }
  $total += $item.file_size
  $expected[$item.path] = $item
}
if ($total -gt 67108864) { throw 'Expanded archive exceeds preview limit' }
$archivePath = [IO.Path]::GetFullPath($manifest.file)
if ($Mode -eq 'Create') {
  # CreateNew never replaces a prepared package. Read only explicitly listed files.
  $stream = [IO.File]::Open($archivePath, [IO.FileMode]::CreateNew)
  try {
    $zip = New-Object IO.Compression.ZipArchive($stream, [IO.Compression.ZipArchiveMode]::Create, $true)
    try {
      foreach ($item in $entries) {
        $source = Get-Item -LiteralPath ([IO.Path]::GetFullPath($item.source))
        if ($source.PSIsContainer -or ($source.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $source.Length -ne $item.file_size) { throw 'Source file type or size does not match package manifest' }
        $inputStream = [IO.File]::Open($source.FullName, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
        try {
          if ($inputStream.Length -ne $item.file_size) { throw 'Source file size changed before reading' }
          $entry = $zip.CreateEntry($item.path, [IO.Compression.CompressionLevel]::Optimal)
          $entry.LastWriteTime = [DateTimeOffset]::new(2026,1,1,0,0,0,[TimeSpan]::Zero)
          $out = $entry.Open()
          try { $result = Read-BoundedHash -InputStream $inputStream -ExpectedBytes $item.file_size -OutputStream $out } finally { $out.Dispose() }
          if ($result.hash -ne $item.sha256) { throw 'Source bytes do not match package manifest' }
        } finally { $inputStream.Dispose() }
      }
    } finally { $zip.Dispose() }
  } finally { $stream.Dispose() }
}
$archiveInfo = Get-Item -LiteralPath $archivePath
if ($archiveInfo.PSIsContainer -or ($archiveInfo.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $archiveInfo.Length -gt 52428800) { throw 'ZIP file type or free preview upload size is invalid' }
$archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  if ($archive.Entries.Count -ne $entries.Count) { throw 'ZIP has missing or unexpected entries' }
  $seen = @{}
  [long]$actualTotal = 0
  foreach ($entry in $archive.Entries) {
    if (-not (Test-SafeArchivePath $entry.FullName) -or -not $expected.ContainsKey($entry.FullName) -or $seen.ContainsKey($entry.FullName)) { throw 'ZIP contains an unapproved or duplicate entry' }
    $item = $expected[$entry.FullName]
    if ($entry.Length -ne $item.file_size -or (($entry.ExternalAttributes -shr 16) -band 61440) -eq 40960) { throw 'ZIP entry size or file type is invalid' }
    $inputStream = $entry.Open()
    try { $result = Read-BoundedHash -InputStream $inputStream -ExpectedBytes $item.file_size } finally { $inputStream.Dispose() }
    if ($result.hash -ne $item.sha256) { throw 'ZIP entry checksum mismatch' }
    $actualTotal += $result.bytes
    if ($actualTotal -gt $total -or $actualTotal -gt 67108864) { throw 'ZIP actual expanded size exceeds preview limit' }
    $seen[$entry.FullName] = $true
  }
  if ($actualTotal -ne $total) { throw 'ZIP actual expanded size differs from manifest' }
} finally { $archive.Dispose() }
[pscustomobject]@{verified=$true; entries=$entries.Count; expanded_bytes=$actualTotal} | ConvertTo-Json -Compress
