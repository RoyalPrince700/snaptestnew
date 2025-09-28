# Test Feedback Endpoint - Step 10 Implementation
# This script tests the feedback endpoint functionality

Write-Host "🚀 Testing Feedback Endpoint Implementation..." -ForegroundColor Cyan
Write-Host ""

# Check if we're in the backend directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Please run this script from the backend directory" -ForegroundColor Red
    Write-Host "   cd backend" -ForegroundColor Yellow
    Write-Host "   .\scripts\test_feedback_endpoint.ps1" -ForegroundColor Yellow
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "❌ Dependencies not installed. Please run:" -ForegroundColor Red
    Write-Host "   npm install" -ForegroundColor Yellow
    exit 1
}

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env file not found. Please create it with required variables." -ForegroundColor Red
    exit 1
}

Write-Host "📝 Running feedback endpoint test script..." -ForegroundColor Green
Write-Host ""

# Run the test script
try {
    node scripts/test_feedback_endpoint.js
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "✅ Feedback endpoint test completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 Step 10 Implementation Status:" -ForegroundColor Cyan
        Write-Host "  ✅ Feedback model created" -ForegroundColor Green
        Write-Host "  ✅ Feedback controller implemented" -ForegroundColor Green
        Write-Host "  ✅ Analytics aggregation working" -ForegroundColor Green
        Write-Host "  ✅ PowerShell test command generated" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎯 Next Steps:" -ForegroundColor Yellow
        Write-Host "  1. Start backend server: npm run dev" -ForegroundColor White
        Write-Host "  2. Use the generated PowerShell command to test HTTP endpoint" -ForegroundColor White
        Write-Host "  3. Verify response includes success:true and feedback counts" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "❌ Test failed with exit code: $exitCode" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error running test script: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
