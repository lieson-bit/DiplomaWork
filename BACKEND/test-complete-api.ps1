$jsonData = @'
{
  "orderId": "ORD-1770967562597-lxyjngbwd",
  "status": "pending",
  "createdAt": "2026-02-12T10:54:22.597Z",
  "lastUpdated": "2026-02-12T10:54:22.597Z",
  "customerInfo": {
    "id": "1d25b961-0870-4f92-991d-6f966f595658",
    "name": "Makolas Jones",
    "email": "mwale22@gmail.com",
    "phone": "0963884441",
    "userType": "customer"
  },
  "locations": {
    "pickup": {
      "address": "Zagorodnyi prospekt, 24, Sankt-Peterburg, Russia, 191002",
      "coordinates": {
        "lat": 59.925209,
        "lng": 30.34174539999999
      },
      "geocoded": true,
      "geocodingMethod": "DistanceMatrix.ai",
      "accuracy": "high"
    },
    "delivery": {
      "address": "ulitsa Esenina, 3 корпус 1, Sankt-Peterburg, Russia, 194354",
      "coordinates": {
        "lat": 60.0333503,
        "lng": 30.329644199999997
      },
      "geocoded": true,
      "geocodingMethod": "DistanceMatrix.ai",
      "accuracy": "high"
    },
    "distance": {
      "km": 11.287,
      "miles": 7.013414477
    }
  },
  "packageDetails": {
    "category": "furniture",
    "categoryLabel": "Furniture & Appliances",
    "weight": {
      "value": 2.5,
      "unit": "kg"
    },
    "volume": {
      "value": 1.4,
      "unit": "m³"
    },
    "urgency": "normal",
    "urgencyLabel": "normal"
  },
  "specialRequirements": {
    "fragile": false,
    "refrigerated": false,
    "oversized": false,
    "hazardous": false,
    "requirementsList": []
  },
  "driverInfo": {
    "id": "1358764d-1e0b-44bd-a735-ca0fc71732f1",
    "driverId": "1358764d-1e0b-44bd-a735-ca0fc71732f1",
    "userId": "7383849d-c318-4fd7-8c62-6e9981beadc5",
    "name": "Lieson Mwale",
    "phone": "0963884441",
    "email": "lieson22@gmail.com",
    "rating": 4.800000190734863,
    "matchScore": 73,
    "suitability": "good",
    "estimatedArrival": "12 mins"
  },
  "vehicleInfo": {
    "type": "small_van",
    "typeFormatted": "Small Van",
    "make": "Ford",
    "model": "Transit",
    "licensePlate": "ABD-25",
    "capacity": {
      "maxWeight": 100,
      "maxVolume": 10,
      "unit": {
        "weight": "kg",
        "volume": "m³"
      }
    },
    "imageUrl": "http://localhost:3002/uploads/vehicles/7383849d-c318-4fd7-8c62-6e9981beadc5/a2b128a2-abeb-438c-8f42-f4d925089f3c_1769541668103.jpg",
    "imageError": false
  },
  "pricing": {
    "estimatedPrice": {
      "usd": 6.838225250413684,
      "rub": 615.4402725372315,
      "formatted": {
        "usd": "$6.84",
        "rub": "₽615.44"
      }
    },
    "confidenceInterval": {
      "low": 523.1242316566468,
      "high": 707.7563134178163,
      "formatted": "$5.81 - $7.86"
    },
    "currency": "USD",
    "baseCurrency": "RUB"
  },
  "timing": {
    "estimatedDuration": {
      "minutes": 14.716666666666667,
      "text": "14 mins",
      "formatted": "14 mins"
    },
    "pickupTime": {
      "estimated": "2026-02-12T10:54:22.597Z",
      "driverArrival": "12 mins minutes"
    },
    "deliveryTime": {
      "estimated": "2026-02-12T11:09:05.597Z",
      "scheduled": "2026-02-12T11:09:05.597Z"
    },
    "urgencyLevel": "normal",
    "serviceHours": "24/7"
  },
  "systemInfo": {
    "geocodingStatus": {
      "pickup": "success",
      "delivery": "success"
    },
    "calculationTimestamp": "2026-02-12T13:54:02.265024",
    "apiVersion": "1.0",
    "source": "customer-booking-form"
  },
  "metadata": {
    "geocodingAttempts": 1,
    "driverSelectionTime": "2026-02-12T10:54:22.597Z",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
    "platform": "web"
  }
}
'@ | Out-String

$tempFile = [System.IO.Path]::GetTempFileName()
Set-Content -Path $tempFile -Value $jsonData -Encoding UTF8

$serviceSecret = "shared_service_secret_key_1234567890"
$apiUrl = "http://localhost:3004/api/orders/receive"

Write-Host "🚀 Sending order request using curl..." -ForegroundColor Cyan

curl.exe -X POST $apiUrl `
  -H "Content-Type: application/json" `
  -H "x-service-secret: $serviceSecret" `
  -H "Accept: application/json" `
  -d "@$tempFile" `
  -i

Remove-Item $tempFile