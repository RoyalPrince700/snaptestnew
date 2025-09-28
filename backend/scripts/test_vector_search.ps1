# PowerShell script to test MongoDB Atlas Vector Search indexes
# This script tests that the vector search indexes are working correctly

Write-Host "Testing MongoDB Atlas Vector Search indexes..." -ForegroundColor Green

# Check if mongosh is installed
try {
    $mongoshVersion = mongosh --version
    Write-Host "MongoDB Shell version: $mongoshVersion" -ForegroundColor Yellow
} catch {
    Write-Host "Error: mongosh is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install MongoDB Shell from: https://www.mongodb.com/try/download/shell" -ForegroundColor Yellow
    exit 1
}

# Load environment variables
if (Test-Path "../.env") {
    Get-Content "../.env" | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
    Write-Host "Environment variables loaded from .env file" -ForegroundColor Yellow
} else {
    Write-Host "Warning: .env file not found. Make sure MONGODB_URI is set in your environment." -ForegroundColor Yellow
}

# Change to scripts directory to ensure relative paths work
Set-Location $PSScriptRoot

# Get MongoDB connection string
$mongodbUri = $env:MONGODB_URI
if (-not $mongodbUri) {
    Write-Host "Error: MONGODB_URI environment variable is not set" -ForegroundColor Red
    Write-Host "Please set MONGODB_URI in your .env file or environment variables" -ForegroundColor Yellow
    exit 1
}

Write-Host "Using MongoDB URI: $($mongodbUri.Substring(0, 20))..." -ForegroundColor Yellow

# Run the test script
Write-Host "Executing vector search test script..." -ForegroundColor Green
try {
    mongosh $mongodbUri --file "test_vector_search.js"
    Write-Host "Vector search test completed successfully!" -ForegroundColor Green
} catch {
    Write-Host "Error executing test script: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
