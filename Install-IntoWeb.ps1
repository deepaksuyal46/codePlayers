param([Parameter(Mandatory=$true)][string]$TargetWeb)
$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'frontend'
if (!(Test-Path (Join-Path $source 'package.json'))) { throw 'Extract the ZIP before running the installer.' }
if (!(Test-Path $TargetWeb)) { throw 'Target web folder does not exist. Pass the full path to your existing web folder.' }
$target = (Resolve-Path $TargetWeb).Path
if (!(Test-Path (Join-Path $target 'package.json'))) { throw 'Target must be the Next.js web folder containing package.json, not the outer Git repository.' }
if ($target -eq (Resolve-Path $source).Path) { throw 'Choose your existing web folder, not the extracted project source.' }
$package = Get-Content (Join-Path $target 'package.json') -Raw | ConvertFrom-Json
if (!$package.dependencies.next -and !$package.devDependencies.next) { throw 'Target package.json does not appear to contain Next.js.' }
$backup = Join-Path $env:USERPROFILE ('CodePlayers-Backups\web-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
# Move old source/config to a recoverable backup to prevent stale routes/config conflicts.
# Credentials, Git history/remotes, and unrelated outer repository files are never touched.
$owned = @('src','app','pages','public','scripts','tests','workers','data','docs','package.json','package-lock.json','pnpm-lock.yaml','yarn.lock','bun.lock','bun.lockb','tsconfig.json','next-env.d.ts','next.config.js','next.config.mjs','next.config.ts','postcss.config.js','postcss.config.mjs','postcss.config.cjs','tailwind.config.js','tailwind.config.ts','eslint.config.mjs','eslint.config.js','.eslintrc.json','middleware.ts','middleware.js','proxy.ts','proxy.js','instrumentation.ts','instrumentation-client.ts','README.md')
foreach ($name in $owned) {
 $item=Join-Path $target $name
 if(Test-Path $item){ Move-Item -LiteralPath $item -Destination (Join-Path $backup $name) }
}
Get-ChildItem -LiteralPath $source -Force | Where-Object { $_.Name -ne '.gitignore' } | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force }
$ignore=Join-Path $target '.gitignore'
$required=@('node_modules/','.next/','.env*','!.env.example','*.tsbuildinfo')
$existing=if(Test-Path $ignore){@(Get-Content $ignore)}else{@()}
foreach($line in $required){if($existing -notcontains $line){Add-Content -LiteralPath $ignore -Value $line}}
if(!(Test-Path (Join-Path $target '.env.local'))){Copy-Item (Join-Path $target '.env.example') (Join-Path $target '.env.local')}
if(Test-Path (Join-Path $target '.next')){Remove-Item -LiteralPath (Join-Path $target '.next') -Recurse -Force}
Write-Host ''
Write-Host 'Project files installed. Existing .env.local and Git configuration were preserved.'
Write-Host "Backup of previous source/config: $backup"
Write-Host "Next: cd `"$target`""
Write-Host 'Then: npm ci; npm run db:check; npm run seed; npm run dev'
Write-Host 'In a second terminal in the same folder: npm run worker'
Write-Host 'Ensure .env.local has MONGODB_URI and APP_ORIGIN=http://localhost:3000.'
