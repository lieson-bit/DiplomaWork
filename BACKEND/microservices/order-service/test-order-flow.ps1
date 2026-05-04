# Comprehensive Order Service Test Script
# Tests all API endpoints including order creation, acceptance, tracking, messages, ratings, balances, and route optimization

$BASE_URL = "http://localhost:3004"
$SERVICE_SECRET = "shared_service_secret_key_1234567890"

# Test User Credentials (Use real JWT tokens from your auth service)
$CUSTOMER_ID = "1d25b961-0870-4f92-991d-6f966f595658"
$DRIVER_USER_ID = "7383849d-c318-4fd7-8c62-6e9981beadc5"    # For JWT auth and driver_id in orders
$DRIVER_ID = "1358764d-1e0b-44bd-a735-ca0fc71732f1" 
$CUSTOMER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxZDI1Yjk2MS0wODcwLTRmOTItOTkxZC02Zjk2NmY1OTU2NTgiLCJ1c2VyVHlwZSI6ImN1c3RvbWVyIiwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc3NzU2NTAyOCwiZXhwIjoxNzc4MTY5ODI4fQ.nYH9_CQMibh7VqbzKK1ZzP4vuYd14uWBmUmm8dwjbLg"
$DRIVER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3MzgzODQ5ZC1jMzE4LTRmZDctOGM2Mi02ZTk5ODFiZWFkYzUiLCJ1c2VyVHlwZSI6ImRyaXZlciIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3Nzc1NjU0MjEsImV4cCI6MTc3ODE3MDIyMX0.giBuauIDy_LwgC9f5XCSarA7VMNTxKY6a-qwEIPWJDQ"

# Colors for output
$GREEN = "Green"
$RED = "Red"
$YELLOW = "Yellow"
$CYAN = "Cyan"
$MAGENTA = "Magenta"

$global:TestResults = @()
$global:CurrentOrderId = $null
$global:CurrentOrderNumber = $null

function Write-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message = ""
    )
    
    $status = if ($Passed) { "✅ PASSED" } else { "❌ FAILED" }
    $color = if ($Passed) { $GREEN } else { $RED }
    
    Write-ColorOutput $color "$status - $TestName"
    if ($Message) { Write-Host "         $Message" }
    
    $global:TestResults += @{
        Name = $TestName
        Passed = $Passed
        Message = $Message
        Timestamp = Get-Date
    }
}

function Write-ColorOutput($color, $message) {
    Write-Host $message -ForegroundColor $color
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-ColorOutput $CYAN "========================================"
    Write-ColorOutput $CYAN "  $Title"
    Write-ColorOutput $CYAN "========================================"
    Write-Host ""
}

# ============================================
# TEST 1: Health Check
# ============================================
function Test-HealthCheck {
    Write-Section "TEST 1: Health Check"
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
        Write-TestResult "GET /health" $true "Service healthy, status: $($response.status)"
        return $true
    }
    catch {
        Write-TestResult "GET /health" $false "Service not responding"
        return $false
    }
}

# ============================================
# TEST 2: Create Order
# ============================================
function Test-CreateOrder {
    Write-Section "TEST 2: Create Order - POST /api/orders/receive"
    
    $orderId = "ORD-TEST-$([DateTimeOffset]::Now.ToUnixTimeMilliseconds())"
    
    $orderData = @{
        orderId = $orderId
        status = "pending"
        createdAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
        lastUpdated = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
        customerInfo = @{
            id = $CUSTOMER_ID
            name = "Makolas Jones"
            email = "mwale22@gmail.com"
            phone = "0963884441"
            userType = "customer"
        }
        locations = @{
            pickup = @{
                address = "Zagorodnyi prospekt, 24, Sankt-Peterburg, Russia, 191002"
                coordinates = @{ lat = 59.925209; lng = 30.341745 }
                geocoded = $true
            }
            delivery = @{
                address = "ulitsa Esenina, 3 корпус 1, Sankt-Peterburg, Russia, 194354"
                coordinates = @{ lat = 60.0333503; lng = 30.3296442 }
                geocoded = $true
            }
            distance = @{ km = 11.287; miles = 7.013 }
        }
        packageDetails = @{
            category = "furniture"
            categoryLabel = "Furniture & Appliances"
            weight = @{ value = 5.5; unit = "kg" }
            volume = @{ value = 3.4; unit = "m³" }
            urgency = "normal"
            urgencyLabel = "normal"
        }
        specialRequirements = @{
            fragile = $false
            refrigerated = $false
            oversized = $false
            hazardous = $false
            requirementsList = @()
        }
        driverInfo = @{
            id = $DRIVER_USER_ID
            driverId = "1358764d-1e0b-44bd-a735-ca0fc71732f1"
            userId = "7383849d-c318-4fd7-8c62-6e9981beadc5"
            name = "Lieson Mwale"
            phone = "0963884441"
            email = "lieson22@gmail.com"
            rating = 4.8
            matchScore = 73
            suitability = "good"
            estimatedArrival = "12 mins"
        }
        vehicleInfo = @{
            type = "small_van"
            typeFormatted = "Small Van"
            make = "Ford"
            model = "Transit"
            licensePlate = "ABD-25"
            capacity = @{ maxWeight = 100; maxVolume = 10; unit = @{ weight = "kg"; volume = "m³" } }
            imageUrl = "http://localhost:3002/uploads/vehicles/test.jpg"
            imageError = $false
        }
        pricing = @{
            estimatedPrice = @{ usd = 6.84; rub = 615.44; formatted = @{ usd = "$6.84"; rub = "₽615.44" } }
            confidenceInterval = @{ low = 523.12; high = 707.76; formatted = "$5.81 - $7.86" }
            currency = "USD"
            baseCurrency = "RUB"
        }
        timing = @{
            estimatedDuration = @{ minutes = 14.7; text = "15 mins"; formatted = "15 mins" }
            pickupTime = @{ estimated = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"); driverArrival = "12 mins" }
            deliveryTime = @{ estimated = (Get-Date).AddMinutes(15).ToString("yyyy-MM-ddTHH:mm:ss.fffZ") }
            urgencyLevel = "normal"
            serviceHours = "24/7"
        }
        systemInfo = @{
            geocodingStatus = @{ pickup = "success"; delivery = "success" }
            calculationTimestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.ffffff")
            apiVersion = "1.0"
            source = "test-script"
        }
        metadata = @{
            geocodingAttempts = 1
            driverSelectionTime = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
            userAgent = "PowerShell-Test-Script"
            platform = "test"
        }
    }

    $jsonBody = $orderData | ConvertTo-Json -Depth 15
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/receive" `
            -Method Post `
            -Headers @{
                "Content-Type" = "application/json"
                "x-service-secret" = $SERVICE_SECRET
            } `
            -Body $jsonBody
        
        if ($response.success -and $response.data) {
            Write-TestResult "POST /api/orders/receive" $true "Order created: $($response.data.order_number)"
            $global:CurrentOrderId = $response.data.id
            $global:CurrentOrderNumber = $response.data.order_number
            return $true
        } else {
            Write-TestResult "POST /api/orders/receive" $false $response.message
            return $false
        }
    }
    catch {
        Write-TestResult "POST /api/orders/receive" $false $_.Exception.Message
        return $false
    }
}

# ============================================
# TEST 3: Get Order with Progress
# ============================================
function Test-GetOrderProgress {
    Write-Section "TEST 3: Get Order with Progress - GET /api/orders/:id/progress"
    
    if (-not $global:CurrentOrderId) {
        Write-TestResult "GET /api/orders/:id/progress" $false "No order ID available"
        return $false
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/$($global:CurrentOrderId)/progress" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $CUSTOMER_TOKEN" }
        
        if ($response.success) {
            $progress = $response.data.progress
            Write-TestResult "GET /api/orders/:id/progress" $true "Progress: $($progress.progressPercentage)% - Status: $($progress.currentStatus)"
            return $true
        } else {
            Write-TestResult "GET /api/orders/:id/progress" $false $response.error
            return $false
        }
    }
    catch {
        Write-TestResult "GET /api/orders/:id/progress" $false $_.Exception.Message
        return $false
    }
}

# ============================================
# TEST 4: Driver Accepts Order
# ============================================
function Test-AcceptOrder {
    Write-Section "TEST 4: Driver Accepts Order - POST /api/orders/:id/accept"
    
    if (-not $global:CurrentOrderId) {
        Write-TestResult "POST /api/orders/:id/accept" $false "No order ID available"
        return $false
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/$($global:CurrentOrderId)/accept" `
            -Method Post `
            -Headers @{
                "Authorization" = "Bearer $DRIVER_TOKEN"
                "Content-Type" = "application/json"
            } `
            -Body "{}"
        
        if ($response.success) {
            Write-TestResult "POST /api/orders/:id/accept" $true "Order accepted, status: $($response.data.status)"
            return $true
        } else {
            Write-TestResult "POST /api/orders/:id/accept" $false $response.error
            return $false
        }
    }
    catch {
        Write-TestResult "POST /api/orders/:id/accept" $false $_.Exception.Message
        return $false
    }
}

# ============================================
# TEST 5: Update Order Status (Driver)
# ============================================
function Test-UpdateOrderStatus {
    Write-Section "TEST 5: Update Order Status - PATCH /api/orders/:id/status"
    
    if (-not $global:CurrentOrderId) {
        Write-TestResult "PATCH /api/orders/:id/status" $false "No order ID available"
        return $false
    }
    
    $statuses = @("route_to_pickup", "in_transit", "delivered")
    $allPassed = $true
    
    foreach ($status in $statuses) {
        try {
            $body = @{ status = $status } | ConvertTo-Json
            $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/$($global:CurrentOrderId)/status" `
                -Method Patch `
                -Headers @{
                    "Authorization" = "Bearer $DRIVER_TOKEN"
                    "Content-Type" = "application/json"
                } `
                -Body $body
            
            if ($response.success) {
                Write-Host "  ✓ Updated to: $status" -ForegroundColor Green
            } else {
                Write-Host "  ✗ Failed to update to: $status" -ForegroundColor Red
                $allPassed = $false
            }
        }
        catch {
            Write-Host "  ✗ Error updating to: $status - $($_.Exception.Message)" -ForegroundColor Red
            $allPassed = $false
        }
        
        Start-Sleep -Seconds 1
    }
    
    Write-TestResult "PATCH /api/orders/:id/status (All statuses)" $allPassed ""
    return $allPassed
}

# ============================================
# TEST 6: Get Order Tracking
# ============================================
function Test-GetOrderTracking {
    Write-Section "TEST 6: Get Order Tracking - GET /api/orders/:id/tracking"
    
    if (-not $global:CurrentOrderId) {
        Write-TestResult "GET /api/orders/:id/tracking" $false "No order ID available"
        return $false
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/$($global:CurrentOrderId)/tracking" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $CUSTOMER_TOKEN" }
        
        if ($response.success) {
            $trackingCount = $response.data.tracking.Count
            Write-TestResult "GET /api/orders/:id/tracking" $true "Tracking points: $trackingCount"
            return $true
        } else {
            Write-TestResult "GET /api/orders/:id/tracking" $false $response.error
            return $false
        }
    }
    catch {
        Write-TestResult "GET /api/orders/:id/tracking" $false $_.Exception.Message
        return $false
    }
}

# ============================================
# TEST 7: Send Message
# ============================================
function Test-SendMessage {
    Write-Section "TEST 7: Send Message - POST /api/orders/:id/messages"
    
    if (-not $global:CurrentOrderId) {
        Write-TestResult "POST /api/orders/:id/messages" $false "No order ID available"
        return $false
    }
    
    try {
        $body = @{ content = "Hello driver, this is a test message from customer!" } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/$($global:CurrentOrderId)/messages" `
            -Method Post `
            -Headers @{
                "Authorization" = "Bearer $CUSTOMER_TOKEN"
                "Content-Type" = "application/json"
            } `
            -Body $body
        
        if ($response.success) {
            Write-TestResult "POST /api/orders/:id/messages" $true "Message sent successfully"
            return $true
        } else {
            Write-TestResult "POST /api/orders/:id/messages" $false $response.error
            return $false
        }
    }
    catch {
        Write-TestResult "POST /api/orders/:id/messages" $false $_.Exception.Message
        return $false
    }
}

# ============================================
# TEST 8: Get Messages
# ============================================
function Test-GetMessages {
    Write-Section "TEST 8: Get Messages - GET /api/orders/:id/messages"
    
    if (-not $global:CurrentOrderId) {
        Write-TestResult "GET /api/orders/:id/messages" $false "No order ID available"
        return $false
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/$($global:CurrentOrderId)/messages" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $CUSTOMER_TOKEN" }
        
        if ($response.success) {
            $messageCount = $response.data.Count
            Write-TestResult "GET /api/orders/:id/messages" $true "Messages retrieved: $messageCount"
            return $true
        } else {
            Write-TestResult "GET /api/orders/:id/messages" $false $response.error
            return $false
        }
    }
    catch {
        Write-TestResult "GET /api/orders/:id/messages" $false $_.Exception.Message
        return $false
    }
}

# ============================================
# TEST 9: Rate Driver
# ============================================
function Test-RateDriver {
    Write-Section "TEST 9: Rate Driver - POST /api/orders/:id/rate"
    
    if (-not $global:CurrentOrderId) {
        Write-TestResult "POST /api/orders/:id/rate" $false "No order ID available"
        return $false
    }
    
    try {
        $body = @{ rating = 5; review = "Excellent service!" } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/$($global:CurrentOrderId)/rate" `
            -Method Post `
            -Headers @{
                "Authorization" = "Bearer $CUSTOMER_TOKEN"
                "Content-Type" = "application/json"
            } `
            -Body $body
        
        if ($response.success) {
            Write-TestResult "POST /api/orders/:id/rate" $true "New average rating: $($response.data.newAverageRating)"
            return $true
        } else {
            Write-TestResult "POST /api/orders/:id/rate" $false $response.error
            return $false
        }
    }
    catch {
        Write-TestResult "POST /api/orders/:id/rate" $false $_.Exception.Message
        return $false
    }
}

# ============================================
# TEST 10: Get Balance
# ============================================
function Test-GetBalance {
    Write-Section "TEST 10: Get Balance - GET /api/balance"
    
    try {
        # Customer balance
        $customerResponse = Invoke-RestMethod -Uri "$BASE_URL/api/balance" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $CUSTOMER_TOKEN" }
        
        if ($customerResponse.success) {
            Write-Host "  Customer Balance: $$($customerResponse.data.availableBalance)" -ForegroundColor Green
            Write-TestResult "GET /api/balance (Customer)" $true "Available: $$($customerResponse.data.availableBalance)"
        } else {
            Write-TestResult "GET /api/balance (Customer)" $false $customerResponse.error
        }
    }
    catch {
        Write-TestResult "GET /api/balance (Customer)" $false $_.Exception.Message
    }
    
    try {
        # Driver balance
        $driverResponse = Invoke-RestMethod -Uri "$BASE_URL/api/balance" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $DRIVER_TOKEN" }
        
        if ($driverResponse.success) {
            Write-Host "  Driver Balance: $$($driverResponse.data.availableBalance)" -ForegroundColor Green
            Write-TestResult "GET /api/balance (Driver)" $true "Available: $$($driverResponse.data.availableBalance)"
            return $true
        } else {
            Write-TestResult "GET /api/balance (Driver)" $false $driverResponse.error
            return $false
        }
    }
    catch {
        Write-TestResult "GET /api/balance (Driver)" $false $_.Exception.Message
        return $false
    }
}

# ============================================
# TEST 11: Get Driver Orders
# ============================================
function Test-GetDriverOrders {
    Write-Section "TEST 11: Get Driver Orders - GET /api/driver/orders"
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/driver/orders" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $DRIVER_TOKEN" }
        
        if ($response.success) {
            $orderCount = $response.data.orders.Count
            Write-TestResult "GET /api/driver/orders" $true "Orders found: $orderCount"
            return $true
        } else {
            Write-TestResult "GET /api/driver/orders" $false $response.error
            return $false
        }
    }
    catch {
        Write-TestResult "GET /api/driver/orders" $false $_.Exception.Message
        return $false
    }
}

# ============================================
# TEST 12: Get Customer Orders
# ============================================
function Test-GetCustomerOrders {
    Write-Section "TEST 12: Get Customer Orders - GET /api/customer/orders"
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/customer/orders" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $CUSTOMER_TOKEN" }
        
        if ($response.success) {
            $orderCount = $response.data.orders.Count
            Write-TestResult "GET /api/customer/orders" $true "Orders found: $orderCount"
            return $true
        } else {
            Write-TestResult "GET /api/customer/orders" $false $response.error
            return $false
        }
    }
    catch {
        Write-TestResult "GET /api/customer/orders" $false $_.Exception.Message
        return $false
    }
}

# ============================================
# TEST 13: Get Driver Optimized Route
# ============================================
function Test-GetOptimizedRoute {
    Write-Section "TEST 13: Get Driver Optimized Route - GET /api/driver/route/optimized"
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/driver/route/optimized" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $DRIVER_TOKEN" }
        
        if ($response.success) {
            if ($response.data) {
                Write-TestResult "GET /api/driver/route/optimized" $true "Distance: $($response.data.totalDistance)km, Duration: $($response.data.totalDuration)min"
            } else {
                Write-TestResult "GET /api/driver/route/optimized" $true "No active orders for optimization"
            }
            return $true
        } else {
            Write-TestResult "GET /api/driver/route/optimized" $false $response.error
            return $false
        }
    }
    catch {
        Write-TestResult "GET /api/driver/route/optimized" $false $_.Exception.Message
        return $false
    }
}

# ============================================
# TEST 14: Get Notifications (Polling)
# ============================================
function Test-GetNotifications {
    Write-Section "TEST 14: Get Notifications - GET /api/notifications"
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/notifications" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $CUSTOMER_TOKEN" }
        
        if ($response.success) {
            $notificationCount = $response.data.notifications.Count
            $unreadCount = $response.data.unreadCount
            Write-TestResult "GET /api/notifications" $true "Notifications: $notificationCount, Unread: $unreadCount"
            return $true
        } else {
            Write-TestResult "GET /api/notifications" $false $response.error
            return $false
        }
    }
    catch {
        Write-TestResult "GET /api/notifications" $false $_.Exception.Message
        return $false
    }
}

# ============================================
# TEST 15: Create Second Order (For Route Optimization)
# ============================================
function Test-CreateSecondOrder {
    Write-Section "TEST 15: Create Second Order (For Route Optimization)"
    
    $orderId = "ORD-TEST-2-$([DateTimeOffset]::Now.ToUnixTimeMilliseconds())"
    
    $orderData = @{
        orderId = $orderId
        status = "pending"
        createdAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
        customerInfo = @{
            id = $CUSTOMER_ID
            name = "Second Customer"
            email = "customer2@example.com"
            phone = "0963884442"
            userType = "customer"
        }
        locations = @{
            pickup = @{
                address = "Nevsky Prospekt, 28, Sankt-Peterburg"
                coordinates = @{ lat = 59.93428; lng = 30.3279 }
            }
            delivery = @{
                address = "Moskovsky Prospekt, 183, Sankt-Peterburg"
                coordinates = @{ lat = 59.8501; lng = 30.3184 }
            }
            distance = @{ km = 8.5 }
        }
        packageDetails = @{
            category = "electronics"
            weight = @{ value = 3; unit = "kg" }
            volume = @{ value = 1; unit = "m³" }
            urgency = "high"
        }
        specialRequirements = @{ fragile = $true; refrigerated = $false; oversized = $false; hazardous = $false }
        driverInfo = @{
            id = $DRIVER_USER_ID
            driverId = "1358764d-1e0b-44bd-a735-ca0fc71732f1" 
            name = "Lieson Mwale"
            phone = "0963884441"
            email = "lieson22@gmail.com"
            rating = 4.8
        }
        vehicleInfo = @{
            type = "small_van"
            make = "Ford"
            model = "Transit"
            licensePlate = "ABD-25"
            capacity = @{ maxWeight = 100; maxVolume = 10 }
        }
        pricing = @{ estimatedPrice = @{ usd = 8.50; rub = 765.00 }; currency = "USD"; baseCurrency = "RUB" }
        timing = @{ estimatedDuration = @{ minutes = 20 }; pickupTime = @{ estimated = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ") }; deliveryTime = @{ estimated = (Get-Date).AddMinutes(20).ToString("yyyy-MM-ddTHH:mm:ss.fffZ") } }
    }

    $jsonBody = $orderData | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/receive" `
            -Method Post `
            -Headers @{
                "Content-Type" = "application/json"
                "x-service-secret" = $SERVICE_SECRET
            } `
            -Body $jsonBody
        
        if ($response.success) {
            Write-TestResult "POST /api/orders/receive (2nd Order)" $true "Second order created: $($response.data.order_number)"
            return $true
        } else {
            Write-TestResult "POST /api/orders/receive (2nd Order)" $false $response.message
            return $false
        }
    }
    catch {
        Write-TestResult "POST /api/orders/receive (2nd Order)" $false $_.Exception.Message
        return $false
    }
}

# ============================================
# TEST 16: API Documentation Access
# ============================================
function Test-ApiDocs {
    Write-Section "TEST 16: API Documentation Access"
    
    $endpoints = @(
        @{ Name = "Swagger UI"; Url = "/api-docs"; Method = "GET" },
        @{ Name = "API Docs Redirect"; Url = "/api/docs"; Method = "GET" }
    )
    
    foreach ($endpoint in $endpoints) {
        try {
            $response = Invoke-WebRequest -Uri "$BASE_URL$($endpoint.Url)" -Method $endpoint.Method -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-TestResult "$($endpoint.Method) $($endpoint.Url)" $true "Documentation accessible"
            } else {
                Write-TestResult "$($endpoint.Method) $($endpoint.Url)" $false "HTTP $($response.StatusCode)"
            }
        }
        catch {
            Write-TestResult "$($endpoint.Method) $($endpoint.Url)" $false $_.Exception.Message
        }
    }
}

# ============================================
# TEST 17: Invalid Request Handling
# ============================================
function Test-InvalidRequests {
    Write-Section "TEST 17: Invalid Request Handling"
    
    # Test missing service secret
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/receive" `
            -Method Post `
            -Headers @{ "Content-Type" = "application/json" } `
            -Body '{}' -ErrorAction Stop
        
        Write-TestResult "Missing Service Secret" $false "Should have been rejected"
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-TestResult "Missing Service Secret" $true "Correctly rejected (401 Unauthorized)"
        } else {
            Write-TestResult "Missing Service Secret" $false "Wrong error: $($_.Exception.Response.StatusCode)"
        }
    }
    
    # Test invalid order ID
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/invalid-id-12345/progress" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $CUSTOMER_TOKEN" } -ErrorAction Stop
        
        Write-TestResult "Invalid Order ID" $false "Should have returned 404"
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 404) {
            Write-TestResult "Invalid Order ID" $true "Correctly returned 404 Not Found"
        } else {
            Write-TestResult "Invalid Order ID" $false "Wrong error: $($_.Exception.Response.StatusCode)"
        }
    }
}

# ============================================
# Show Test Summary
# ============================================
function Show-TestSummary {
    Write-Section "TEST SUMMARY"
    
    $total = $global:TestResults.Count
    $passed = ($global:TestResults | Where-Object { $_.Passed -eq $true }).Count
    $failed = $total - $passed
    $passRate = if ($total -gt 0) { [math]::Round(($passed / $total) * 100, 2) } else { 0 }
    
    Write-ColorOutput $CYAN "Total Tests: $total"
    Write-ColorOutput $GREEN "Passed: $passed"
    if ($failed -gt 0) { Write-ColorOutput $RED "Failed: $failed" }
    else { Write-Host "Failed: $failed" }
    Write-ColorOutput $YELLOW "Pass Rate: $passRate%"
    
    Write-Host ""
    Write-ColorOutput $CYAN "Detailed Results:"
    Write-Host "----------------"
    
    foreach ($result in $global:TestResults) {
        $status = if ($result.Passed) { "✅" } else { "❌" }
        $color = if ($result.Passed) { $GREEN } else { $RED }
        Write-ColorOutput $color "$status $($result.Name)"
        if ($result.Message) { Write-Host "     $($result.Message)" }
    }
    
    if ($passed -eq $total) {
        Write-Host ""
        Write-ColorOutput $GREEN "🎉 ALL TESTS PASSED! Order service is working correctly. 🎉"
    } else {
        Write-Host ""
        Write-ColorOutput $RED "⚠️ Some tests failed. Please check the logs for details. ⚠️"
    }
}

# ============================================
# Main Execution
# ============================================
function Main {
    Clear-Host
    Write-ColorOutput $MAGENTA @"
╔══════════════════════════════════════════════════════════════════╗
║                   ORDER SERVICE TEST SUITE                       ║
║              Comprehensive API Endpoint Testing                  ║
╚══════════════════════════════════════════════════════════════════╝
"@
    
    Write-Host ""
    Write-Host "Base URL: $BASE_URL" -ForegroundColor Yellow
    Write-Host "Customer ID: $CUSTOMER_ID" -ForegroundColor Yellow
    Write-Host "Driver ID: $DRIVER_ID" -ForegroundColor Yellow
    Write-Host ""
    
    # Check if service is running
    if (-not (Test-HealthCheck)) {
        Write-ColorOutput $RED "Service is not running. Please start the service first."
        return
    }
    
    # Run all tests
    Test-CreateOrder
    Test-GetOrderProgress
    Test-AcceptOrder
    Test-UpdateOrderStatus
    Test-GetOrderTracking
    Test-SendMessage
    Test-GetMessages
    Test-RateDriver
    Test-GetBalance
    Test-GetDriverOrders
    Test-GetCustomerOrders
    Test-GetOptimizedRoute
    Test-GetNotifications
    Test-CreateSecondOrder
    Test-ApiDocs
    Test-InvalidRequests
    
    # Show summary
    Show-TestSummary
    
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Run the main function
Main 0