# PowerShell script for testing order flow
$BASE_URL = "http://localhost:3004"
$SERVICE_SECRET = "shared_service_secret_key_1234567890"

# Colors for output
$GREEN = "Green"
$RED = "Red"
$YELLOW = "Yellow"
$CYAN = "Cyan"

function Write-ColorOutput($color, $message) {
    Write-Host $message -ForegroundColor $color
}

function Show-Menu {
    Clear-Host
    Write-ColorOutput $CYAN "========================================"
    Write-ColorOutput $CYAN "   ORDER SERVICE TEST CLI - POWERSHELL  "
    Write-ColorOutput $CYAN "========================================"
    Write-Host ""
    Write-Host "1. Create a new order"
    Write-Host "2. Accept an order (as driver)"
    Write-Host "3. Reject an order (as driver)"
    Write-Host "4. Get order details"
    Write-Host "5. Check WebSocket status"
    Write-Host "6. List all orders for driver"
    Write-Host "7. List all orders for customer"
    Write-Host "8. Exit"
    Write-Host ""
}

function Create-Order {
    Write-ColorOutput $CYAN "`n📦 Creating test order..."
    
    $orderId = "ORD-TEST-$([DateTimeOffset]::Now.ToUnixTimeMilliseconds())"
    
    $orderData = @{
        orderId = $orderId
        customerInfo = @{
            id = "1d25b961-0870-4f92-991d-6f966f595658"
            name = "Makolas Jones"
            email = "mwale22@gmail.com"
            phone = "0963884441"
        }
        driverInfo = @{
            id = "1358764d-1e0b-44bd-a735-ca0fc71732f1"
            name = "Lieson Mwale"
            phone = "0963884441"
            email = "lieson22@gmail.com"
            rating = 4.8
        }
        locations = @{
            pickup = @{
                address = "Zagorodnyi prospekt, 24, Sankt-Peterburg"
                coordinates = @{
                    lat = 59.925209
                    lng = 30.341745
                }
            }
            delivery = @{
                address = "ulitsa Esenina, 3, Sankt-Peterburg"
                coordinates = @{
                    lat = 60.033350
                    lng = 30.329644
                }
            }
            distance = @{
                km = 11.287
            }
        }
        packageDetails = @{
            category = "furniture"
            weight = @{
                value = 2.5
                unit = "kg"
            }
            volume = @{
                value = 1.4
                unit = "m³"
            }
            urgency = "normal"
        }
        pricing = @{
            estimatedPrice = @{
                usd = 6.84
                rub = 615.44
            }
            currency = "USD"
        }
        timing = @{
            estimatedDuration = @{
                minutes = 15
            }
        }
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
        
        Write-ColorOutput $GREEN "✅ Order created successfully!"
        Write-Host "Order ID: $($response.data.id)"
        Write-Host "Order Number: $($response.data.order_number)"
        Write-Host "Status: $($response.data.status)"
        
        return $response.data
    }
    catch {
        Write-ColorOutput $RED "❌ Failed to create order:"
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd() | ConvertFrom-Json
            Write-Host $responseBody.message
        } else {
            Write-Host $_.Exception.Message
        }
        return $null
    }
}

function Accept-Order {
    Write-ColorOutput $CYAN "`n✅ Accepting order..."
    
    $orderId = Read-Host "Enter order ID"
    $driverToken = Read-Host "Enter driver JWT token"
    
    if ([string]::IsNullOrEmpty($driverToken)) {
        Write-ColorOutput $RED "❌ Driver token is required"
        return
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/$orderId/accept" `
            -Method Post `
            -Headers @{
                "Authorization" = "Bearer $driverToken"
                "Content-Type" = "application/json"
            } `
            -Body "{}"
        
        Write-ColorOutput $GREEN "✅ Order accepted successfully!"
        Write-Host "Status: $($response.data.status)"
        Write-Host "Message: $($response.message)"
    }
    catch {
        Write-ColorOutput $RED "❌ Failed to accept order:"
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd() | ConvertFrom-Json
            Write-Host $responseBody.error
        } else {
            Write-Host $_.Exception.Message
        }
    }
}

function Reject-Order {
    Write-ColorOutput $CYAN "`n❌ Rejecting order..."
    
    $orderId = Read-Host "Enter order ID"
    $driverToken = Read-Host "Enter driver JWT token"
    $reason = Read-Host "Reason for rejection (optional)"
    
    if ([string]::IsNullOrEmpty($driverToken)) {
        Write-ColorOutput $RED "❌ Driver token is required"
        return
    }
    
    $body = @{
        reason = if ($reason) { $reason } else { "Driver unavailable" }
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/$orderId/reject" `
            -Method Post `
            -Headers @{
                "Authorization" = "Bearer $driverToken"
                "Content-Type" = "application/json"
            } `
            -Body $body
        
        Write-ColorOutput $GREEN "✅ Order rejected successfully!"
        Write-Host "Status: $($response.data.status)"
        Write-Host "Message: $($response.message)"
    }
    catch {
        Write-ColorOutput $RED "❌ Failed to reject order:"
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd() | ConvertFrom-Json
            Write-Host $responseBody.error
        } else {
            Write-Host $_.Exception.Message
        }
    }
}

function Get-OrderDetails {
    Write-ColorOutput $CYAN "`n🔍 Getting order details..."
    
    $orderId = Read-Host "Enter order ID"
    $token = Read-Host "Enter JWT token (customer or driver)"
    
    if ([string]::IsNullOrEmpty($token)) {
        Write-ColorOutput $RED "❌ Token is required"
        return
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/$orderId" `
            -Method Get `
            -Headers @{
                "Authorization" = "Bearer $token"
            }
        
        Write-ColorOutput $GREEN "✅ Order retrieved successfully!"
        Write-Host "`nOrder Details:"
        Write-Host "  ID: $($response.data.id)"
        Write-Host "  Number: $($response.data.order_number)"
        Write-Host "  Status: $($response.data.status)"
        Write-Host "  Driver Accepted: $($response.data.driver_info.accepted)"
        if ($response.data.driver_info.accepted_at) {
            Write-Host "  Accepted At: $($response.data.driver_info.accepted_at)"
        }
        Write-Host "  Customer: $($response.data.customer_info.name)"
        Write-Host "  Driver: $($response.data.driver_info.name)"
        Write-Host "  Price: `$$($response.data.pricing.estimated_usd)"
    }
    catch {
        Write-ColorOutput $RED "❌ Failed to get order:"
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd() | ConvertFrom-Json
            Write-Host $responseBody.error
        } else {
            Write-Host $_.Exception.Message
        }
    }
}

function Check-WebSocketStatus {
    Write-ColorOutput $CYAN "`n📡 Checking WebSocket status..."
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/test/websocket" -Method Get
        
        Write-ColorOutput $GREEN "✅ WebSocket Status:"
        Write-Host "  WebSocket Exists: $($response.data.wssExists)"
        Write-Host "  Initialized: $($response.data.isInitialized)"
        Write-Host "  Notification Service Ready: $($response.data.notificationServiceReady)"
        Write-Host "  Timestamp: $($response.data.timestamp)"
    }
    catch {
        Write-ColorOutput $RED "❌ Failed to check WebSocket status: $($_.Exception.Message)"
    }
}

function Get-DriverOrders {
    Write-ColorOutput $CYAN "`n🚚 Getting driver orders..."
    
    $driverId = Read-Host "Enter driver ID"
    $token = Read-Host "Enter driver JWT token"
    
    if ([string]::IsNullOrEmpty($token)) {
        Write-ColorOutput $RED "❌ Token is required"
        return
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/driver/orders?driverId=$driverId" `
            -Method Get `
            -Headers @{
                "Authorization" = "Bearer $token"
            }
        
        Write-ColorOutput $GREEN "✅ Orders retrieved successfully!"
        if ($response.orders.Count -eq 0) {
            Write-Host "No orders found for this driver"
        } else {
            foreach ($order in $response.orders) {
                Write-Host "`nOrder: $($order.order_number) - Status: $($order.status)"
            }
        }
    }
    catch {
        Write-ColorOutput $RED "❌ Failed to get driver orders: $($_.Exception.Message)"
    }
}

function Get-CustomerOrders {
    Write-ColorOutput $CYAN "`n👤 Getting customer orders..."
    
    $customerId = Read-Host "Enter customer ID"
    $token = Read-Host "Enter customer JWT token"
    
    if ([string]::IsNullOrEmpty($token)) {
        Write-ColorOutput $RED "❌ Token is required"
        return
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/customer/orders?customerId=$customerId" `
            -Method Get `
            -Headers @{
                "Authorization" = "Bearer $token"
            }
        
        Write-ColorOutput $GREEN "✅ Orders retrieved successfully!"
        if ($response.orders.Count -eq 0) {
            Write-Host "No orders found for this customer"
        } else {
            foreach ($order in $response.orders) {
                Write-Host "`nOrder: $($order.order_number) - Status: $($order.status) - Price: `$$($order.estimated_price_usd)"
            }
        }
    }
    catch {
        Write-ColorOutput $RED "❌ Failed to get customer orders: $($_.Exception.Message)"
    }
}

# Main loop
do {
    Show-Menu
    $choice = Read-Host "Select option (1-8)"
    
    switch ($choice) {
        "1" { Create-Order }
        "2" { Accept-Order }
        "3" { Reject-Order }
        "4" { Get-OrderDetails }
        "5" { Check-WebSocketStatus }
        "6" { Get-DriverOrders }
        "7" { Get-CustomerOrders }
        "8" { 
            Write-ColorOutput $YELLOW "Exiting..."
            break
        }
        default { Write-ColorOutput $RED "Invalid option" }
    }
    
    if ($choice -ne "8") {
        Write-Host ""
        Read-Host "Press Enter to continue"
    }
} while ($choice -ne "8")