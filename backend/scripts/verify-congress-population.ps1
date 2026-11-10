param(
    [string]$BaseUrl = 'http://localhost:8080',
    [string]$ReportPath
)
$ErrorActionPreference = 'Stop'
$populationBackend = Split-Path $PSScriptRoot -Parent
if (!$ReportPath) {
    $ReportPath = Get-ChildItem -LiteralPath (Join-Path $populationBackend 'target/congress-population') -Filter '*-profile-result.json' |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (!$ReportPath) { throw 'No completed population report found.' }
$populationReport = Get-Content -Raw -LiteralPath $ReportPath | ConvertFrom-Json
$populationRows = @($populationReport.rows | Where-Object { $_.action -ne 'SKIP' })
$populationDirectory = Invoke-RestMethod -Uri "$BaseUrl/api/politicians" -TimeoutSec 90
$populationDirectory = @($populationDirectory)
$populationIds = [System.Collections.Generic.HashSet[string]]::new()
$populationDirectory | ForEach-Object { [void]$populationIds.Add([string]$_.politicianId) }
$populationMissing = @($populationRows | Where-Object { !$populationIds.Contains([string]$_.politicianId) })
if ($populationMissing.Count) { throw "$($populationMissing.Count) linked people are absent from the public API." }
$populationSamples = @($populationRows | Where-Object { $_.action -eq 'CREATE' } | Select-Object -First 3) +
    @($populationRows | Where-Object { $_.action -eq 'LINK_EXISTING' } | Select-Object -First 3)
if (!$populationSamples.Count) { $populationSamples = @($populationRows | Select-Object -First 6) }
$populationChecked = @()
foreach ($populationRow in $populationSamples) {
    $populationId = $populationRow.politicianId
    $populationProfile = Invoke-RestMethod -Uri "$BaseUrl/api/politicians/$populationId" -TimeoutSec 90
    $populationDashboard = Invoke-RestMethod -Uri "$BaseUrl/api/politicians/$populationId/dashboard" -TimeoutSec 90
    if ($populationProfile.politicianId -ne $populationId -or $populationDashboard.politicianId -ne $populationId) { throw 'Profile identity mismatch.' }
    if ($populationRow.action -eq 'CREATE' -and ($populationProfile.position -or $populationProfile.termStart -or $populationProfile.termEnd)) { throw 'Imported profile contains unverified current-office fields.' }
    $populationFirst = Invoke-RestMethod -Uri "$BaseUrl/api/politicians/$populationId/congress-records?offset=0&limit=5" -TimeoutSec 90
    if ($populationFirst.records.Count -gt 5) { throw 'Congress pagination limit was ignored.' }
    if ($populationFirst.total -gt 5) {
        $populationSecond = Invoke-RestMethod -Uri "$BaseUrl/api/politicians/$populationId/congress-records?offset=5&limit=5" -TimeoutSec 90
        if ($populationSecond.offset -ne 5) { throw 'Congress pagination offset was ignored.' }
        $populationFirstKeys = @($populationFirst.records | ForEach-Object { $_.key })
        if (@($populationSecond.records | Where-Object { $_.key -in $populationFirstKeys }).Count) { throw 'Congress pages overlap.' }
    }
    $populationChecked += [pscustomobject]@{
        politicianId = $populationId
        name = $populationProfile.fullName
        records = $populationFirst.total
        memberships = @($populationFirst.memberships).Count
        origin = $populationDashboard.profileOrigin
    }
}
$populationResult = [pscustomobject]@{
    directoryProfiles = $populationDirectory.Count
    expectedLinkedPeople = $populationRows.Count
    linkedPeoplePresent = $populationRows.Count - $populationMissing.Count
    missing = $populationMissing.Count
    samples = $populationChecked
}
$populationResult | ConvertTo-Json -Depth 6
$populationResult | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $populationBackend 'target/congress-population/api-verification.json') -Encoding utf8
