#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Diagnose vector search issues in SnapTest
    
.DESCRIPTION
    This script runs diagnostics to identify why the AI might be responding with "I don't know".
    It checks vector indexes, document chunks, embeddings, and tests vector search functionality.
    
.EXAMPLE
    .\diagnose_vector_search.ps1
#>

Write-Host "🔧 Running SnapTest Vector Search Diagnostics..." -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "diagnose_vector_search.js")) {
    Write-Host "❌ Please run this script from the backend/scripts directory" -ForegroundColor Red
    Write-Host "   Current directory: $(Get-Location)" -ForegroundColor Yellow
    Write-Host "   Expected files: diagnose_vector_search.js" -ForegroundColor Yellow
    exit 1
}

# Check if Node.js is available
try {
    $nodeVersion = node --version 2>$null
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "   Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check if .env file exists
if (-not (Test-Path "../.env")) {
    Write-Host "❌ .env file not found in backend directory" -ForegroundColor Red
    Write-Host "   Please ensure MONGODB_URI is configured" -ForegroundColor Yellow
    exit 1
}

# Run the diagnostic script
Write-Host "🚀 Starting diagnostics..." -ForegroundColor Green
Write-Host ""

try {
    node diagnose_vector_search.js
    $exitCode = $LASTEXITCODE
    
    Write-Host ""
    if ($exitCode -eq 0) {
        Write-Host "✅ Diagnostics completed successfully" -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 Next Steps:" -ForegroundColor Cyan
        Write-Host "   1. If you see missing vector indexes, create them using Atlas UI" -ForegroundColor Yellow
        Write-Host "   2. See: backend/scripts/atlas_ui_instructions.md" -ForegroundColor Yellow
        Write-Host "   3. If embeddings are missing, re-upload your documents" -ForegroundColor Yellow
        Write-Host "   4. Test again by asking the AI about your uploaded document" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Diagnostics failed with exit code: $exitCode" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Failed to run diagnostics: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
