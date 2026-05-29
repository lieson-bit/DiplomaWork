# Всесторонний скрипт тестирования сервиса заказов
# Тестирует все API-эндпоинты, включая создание заказа, принятие, отслеживание, сообщения, оценки, балансы и оптимизацию маршрута

$BASE_URL = "http://localhost:3004"
$SERVICE_SECRET = "shared_service_secret_key_1234567890"

# Учётные данные тестового пользователя (используйте реальные JWT-токены из вашего сервиса аутентификации)
$CUSTOMER_ID = "1d25b961-0870-4f92-991d-6f966f595658"
$DRIVER_USER_ID = "7383849d-c318-4fd7-8c62-6e9981beadc5"    # Для JWT-аутентификации и driver_id в заказах
$DRIVER_ID = "1358764d-1e0b-44bd-a735-ca0fc71732f1" 
$CUSTOMER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxZDI1Yjk2MS0wODcwLTRmOTItOTkxZC02Zjk2NmY1OTU2NTgiLCJ1c2VyVHlwZSI6ImN1c3RvbWVyIiwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc3ODU2OTg4NCwiZXhwIjoxNzc5MTc0Njg0fQ.mVZId9MdyUOpVmhFDTAh_4qX5_qXb8PhIJxTH6L11-I"
$DRIVER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3MzgzODQ5ZC1jMzE4LTRmZDctOGM2Mi02ZTk5ODFiZWFkYzUiLCJ1c2VyVHlwZSI6ImRyaXZlciIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3Nzg1NzMwMDQsImV4cCI6MTc3OTE3NzgwNH0._e1v5C0Q1sEMu8D8hXsTTwaGJ8X6nL0IHtIOa4S40Xg"

# Цвета для вывода
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
    
    $status = if ($Passed) { "✅ ВЫПОЛНЕН" } else { "❌ НЕ ВЫПОЛНЕН" }
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
# ТЕСТ 1: Проверка состояния сервиса
# ============================================
function Test-HealthCheck {
    Write-Section "ТЕСТ 1: Проверка состояния сервиса"
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
        Write-TestResult "GET /health" $true "Сервис работает, статус: $($response.status)"
        return $true
    }
    catch {
        Write-TestResult "GET /health" $false "Сервис не отвечает"
        return $false
    }
}

# ============================================
# ТЕСТ 2: Создание заказа
# ============================================
function Test-CreateOrder {
    Write-Section "ТЕСТ 2: Создание заказа - POST /api/orders/receive"
    
    $orderId = "ORD-TEST-$([DateTimeOffset]::Now.ToUnixTimeMilliseconds())"
    
    $orderData = @{
        orderId = $orderId
        status = "pending"
        createdAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
        lastUpdated = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
        customerInfo = @{
            id = $CUSTOMER_ID
            name = "Маколас Джонс"
            email = "mwale22@gmail.com"
            phone = "0963884441"
            userType = "customer"
        }
        locations = @{
            pickup = @{
                address = "Загородный проспект, 5, Санкт-Петербург, Россия, 191002"
                coordinates = @{ lat = 58.925209; lng = 31.341745 }
                geocoded = $true
            }
            delivery = @{
                address = "улица Есенина, 8 корпус 1, Санкт-Петербург, Россия, 194354"
                coordinates = @{ lat = 62.0333503; lng = 36.3296442 }
                geocoded = $true
            }
            distance = @{ km = 11.287; miles = 7.013 }
        }
        packageDetails = @{
            category = "furniture"
            categoryLabel = "Мебель и техника"
            weight = @{ value = 5.5; unit = "kg" }
            volume = @{ value = 3.4; unit = "m³" }
            urgency = "normal"
            urgencyLabel = "обычная"
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
            name = "Лисон Мвале"
            phone = "0963884441"
            email = "lieson22@gmail.com"
            rating = 4.8
            matchScore = 73
            suitability = "good"
            estimatedArrival = "12 мин"
        }
        vehicleInfo = @{
            type = "small_van"
            typeFormatted = "Малотоннажный фургон"
            make = "Ford"
            model = "Transit"
            licensePlate = "АБД-25"
            capacity = @{ maxWeight = 100; maxVolume = 10; unit = @{ weight = "kg"; volume = "m³" } }
            imageUrl = "http://localhost:3002/uploads/vehicles/test.jpg"
            imageError = $false
        }
        pricing = @{
            estimatedPrice = @{ usd = 19.84; rub = 1115.44; formatted = @{ usd = "$19.84"; rub = "₽1115.44" } }
            confidenceInterval = @{ low = 523.12; high = 2000.76; formatted = "$5.81 - $20.86" }
            currency = "USD"
            baseCurrency = "RUB"
        }
        timing = @{
            estimatedDuration = @{ minutes = 14.7; text = "15 мин"; formatted = "15 мин" }
            pickupTime = @{ estimated = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"); driverArrival = "12 мин" }
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
            Write-TestResult "POST /api/orders/receive" $true "Заказ создан: $($response.data.order_number)"
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
# ТЕСТ 3: Получение заказа с прогрессом
# ============================================
function Test-GetOrderProgress {
    Write-Section "ТЕСТ 3: Получение заказа с прогрессом - GET /api/orders/:id/progress"
    
    if (-not $global:CurrentOrderId) {
        Write-TestResult "GET /api/orders/:id/progress" $false "Нет доступного ID заказа"
        return $false
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/$($global:CurrentOrderId)/progress" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $CUSTOMER_TOKEN" }
        
        if ($response.success) {
            $progress = $response.data.progress
            Write-TestResult "GET /api/orders/:id/progress" $true "Прогресс: $($progress.progressPercentage)% - Статус: $($progress.currentStatus)"
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
# ТЕСТ 4: Принятие заказа водителем
# ============================================
function Test-AcceptOrder {
    Write-Section "ТЕСТ 4: Принятие заказа водителем - POST /api/orders/:id/accept"
    
    if (-not $global:CurrentOrderId) {
        Write-TestResult "POST /api/orders/:id/accept" $false "Нет доступного ID заказа"
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
            Write-TestResult "POST /api/orders/:id/accept" $true "Заказ принят, статус: $($response.data.status)"
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
# ТЕСТ 5: Обновление статуса заказа (водитель)
# ============================================
function Test-UpdateOrderStatus {
    Write-Section "ТЕСТ 5: Обновление статуса заказа - PATCH /api/orders/:id/status"
    
    if (-not $global:CurrentOrderId) {
        Write-TestResult "PATCH /api/orders/:id/status" $false "Нет доступного ID заказа"
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
                Write-Host "  ✓ Обновлено на: $status" -ForegroundColor Green
            } else {
                Write-Host "  ✗ Не удалось обновить на: $status" -ForegroundColor Red
                $allPassed = $false
            }
        }
        catch {
            Write-Host "  ✗ Ошибка при обновлении на: $status - $($_.Exception.Message)" -ForegroundColor Red
            $allPassed = $false
        }
        
        Start-Sleep -Seconds 1
    }
    
    Write-TestResult "PATCH /api/orders/:id/status (Все статусы)" $allPassed ""
    return $allPassed
}

# ============================================
# ТЕСТ 6: Получение отслеживания заказа
# ============================================
function Test-GetOrderTracking {
    Write-Section "ТЕСТ 6: Получение отслеживания заказа - GET /api/orders/:id/tracking"
    
    if (-not $global:CurrentOrderId) {
        Write-TestResult "GET /api/orders/:id/tracking" $false "Нет доступного ID заказа"
        return $false
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/$($global:CurrentOrderId)/tracking" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $CUSTOMER_TOKEN" }
        
        if ($response.success) {
            $trackingCount = $response.data.tracking.Count
            Write-TestResult "GET /api/orders/:id/tracking" $true "Точек отслеживания: $trackingCount"
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
# ТЕСТ 7: Отправка сообщения
# ============================================
function Test-SendMessage {
    Write-Section "ТЕСТ 7: Отправка сообщения - POST /api/orders/:id/messages"
    
    if (-not $global:CurrentOrderId) {
        Write-TestResult "POST /api/orders/:id/messages" $false "Нет доступного ID заказа"
        return $false
    }
    
    try {
        $body = @{ content = "Здравствуйте, водитель! Это тестовое сообщение от клиента." } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/$($global:CurrentOrderId)/messages" `
            -Method Post `
            -Headers @{
                "Authorization" = "Bearer $CUSTOMER_TOKEN"
                "Content-Type" = "application/json"
            } `
            -Body $body
        
        if ($response.success) {
            Write-TestResult "POST /api/orders/:id/messages" $true "Сообщение успешно отправлено"
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
# ТЕСТ 8: Получение сообщений
# ============================================
function Test-GetMessages {
    Write-Section "ТЕСТ 8: Получение сообщений - GET /api/orders/:id/messages"
    
    if (-not $global:CurrentOrderId) {
        Write-TestResult "GET /api/orders/:id/messages" $false "Нет доступного ID заказа"
        return $false
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/$($global:CurrentOrderId)/messages" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $CUSTOMER_TOKEN" }
        
        if ($response.success) {
            $messageCount = $response.data.Count
            Write-TestResult "GET /api/orders/:id/messages" $true "Получено сообщений: $messageCount"
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
# ТЕСТ 9: Оценка водителя
# ============================================
function Test-RateDriver {
    Write-Section "ТЕСТ 9: Оценка водителя - POST /api/orders/:id/rate"
    
    if (-not $global:CurrentOrderId) {
        Write-TestResult "POST /api/orders/:id/rate" $false "Нет доступного ID заказа"
        return $false
    }
    
    try {
        $body = @{ rating = 5; review = "Отличный сервис!" } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/$($global:CurrentOrderId)/rate" `
            -Method Post `
            -Headers @{
                "Authorization" = "Bearer $CUSTOMER_TOKEN"
                "Content-Type" = "application/json"
            } `
            -Body $body
        
        if ($response.success) {
            Write-TestResult "POST /api/orders/:id/rate" $true "Новый средний рейтинг: $($response.data.newAverageRating)"
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
# ТЕСТ 10: Получение баланса
# ============================================
function Test-GetBalance {
    Write-Section "ТЕСТ 10: Получение баланса - GET /api/balance"
    
    try {
        # Баланс клиента
        $customerResponse = Invoke-RestMethod -Uri "$BASE_URL/api/balance" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $CUSTOMER_TOKEN" }
        
        if ($customerResponse.success) {
            Write-Host "  Баланс клиента: $($customerResponse.data.availableBalance) руб." -ForegroundColor Green
            Write-TestResult "GET /api/balance (Клиент)" $true "Доступно: $($customerResponse.data.availableBalance) руб."
        } else {
            Write-TestResult "GET /api/balance (Клиент)" $false $customerResponse.error
        }
    }
    catch {
        Write-TestResult "GET /api/balance (Клиент)" $false $_.Exception.Message
    }
    
    try {
        # Баланс водителя
        $driverResponse = Invoke-RestMethod -Uri "$BASE_URL/api/balance" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $DRIVER_TOKEN" }
        
        if ($driverResponse.success) {
            Write-Host "  Баланс водителя: $($driverResponse.data.availableBalance) руб." -ForegroundColor Green
            Write-TestResult "GET /api/balance (Водитель)" $true "Доступно: $($driverResponse.data.availableBalance) руб."
            return $true
        } else {
            Write-TestResult "GET /api/balance (Водитель)" $false $driverResponse.error
            return $false
        }
    }
    catch {
        Write-TestResult "GET /api/balance (Водитель)" $false $_.Exception.Message
        return $false
    }
}

# ============================================
# ТЕСТ 11: Получение заказов водителя
# ============================================
function Test-GetDriverOrders {
    Write-Section "ТЕСТ 11: Получение заказов водителя - GET /api/driver/orders"
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/driver/orders" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $DRIVER_TOKEN" }
        
        if ($response.success) {
            $orderCount = $response.data.orders.Count
            Write-TestResult "GET /api/driver/orders" $true "Найдено заказов: $orderCount"
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
# ТЕСТ 12: Получение заказов клиента
# ============================================
function Test-GetCustomerOrders {
    Write-Section "ТЕСТ 12: Получение заказов клиента - GET /api/customer/orders"
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/customer/orders" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $CUSTOMER_TOKEN" }
        
        if ($response.success) {
            $orderCount = $response.data.orders.Count
            Write-TestResult "GET /api/customer/orders" $true "Найдено заказов: $orderCount"
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
# ТЕСТ 13: Получение оптимизированного маршрута водителя
# ============================================
function Test-GetOptimizedRoute {
    Write-Section "ТЕСТ 13: Получение оптимизированного маршрута водителя - GET /api/driver/route/optimized"
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/driver/route/optimized" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $DRIVER_TOKEN" }
        
        if ($response.success) {
            if ($response.data) {
                Write-TestResult "GET /api/driver/route/optimized" $true "Расстояние: $($response.data.totalDistance) км, Время: $($response.data.totalDuration) мин"
            } else {
                Write-TestResult "GET /api/driver/route/optimized" $true "Нет активных заказов для оптимизации"
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
# ТЕСТ 14: Получение уведомлений (Polling)
# ============================================
function Test-GetNotifications {
    Write-Section "ТЕСТ 14: Получение уведомлений - GET /api/notifications"
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/notifications" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $CUSTOMER_TOKEN" }
        
        if ($response.success) {
            $notificationCount = $response.data.notifications.Count
            $unreadCount = $response.data.unreadCount
            Write-TestResult "GET /api/notifications" $true "Уведомлений: $notificationCount, Непрочитанных: $unreadCount"
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
# ТЕСТ 15: Создание второго заказа (для оптимизации маршрута)
# ============================================
function Test-CreateSecondOrder {
    Write-Section "ТЕСТ 15: Создание второго заказа (для оптимизации маршрута)"
    
    $orderId = "ORD-TEST-2-$([DateTimeOffset]::Now.ToUnixTimeMilliseconds())"
    
    $orderData = @{
        orderId = $orderId
        status = "pending"
        createdAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
        customerInfo = @{
            id = $CUSTOMER_ID
            name = "Второй клиент"
            email = "customer2@example.com"
            phone = "0963884442"
            userType = "customer"
        }
        locations = @{
            pickup = @{
                address = "Невский проспект, 28, Санкт-Петербург"
                coordinates = @{ lat = 59.93428; lng = 30.3279 }
            }
            delivery = @{
                address = "Московский проспект, 183, Санкт-Петербург"
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
            name = "Лисон Мвале"
            phone = "0963884441"
            email = "lieson22@gmail.com"
            rating = 4.8
        }
        vehicleInfo = @{
            type = "small_van"
            make = "Ford"
            model = "Transit"
            licensePlate = "АБД-25"
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
            Write-TestResult "POST /api/orders/receive (2-й заказ)" $true "Второй заказ создан: $($response.data.order_number)"
            return $true
        } else {
            Write-TestResult "POST /api/orders/receive (2-й заказ)" $false $response.message
            return $false
        }
    }
    catch {
        Write-TestResult "POST /api/orders/receive (2-й заказ)" $false $_.Exception.Message
        return $false
    }
}

# ============================================
# ТЕСТ 16: Доступ к документации API
# ============================================
function Test-ApiDocs {
    Write-Section "ТЕСТ 16: Доступ к документации API"
    
    $endpoints = @(
        @{ Name = "Swagger UI"; Url = "/api-docs"; Method = "GET" },
        @{ Name = "Перенаправление API Docs"; Url = "/api/docs"; Method = "GET" }
    )
    
    foreach ($endpoint in $endpoints) {
        try {
            $response = Invoke-WebRequest -Uri "$BASE_URL$($endpoint.Url)" -Method $endpoint.Method -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-TestResult "$($endpoint.Method) $($endpoint.Url)" $true "Документация доступна"
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
# ТЕСТ 17: Обработка неверных запросов
# ============================================
function Test-InvalidRequests {
    Write-Section "ТЕСТ 17: Обработка неверных запросов"
    
    # Проверка отсутствия служебного секретного ключа
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/receive" `
            -Method Post `
            -Headers @{ "Content-Type" = "application/json" } `
            -Body '{}' -ErrorAction Stop
        
        Write-TestResult "Отсутствует служебный секретный ключ" $false "Запрос должен был быть отклонён"
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-TestResult "Отсутствует служебный секретный ключ" $true "Корректно отклонён (401 Unauthorized)"
        } else {
            Write-TestResult "Отсутствует служебный секретный ключ" $false "Неверная ошибка: $($_.Exception.Response.StatusCode)"
        }
    }
    
    # Проверка неверного ID заказа
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/orders/invalid-id-12345/progress" `
            -Method Get `
            -Headers @{ "Authorization" = "Bearer $CUSTOMER_TOKEN" } -ErrorAction Stop
        
        Write-TestResult "Неверный ID заказа" $false "Должен был вернуть 404"
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 404) {
            Write-TestResult "Неверный ID заказа" $true "Корректно возвращён 404 Not Found"
        } else {
            Write-TestResult "Неверный ID заказа" $false "Неверная ошибка: $($_.Exception.Response.StatusCode)"
        }
    }
}

# ============================================
# Отображение сводки тестов
# ============================================
function Show-TestSummary {
    Write-Section "СВОДКА ТЕСТИРОВАНИЯ"
    
    $total = $global:TestResults.Count
    $passed = ($global:TestResults | Where-Object { $_.Passed -eq $true }).Count
    $failed = $total - $passed
    $passRate = if ($total -gt 0) { [math]::Round(($passed / $total) * 100, 2) } else { 0 }
    
    Write-ColorOutput $CYAN "Всего тестов: $total"
    Write-ColorOutput $GREEN "Выполнено: $passed"
    if ($failed -gt 0) { Write-ColorOutput $RED "Не выполнено: $failed" }
    else { Write-Host "Не выполнено: $failed" }
    Write-ColorOutput $YELLOW "Процент выполнения: $passRate%"
    
    Write-Host ""
    Write-ColorOutput $CYAN "Детальные результаты:"
    Write-Host "----------------"
    
    foreach ($result in $global:TestResults) {
        $status = if ($result.Passed) { "✅" } else { "❌" }
        $color = if ($result.Passed) { $GREEN } else { $RED }
        Write-ColorOutput $color "$status $($result.Name)"
        if ($result.Message) { Write-Host "     $($result.Message)" }
    }
    
    if ($passed -eq $total) {
        Write-Host ""
        Write-ColorOutput $GREEN "🎉 ВСЕ ТЕСТЫ ВЫПОЛНЕНЫ! Сервис заказов работает корректно. 🎉"
    } else {
        Write-Host ""
        Write-ColorOutput $RED "⚠️ Некоторые тесты не выполнены. Пожалуйста, проверьте журналы для получения подробной информации. ⚠️"
    }
}

# ============================================
# Основное выполнение
# ============================================
function Main {
    Clear-Host
    Write-ColorOutput $MAGENTA @"
╔══════════════════════════════════════════════════════════════════╗
║                   КОМПЛЕКС ТЕСТИРОВАНИЯ СЕРВИСА ЗАКАЗОВ          ║
║              Всестороннее тестирование API-эндпоинтов           ║
╚══════════════════════════════════════════════════════════════════╝
"@
    
    Write-Host ""
    Write-Host "Базовый URL: $BASE_URL" -ForegroundColor Yellow
    Write-Host "ID клиента: $CUSTOMER_ID" -ForegroundColor Yellow
    Write-Host "ID водителя: $DRIVER_ID" -ForegroundColor Yellow
    Write-Host ""
    
    # Проверка работоспособности сервиса
    if (-not (Test-HealthCheck)) {
        Write-ColorOutput $RED "Сервис не запущен. Пожалуйста, сначала запустите сервис."
        return
    }
    
    # Запуск всех тестов
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
    
    # Отображение сводки
    Show-TestSummary
    
    Write-Host ""
    Write-Host "Нажмите любую клавишу для выхода..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Запуск основной функции
Main