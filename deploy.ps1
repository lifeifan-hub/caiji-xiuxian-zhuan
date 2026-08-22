param(
  [string]$Repo = "caiji-xiuxian-zhuan",
  [string]$Branch = "main"
)
$ErrorActionPreference = "Stop"

if (-not $env:GITHUB_TOKEN) {
  Write-Host "请先设置环境变量 GITHUB_TOKEN（需 repo 权限）。" -ForegroundColor Yellow
  exit 1
}

$Token = $env:GITHUB_TOKEN
$User = git config --global user.name
if (-not $User) { $User = (Invoke-RestMethod -Uri "https://api.github.com/user" -Headers @{ Authorization = "token $Token" }).login }
Write-Host "GitHub 用户: $User"

# 1) 创建仓库（若不存在）
$headers = @{ Authorization = "token $Token"; Accept = "application/vnd.github+json" }
try {
  Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method Post -Headers $headers -ContentType "application/json" -Body (@{ name = $Repo; private = $false; auto_init = $true; description = "菜鸡修仙传 · 文字MUD放置修仙" } | ConvertTo-Json) | Out-Null
  Write-Host "仓库已创建: $User/$Repo" -ForegroundColor Green
} catch {
  Write-Host "仓库已存在或创建跳过: $($_.Exception.Message)" -ForegroundColor DarkGray
}

# 2) 推送
git init -q
git remote remove origin 2>$null
git remote add origin "https://${User}:${Token}@github.com/${User}/${Repo}.git"
git add -A
git -c user.name="$User" -c user.email="codex@users.noreply.github.com" commit -q -m "菜鸡修仙传 v1" 2>$null
git branch -M $Branch
git -c http.extraheader="AUTHORIZATION: basic" push -qf --force --set-upstream origin $Branch
if ($LASTEXITCODE -ne 0) { Write-Host "推送失败，请检查 token 权限" -ForegroundColor Red; exit 1 }
Write-Host "代码已推送" -ForegroundColor Green

# 3) 开启 GitHub Pages
try {
  $site = Invoke-RestMethod -Uri "https://api.github.com/repos/${User}/${Repo}/pages" -Method Post -Headers $headers -ContentType "application/json" -Body (@{ source = @{ branch = $Branch; path = "/" } } | ConvertTo-Json) | Out-Null
  Write-Host "GitHub Pages 已开启" -ForegroundColor Green
} catch {
  Write-Host "Pages 可能已开启: $($_.Exception.Message)" -ForegroundColor DarkGray
}

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  游戏地址: https://${User}.github.io/${Repo}/" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
