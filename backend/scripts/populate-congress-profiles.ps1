param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$populationBackend = Split-Path $PSScriptRoot -Parent
Push-Location $populationBackend
try {
    & .\mvnw.cmd -q -DskipTests compile dependency:build-classpath '-Dmdep.outputFile=target/population-classpath.txt'
    if ($LASTEXITCODE -ne 0) { throw 'Population command compilation failed.' }
    $populationClasspath = 'target/classes;' + (Get-Content -Raw -LiteralPath 'target/population-classpath.txt').Trim()
    $populationArgs = @()
    if ($Apply) { $populationArgs = @('--apply', '--development') }
    & java '-Xmx1536m' -cp $populationClasspath com.politikapp.backend.congress.CongressPopulationCommand @populationArgs
    if ($LASTEXITCODE -ne 0) { throw 'Population did not finish. Inspect reports; committed source batches are safe to resume.' }
} finally { Pop-Location }
