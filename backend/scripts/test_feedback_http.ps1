# HTTP Test for Feedback Endpoint - Step 10
# Run this after starting the backend server with: npm run dev

Write-Host "🌐 Testing Feedback Endpoint via HTTP..." -ForegroundColor Cyan
Write-Host ""

# Check if server is running
try {
    $healthCheck = Invoke-RestMethod -Uri "http://localhost:5000/api/health" -Method Get -TimeoutSec 5
    Write-Host "✅ Backend server is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend server is not running. Please start it with:" -ForegroundColor Red
    Write-Host "   npm run dev" -ForegroundColor Yellow
    exit 1
}

# Test data from the previous test run (you may need to update these IDs)
Write-Host "📝 Using test data from previous run..." -ForegroundColor Yellow

# You can update these IDs from the test script output:
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGQ2OTBjNWM0MDA1MWRiNThhM2Y1NDIiLCJpYXQiOjE3NTg4OTIyMzMsImV4cCI6MTc1ODg5NTgzM30.7xI8FM1jWUYXPdrRA89WnlVfPf8gnctPv694ZzbCByY"
$conversationId = "68d690c9c40051db58a3f549"
$messageId = "68d690cac40051db58a3f54d"

Write-Host "🔍 Testing feedback submission via HTTP..." -ForegroundColor Green

# Test 1: Submit hallucination feedback
Write-Host ""
Write-Host "📝 Test 1: Submitting hallucination feedback..." -ForegroundColor Cyan
$body1 = @{
    conversationId = $conversationId
    messageId = $messageId
    kind = "hallucination"
    comment = "This claim seems unsupported by the source material."
} | ConvertTo-Json

try {
    $response1 = Invoke-RestMethod -Uri "http://localhost:5000/api/ai/feedback" -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body $body1
    Write-Host "✅ Hallucination feedback submitted successfully!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor White
    $response1 | ConvertTo-Json -Depth 5
} catch {
    Write-Host "❌ Failed to submit hallucination feedback: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Submit good feedback
Write-Host ""
Write-Host "📝 Test 2: Submitting good feedback..." -ForegroundColor Cyan
$body2 = @{
    conversationId = $conversationId
    messageId = $messageId
    kind = "good"
    comment = "Very helpful and accurate explanation!"
} | ConvertTo-Json

try {
    $response2 = Invoke-RestMethod -Uri "http://localhost:5000/api/ai/feedback" -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body $body2
    Write-Host "✅ Good feedback submitted successfully!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor White
    $response2 | ConvertTo-Json -Depth 5
} catch {
    Write-Host "❌ Failed to submit good feedback: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Submit bad feedback
Write-Host ""
Write-Host "📝 Test 3: Submitting bad feedback..." -ForegroundColor Cyan
$body3 = @{
    conversationId = $conversationId
    messageId = $messageId
    kind = "bad"
    comment = "Not what I was looking for."
} | ConvertTo-Json

try {
    $response3 = Invoke-RestMethod -Uri "http://localhost:5000/api/ai/feedback" -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body $body3
    Write-Host "✅ Bad feedback submitted successfully!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor White
    $response3 | ConvertTo-Json -Depth 5
} catch {
    Write-Host "❌ Failed to submit bad feedback: $($_.Exception.Message)" -ForegroundColor Red
}

# Test error cases
Write-Host ""
Write-Host "🔍 Testing error cases..." -ForegroundColor Yellow

# Test 4: Invalid kind
Write-Host ""
Write-Host "📝 Test 4: Testing invalid kind..." -ForegroundColor Cyan
$body4 = @{
    conversationId = $conversationId
    messageId = $messageId
    kind = "invalid"
    comment = "This should fail"
} | ConvertTo-Json

try {
    $response4 = Invoke-RestMethod -Uri "http://localhost:5000/api/ai/feedback" -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body $body4
    Write-Host "❌ Invalid kind test should have failed but didn't!" -ForegroundColor Red
} catch {
    Write-Host "✅ Invalid kind properly rejected: $($_.Exception.Message)" -ForegroundColor Green
}

# Test 5: Missing required fields
Write-Host ""
Write-Host "📝 Test 5: Testing missing required fields..." -ForegroundColor Cyan
$body5 = @{
    kind = "good"
    comment = "Missing conversationId and messageId"
} | ConvertTo-Json

try {
    $response5 = Invoke-RestMethod -Uri "http://localhost:5000/api/ai/feedback" -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body $body5
    Write-Host "❌ Missing fields test should have failed but didn't!" -ForegroundColor Red
} catch {
    Write-Host "✅ Missing fields properly rejected: $($_.Exception.Message)" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 HTTP Feedback Endpoint Testing Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Expected Results:" -ForegroundColor Cyan
Write-Host "  ✅ Successful submissions return: success:true, data._id, data.counts" -ForegroundColor White
Write-Host "  ✅ Invalid requests return appropriate error messages" -ForegroundColor White
Write-Host "  ✅ Feedback counts increment correctly for each message" -ForegroundColor White
Write-Host ""
Write-Host "🎯 Step 10 Implementation: COMPLETE!" -ForegroundColor Green
