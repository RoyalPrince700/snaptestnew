# PowerShell script to create MongoDB Atlas Vector Search indexes
# This script requires mongosh to be installed and MONGODB_URI environment variable to be set

Write-Host "Creating MongoDB Atlas Vector Search indexes..." -ForegroundColor Green

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

# Run the mongosh script
Write-Host "Executing vector index creation script..." -ForegroundColor Green
Write-Host "NOTE: If you see 'Attribute mappings missing' errors, this is expected." -ForegroundColor Yellow
Write-Host "Please use the MongoDB Atlas UI instead. See atlas_ui_instructions.md for details." -ForegroundColor Yellow

try {
    mongosh $mongodbUri --file "create_vector_indexes.js"
    Write-Host "Script execution completed!" -ForegroundColor Green
} catch {
    Write-Host "Error executing mongosh script: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "This is expected. Please use the Atlas UI instead." -ForegroundColor Yellow
}

Write-Host "`nNext Steps:" -ForegroundColor Green
Write-Host "1. Open MongoDB Atlas UI" -ForegroundColor White
Write-Host "2. Navigate to your cluster > Search > Create Index" -ForegroundColor White
Write-Host "3. Follow the instructions in atlas_ui_instructions.md" -ForegroundColor White
Write-Host "4. Create indexes for these collections:" -ForegroundColor Yellow
Write-Host "   - docchunks (docchunks_embedding)" -ForegroundColor White
Write-Host "   - messages (messages_embedding)" -ForegroundColor White
Write-Host "   - memories (memories_embedding)" -ForegroundColor White
Write-Host "`nAfter creating indexes via UI, run test_vector_search.ps1 to verify they work." -ForegroundColor Green
