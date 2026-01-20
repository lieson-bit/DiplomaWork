# test-customer-service-api.ps1
Write-Host "🧪 CUSTOMER SERVICE API TEST" -ForegroundColor Magenta
Write-Host "=================================================" -ForegroundColor Magenta

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$testEmail = "customer_${timestamp}@test.com"
$testPassword = "Passcust123"

# Track results
$testResults = @{}
$userId = $null
$accessToken = $null
$customerId = $null
$addressId = $null
$paymentMethodId = $null

# ==================== 1. REGISTER USER ====================
Write-Host "`n📝 1. Registering customer user..." -ForegroundColor Yellow

$registerData = @{
    email = $testEmail
    password = $testPassword
    firstName = "Customer"
    lastName = "User"
    userType = "customer"
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
    Write-Host "✅ Customer User: $userId" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Registration failed: $_" -ForegroundColor Red
    exit
}

# Headers for authenticated requests
$headers = @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type" = "application/json"
}

# ==================== 2. CREATE CUSTOMER PROFILE ====================
Write-Host "`n👤 2. Creating customer profile..." -ForegroundColor Yellow

$profileData = @{
    userId = $userId
    accountType = "personal"
    dateOfBirth = "1990-01-01"
} | ConvertTo-Json

try {
    $customerProfile = Invoke-RestMethod `
        -Uri "http://localhost:3003/api/customers/profile" `
        -Method Post `
        -Headers $headers `
        -Body $profileData
    
    $customerId = $customerProfile.data.id
    $testResults["Create Customer Profile"] = $true
    Write-Host "✅ Customer Profile: $customerId" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Customer profile creation failed: $_" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Error: $($_.ErrorDetails.Message)" -ForegroundColor Gray
    }
}

# ==================== 3. GET CUSTOMER PROFILE ====================
Write-Host "`n👤 3. Getting customer profile..." -ForegroundColor Yellow

try {
    $profile = Invoke-RestMethod `
        -Uri "http://localhost:3003/api/customers/profile" `
        -Method Get `
        -Headers $headers
    
    $testResults["Get Customer Profile"] = $true
    Write-Host "✅ Profile retrieved successfully" -ForegroundColor Green
    Write-Host "   Account Type: $($profile.data.accountType)" -ForegroundColor Gray
    Write-Host "   Join Date: $($profile.data.joinDate)" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Get profile failed: $_" -ForegroundColor Red
}

# ==================== 4. ADD ADDRESS ====================
Write-Host "`n🏠 4. Adding customer address..." -ForegroundColor Yellow

$addressData = @{
    label = "Home"
    address = "123 Main Street"
    city = "New York"
    state = "NY"
    country = "US"
    postalCode = "10001"
    latitude = 40.7128
    longitude = -74.0060
    isDefault = $true
    notes = "Main entrance"
} | ConvertTo-Json

try {
    Write-Host "   Adding address with correct validation:" -ForegroundColor Gray
    
    $addressResponse = Invoke-RestMethod `
        -Uri "http://localhost:3003/api/customers/addresses" `
        -Method Post `
        -Headers $headers `
        -Body $addressData
    
    $addressId = $addressResponse.data.id
    $testResults["Add Address"] = $true
    Write-Host "✅ Address: $addressId" -ForegroundColor Green
    Write-Host "   Label: $($addressResponse.data.label)" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Add address failed: $_" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Error: $($_.ErrorDetails.Message)" -ForegroundColor Gray
    }
}

# ==================== 5. ADD SECOND ADDRESS (NON-DEFAULT) ====================
Write-Host "`n🏢 5. Adding second address (work)..." -ForegroundColor Yellow

$workAddressData = @{
    label = "Work"
    address = "456 Office Ave"
    city = "New York"
    state = "NY"
    country = "US"
    postalCode = "10002"
    isDefault = $false
    notes = "Reception desk"
} | ConvertTo-Json

try {
    $workAddress = Invoke-RestMethod `
        -Uri "http://localhost:3003/api/customers/addresses" `
        -Method Post `
        -Headers $headers `
        -Body $workAddressData
    
    $testResults["Add Work Address"] = $true
    Write-Host "✅ Work address added" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Add work address failed: $_" -ForegroundColor Red
}

# ==================== 6. UPDATE ADDRESS ====================
Write-Host "`n🔄 6. Updating address..." -ForegroundColor Yellow

if ($addressId) {
    $updateAddressData = @{
        label = "Home Updated"
        notes = "Updated notes"
    } | ConvertTo-Json
    
    try {
        $updatedAddress = Invoke-RestMethod `
            -Uri "http://localhost:3003/api/customers/addresses/$addressId" `
            -Method Put `
            -Headers $headers `
            -Body $updateAddressData
        
        $testResults["Update Address"] = $true
        Write-Host "✅ Address updated" -ForegroundColor Green
        
    } catch {
        Write-Host "❌ Update address failed: $_" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  Skipping (no address ID)" -ForegroundColor Yellow
}

# ==================== 7. ADD PAYMENT METHOD ====================
Write-Host "`n💳 7. Adding payment method..." -ForegroundColor Yellow

$paymentData = @{
    type = "card"
    provider = "visa"
    last4 = "4242"
    expiryMonth = 12
    expiryYear = 2025
    nameOnCard = "Customer User"
    isDefault = $true
} | ConvertTo-Json

try {
    $paymentResponse = Invoke-RestMethod `
        -Uri "http://localhost:3003/api/customers/payment-methods" `
        -Method Post `
        -Headers $headers `
        -Body $paymentData
    
    $paymentMethodId = $paymentResponse.data.id
    $testResults["Add Payment Method"] = $true
    Write-Host "✅ Payment Method: $paymentMethodId" -ForegroundColor Green
    Write-Host "   Last 4: $($paymentResponse.data.last4)" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Add payment method failed: $_" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Error: $($_.ErrorDetails.Message)" -ForegroundColor Gray
    }
}

# ==================== 8. UPDATE PAYMENT METHOD ====================
Write-Host "`n💳 8. Updating payment method..." -ForegroundColor Yellow

if ($paymentMethodId) {
    $updatePaymentData = @{
        isDefault = $false
        expiryMonth = 11
    } | ConvertTo-Json
    
    try {
        $updatedPayment = Invoke-RestMethod `
            -Uri "http://localhost:3003/api/customers/payment-methods/$paymentMethodId" `
            -Method Put `
            -Headers $headers `
            -Body $updatePaymentData
        
        $testResults["Update Payment Method"] = $true
        Write-Host "✅ Payment method updated" -ForegroundColor Green
        
    } catch {
        Write-Host "❌ Update payment method failed: $_" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  Skipping (no payment method ID)" -ForegroundColor Yellow
}

# ==================== 9. UPDATE PREFERENCES ====================
Write-Host "`n⚙️  9. Updating customer preferences..." -ForegroundColor Yellow

$preferencesData = @{
    defaultPickupType = "home"
    notificationEmail = $true
    notificationSMS = $false
    notificationPush = $true
    language = "en"
    timezone = "America/New_York"
} | ConvertTo-Json

try {
    $preferences = Invoke-RestMethod `
        -Uri "http://localhost:3003/api/customers/preferences" `
        -Method Put `
        -Headers $headers `
        -Body $preferencesData
    
    $testResults["Update Preferences"] = $true
    Write-Host "✅ Preferences updated" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Update preferences failed: $_" -ForegroundColor Red
}

# ==================== 10. SET DELIVERY TIME SLOTS ====================
Write-Host "`n⏰ 10. Setting delivery time slots..." -ForegroundColor Yellow

$timeSlotsData = @"
[
    {
        "dayOfWeek": 1,
        "startTime": "09:00",
        "endTime": "17:00",
        "isActive": true
    },
    {
        "dayOfWeek": 3,
        "startTime": "10:00",
        "endTime": "14:00",
        "isActive": true
    }
]
"@

try {
    $timeSlots = Invoke-RestMethod `
        -Uri "http://localhost:3003/api/customers/time-slots" `
        -Method Put `
        -Headers $headers `
        -Body $timeSlotsData
    
    $testResults["Set Time Slots"] = $true
    Write-Host "✅ Time slots set" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Set time slots failed: $_" -ForegroundColor Red
}

# ==================== 11. SUBMIT FEEDBACK ====================
Write-Host "`n📝 11. Submitting feedback..." -ForegroundColor Yellow

$feedbackData = @{
    rating = 5
    comment = "Great service! Very responsive and professional."
    category = "delivery"
} | ConvertTo-Json

try {
    $feedback = Invoke-RestMethod `
        -Uri "http://localhost:3003/api/customers/feedback" `
        -Method Post `
        -Headers $headers `
        -Body $feedbackData
    
    $testResults["Submit Feedback"] = $true
    Write-Host "✅ Feedback submitted" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Submit feedback failed: $_" -ForegroundColor Red
}

# ==================== 12. UPDATE ORDER STATS ====================
Write-Host "`n📈 12. Updating order stats..." -ForegroundColor Yellow

$orderStatsData = @{
    orderAmount = 150.75
} | ConvertTo-Json

try {
    $orderStats = Invoke-RestMethod `
        -Uri "http://localhost:3003/api/customers/order-stats" `
        -Method Post `
        -Headers $headers `
        -Body $orderStatsData
    
    $testResults["Update Order Stats"] = $true
    Write-Host "✅ Order stats updated" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Update order stats failed: $_" -ForegroundColor Red
}

# ==================== 13. GET CUSTOMER STATS ====================
Write-Host "`n📊 13. Getting customer stats..." -ForegroundColor Yellow

try {
    $stats = Invoke-RestMethod `
        -Uri "http://localhost:3003/api/customers/stats" `
        -Method Get `
        -Headers $headers
    
    $testResults["Get Customer Stats"] = $true
    Write-Host "✅ Stats retrieved" -ForegroundColor Green
    Write-Host "   Total Orders: $($stats.data.totalOrders)" -ForegroundColor Gray
    Write-Host "   Total Spent: $($stats.data.totalSpent)" -ForegroundColor Gray
    Write-Host "   Loyalty Points: $($stats.data.loyaltyPoints)" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Get stats failed: $_" -ForegroundColor Red
}

# ==================== 14. DELETE PAYMENT METHOD ====================
Write-Host "`n🗑️  14. Deleting payment method..." -ForegroundColor Yellow

if ($paymentMethodId) {
    try {
        $deleted = Invoke-RestMethod `
            -Uri "http://localhost:3003/api/customers/payment-methods/$paymentMethodId" `
            -Method Delete `
            -Headers $headers
        
        $testResults["Delete Payment Method"] = $true
        Write-Host "✅ Payment method deleted" -ForegroundColor Green
        
    } catch {
        Write-Host "❌ Delete payment method failed: $_" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            $errorMsg = $_.ErrorDetails.Message | ConvertFrom-Json
            if ($errorMsg.message -like "*only payment method*") {
                Write-Host "   Note: Skipping delete as it's the only payment method" -ForegroundColor Yellow
            }
        }
    }
} else {
    Write-Host "⚠️  Skipping (no payment method ID)" -ForegroundColor Yellow
}

# ==================== 15. DELETE ADDRESS ====================
Write-Host "`n🗑️  15. Deleting address..." -ForegroundColor Yellow

if ($addressId) {
    try {
        $deleted = Invoke-RestMethod `
            -Uri "http://localhost:3003/api/customers/addresses/$addressId" `
            -Method Delete `
            -Headers $headers
        
        $testResults["Delete Address"] = $true
        Write-Host "✅ Address deleted" -ForegroundColor Green
        
    } catch {
        Write-Host "❌ Delete address failed: $_" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            $errorMsg = $_.ErrorDetails.Message | ConvertFrom-Json
            if ($errorMsg.message -like "*only address*") {
                Write-Host "   Note: Skipping delete as it's the only address" -ForegroundColor Yellow
            }
        }
    }
} else {
    Write-Host "⚠️  Skipping (no address ID)" -ForegroundColor Yellow
}

# ==================== 16. UPDATE PROFILE (ADD BUSINESS INFO) ====================
Write-Host "`n🏢 16. Updating to business account..." -ForegroundColor Yellow

$updateProfileData = @{
    accountType = "business"
    businessName = "Test Business Inc."
    businessType = "Retail"
    businessPhone = "+1234567890"
    taxId = "TAX-12345-$timestamp"
} | ConvertTo-Json

try {
    $updatedProfile = Invoke-RestMethod `
        -Uri "http://localhost:3003/api/customers/profile" `
        -Method Put `
        -Headers $headers `
        -Body $updateProfileData
    
    $testResults["Update Profile to Business"] = $true
    Write-Host "✅ Profile updated to business" -ForegroundColor Green
    Write-Host "   Business: $($updatedProfile.data.businessName)" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Update profile failed: $_" -ForegroundColor Red
}

# ==================== 17. TEST SEARCH ENDPOINT (PUBLIC) ====================
Write-Host "`n🔍 17. Testing search endpoint..." -ForegroundColor Yellow

try {
    $search = Invoke-RestMethod `
        -Uri "http://localhost:3003/api/customers/search" `
        -Method Get `
        -ContentType "application/json"
    
    $testResults["Test Search"] = $true
    Write-Host "✅ Search endpoint accessible" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Search test failed: $_" -ForegroundColor Red
}

# ==================== 18. CHECK HEALTH ENDPOINT ====================
Write-Host "`n❤️  18. Checking health endpoint..." -ForegroundColor Yellow

try {
    $health = Invoke-RestMethod `
        -Uri "http://localhost:3003/health" `
        -Method Get
    
    $testResults["Health Check"] = $true
    Write-Host "✅ Health: $($health.status)" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Health check failed: $_" -ForegroundColor Red
}

# ==================== SUMMARY ====================
Write-Host "`n" + "="*70 -ForegroundColor Cyan
Write-Host "📊 FINAL CUSTOMER SERVICE RESULTS" -ForegroundColor Magenta
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
Write-Host "   Customer ID: $customerId" -ForegroundColor White
Write-Host "   Address ID: $addressId" -ForegroundColor White
Write-Host "   Payment Method ID: $paymentMethodId" -ForegroundColor White

Write-Host "`n" + "="*70 -ForegroundColor Cyan
Write-Host "🚀 CUSTOMER SERVICE TEST COMPLETE!" -ForegroundColor Magenta
Write-Host "="*70 -ForegroundColor Cyan

Write-Host "`n📋 NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Check database for created data:" -ForegroundColor White
Write-Host "   mysql -h localhost -P 3309 -u customer_user -p customer_service_db" -ForegroundColor Gray
Write-Host "2. Verify data integrity with queries:" -ForegroundColor White
Write-Host "   SELECT * FROM customers WHERE user_id = '$userId';" -ForegroundColor Gray
Write-Host "   SELECT * FROM customer_addresses WHERE customer_id = '$customerId';" -ForegroundColor Gray
Write-Host "   SELECT * FROM customer_payment_methods WHERE customer_id = '$customerId';" -ForegroundColor Gray