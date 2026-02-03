"""
FastAPI сервис для расчета стоимости доставки
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import sys
import os
from datetime import datetime
import uvicorn

# Импортируем нашу систему расчета
from pricing_service import (
    DeliveryPricePredictor, 
    ItemCategory, 
    DeliveryUrgency, 
    SpecialRequirements
)

app = FastAPI(
    title="Delivery Price Calculator API",
    description="API для расчета стоимости доставки с использованием ML модели",
    version="1.0.0"
)

# Настройка CORS для фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React/Vite dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Инициализируем предсказатель один раз при старте
predictor = None

@app.on_event("startup")
async def startup_event():
    """Инициализация при запуске приложения"""
    global predictor
    try:
        predictor = DeliveryPricePredictor()
        print("✅ DeliveryPricePredictor успешно инициализирован")
    except Exception as e:
        print(f"❌ Ошибка при инициализации DeliveryPricePredictor: {e}")
        raise

# Pydantic модели
class DeliveryRequest(BaseModel):
    """Модель запроса от фронтенда"""
    pickup_address: str
    delivery_address: str
    category: str  # 'documents', 'furniture', 'construction', 'food', 'electronics', 'other'
    weight_kg: Optional[float] = None
    volume_m3: Optional[float] = None
    urgency: str = 'standard'  # 'standard', 'urgent', 'scheduled'
    fragile: bool = False
    refrigerated: bool = False
    oversized: bool = False
    hazardous: bool = False

class PriceResponse(BaseModel):
    """Упрощенный ответ с ценой для фронтенда"""
    success: bool
    price_rub: Optional[float] = None
    price_usd: Optional[float] = None
    distance_km: Optional[float] = None
    duration_minutes: Optional[float] = None
    duration_text: Optional[str] = None
    vehicle_type: Optional[str] = None
    confidence_interval_low: Optional[float] = None
    confidence_interval_high: Optional[float] = None
    error: Optional[str] = None
    timestamp: str

class FullDeliveryResponse(BaseModel):
    """Полный ответ со всеми деталями"""
    success: bool
    price_breakdown: Optional[dict] = None
    delivery_details: Optional[dict] = None
    weather_data: Optional[dict] = None
    error: Optional[str] = None
    timestamp: str

# Вспомогательные функции для преобразования данных
def map_category(category: str) -> ItemCategory:
    """Преобразует категорию из фронтенда в ItemCategory"""
    category_map = {
        'documents': ItemCategory.DOCUMENTS_SMALL,
        'furniture': ItemCategory.FURNITURE_APPLIANCES,
        'construction': ItemCategory.CONSTRUCTION_MATERIAL,
        'food': ItemCategory.FOOD_BEVERAGES,
        'electronics': ItemCategory.ELECTRONICS_FRAGILE,
        'other': ItemCategory.OTHER
    }
    return category_map.get(category, ItemCategory.OTHER)

def map_urgency(urgency: str) -> DeliveryUrgency:
    """Преобразует срочность из фронтенда в DeliveryUrgency"""
    urgency_map = {
        'standard': DeliveryUrgency.STANDARD,
        'urgent': DeliveryUrgency.URGENT,
        'scheduled': DeliveryUrgency.SCHEDULED
    }
    return urgency_map.get(urgency, DeliveryUrgency.STANDARD)

def get_special_requirement(
    fragile: bool, 
    refrigerated: bool, 
    oversized: bool, 
    hazardous: bool
) -> SpecialRequirements:
    """Определяет особые требования"""
    if hazardous:
        return SpecialRequirements.HAZARDOUS
    elif refrigerated:
        return SpecialRequirements.REFRIGERATED
    elif oversized:
        return SpecialRequirements.OVERSIZED
    elif fragile:
        return SpecialRequirements.FRAGILE
    else:
        return SpecialRequirements.NONE

# Эндпоинты API
@app.get("/")
async def root():
    """Корневой эндпоинт"""
    return {
        "message": "🚚 Delivery Price Calculator API",
        "version": "1.0.0",
        "status": "operational",
        "endpoints": {
            "GET /health": "Проверка здоровья сервиса",
            "POST /api/calculate-price": "Расчет стоимости доставки",
            "POST /api/full-calculation": "Полный расчет со всеми деталями"
        }
    }

@app.get("/health")
async def health_check():
    """Проверка здоровья сервиса"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "delivery-price-calculator"
    }

@app.post("/api/calculate-price", response_model=PriceResponse)
async def calculate_price(request: DeliveryRequest):
    """
    Основной эндпоинт для расчета стоимости доставки
    Возвращает упрощенный ответ с ценой
    """
    try:
        if predictor is None:
            raise HTTPException(status_code=500, detail="Service not initialized")
        
        print(f"📦 Получен запрос на расчет:")
        print(f"   От: {request.pickup_address}")
        print(f"   До: {request.delivery_address}")
        print(f"   Категория: {request.category}")
        
        # Преобразуем данные из фронтенда
        item_category = map_category(request.category)
        urgency = map_urgency(request.urgency)
        special_requirement = get_special_requirement(
            request.fragile, 
            request.refrigerated, 
            request.oversized, 
            request.hazardous
        )
        
        # Вызываем расчет стоимости
        result = predictor.calculate_delivery_price(
            origin=request.pickup_address,
            destination=request.delivery_address,
            item_category=item_category,
            weight_kg=request.weight_kg,
            volume_m3=request.volume_m3,
            urgency=urgency,
            special_requirement=special_requirement
        )
        
        if result['success']:
            # ДОБАВЛЕНО: Отладочная информация
            print(f"📊 Данные для ответа:")
            print(f"   Расстояние: {result['delivery_details']['distance_km']} км")
            print(f"   Время: {result['delivery_details']['duration_text']}")
            print(f"   Тип транспорта: {result['delivery_details']['recommended_vehicle']}")
            
            return PriceResponse(
                success=True,
                price_rub=result['price_breakdown']['final_price_rub'],
                price_usd=result['price_breakdown']['final_price_usd'],
                distance_km=result['delivery_details']['distance_km'],
                duration_minutes=result['delivery_details']['duration_minutes'],
                duration_text=result['delivery_details']['duration_text'],
                vehicle_type=result['delivery_details']['recommended_vehicle'],
                confidence_interval_low=result['price_breakdown']['confidence_interval']['lower_bound_rub'],
                confidence_interval_high=result['price_breakdown']['confidence_interval']['upper_bound_rub'],
                timestamp=datetime.now().isoformat()
            )
        else:
            return PriceResponse(
                success=False,
                error=result.get('error', 'Unknown error'),
                timestamp=datetime.now().isoformat()
            )
            
    except Exception as e:
        print(f"❌ Ошибка при расчете: {e}")
        import traceback
        traceback.print_exc()
        return PriceResponse(
            success=False,
            error=str(e),
            timestamp=datetime.now().isoformat()
        )

@app.post("/api/full-calculation", response_model=FullDeliveryResponse)
async def full_calculation(request: DeliveryRequest):
    """
    Полный расчет со всеми деталями для отладки или детального просмотра
    """
    try:
        if predictor is None:
            raise HTTPException(status_code=500, detail="Service not initialized")
        
        # Преобразуем данные из фронтенда
        item_category = map_category(request.category)
        urgency = map_urgency(request.urgency)
        special_requirement = get_special_requirement(
            request.fragile, 
            request.refrigerated, 
            request.oversized, 
            request.hazardous
        )
        
        # Вызываем расчет стоимости
        result = predictor.calculate_delivery_price(
            origin=request.pickup_address,
            destination=request.delivery_address,
            item_category=item_category,
            weight_kg=request.weight_kg,
            volume_m3=request.volume_m3,
            urgency=urgency,
            special_requirement=special_requirement
        )
        
        return FullDeliveryResponse(
            success=result['success'],
            price_breakdown=result.get('price_breakdown'),
            delivery_details=result.get('delivery_details'),
            weather_data=result.get('weather_data'),
            error=result.get('error'),
            timestamp=datetime.now().isoformat()
        )
            
    except Exception as e:
        print(f"❌ Ошибка при расчете: {e}")
        return FullDeliveryResponse(
            success=False,
            error=str(e),
            timestamp=datetime.now().isoformat()
        )

@app.get("/api/categories")
async def get_categories():
    """Получить список доступных категорий грузов"""
    return {
        "categories": [
            {"value": "documents", "label": "Documents & Small Packages"},
            {"value": "furniture", "label": "Furniture & Appliances"},
            {"value": "construction", "label": "Construction Materials"},
            {"value": "food", "label": "Food & Beverages"},
            {"value": "electronics", "label": "Electronics & Fragile Items"},
            {"value": "other", "label": "Other"}
        ]
    }

@app.get("/api/urgency-options")
async def get_urgency_options():
    """Получить список вариантов срочности"""
    return {
        "urgency_options": [
            {"value": "standard", "label": "Standard (same day)"},
            {"value": "urgent", "label": "Urgent (within 2 hours)"},
            {"value": "scheduled", "label": "Scheduled (next day)"}
        ]
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Автоматическая перезагрузка при изменениях
        log_level="info"
    )