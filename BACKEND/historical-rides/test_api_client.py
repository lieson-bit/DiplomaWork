"""
Простой клиент для тестирования API предсказания стоимости поездок
"""

import requests
import json

def test_single_prediction():
    """Тестирование одиночного предсказания"""
    url = "http://localhost:5000/predict"
    
    data = {
        "distance_kms": 3.5,
        "total_time_minutes": 9.57,
        "transport_mode": "driving",
        "temperature_value": -18.7,
        "humidity": 100,
        "wind_speed": 2.19,
        "cloudness": 73,
        "weather_main": "Broken Clouds",
        "city": "Moscow",
        "country": "RU",
        "hour": 14,
        "usd_exchange_rate": 90.0
    }
    
    print("📤 Отправка запроса на предсказание...")
    print(f"Данные: {json.dumps(data, indent=2)}")
    
    response = requests.post(url, json=data)
    
    print(f"\n📥 Ответ от сервера (статус: {response.status_code}):")
    if response.status_code == 200:
        result = response.json()
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
        if result['success']:
            prediction = result['prediction']
            print(f"\n🎯 РЕЗУЛЬТАТ:")
            print(f"   Стоимость: {prediction['price_rub']} RUB")
            print(f"   Стоимость: {prediction['price_usd']} USD")
            print(f"   Доверительный интервал: {prediction['confidence_interval']['lower_bound_rub']} - {prediction['confidence_interval']['upper_bound_rub']} RUB")
    else:
        print(f"Ошибка: {response.text}")

def test_batch_prediction():
    """Тестирование пакетного предсказания"""
    url = "http://localhost:5000/predict-batch"
    
    data = {
        "trips": [
            {
                "distance_kms": 5.2,
                "total_time_minutes": 15.3,
                "transport_mode": "driving",
                "weather_main": "Clear",
                "city": "Saint Petersburg",
                "hour": 18
            },
            {
                "distance_kms": 2.1,
                "total_time_minutes": 8.2,
                "transport_mode": "driving",
                "weather_main": "Rain",
                "city": "Moscow",
                "hour": 9
            },
            {
                "distance_kms": 10.5,
                "total_time_minutes": 25.0,
                "transport_mode": "driving",
                "weather_main": "Snow",
                "city": "Other",
                "hour": 20
            }
        ],
        "usd_exchange_rate": 90.0
    }
    
    print("\n📦 Тестирование пакетного предсказания...")
    response = requests.post(url, json=data)
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Успешно обработано {result['total_trips']} поездок")
        
        for trip_result in result['results']:
            if trip_result['success']:
                pred = trip_result['prediction']
                print(f"   Поездка {trip_result['trip_id']}: {pred['price_rub']} RUB")
    else:
        print(f"❌ Ошибка: {response.text}")

def test_health_check():
    """Проверка состояния API"""
    url = "http://localhost:5000/health"
    response = requests.get(url)
    
    print("\n🏥 Проверка состояния API:")
    if response.status_code == 200:
        health = response.json()
        print(f"   Статус: {health['status']}")
        print(f"   Модель загружена: {health['model_loaded']}")
    else:
        print(f"   API недоступно")

def test_model_info():
    """Получение информации о модели"""
    url = "http://localhost:5000/model-info"
    response = requests.get(url)
    
    print("\n📊 Информация о модели:")
    if response.status_code == 200:
        info = response.json()
        print(f"   Тип модели: {info['model_type']}")
        print(f"   Количество признаков: {info['feature_count']}")
        print(f"   Пример признаков: {info['features_sample']}")
    else:
        print(f"   Не удалось получить информацию")

if __name__ == "__main__":
    print("🚖 КЛИЕНТ ДЛЯ ТЕСТИРОВАНИЯ API ПРЕДСКАЗАНИЯ СТОИМОСТИ")
    print("=" * 60)
    
    # Проверяем доступность API
    try:
        test_health_check()
        test_model_info()
        test_single_prediction()
        test_batch_prediction()
        
    except requests.exceptions.ConnectionError:
        print("❌ API недоступно. Убедитесь, что сервер запущен.")
        print("   Запустите: python api_predictor.py")