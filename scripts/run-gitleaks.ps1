[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$image = "zricethezav/gitleaks@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f"
$repositoryRoot = (& git rev-parse --show-toplevel 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or -not $repositoryRoot) { throw "Unable to resolve the current Git worktree." }
$commonDirectory = (& git -C $repositoryRoot rev-parse --path-format=absolute --git-common-dir 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or -not $commonDirectory) { throw "Unable to resolve the common Git directory." }
$primaryRepository = Split-Path -Parent $commonDirectory
$configuration = Join-Path $repositoryRoot ".gitleaks.toml"
if (-not (Test-Path -LiteralPath $configuration -PathType Leaf)) { throw "Missing .gitleaks.toml in the current worktree." }

$countText = (& git -C $repositoryRoot rev-list --all --count 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or $countText -notmatch "^[1-9][0-9]*$") {
  throw "Complete-history scan requires at least one reachable commit; found '$countText'."
}

& docker run --rm `
  --volume "${repositoryRoot}:/repo:ro" `
  --workdir /repo `
  $image dir --config .gitleaks.toml --no-banner --redact .
if ($LASTEXITCODE -ne 0) { throw "Gitleaks current-source scan failed or found a secret." }

# A linked Windows worktree stores an absolute host path in its .git pointer.
# Scan shared history from the primary repository and mount this worktree's
# reviewed configuration independently, so Docker never trusts that pointer.
& docker run --rm `
  --volume "${primaryRepository}:/repo:ro" `
  --volume "${configuration}:/config/.gitleaks.toml:ro" `
  --workdir /repo `
  $image git --config /config/.gitleaks.toml --no-banner --redact --log-opts=--all .
if ($LASTEXITCODE -ne 0) { throw "Gitleaks complete-history scan failed or found a secret." }

Write-Host "Gitleaks passed for current source and $countText reachable commit(s)."
