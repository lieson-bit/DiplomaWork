# test-all-driver-apis-correct.ps1
Write-Host "🧪 DRIVER API TEST (CORRECT VALIDATION)" -ForegroundColor Magenta
Write-Host "=============================================" -ForegroundColor Magenta

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$testEmail = "valid_${timestamp}@test.com"
$testPassword = "Passdriver123"

# Track results
$testResults = @{}
$userId = $null
$accessToken = $null
$driverId = $null
$vehicleId = $null

# ==================== 1. REGISTER USER ====================
Write-Host "`n📝 1. Registering user..." -ForegroundColor Yellow

$registerData = @{
    email = $testEmail
    password = $testPassword
    firstName = "Valid"
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
    
    $accessToken = $registerResponse.tokens.accessToken
    $userId = $registerResponse.user.id
    
    $testResults["User Registration"] = $true
    Write-Host "✅ User: $userId" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Registration failed: $_" -ForegroundColor Red
    exit
}

# Headers
$headers = @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type" = "application/json"
}

# ==================== 2. CREATE DRIVER PROFILE ====================
Write-Host "`n🚗 2. Creating driver profile..." -ForegroundColor Yellow

$profileData = @{
    licenseNumber = "VALID-$timestamp"
    licenseExpiry = "2025-12-31"
    insuranceNumber = "VALIDINS-$timestamp"
    insuranceExpiry = "2025-12-31"
} | ConvertTo-Json

try {
    $driverProfile = Invoke-RestMethod `
        -Uri "http://localhost:3002/api/drivers/profile" `
        -Method Post `
        -Headers $headers `
        -Body $profileData
    
    $driverId = $driverProfile.data.id
    $testResults["Create Driver Profile"] = $true
    Write-Host "✅ Driver: $driverId" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Driver profile failed: $_" -ForegroundColor Red
}

# ==================== 3. ADD VEHICLE (WITH CORRECT VALIDATION) ====================
Write-Host "`n🚚 3. Adding vehicle (correct validation)..." -ForegroundColor Yellow

# Based on validation: type must be one of [motorbike, small_van, medium_truck, large_truck]
# licensePlate must be ≤ 20 characters
$vehicleData = @{
    type = "motorbike"  # CORRECT: must be one of these values
    make = "Honda"
    model = "CBR600RR"
    year = 2023
    color = "Red"
    licensePlate = "VLD$timestamp"  # CORRECT: 20 chars max (timestamp is 14 chars)
    maxWeight = 200
    maxVolume = 2
    insuranceInfo = "Comprehensive insurance"
} | ConvertTo-Json

try {
    Write-Host "   Sending vehicle data:" -ForegroundColor Gray
    Write-Host "   Type: motorbike (valid)" -ForegroundColor Gray
    Write-Host "   License Plate: VLD$timestamp (≤ 20 chars)" -ForegroundColor Gray
    
    $vehicleResponse = Invoke-RestMethod `
        -Uri "http://localhost:3002/api/drivers/vehicles" `
        -Method Post `
        -Headers $headers `
        -Body $vehicleData
    
    $vehicleId = $vehicleResponse.data.id
    $testResults["Add Vehicle"] = $true
    Write-Host "✅ Vehicle: $vehicleId" -ForegroundColor Green
    Write-Host "   License Plate: $($vehicleResponse.data.licensePlate)" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Add vehicle failed: $_" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Error: $($_.ErrorDetails.Message)" -ForegroundColor Gray
    }
}

# ==================== 4. GET VEHICLES ====================
Write-Host "`n📋 4. Getting vehicles..." -ForegroundColor Yellow

try {
    $vehicles = Invoke-RestMethod `
        -Uri "http://localhost:3002/api/drivers/vehicles" `
        -Method Get `
        -Headers $headers
    
    $testResults["Get Vehicles"] = $true
    Write-Host "✅ Vehicles: $($vehicles.data.Count)" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Get vehicles failed: $_" -ForegroundColor Red
}

# ==================== 5. UPDATE VEHICLE ====================
Write-Host "`n🔄 5. Updating vehicle..." -ForegroundColor Yellow

if ($vehicleId) {
    $updateVehicleData = @{
        color = "Blue"
        insuranceInfo = "Updated insurance"
    } | ConvertTo-Json
    
    try {
        $updated = Invoke-RestMethod `
            -Uri "http://localhost:3002/api/drivers/vehicles/$vehicleId" `
            -Method Put `
            -Headers $headers `
            -Body $updateVehicleData
        
        $testResults["Update Vehicle"] = $true
        Write-Host "✅ Vehicle updated" -ForegroundColor Green
        
    } catch {
        Write-Host "❌ Update vehicle failed: $_" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  Skipping (no vehicle ID)" -ForegroundColor Yellow
}

# ==================== 6. DELETE VEHICLE ====================
Write-Host "`n🗑️  6. Deleting vehicle..." -ForegroundColor Yellow

if ($vehicleId) {
    try {
        $deleted = Invoke-RestMethod `
            -Uri "http://localhost:3002/api/drivers/vehicles/$vehicleId" `
            -Method Delete `
            -Headers $headers
        
        $testResults["Delete Vehicle"] = $true
        Write-Host "✅ Vehicle deleted" -ForegroundColor Green
        
    } catch {
        Write-Host "❌ Delete vehicle failed: $_" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  Skipping (no vehicle ID)" -ForegroundColor Yellow
}

# ==================== 7. SET AVAILABILITY (CORRECT FORMAT) ====================
Write-Host "`n📅 7. Setting availability (correct format)..." -ForegroundColor Yellow

# From logs: dayOfWeek must be a number (0-6 where 0=Sunday, 1=Monday, etc.)
$availabilityData = @"
[
    {
        "dayOfWeek": 1,
        "startTime": "09:00",
        "endTime": "17:00",
        "isActive": true
    },
    {
        "dayOfWeek": 2,
        "startTime": "09:00",
        "endTime": "17:00",
        "isActive": true
    }
]
"@

try {
    Write-Host "   Sending availability:" -ForegroundColor Gray
    Write-Host "   dayOfWeek: 1 (Monday, as number)" -ForegroundColor Gray
    Write-Host "   dayOfWeek: 2 (Tuesday, as number)" -ForegroundColor Gray
    
    $availability = Invoke-RestMethod `
        -Uri "http://localhost:3002/api/drivers/availability" `
        -Method Put `
        -Headers $headers `
        -Body $availabilityData
    
    $testResults["Set Availability"] = $true
    Write-Host "✅ Availability set" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Set availability failed: $_" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Error: $($_.ErrorDetails.Message)" -ForegroundColor Gray
    }
}

# ==================== 8. GET AVAILABILITY ====================
Write-Host "`n📅 8. Getting availability..." -ForegroundColor Yellow

try {
    $getAvailability = Invoke-RestMethod `
        -Uri "http://localhost:3002/api/drivers/availability" `
        -Method Get `
        -Headers $headers
    
    $testResults["Get Availability"] = $true
    Write-Host "✅ Availability retrieved" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Get availability failed: $_" -ForegroundColor Red
}

# ==================== 9. UPDATE DRIVER STATUS ====================
Write-Host "`n📱 9. Updating driver status..." -ForegroundColor Yellow

$statusData = @{
    isOnline = $true
    location = "Test Location, City"
} | ConvertTo-Json

try {
    $status = Invoke-RestMethod `
        -Uri "http://localhost:3002/api/drivers/status" `
        -Method Patch `
        -Headers $headers `
        -Body $statusData
    
    $testResults["Update Status"] = $true
    Write-Host "✅ Status updated" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Update status failed: $_" -ForegroundColor Red
}

# ==================== 10. GET VERIFICATION STATUS ====================
Write-Host "`n✅ 10. Getting verification status..." -ForegroundColor Yellow

try {
    $verification = Invoke-RestMethod `
        -Uri "http://localhost:3002/api/drivers/verification-status" `
        -Method Get `
        -Headers $headers
    
    $testResults["Get Verification Status"] = $true
    Write-Host "✅ Verification: $($verification.data.canDrive)" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Get verification failed: $_" -ForegroundColor Red
}

# ==================== 11. RECORD METRICS ====================
Write-Host "`n📈 11. Recording metrics..." -ForegroundColor Yellow

$metricsData = @{
    deliveriesCount = 5
    successfulDeliveries = 4
    totalEarnings = 150.75
    averageRating = 4.5
    onlineHours = 8.5
    distanceTraveled = 120.3
} | ConvertTo-Json

try {
    $metrics = Invoke-RestMethod `
        -Uri "http://localhost:3002/api/drivers/metrics" `
        -Method Post `
        -Headers $headers `
        -Body $metricsData
    
    $testResults["Record Metrics"] = $true
    Write-Host "✅ Metrics recorded" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Record metrics failed: $_" -ForegroundColor Red
}

# ==================== 12. TEST OTHER ENDPOINTS ====================
Write-Host "`n🔧 12. Testing other endpoints..." -ForegroundColor Yellow

# Get driver profile
try {
    $profile = Invoke-RestMethod -Uri "http://localhost:3002/api/drivers/profile" -Method Get -Headers $headers
    $testResults["Get Driver Profile"] = $true
    Write-Host "✅ Get profile works" -ForegroundColor Green
} catch {
    Write-Host "❌ Get profile failed" -ForegroundColor Red
}

# Get documents
try {
    $docs = Invoke-RestMethod -Uri "http://localhost:3002/api/drivers/documents" -Method Get -Headers $headers
    $testResults["Get Documents"] = $true
    Write-Host "✅ Get documents works" -ForegroundColor Green
} catch {
    Write-Host "❌ Get documents failed" -ForegroundColor Red
}

# ==================== SUMMARY ====================
Write-Host "`n" + "="*70 -ForegroundColor Cyan
Write-Host "📊 FINAL RESULTS" -ForegroundColor Magenta
Write-Host "="*70 -ForegroundColor Cyan

$passed = ($testResults.GetEnumerator() | Where-Object { $_.Value -eq $true }).Count
$total = $testResults.Count

Write-Host "`n✅ PASSED: $passed/$total" -ForegroundColor Green
foreach ($test in $testResults.GetEnumerator() | Where-Object { $_.Value -eq $true } | Sort-Object Name) {
    Write-Host "   ✓ $($test.Key)" -ForegroundColor Green
}

Write-Host "`n❌ FAILED: $($total - $passed)/$total" -ForegroundColor Red
foreach ($test in $testResults.GetEnumerator() | Where-Object { $_.Value -eq $false } | Sort-Object Name) {
    Write-Host "   ✗ $($test.Key)" -ForegroundColor Red
}

Write-Host "`n🔗 TEST DATA:" -ForegroundColor Yellow
Write-Host "   Email: $testEmail" -ForegroundColor White
Write-Host "   Password: $testPassword" -ForegroundColor White
Write-Host "   User ID: $userId" -ForegroundColor White
Write-Host "   Driver ID: $driverId" -ForegroundColor White
Write-Host "   Vehicle ID: $vehicleId" -ForegroundColor White

Write-Host "`n" + "="*70 -ForegroundColor Cyan
Write-Host "🚀 TEST COMPLETE!" -ForegroundColor Magenta
Write-Host "="*70 -ForegroundColor Cyan