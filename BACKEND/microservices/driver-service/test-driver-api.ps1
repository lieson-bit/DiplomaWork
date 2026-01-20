# test-driver-api.ps1
Write-Host "🚀 TESTING DRIVER SERVICE API" -ForegroundColor Magenta
Write-Host "===============================" -ForegroundColor Magenta

# Register a test user
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$email = "shared_test_${timestamp}@example.com"

Write-Host "`n1. Registering user: $email" -ForegroundColor Cyan
$registerData = @{
    email = $email
    password = "Passdriver123"
    firstName = "Shared"
    lastName = "Test"
    userType = "driver"
    phone = "+1234567890"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod `
        -Uri "http://localhost:3001/api/auth/register" `
        -Method Post `
        -Body $registerData `
        -ContentType "application/json"
    
    $token = $registerResponse.tokens.accessToken
    $userId = $registerResponse.user.id
    
    Write-Host "✅ User registered successfully" -ForegroundColor Green
    Write-Host "   User ID: $userId" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Registration failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test driver service
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$profileData = @{
    licenseNumber = "DLSHARED123"
    licenseExpiry = "2025-12-31"
    insuranceNumber = "INSSHARED123"
    insuranceExpiry = "2025-12-31"
} | ConvertTo-Json

Write-Host "`n2. Creating driver profile..." -ForegroundColor Cyan

try {
    $result = Invoke-RestMethod `
        -Uri "http://localhost:3002/api/drivers/profile" `
        -Method Post `
        -Headers $headers `
        -Body $profileData `
        -ErrorAction Stop
    
    Write-Host "🎉 SUCCESS! Driver profile created!" -ForegroundColor Green
    Write-Host "   Profile ID: $($result.data.id)" -ForegroundColor Cyan
    Write-Host "   Status: $($result.data.status)" -ForegroundColor Cyan
    
    # Test getting the profile
    Write-Host "`n3. Testing GET profile..." -ForegroundColor Cyan
    $getProfile = Invoke-RestMethod -Uri "http://localhost:3002/api/drivers/profile" -Method Get -Headers $headers
    Write-Host "✅ GET profile works!" -ForegroundColor Green
    
    # Test adding a vehicle
    Write-Host "`n4. Testing vehicle addition..." -ForegroundColor Cyan
    $vehicleData = @{
        type = "motorbike"
        make = "Honda"
        model = "CBR600RR"
        year = 2023
        color = "Red"
        licensePlate = "SHARED" + (Get-Random -Minimum 100 -Maximum 999)
        maxWeight = 200
        maxVolume = 2
        insuranceInfo = "Shared network test insurance"
    } | ConvertTo-Json
    
    $vehicleResult = Invoke-RestMethod `
        -Uri "http://localhost:3002/api/drivers/vehicles" `
        -Method Post `
        -Headers $headers `
        -Body $vehicleData
    
    Write-Host "✅ Vehicle added: $($vehicleResult.data.licensePlate)" -ForegroundColor Green
    
    Write-Host "`n🎊 ALL TESTS PASSED! Driver service is working correctly!" -ForegroundColor Magenta
    
} catch {
    Write-Host "❌ Test failed: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "   Error: $($errorDetails.error.message)" -ForegroundColor Gray
        
        # Check logs
        Write-Host "`n🔍 Checking driver service logs..." -ForegroundColor Yellow
        docker logs driver-service --tail 30
    }
}