[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$envExamplePath = Join-Path $repositoryRoot '.env.example'
$envPath = Join-Path $repositoryRoot '.env'

if (-not (Test-Path -LiteralPath $envPath)) {
  Copy-Item -LiteralPath $envExamplePath -Destination $envPath
}

$envContents = Get-Content -LiteralPath $envPath -Raw
$secretMatch = [regex]::Match($envContents, '(?m)^JWT_ACCESS_SECRET=(.*)$')
$existingSecret = if ($secretMatch.Success) {
  $secretMatch.Groups[1].Value.Trim().Trim('"')
} else {
  ''
}
$secretIsSecure =
  $existingSecret.Length -ge 32 -and $existingSecret -notmatch '(?i)change[-_ ]?me'

if ($secretIsSecure) {
  $secretWasGenerated = $false
} else {
  $randomBytes = [byte[]]::new(48)
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($randomBytes)
  $jwtSecret = [Convert]::ToBase64String($randomBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
  $secretLine = "JWT_ACCESS_SECRET=$jwtSecret"

  if ($secretMatch.Success) {
    $envContents = [regex]::Replace(
      $envContents,
      '(?m)^JWT_ACCESS_SECRET=.*$',
      $secretLine,
      1
    )
  } else {
    $envContents = "$envContents`r`n$secretLine`r`n"
  }

  Set-Content -LiteralPath $envPath -Value $envContents -Encoding utf8 -NoNewline
  $secretWasGenerated = $true
}

[pscustomobject]@{
  EnvironmentFile = $envPath
  JwtSecretGenerated = $secretWasGenerated
}
