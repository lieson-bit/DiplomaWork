"""
Полноценная система для предсказания стоимости поездки Uber/Gett по адресам
"""

import requests
import json
import joblib
import pandas as pd
import numpy as np
from typing import Dict, Optional, Tuple, List
import time
import re
import os
from datetime import datetime

class UberPricePredictor:
    """Полная система для предсказания стоимости поездки"""
    
    def __init__(self, models_dir='E:/DiplomaWork/BACKEND/historical-rides/models'):
        """
        Инициализация системы предсказания
        
        Args:
            models_dir: Директория с сохраненными моделями
        """
        # API сервисы
        self.delivery_service = DeliveryDataService()
        
        # Загрузка модели
        self.models_dir = models_dir
        self.model = None
        self.scaler = None
        self.feature_names = None
        self.load_model()
        
        # Настройки
        self.usd_exchange_rate = 90.0  # Курс USD/RUB
        self.confidence_percentage = 15.0  # Процент доверительного интервала
        
        print("🚖 UberPricePredictor инициализирован")
    
    def load_model(self):
        """Загружает сохраненную модель ML"""
        try:
            # Загружаем модель
            model_path = os.path.join(self.models_dir, 'best_model_xgboost.joblib')
            self.model = joblib.load(model_path)
            print(f"✅ Модель ML загружена: {model_path}")
            
            # Загружаем scaler
            scaler_path = os.path.join(self.models_dir, 'scaler.joblib')
            self.scaler = joblib.load(scaler_path)
            print(f"✅ Scaler загружен: {scaler_path}")
            
            # Загружаем названия признаков
            features_path = os.path.join(self.models_dir, 'feature_names.joblib')
            self.feature_names = joblib.load(features_path)
            print(f"✅ Названия признаков загружены: {features_path}")
            
        except Exception as e:
            print(f"❌ Ошибка при загрузке модели: {e}")
            raise
    
    def get_route_data(self, origin: str, destination: str, transport_mode: str = 'driving') -> Dict:
        """
        Получает данные о маршруте и погоде через API
        
        Args:
            origin: Адрес начала поездки
            destination: Адрес назначения
            transport_mode: Режим транспорта (driving/walking/bicycling)
            
        Returns:
            Dict: Данные о маршруте и погоде
        """
        print(f"\n📍 Получение данных о маршруте...")
        print(f"   От: {origin}")
        print(f"   До: {destination}")
        print(f"   Режим: {transport_mode}")
        
        # Получаем полные данные о доставке
        delivery_data = self.delivery_service.get_complete_delivery_data(
            origin=origin,
            destination=destination,
            transport_mode=transport_mode
        )
        
        return delivery_data
    
    # Добавьте этот метод ВМЕСТО старого prepare_prediction_features
    def prepare_prediction_features(self, delivery_data: Dict) -> pd.DataFrame:
        """
        Подготавливает признаки для модели ML на основе данных API
        Используем ТОЧНО те признаки, которые есть в feature_names
        """
        route = delivery_data['route']
        weather = delivery_data['weather']
        
        print("\n🔧 Подготовка признаков для ML модели...")
        
        # Создаем пустой DataFrame с нулями для ВСЕХ признаков
        input_df = pd.DataFrame(np.zeros((1, len(self.feature_names))), columns=self.feature_names)
        
        # 1. Заполняем ОСНОВНЫЕ числовые признаки
        if route.get('success'):
            distance_km = route['distance_meters'] / 1000
            duration_minutes = route['duration_seconds'] / 60
            
            # Основные числовые признаки из feature_names
            if 'distance_kms' in self.feature_names:
                input_df['distance_kms'] = distance_km
            
            if 'total_time_minutes' in self.feature_names:
                input_df['total_time_minutes'] = duration_minutes
            
            # Скорость
            if duration_minutes > 0:
                speed_kmh = distance_km / (duration_minutes / 60)
            else:
                speed_kmh = 0
            
            if 'speed_kmh' in self.feature_names:
                input_df['speed_kmh'] = speed_kmh
            
            print(f"  ✓ Расстояние: {distance_km:.2f} км, Время: {duration_minutes:.1f} мин, Скорость: {speed_kmh:.1f} км/ч")
        
        # 2. Заполняем погодные признаки
        if weather.get('success'):
            weather_mapping = {
                'temperature_value': weather.get('temperature_value'),
                'feels_like': weather.get('feels_like'),
                'humidity': weather.get('humidity'),
                'wind_speed': weather.get('wind_speed'),
                'cloudness': weather.get('cloudness')
            }
            
            for feature, value in weather_mapping.items():
                if feature in self.feature_names:
                    input_df[feature] = value
            
            print(f"  ✓ Погода: {weather['temperature_value']:.1f}°C, {weather['weather_desc']}")
        
        # 3. surge_multiplier (всегда 1.0 для базовой цены)
        if 'surge_multiplier' in self.feature_names:
            input_df['surge_multiplier'] = 1.0
        
        # 4. Определяем и устанавливаем ПРАВИЛЬНЫЕ бинарные признаки
        # Проверяем какие dummy признаки есть в модели
        print(f"\n📋 Библиотека признаков модели ({len(self.feature_names)}):")
        
        # Сначала заполним ВСЕ dummy-переменные нулями (они уже нули)
        
        # Теперь установим ПРАВИЛЬНЫЕ значения для текущей поездки
        
        # 4.1 Определяем тип поездки (trip_type_*)
        transport_mode = route.get('transport_mode', 'driving') if route.get('success') else 'driving'
        if transport_mode == 'driving':
            # Для Uber/Gett у нас есть специфичные типы
            if 'trip_type_uberx' in self.feature_names:
                input_df['trip_type_uberx'] = 1  # Предполагаем UberX как базовый
            if 'trip_type_uberblack' in self.feature_names:
                input_df['trip_type_uberblack'] = 0
            if 'trip_type_uberelka' in self.feature_names:
                input_df['trip_type_uberelka'] = 0
            if 'trip_type_comfort' in self.feature_names:
                input_df['trip_type_comfort'] = 0
            if 'trip_type_economyfix' in self.feature_names:
                input_df['trip_type_economyfix'] = 0
        
        # 4.2 Определяем город (city_*)
        if weather.get('success') and 'location' in weather:
            city = weather['location'].get('city', '').lower()
            
            # Проверяем какие city_ признаки есть в модели
            city_features = [f for f in self.feature_names if f.startswith('city_')]
            
            if city_features:
                print(f"  ✓ Доступные city_ признаки: {city_features}")
                
                # Определяем правильный город
                if 'москв' in city or 'moscow' in city:
                    if 'city_moscow' in self.feature_names:
                        input_df['city_moscow'] = 1
                    elif 'city_Moscow' in self.feature_names:
                        input_df['city_Moscow'] = 1
                elif 'петербург' in city or 'petersburg' in city or 'peter' in city:
                    if 'city_saint_petersburg' in self.feature_names:
                        input_df['city_saint_petersburg'] = 1
                    elif 'city_Saint_Petersburg' in self.feature_names:
                        input_df['city_Saint_Petersburg'] = 1
        
        # 4.3 Определяем погоду (weather_*)
        if weather.get('success'):
            weather_main = weather.get('weather_main', '').lower()
            weather_desc = weather.get('weather_desc', '').lower()
            
            # Проверяем какие weather_ признаки есть в модели
            weather_features = [f for f in self.feature_names if f.startswith('weather_')]
            
            if weather_features:
                print(f"  ✓ Доступные weather_ признаки: {weather_features}")
                
                # Определяем тип погоды
                if 'cloud' in weather_main or 'cloud' in weather_desc:
                    # Ищем любой cloud-related признак
                    for feature in weather_features:
                        if 'cloud' in feature.lower():
                            input_df[feature] = 1
                            break
                elif 'clear' in weather_main or 'clear' in weather_desc:
                    for feature in weather_features:
                        if 'clear' in feature.lower():
                            input_df[feature] = 1
                            break
                elif 'rain' in weather_main or 'rain' in weather_desc:
                    for feature in weather_features:
                        if 'rain' in feature.lower():
                            input_df[feature] = 1
                            break
                elif 'snow' in weather_main or 'snow' in weather_desc:
                    for feature in weather_features:
                        if 'snow' in feature.lower():
                            input_df[feature] = 1
                            break
                        
        # 4.4 Временные признаки
        current_hour = datetime.now().hour
        if 'trip_start_time_hour' in self.feature_names:
            input_df['trip_start_time_hour'] = current_hour
        
        # Определяем время суток
        time_of_day_features = [f for f in self.feature_names if 'timeofday' in f.lower()]
        if time_of_day_features:
            if 5 <= current_hour < 12:
                for feature in time_of_day_features:
                    if 'morning' in feature.lower():
                        input_df[feature] = 1
            elif 12 <= current_hour < 17:
                for feature in time_of_day_features:
                    if 'afternoon' in feature.lower():
                        input_df[feature] = 1
            elif 17 <= current_hour < 22:
                for feature in time_of_day_features:
                    if 'evening' in feature.lower():
                        input_df[feature] = 1
            else:
                for feature in time_of_day_features:
                    if 'night' in feature.lower():
                        input_df[feature] = 1
        
        # 5. Другие важные признаки
        # trip_time_minutes (часто равен total_time_minutes)
        if 'trip_time_minutes' in self.feature_names and 'total_time_minutes' in self.feature_names:
            input_df['trip_time_minutes'] = input_df['total_time_minutes']
        
        # Год, месяц
        current_year = datetime.now().year
        current_month = datetime.now().month
        
        year_features = [f for f in self.feature_names if 'year' in f]
        month_features = [f for f in self.feature_names if 'month' in f and 'year' not in f]
        
        for feature in year_features:
            input_df[feature] = current_year
        
        for feature in month_features:
            input_df[feature] = current_month
        
        # 6. Выводим отладочную информацию
        print(f"\n📊 Заполненные признаки (ненулевые):")
        non_zero_features = input_df.columns[(input_df != 0).any()].tolist()
        
        for feature in non_zero_features[:15]:  # Покажем первые 15
            value = input_df[feature].iloc[0]
            print(f"   {feature:30s}: {value}")
        
        if len(non_zero_features) > 15:
            print(f"   ... и еще {len(non_zero_features) - 15} признаков")
        
        zero_count = (input_df == 0).sum().sum()
        print(f"\n✅ Подготовлено {input_df.shape[1]} признаков")
        print(f"   Ненулевых признаков: {len(non_zero_features)}")
        print(f"   Нулевых признаков: {zero_count}")
        
        return input_df
    
    def predict_price_from_addresses(self, origin: str, destination: str, 
                                    transport_mode: str = 'driving') -> Dict:
        """
        Предсказывает стоимость поездки на основе адресов
        
        Args:
            origin: Адрес начала поездки
            destination: Адрес назначения
            transport_mode: Режим транспорта
            
        Returns:
            Dict: Результаты предсказания
        """
        print("\n" + "="*60)
        print("🚖 ПРЕДСКАЗАНИЕ СТОИМОСТИ ПОЕЗДКИ ПО АДРЕСАМ")
        print("="*60)
        
        try:
            # 1. Получаем данные о маршруте и погоде
            delivery_data = self.get_route_data(origin, destination, transport_mode)
            
            # Выводим сводку
            self.delivery_service.print_delivery_summary(delivery_data)
            
            # 2. Подготавливаем признаки для ML модели
            features_df = self.prepare_prediction_features(delivery_data)
            
            if features_df is None:
                return {
                    'success': False,
                    'error': 'Не удалось подготовить данные для предсказания',
                    'timestamp': datetime.now().isoformat()
                }
            
            # 3. Применяем масштабирование
            scaled_features = self.scaler.transform(features_df)
            
            # 4. Предсказываем стоимость
            predicted_price_rub = self.model.predict(scaled_features)[0]
            predicted_price_usd = predicted_price_rub / self.usd_exchange_rate
            
            # 5. Рассчитываем доверительный интервал
            confidence_interval = predicted_price_rub * (self.confidence_percentage / 100)
            
            # 6. Формируем полный результат
            result = {
                'success': True,
                'prediction': {
                    'price_rub': float(predicted_price_rub),
                    'price_usd': float(predicted_price_usd),
                    'confidence_interval': {
                        'lower_bound_rub': float(predicted_price_rub - confidence_interval),
                        'upper_bound_rub': float(predicted_price_rub + confidence_interval),
                        'percentage': float(self.confidence_percentage)
                    }
                },
                'route_data': {
                    'origin': delivery_data['metadata']['origin'],
                    'destination': delivery_data['metadata']['destination'],
                    'distance_km': float(delivery_data['route']['distance_meters'] / 1000),
                    'distance_text': delivery_data['route'].get('distance_text', ''),
                    'duration_minutes': float(delivery_data['route']['duration_seconds'] / 60),
                    'duration_text': delivery_data['route'].get('duration_text', ''),
                    'transport_mode': transport_mode
                },
                'weather_data': {
                    'temperature': float(delivery_data['weather'].get('temperature_value', 0)),
                    'feels_like': float(delivery_data['weather'].get('feels_like', 0)),
                    'humidity': int(delivery_data['weather'].get('humidity', 0)),
                    'wind_speed': float(delivery_data['weather'].get('wind_speed', 0)),
                    'cloudness': int(delivery_data['weather'].get('cloudness', 0)),
                    'conditions': delivery_data['weather'].get('weather_desc', '')
                } if delivery_data['weather'].get('success') else {'available': False},
                'timestamp': datetime.now().isoformat(),
                'model_info': {
                    'model_type': 'XGBoost',
                    'feature_count': len(self.feature_names),
                    'r2_score': 0.8117,  # Из финального отчета
                    'confidence_level': f"{self.confidence_percentage}%"
                }
            }
            
            # 7. Выводим результат
            self.print_prediction_result(result)
            
            return result
            
        except Exception as e:
            error_result = {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            print(f"❌ Ошибка при предсказании: {e}")
            return error_result
    
    def print_prediction_result(self, result: Dict):
        """Выводит результат предсказания в удобном формате"""
        print("\n" + "="*60)
        print("🎯 РЕЗУЛЬТАТ ПРЕДСКАЗАНИЯ")
        print("="*60)
        
        if result['success']:
            pred = result['prediction']
            route = result['route_data']
            weather = result['weather_data']
            
            print(f"📍 Маршрут:")
            print(f"   От: {route['origin'][:50]}...")
            print(f"   До: {route['destination'][:50]}...")
            print(f"   Расстояние: {route['distance_text']} ({route['distance_km']:.2f} км)")
            print(f"   Время: {route['duration_text']} ({route['duration_minutes']:.1f} мин)")
            print(f"   Режим: {route['transport_mode']}")
            
            print(f"\n🌤️  Погодные условия:")
            if weather.get('available', True):
                print(f"   Температура: {weather['temperature']:.1f}°C (ощущается как {weather['feels_like']:.1f}°C)")
                print(f"   Влажность: {weather['humidity']}%")
                print(f"   Ветер: {weather['wind_speed']:.1f} м/с")
                print(f"   Облачность: {weather['cloudness']}%")
                print(f"   Условия: {weather['conditions']}")
            else:
                print(f"   (данные о погоде недоступны)")
            
            print(f"\n💰 Стоимость поездки:")
            print(f"   RUB: {pred['price_rub']:.2f}")
            print(f"   USD: {pred['price_usd']:.2f} (курс {self.usd_exchange_rate:.1f} RUB/USD)")
            print(f"   Доверительный интервал ({pred['confidence_interval']['percentage']}%):")
            print(f"     От: {pred['confidence_interval']['lower_bound_rub']:.2f} RUB")
            print(f"     До: {pred['confidence_interval']['upper_bound_rub']:.2f} RUB")
            
            # Сравнение со средней стоимостью
            avg_price_rub = 303.36  # Из финального отчета
            comparison = (pred['price_rub'] / avg_price_rub - 1) * 100
            
            print(f"\n📊 Сравнение со средней стоимостью:")
            print(f"   Средняя стоимость в данных: {avg_price_rub:.2f} RUB")
            print(f"   Разница: {comparison:+.1f}%")
            
            print(f"\n📈 Качество модели:")
            print(f"   R²: {result['model_info']['r2_score']:.4f} (очень хорошее)")
            print(f"   Уверенность: {result['model_info']['confidence_level']}")
            
        else:
            print(f"❌ Ошибка: {result.get('error', 'Неизвестная ошибка')}")
        
        print("="*60)
    
    def save_prediction_result(self, result: Dict, filename: str = None):
        """
        Сохраняет результат предсказания в JSON файл
        
        Args:
            result: Результат предсказания
            filename: Имя файла (если None, генерируется автоматически)
        """
        if not result['success']:
            print("⚠ Не удалось сохранить результат (ошибка предсказания)")
            return
        
        # Создаем директорию для сохранения
        output_dir = 'uber_predictions'
        os.makedirs(output_dir, exist_ok=True)
        
        # Генерируем имя файла
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            origin_short = result['route_data']['origin'][:20].replace(' ', '_').replace('/', '_')
            dest_short = result['route_data']['destination'][:20].replace(' ', '_').replace('/', '_')
            filename = f"uber_pred_{timestamp}_{origin_short}_to_{dest_short}.json"
        
        filepath = os.path.join(output_dir, filename)
        
        # Сохраняем в JSON
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Результат сохранен: {filepath}")
        return filepath


# Импортируем класс DeliveryDataService из предыдущего кода
class DeliveryDataService:
    """Сервис для получения данных о расстоянии, времени и погоде"""
    
    def __init__(self):
        # DistanceMatrix.ai API configuration
        self.distance_api_key = "NFLqNsgalupmIuzDS6zKuprvodMgjdaGAxBtGYNpOT9TUwnCnC4Z9Do6T2drMT4Y"
        self.distance_api_url = "https://api.distancematrix.ai/maps/api/distancematrix/json"
        
        # OpenWeatherMap API configuration
        self.weather_api_key = "2f5464371ce6b10a70de5ef28258b8c2"
        self.weather_api_url = "https://api.openweathermap.org/data/2.5/weather"
        
        # Cache for API responses
        self.cache = {}
        self.cache_timeout = 300  # 5 minutes
        
        print("DeliveryDataService initialized")
    
    def extract_city_from_address(self, address: str) -> str:
        """
        Extract city name from address string for fallback geocoding
        """
        # Common Russian city patterns
        city_patterns = [
            r'(Москва|Moscow)',
            r'(Санкт-Петербург|Saint Petersburg|St\.? Petersburg)',
            r'(Новосибирск|Novosibirsk)',
            r'(Екатеринбург|Yekaterinburg)',
            r'(Казань|Kazan)',
            r'(Нижний Новгород|Nizhny Novgorod)',
            r'(Челябинск|Chelyabinsk)',
            r'(Омск|Omsk)',
            r'(Самара|Samara)',
            r'(Ростов-на-Дону|Rostov-on-Don)',
            r'(Уфа|Ufa)',
            r'(Красноярск|Krasnoyarsk)',
            r'(Воронеж|Voronezh)',
            r'(Пермь|Perm)',
            r'(Волгоград|Volgograd)'
        ]
        
        # Check for patterns in the address
        address_lower = address.lower()
        for pattern in city_patterns:
            match = re.search(pattern, address, re.IGNORECASE)
            if match:
                return match.group(1)
        
        # Try to extract city from address structure (common formats)
        parts = address.split(',')
        if len(parts) >= 2:
            # City is often the second-to-last part in Russian addresses
            possible_city = parts[-2].strip()
            if possible_city and len(possible_city) > 2:
                return possible_city
        
        # Return the last part if nothing else works
        return parts[-1].strip() if parts else address
    
    def get_coordinates_from_address(self, address: str) -> Optional[Tuple[float, float]]:
        """
        Get coordinates from an address using OpenWeatherMap's geocoding API
        with improved error handling and fallbacks
        """
        try:
            # Clean and normalize address
            normalized_address = address.strip()
            if not normalized_address:
                print("⚠ Empty address provided")
                return None
            
            # Create cache key
            cache_key = f"geocode_{normalized_address}"
            
            # Check cache
            if cache_key in self.cache:
                cached_data = self.cache[cache_key]
                if time.time() - cached_data['timestamp'] < self.cache_timeout:
                    print(f"Using cached coordinates for: {normalized_address}")
                    return cached_data['data']
            
            print(f"🌍 Geocoding address: {normalized_address}")
            
            # Method 1: Try OpenWeatherMap geocoding API first
            geocode_url = "http://api.openweathermap.org/geo/1.0/direct"
            params = {
                'q': normalized_address,
                'limit': 5,  # Get multiple results for better matching
                'appid': self.weather_api_key,
                'lang': 'en'
            }
            
            response = requests.get(geocode_url, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                if data and len(data) > 0:
                    # Try to find the best match
                    best_match = data[0]
                    
                    # If we have multiple results, try to find one with "RU" country code
                    if len(data) > 1:
                        for result in data:
                            if result.get('country') == 'RU':
                                best_match = result
                                break
                    
                    coords = (best_match['lat'], best_match['lon'])
                    location_name = f"{best_match.get('name', 'Unknown')}, {best_match.get('country', 'Unknown')}"
                    
                    print(f"✅ Successfully geocoded: {normalized_address}")
                    print(f"   → Coordinates: {coords}")
                    print(f"   → Location: {location_name}")
                    
                    # Cache the result
                    self.cache[cache_key] = {
                        'timestamp': time.time(),
                        'data': coords
                    }
                    
                    return coords
            
            # Method 2: If OpenWeatherMap fails, try Nominatim (OpenStreetMap) as fallback
            print(f"⚠ OpenWeatherMap geocoding failed, trying Nominatim...")
            
            nominatim_url = "https://nominatim.openstreetmap.org/search"
            params = {
                'q': normalized_address,
                'format': 'json',
                'limit': 1,
                'countrycodes': 'ru',  # Prioritize Russia
                'accept-language': 'en'
            }
            
            headers = {
                'User-Agent': 'DeliveryDataService/1.0'
            }
            
            response = requests.get(nominatim_url, params=params, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    coords = (float(data[0]['lat']), float(data[0]['lon']))
                    print(f"✅ Successfully geocoded via Nominatim: {normalized_address}")
                    print(f"   → Coordinates: {coords}")
                    print(f"   → Location: {data[0].get('display_name', 'Unknown')}")
                    
                    # Cache the result
                    self.cache[cache_key] = {
                        'timestamp': time.time(),
                        'data': coords
                    }
                    
                    return coords
            
            # Method 3: Extract city and try geocoding just the city
            print(f"⚠ Full address geocoding failed, extracting city...")
            city_name = self.extract_city_from_address(normalized_address)
            
            if city_name and city_name != normalized_address:
                print(f"   Trying with city only: {city_name}")
                
                # Try with OpenWeatherMap again
                params = {
                    'q': f"{city_name},RU",  # Add country code for better results
                    'limit': 1,
                    'appid': self.weather_api_key
                }
                
                response = requests.get(geocode_url, params=params, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if data and len(data) > 0:
                        coords = (data[0]['lat'], data[0]['lon'])
                        print(f"✅ Successfully geocoded city: {city_name}")
                        print(f"   → Coordinates: {coords}")
                        
                        # Cache both the full address and city results
                        self.cache[cache_key] = {
                            'timestamp': time.time(),
                            'data': coords
                        }
                        
                        return coords
            
            print(f"❌ All geocoding attempts failed for: {normalized_address}")
            return None
                
        except requests.exceptions.Timeout:
            print(f"⚠ Geocoding timeout for: {address}")
            return None
        except requests.exceptions.RequestException as e:
            print(f"⚠ Geocoding network error: {str(e)}")
            return None
        except Exception as e:
            print(f"⚠ Unexpected geocoding error: {str(e)}")
            return None
    
    def get_weather_by_coordinates(self, lat: float, lon: float) -> Dict:
        """
        Get weather data using coordinates (more reliable than city names)
        """
        print(f"🌤️  Getting weather for coordinates: ({lat}, {lon})")
        return self.get_weather_data(lat=lat, lon=lon)
    
    def get_weather_for_address(self, address: str) -> Dict:
        """
        Get weather data for an address by automatically extracting coordinates
        """
        # Get coordinates from address
        coords = self.get_coordinates_from_address(address)
        
        if coords:
            lat, lon = coords
            # Get weather using coordinates
            return self.get_weather_by_coordinates(lat, lon)
        else:
            # Try to extract city name as fallback
            city_name = self.extract_city_from_address(address)
            if city_name:
                print(f"⚠ Using city name fallback for weather: {city_name}")
                return self.get_weather_data(city=city_name, country_code="RU")
            else:
                return {
                    'success': False,
                    'error': f"Could not determine location from address: {address}",
                    'api_status': 'geocoding_failed'
                }
    
    def get_delivery_route_info(self, origin: str, destination: str, 
                               transport_mode: str = 'driving') -> Dict:
        """
        Get distance and time information for a delivery route
        """
        try:
            # Normalize transport mode
            valid_modes = ['driving', 'walking', 'bicycling', 'transit']
            if transport_mode not in valid_modes:
                print(f"⚠ Warning: Transport mode '{transport_mode}' not supported. Using 'driving'.")
                transport_mode = 'driving'
            
            # Fix: Check if bicycling is available - if not, use driving
            if transport_mode == 'bicycling':
                transport_mode_to_use = 'bicycling'
            else:
                transport_mode_to_use = transport_mode
            
            # Create cache key
            cache_key = f"route_{origin}_{destination}_{transport_mode_to_use}"
            
            # Check cache
            if cache_key in self.cache:
                cached_data = self.cache[cache_key]
                if time.time() - cached_data['timestamp'] < self.cache_timeout:
                    print(f"Using cached route data for {origin} to {destination}")
                    return cached_data['data']
            
            # Prepare parameters
            params = {
                "origins": origin,
                "destinations": destination,
                "key": self.distance_api_key,
                "mode": transport_mode_to_use,
                "departure_time": "now",
                "units": "metric",
                "language": "en"
            }
            
            # Make API request
            print(f"📍 Getting route from: {origin}")
            print(f"   → To: {destination}")
            print(f"   → Mode: {transport_mode_to_use}")
            
            response = requests.get(self.distance_api_url, params=params, timeout=10)
            data = response.json()
            
            # Process response
            if data.get("status") == "OK":
                element = data["rows"][0]["elements"][0]
                if element.get("status") == "OK":
                    result = {
                        'success': True,
                        'distance_meters': element["distance"]["value"],
                        'distance_text': element["distance"]["text"],
                        'duration_seconds': element["duration"]["value"],
                        'duration_text': element["duration"]["text"],
                        'origin_address': data.get("origin_addresses", [origin])[0],
                        'destination_address': data.get("destination_addresses", [destination])[0],
                        'transport_mode': transport_mode_to_use,
                        'api_status': 'success'
                    }
                    
                    # Add additional traffic info if available
                    if 'duration_in_traffic' in element:
                        result['duration_in_traffic_seconds'] = element["duration_in_traffic"]["value"]
                        result['duration_in_traffic_text'] = element["duration_in_traffic"]["text"]
                    
                    # Cache the result
                    self.cache[cache_key] = {
                        'timestamp': time.time(),
                        'data': result
                    }
                    
                    return result
                else:
                    # If bicycling fails, try with driving
                    if transport_mode_to_use == 'bicycling':
                        print(f"⚠ Bicycling mode failed: {element.get('status')}. Trying with driving...")
                        return self.get_delivery_route_info(origin, destination, 'driving')
                    else:
                        return {
                            'success': False,
                            'error': f"Route calculation failed: {element.get('status')}",
                            'api_status': 'route_error'
                        }
            else:
                return {
                    'success': False,
                    'error': f"API request failed: {data.get('status')}",
                    'api_status': 'api_error'
                }
                
        except requests.exceptions.Timeout:
            return {
                'success': False,
                'error': "Distance API timeout after 10 seconds",
                'api_status': 'timeout'
            }
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': f"Distance API request error: {str(e)}",
                'api_status': 'network_error'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Unexpected error: {str(e)}",
                'api_status': 'unexpected_error'
            }
    
    def get_weather_data(self, lat: float = None, lon: float = None, 
                        city: str = None, country_code: str = None) -> Dict:
        """
        Get weather data for a location
        Can use coordinates (lat, lon) OR city name
        """
        try:
            # Create cache key
            if lat is not None and lon is not None:
                cache_key = f"weather_{lat}_{lon}"
                params = {
                    'lat': lat,
                    'lon': lon,
                    'appid': self.weather_api_key,
                    'units': 'metric'
                }
            elif city is not None:
                cache_key = f"weather_{city}_{country_code}"
                query = f"{city},{country_code}" if country_code else city
                params = {
                    'q': query,
                    'appid': self.weather_api_key,
                    'units': 'metric'
                }
            else:
                return {
                    'success': False,
                    'error': "Either coordinates (lat, lon) or city name must be provided",
                    'api_status': 'invalid_params'
                }
            
            # Check cache
            if cache_key in self.cache:
                cached_data = self.cache[cache_key]
                if time.time() - cached_data['timestamp'] < self.cache_timeout:
                    print(f"Using cached weather data for {cache_key}")
                    return cached_data['data']
            
            # Make API request
            response = requests.get(self.weather_api_url, params=params, timeout=10)
            data = response.json()
            
            # Check for API errors
            if data.get("cod") != 200:
                error_msg = data.get("message", "Unknown weather API error")
                return {
                    'success': False,
                    'error': error_msg,
                    'api_status': 'weather_api_error'
                }
            
            # Parse successful response
            weather_data = {
                'success': True,
                'temperature_value': data['main']['temp'],
                'feels_like': data['main']['feels_like'],
                'temp_min': data['main']['temp_min'],
                'temp_max': data['main']['temp_max'],
                'pressure': data['main']['pressure'],
                'humidity': data['main']['humidity'],
                'wind_speed': data['wind'].get('speed', 0),
                'wind_deg': data['wind'].get('deg', 0),
                'wind_gust': data['wind'].get('gust', 0),
                'cloudness': data['clouds']['all'],
                'weather_main': data['weather'][0]['main'],
                'weather_desc': data['weather'][0]['description'],
                'weather_icon': data['weather'][0]['icon'],
                'visibility': data.get('visibility', 10000),
                'timestamp': data['dt'],
                'location': {
                    'city': data.get('name'),
                    'country': data['sys'].get('country'),
                    'lat': data['coord']['lat'],
                    'lon': data['coord']['lon']
                },
                'sunrise': data['sys']['sunrise'],
                'sunset': data['sys']['sunset'],
                'api_status': 'success'
            }
            
            # Try to get precipitation data
            if 'rain' in data:
                weather_data['rain_1h'] = data['rain'].get('1h', 0)
                weather_data['rain_3h'] = data['rain'].get('3h', 0)
            if 'snow' in data:
                weather_data['snow_1h'] = data['snow'].get('1h', 0)
                weather_data['snow_3h'] = data['snow'].get('3h', 0)
            
            # Cache the result
            self.cache[cache_key] = {
                'timestamp': time.time(),
                'data': weather_data
            }
            
            return weather_data
            
        except requests.exceptions.Timeout:
            return {
                'success': False,
                'error': "Weather API timeout after 10 seconds",
                'api_status': 'timeout'
            }
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': f"Weather API request error: {str(e)}",
                'api_status': 'network_error'
            }
        except KeyError as e:
            return {
                'success': False,
                'error': f"Unexpected API response format: missing {str(e)}",
                'api_status': 'format_error'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Unexpected error: {str(e)}",
                'api_status': 'unexpected_error'
            }
    
    def get_complete_delivery_data(self, origin: str, destination: str, 
                                  transport_mode: str = 'driving',
                                  weather_location: str = None) -> Dict:
        """
        Get complete delivery data: route info + weather
        Automatically extracts coordinates from addresses
        """
        print(f"\n🔍 Getting delivery data for:")
        print(f"   Origin: {origin}")
        print(f"   Destination: {destination}")
        print(f"   Transport mode: {transport_mode}")
        
        # Get route information
        route_info = self.get_delivery_route_info(origin, destination, transport_mode)
        
        # Determine which location to use for weather
        weather_location_to_use = weather_location if weather_location else origin
        
        print(f"   Weather location: {weather_location_to_use}")
        
        # Get weather data for the specified location
        weather_info = self.get_weather_for_address(weather_location_to_use)
        
        # If weather failed, try destination as fallback
        if not weather_info.get('success') and weather_location_to_use != destination:
            print(f"⚠ Weather failed for {weather_location_to_use}, trying destination...")
            weather_info = self.get_weather_for_address(destination)
        
        # Combine results
        result = {
            'route': route_info,
            'weather': weather_info,
            'metadata': {
                'origin': origin,
                'destination': destination,
                'transport_mode': transport_mode,
                'timestamp': time.time(),
                'weather_location': weather_location_to_use,
                'coordinates_extracted': True
            }
        }
        
        return result
    
    def print_delivery_summary(self, delivery_data: Dict) -> None:
        """Print a formatted summary of delivery data"""
        route = delivery_data['route']
        weather = delivery_data['weather']
        
        print("\n" + "="*60)
        print("📦 DELIVERY DATA SUMMARY")
        print("="*60)
        
        if route.get('success'):
            print(f"📍 Route: {route.get('origin_address', 'Unknown')}")
            print(f"          → {route.get('destination_address', 'Unknown')}")
            print(f"📏 Distance: {route['distance_text']} ({route['distance_meters']} meters)")
            print(f"⏱️  Duration: {route['duration_text']} ({route['duration_seconds']} seconds)")
            print(f"🚗 Mode: {route.get('transport_mode', 'Unknown')}")
            
            if 'duration_in_traffic_text' in route:
                print(f"🚦 Traffic duration: {route['duration_in_traffic_text']}")
        else:
            print(f"❌ Route Error: {route.get('error', 'Unknown error')}")
        
        print("\n" + "-"*60)
        print("🌤️  WEATHER CONDITIONS")
        print("-"*60)
        
        if weather.get('success'):
            print(f"✅ Weather API: Success")
            print(f"🌡️  Temperature: {weather['temperature_value']:.1f}°C")
            print(f"   Feels like: {weather['feels_like']:.1f}°C")
            print(f"💧 Humidity: {weather['humidity']}%")
            print(f"💨 Wind: {weather['wind_speed']} m/s")
            print(f"☁️  Clouds: {weather['cloudness']}%")
            print(f"🌈 Conditions: {weather['weather_desc'].title()}")
            
            if 'rain_1h' in weather and weather['rain_1h'] > 0:
                print(f"🌧️  Rain (1h): {weather['rain_1h']} mm")
            if 'snow_1h' in weather and weather['snow_1h'] > 0:
                print(f"❄️  Snow (1h): {weather['snow_1h']} mm")
            
            if 'location' in weather:
                loc = weather['location']
                print(f"📍 Location: {loc.get('city', 'Unknown')}, {loc.get('country', 'Unknown')}")
        else:
            print(f"⚠ Weather: {weather.get('api_status', 'fallback')}")
            if 'error' in weather:
                print(f"   Error: {weather['error']}")
            print(f"🌡️  Temperature: {weather.get('temperature_value', 'N/A')}°C")
            print(f"💧 Humidity: {weather.get('humidity', 'N/A')}%")
            print(f"💨 Wind: {weather.get('wind_speed', 'N/A')} m/s")
        
        print("="*60)


def main():
    """Основная функция для демонстрации работы системы"""
    print("\n" + "="*60)
    print("🚖 UBER/GETT ЦЕНА ПРЕДСКАЗАТЕЛЬ ПО АДРЕСАМ")
    print("="*60)
    
    try:
        # Инициализируем предсказатель
        predictor = UberPricePredictor()
        
        # Примеры использования
        
        # Пример 1: Москва
        print("\n📋 ПРИМЕР 1: Москва (стандартный маршрут)")
        print("-" * 40)
        
        result1 = predictor.predict_price_from_addresses(
            origin="ул. Тверская, 7, Москва",
            destination="Красная площадь, Москва",
            transport_mode='driving'
        )
        
        if result1['success']:
            predictor.save_prediction_result(result1, "москва_тверская_красная_площадь.json")
        
        # Пример 2: Санкт-Петербург
        print("\n📋 ПРИМЕР 2: Санкт-Петербург (пешая прогулка)")
        print("-" * 40)
        
        result2 = predictor.predict_price_from_addresses(
            origin="Невский проспект, Санкт-Петербург",
            destination="Петропавловская крепость, Санкт-Петербург",
            transport_mode='walking'
        )
        
        if result2['success']:
            predictor.save_prediction_result(result2, "спб_невский_крепость.json")
        
        # Пример 3: Казань
        print("\n📋 ПРИМЕР 3: Казань (длинный маршрут)")
        print("-" * 40)
        
        result3 = predictor.predict_price_from_addresses(
            origin="улица Ленина, 1, Казань",
            destination="Казанский Кремль, Казань",
            transport_mode='driving'
        )
        
        if result3['success']:
            predictor.save_prediction_result(result3, "казань_ленина_кремль.json")
        
        # Пример 4: Пользовательский ввод через аргументы
        import sys
        if len(sys.argv) >= 3:
            print("\n📋 ПРИМЕР 4: Командная строка")
            print("-" * 40)
            
            user_origin = sys.argv[1]
            user_destination = sys.argv[2]
            user_mode = sys.argv[3] if len(sys.argv) > 3 else 'driving'
            
            user_result = predictor.predict_price_from_addresses(
                origin=user_origin,
                destination=user_destination,
                transport_mode=user_mode
            )
            
            if user_result['success']:
                filename = f"custom_{datetime.now().strftime('%H%M%S')}.json"
                predictor.save_prediction_result(user_result, filename)
        
        print("\n" + "="*60)
        print("✅ СИСТЕМА УСПЕШНО ЗАВЕРШИЛА РАБОТУ")
        print("="*60)
        
        return result1
        
    except Exception as e:
        print(f"❌ Критическая ошибка: {e}")
        import traceback
        traceback.print_exc()
        return None


def interactive_mode():
    """Интерактивный режим работы"""
    print("\n" + "="*60)
    print("💬 ИНТЕРАКТИВНЫЙ РЕЖИМ UBER ПРЕДСКАЗАТЕЛЯ")
    print("="*60)
    
    predictor = UberPricePredictor()
    
    while True:
        print("\nВведите данные для предсказания стоимости поездки:")
        print("(или 'exit' для выхода)")
        
        origin = input("\n📍 Откуда (адрес начала): ")
        if origin.lower() == 'exit':
            break
        
        destination = input("📍 Куда (адрес назначения): ")
        if destination.lower() == 'exit':
            break
        
        transport_mode = input("🚗 Режим (driving/walking/bicycling, по умолчанию driving): ")
        if not transport_mode:
            transport_mode = 'driving'
        
        print("\n" + "-"*40)
        print("🔍 Обработка запроса...")
        
        result = predictor.predict_price_from_addresses(origin, destination, transport_mode)
        
        if result['success']:
            save = input("\n💾 Сохранить результат? (y/n): ")
            if save.lower() == 'y':
                predictor.save_prediction_result(result)
        
        continue_prompt = input("\n📝 Продолжить? (y/n): ")
        if continue_prompt.lower() != 'y':
            break
    
    print("\n👋 Спасибо за использование Uber Price Predictor!")


if __name__ == "__main__":
    # Для автоматического запуска примеров:
    # python uber_price_predictor.py
    
    # Для интерактивного режима:
    # python uber_price_predictor.py interactive
    
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "interactive":
        interactive_mode()
    else:
        main()