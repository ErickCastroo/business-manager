[CmdletBinding()]
param(
  [string]$ServerInstance = 'tcp:localhost,1433',
  [string]$DatabaseName = 'BusinessManager',
  [string]$LoginName = 'business_manager_app'
)

$ErrorActionPreference = 'Stop'

if ($DatabaseName -notmatch '^[A-Za-z][A-Za-z0-9_]{0,127}$') {
  throw 'DatabaseName contains unsupported characters.'
}

if ($LoginName -notmatch '^[A-Za-z][A-Za-z0-9_]{0,127}$') {
  throw 'LoginName contains unsupported characters.'
}

if ($ServerInstance -notmatch '^tcp:([A-Za-z0-9.-]+),([0-9]{1,5})$') {
  throw 'ServerInstance must use the format tcp:host,port.'
}

$databaseHost = $Matches[1]
$databasePort = [int]$Matches[2]

if ($databasePort -lt 1 -or $databasePort -gt 65535) {
  throw 'ServerInstance contains an invalid TCP port.'
}

$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$envPath = Join-Path $repositoryRoot '.env'

if (-not (Test-Path -LiteralPath $envPath)) {
  Copy-Item -LiteralPath (Join-Path $repositoryRoot '.env.example') -Destination $envPath
}

$envContents = Get-Content -LiteralPath $envPath -Raw
$existingPasswordPattern =
  '(?m)^DATABASE_URL="[^"\r\n]*user=' +
  [regex]::Escape($LoginName) +
  ';password=\{([^}\r\n]+)\}[^"\r\n]*"$'
$existingPasswordMatch = [regex]::Match($envContents, $existingPasswordPattern)

if (
  $existingPasswordMatch.Success -and
  $existingPasswordMatch.Groups[1].Value -ne 'CHANGE_ME'
) {
  $databasePassword = $existingPasswordMatch.Groups[1].Value
  $passwordWasGenerated = $false
} else {
  $randomBytes = [byte[]]::new(24)
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($randomBytes)
  $randomSuffix = [Convert]::ToBase64String($randomBytes).Replace('+', 'A').Replace('/', 'b')
  $databasePassword = "Bm1!$randomSuffix"
  $passwordWasGenerated = $true
}

$sqlPassword = $databasePassword.Replace("'", "''")

$query = @"
SET NOCOUNT ON;

IF DB_ID(N'$DatabaseName') IS NULL
BEGIN
  CREATE DATABASE [$DatabaseName];
END;

IF SUSER_ID(N'$LoginName') IS NULL
BEGIN
  CREATE LOGIN [$LoginName]
    WITH PASSWORD = N'$sqlPassword',
         CHECK_POLICY = ON,
         CHECK_EXPIRATION = OFF,
         DEFAULT_DATABASE = [$DatabaseName];
END
ELSE
BEGIN
  ALTER LOGIN [$LoginName] WITH PASSWORD = N'$sqlPassword';
  ALTER LOGIN [$LoginName] ENABLE;
  ALTER LOGIN [$LoginName] WITH DEFAULT_DATABASE = [$DatabaseName];
END;

USE [$DatabaseName];

IF USER_ID(N'$LoginName') IS NULL
BEGIN
  CREATE USER [$LoginName] FOR LOGIN [$LoginName];
END;

IF ISNULL(IS_ROLEMEMBER(N'db_owner', N'$LoginName'), 0) = 0
BEGIN
  ALTER ROLE [db_owner] ADD MEMBER [$LoginName];
END;
"@

$query | & sqlcmd -S $ServerInstance -E -l 8 -C -b

if ($LASTEXITCODE -ne 0) {
  throw "sqlcmd failed with exit code $LASTEXITCODE."
}

$databaseUrl =
  "sqlserver://${databaseHost}:$databasePort;database=$DatabaseName;schema=dbo;user=$LoginName;password={$databasePassword};encrypt=true;trustServerCertificate=true"
$databaseUrlLine = "DATABASE_URL=`"$databaseUrl`""

if ($envContents -match '(?m)^DATABASE_URL=.*$') {
  $updatedEnvContents = [regex]::Replace(
    $envContents,
    '(?m)^DATABASE_URL=.*$',
    $databaseUrlLine,
    1
  )
} else {
  $updatedEnvContents = "$envContents`r`n$databaseUrlLine`r`n"
}

Set-Content -LiteralPath $envPath -Value $updatedEnvContents -Encoding utf8 -NoNewline

[pscustomobject]@{
  Server = $ServerInstance
  Database = $DatabaseName
  Login = $LoginName
  PasswordGenerated = $passwordWasGenerated
  EnvironmentFile = $envPath
}
