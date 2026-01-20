# test-local.ps1
Write-Host "🧪 Testing LOCAL driver service" -ForegroundColor Magenta

# Register user
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$email = "local_test_$timestamp@example.com"

$registerData = @{
    email = $email
    password = "Passdriver123"
    firstName = "Local"
    lastName = "Test"
    userType = "driver"
    phone = "+1234567890"
} | ConvertTo-Json

$registerResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/register" -Method Post -Body $registerData -ContentType "application/json"
$token = $registerResponse.tokens.accessToken

Write-Host "✅ Registered: $email" -ForegroundColor Green

# Test driver service
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$profileData = @{
    licenseNumber = "DLLOCAL123"
    licenseExpiry = "2025-12-31"
    insuranceNumber = "INSLOCAL123"
    insuranceExpiry = "2025-12-31"
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "http://localhost:3002/api/drivers/profile" -Method Post -Headers $headers -Body $profileData
    Write-Host "🎉 SUCCESS! Driver profile created" -ForegroundColor Green
    Write-Host "   ID: $($result.data.id)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Error: $($_.ErrorDetails.Message)" -ForegroundColor Gray
}
