"""
Система расчета стоимости доставки по адресам с учетом характеристик груза
"""

import requests
import json
import joblib
import pandas as pd
import numpy as np
from typing import Dict, Optional, Tuple, List, Any
import time
import re
import os
from datetime import datetime
from enum import Enum

class ItemCategory(Enum):
    """Категории грузов"""
    DOCUMENTS_SMALL = "Документы и мелкие посылки"
    FURNITURE_APPLIANCES = "Мебель и бытовая техника"
    CONSTRUCTION_MATERIAL = "Строительные материалы"
    FOOD_BEVERAGES = "Продукты питания и напитки"
    ELECTRONICS_FRAGILE = "Электроника и хрупкие товары"
    OTHER = "Другое"

class DeliveryUrgency(Enum):
    """Срочность доставки"""
    STANDARD = "Стандартная (сегодня)"
    URGENT = "Срочная (в течение 2 часов)"
    SCHEDULED = "По расписанию (завтра)"

class SpecialRequirements(Enum):
    """Особые требования"""
    FRAGILE = "Хрупкий груз"
    REFRIGERATED = "Охлаждаемый"
    OVERSIZED = "Крупногабаритный"
    HAZARDOUS = "Опасный груз"
    NONE = "Нет особых требований"

class VehicleType(Enum):
    """Типы транспортных средств"""
    MOTORCYCLE = "motorcycle"  # Мотоцикл
    CAR_SEDAN = "car_sedan"    # Легковой автомобиль
    CAR_HATCHBACK = "car_hatchback"  # Хэтчбек
    CAR_SUV = "car_suv"        # Внедорожник
    VAN_SMALL = "van_small"    # Маленький фургон
    VAN_MEDIUM = "van_medium"  # Средний фургон
    VAN_LARGE = "van_large"    # Большой фургон
    TRUCK_SMALL = "truck_small"  # Маленький грузовик
    TRUCK_MEDIUM = "truck_medium"  # Средний грузовик

class DeliveryPricePredictor:
    """Система расчета стоимости доставки с учетом груза"""
    
    def __init__(self, models_dir='E:/DiplomaWork/BACKEND/historical-rides/models'):
        """
        Инициализация системы расчета стоимости
        
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
        
        # Тарифы и коэффициенты
        self.base_rates = {
            'motorcycle': 150,  # базовый тариф за км
            'car_sedan': 200,
            'car_hatchback': 180,
            'car_suv': 220,
            'van_small': 300,
            'van_medium': 400,
            'van_large': 500,
            'truck_small': 600,
            'truck_medium': 800
        }
        
        # Коэффициенты срочности
        self.urgency_multipliers = {
            DeliveryUrgency.STANDARD: 1.0,
            DeliveryUrgency.URGENT: 1.5,
            DeliveryUrgency.SCHEDULED: 0.9
        }
        
        # Коэффициенты особых требований
        self.special_requirements_multipliers = {
            SpecialRequirements.FRAGILE: 1.3,
            SpecialRequirements.REFRIGERATED: 1.5,
            SpecialRequirements.OVERSIZED: 1.4,
            SpecialRequirements.HAZARDOUS: 1.8,
            SpecialRequirements.NONE: 1.0
        }
        
        print("🚚 DeliveryPricePredictor инициализирован")
    
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
    
    def determine_vehicle_type(self, item_category: ItemCategory, 
                              weight_kg: float = None, 
                              volume_m3: float = None) -> VehicleType:
        """
        Определяет тип транспортного средства на основе характеристик груза
        """
        print(f"\n🚚 Определение типа транспорта...")
        print(f"   Категория: {item_category.value}")
        
        if weight_kg:
            print(f"   Вес: {weight_kg} кг")
        if volume_m3:
            print(f"   Объем: {volume_m3} м³")
        
        # Правила определения транспорта
        if item_category == ItemCategory.DOCUMENTS_SMALL:
            if weight_kg and weight_kg > 5:
                vehicle = VehicleType.CAR_SEDAN
            else:
                vehicle = VehicleType.MOTORCYCLE
                
        elif item_category == ItemCategory.FURNITURE_APPLIANCES:
            if volume_m3 and volume_m3 > 10:
                vehicle = VehicleType.TRUCK_MEDIUM
            elif volume_m3 and volume_m3 > 5:
                vehicle = VehicleType.VAN_LARGE
            elif volume_m3 and volume_m3 > 2:
                vehicle = VehicleType.VAN_MEDIUM
            else:
                vehicle = VehicleType.VAN_SMALL
                
        elif item_category == ItemCategory.CONSTRUCTION_MATERIAL:
            if weight_kg and weight_kg > 500:
                vehicle = VehicleType.TRUCK_MEDIUM
            elif weight_kg and weight_kg > 200:
                vehicle = VehicleType.TRUCK_SMALL
            else:
                vehicle = VehicleType.VAN_LARGE
                
        elif item_category == ItemCategory.FOOD_BEVERAGES:
            if weight_kg and weight_kg > 100:
                vehicle = VehicleType.VAN_MEDIUM
            elif volume_m3 and volume_m3 > 3:
                vehicle = VehicleType.VAN_SMALL
            else:
                vehicle = VehicleType.CAR_HATCHBACK
                
        elif item_category == ItemCategory.ELECTRONICS_FRAGILE:
            if weight_kg and weight_kg > 50:
                vehicle = VehicleType.VAN_SMALL
            elif volume_m3 and volume_m3 > 1:
                vehicle = VehicleType.CAR_SUV
            else:
                vehicle = VehicleType.CAR_SEDAN
                
        else:  # ItemCategory.OTHER
            if weight_kg and weight_kg > 100:
                vehicle = VehicleType.VAN_MEDIUM
            elif volume_m3 and volume_m3 > 5:
                vehicle = VehicleType.VAN_SMALL
            else:
                vehicle = VehicleType.CAR_SEDAN
        
        print(f"   Рекомендованный транспорт: {vehicle.value}")
        return vehicle
    
    def get_transport_mode_for_api(self, vehicle_type: VehicleType) -> str:
        """
        Преобразует тип транспорта в режим для DistanceMatrix API
        """
        # DistanceMatrix API поддерживает только 'driving', 'walking', 'bicycling', 'transit'
        # Все наши транспортные средства относятся к 'driving'
        return 'driving'
    
    def get_delivery_data(self, origin: str, destination: str, 
                         vehicle_type: VehicleType) -> Dict:
        """
        Получает данные о маршруте и погоде через API
        
        Args:
            origin: Адрес начала поездки
            destination: Адрес назначения
            vehicle_type: Тип транспортного средства
            
        Returns:
            Dict: Данные о маршруте и погоде
        """
        print(f"\n📍 Получение данных о маршруте...")
        print(f"   От: {origin}")
        print(f"   До: {destination}")
        print(f"   Транспорт: {vehicle_type.value}")
        
        # Получаем полные данные о доставке
        delivery_data = self.delivery_service.get_complete_delivery_data(
            origin=origin,
            destination=destination,
            transport_mode=self.get_transport_mode_for_api(vehicle_type)
        )
        
        return delivery_data
    
    def prepare_prediction_features(self, 
                                  delivery_data: Dict,
                                  vehicle_type: VehicleType,
                                  item_category: ItemCategory,
                                  urgency: DeliveryUrgency,
                                  special_requirement: SpecialRequirements) -> pd.DataFrame:
        """
        Подготавливает признаки для ML модели
        """
        route = delivery_data['route']
        weather = delivery_data['weather']
        
        print("\n🔧 Подготовка признаков для ML модели...")
        
        # Создаем пустой DataFrame с нулями для ВСЕХ признаков
        input_df = pd.DataFrame(np.zeros((1, len(self.feature_names))), 
                               columns=self.feature_names)
        
        # 1. ОСНОВНЫЕ ПРИЗНАКИ ИЗ API
        if route.get('success'):
            distance_km = route['distance_meters'] / 1000
            duration_minutes = route['duration_seconds'] / 60
            
            # Важные признаки из модели
            if 'distance_kms' in self.feature_names:
                input_df['distance_kms'] = distance_km
            
            if 'trip_time_minutes' in self.feature_names:
                input_df['trip_time_minutes'] = duration_minutes
            
            if 'total_time_minutes' in self.feature_names:
                input_df['total_time_minutes'] = duration_minutes
            
            print(f"  ✓ Расстояние: {distance_km:.2f} км")
            print(f"  ✓ Время: {duration_minutes:.1f} мин")
        
        # 2. ПОГОДНЫЕ ПРИЗНАКИ
        if weather.get('success'):
            current_hour = datetime.now().hour
            current_month = datetime.now().month
            
            # Температура
            if 'temperature_value' in self.feature_names:
                temp_value = weather.get('temperature_value', 20)
                input_df['temperature_value'] = temp_value
            
            # Взаимодействие температуры и времени
            if 'temp_hour_interaction' in self.feature_names:
                temp_value = weather.get('temperature_value', 20)
                input_df['temp_hour_interaction'] = temp_value * current_hour
            
            # Месяц температуры
            if 'temperature_time_month' in self.feature_names:
                input_df['temperature_time_month'] = current_month
            
            print(f"  ✓ Температура: {weather.get('temperature_value', 'N/A')}°C")
            print(f"  ✓ Взаимодействие температуры и времени: {input_df.get('temp_hour_interaction', 'N/A').iloc[0]}")
        
        # 3. ПРИЗНАКИ ТРАНСПОРТА И ГРУЗА
        # Типы поездок (UberX, UberBlack)
        if 'trip_type_uberx' in self.feature_names:
            # UberX для стандартных грузов
            if vehicle_type in [VehicleType.MOTORCYCLE, VehicleType.CAR_SEDAN, 
                              VehicleType.CAR_HATCHBACK, VehicleType.CAR_SUV]:
                input_df['trip_type_uberx'] = 1
            else:
                input_df['trip_type_uberx'] = 0
        
        if 'trip_type_uberblack' in self.feature_names:
            # UberBlack для премиум-транспорта
            if vehicle_type in [VehicleType.CAR_SUV, VehicleType.VAN_SMALL]:
                input_df['trip_type_uberblack'] = 1
            else:
                input_df['trip_type_uberblack'] = 0
        
        # Марка автомобиля (в нашем случае определяем по типу транспорта)
        # В модели может быть 'vehicle_make', но мы используем типы поездок
        
        # Приложение (Uber vs Gett)
        if 'ride_hailing_app_Uber' in self.feature_names:
            # Предполагаем Uber как основное приложение
            input_df['ride_hailing_app_Uber'] = 1
        
        # 4. ДОПОЛНИТЕЛЬНЫЕ ПРИЗНАКИ
        # Множитель спроса
        if 'surge_multiplier' in self.feature_names:
            # Учитываем срочность
            input_df['surge_multiplier'] = self.urgency_multipliers.get(urgency, 1.0)
        
        # Скорость
        if 'speed_kmh' in self.feature_names and 'distance_kms' in input_df.columns and 'total_time_minutes' in input_df.columns:
            distance = input_df['distance_kms'].iloc[0]
            time_minutes = input_df['total_time_minutes'].iloc[0]
            if time_minutes > 0:
                input_df['speed_kmh'] = distance / (time_minutes / 60)
        
        # 5. ВРЕМЕННЫЕ ПРИЗНАКИ
        current_hour = datetime.now().hour
        if 'trip_start_time_hour' in self.feature_names:
            input_df['trip_start_time_hour'] = current_hour
        
        # Время суток
        time_of_day_features = [f for f in self.feature_names if 'timeofday' in f]
        if time_of_day_features:
            if 5 <= current_hour < 12:
                for feature in time_of_day_features:
                    if 'morning' in feature:
                        input_df[feature] = 1
            elif 12 <= current_hour < 17:
                for feature in time_of_day_features:
                    if 'afternoon' in feature:
                        input_df[feature] = 1
            elif 17 <= current_hour < 22:
                for feature in time_of_day_features:
                    if 'evening' in feature:
                        input_df[feature] = 1
            else:
                for feature in time_of_day_features:
                    if 'night' in feature:
                        input_df[feature] = 1
        
        # 6. ВЫВОДИМ ИНФОРМАЦИЮ О ПРИЗНАКАХ
        print(f"\n📊 Заполненные признаки:")
        non_zero_features = input_df.columns[(input_df != 0).any()].tolist()
        
        for feature in non_zero_features[:10]:
            value = input_df[feature].iloc[0]
            print(f"   {feature:30s}: {value}")
        
        if len(non_zero_features) > 10:
            print(f"   ... и еще {len(non_zero_features) - 10} признаков")
        
        print(f"\n✅ Подготовлено {len(self.feature_names)} признаков")
        print(f"   Ненулевых: {len(non_zero_features)}")
        
        return input_df
    
    def calculate_adjustments(self, 
                            base_price: float,
                            distance_km: float,
                            vehicle_type: VehicleType,
                            item_category: ItemCategory,
                            weight_kg: float = None,
                            volume_m3: float = None,
                            urgency: DeliveryUrgency = DeliveryUrgency.STANDARD,
                            special_requirement: SpecialRequirements = SpecialRequirements.NONE) -> Dict[str, Any]:
        """
        Рассчитывает корректировки к базовой цене
        """
        adjustments = {
            'base_price': base_price,
            'adjustments': [],
            'total_adjustment': 0,
            'final_price': base_price
        }
        
        # 1. Базовый тариф за транспорт - ИСПРАВЛЕННЫЙ РАСЧЕТ
        vehicle_rate = self.base_rates.get(vehicle_type.value, 200)
        
        # Убедимся, что distance_km не ноль (минимальное расстояние 1 км)
        actual_distance = max(distance_km, 1.0)
        vehicle_adjustment = vehicle_rate * actual_distance * 0.1  # 10% от базового тарифа
        
        adjustments['adjustments'].append({
            'name': f'Тариф {vehicle_type.value}',
            'amount': vehicle_adjustment,
            'percentage': 10.0
        })
        
        # 2. Коэффициент срочности
        urgency_multiplier = self.urgency_multipliers.get(urgency, 1.0)
        urgency_adjustment = base_price * (urgency_multiplier - 1.0)
        adjustments['adjustments'].append({
            'name': f'Срочность: {urgency.value}',
            'amount': urgency_adjustment,
            'percentage': (urgency_multiplier - 1.0) * 100
        })
        
        # 3. Коэффициент особых требований
        special_multiplier = self.special_requirements_multipliers.get(special_requirement, 1.0)
        special_adjustment = base_price * (special_multiplier - 1.0)
        if special_requirement != SpecialRequirements.NONE:
            adjustments['adjustments'].append({
                'name': f'Особое требование: {special_requirement.value}',
                'amount': special_adjustment,
                'percentage': (special_multiplier - 1.0) * 100
            })
        
        # 4. Корректировка по весу
        if weight_kg:
            weight_factor = min(weight_kg / 50, 2.0)  # Максимум 2x за вес
            weight_adjustment = base_price * (weight_factor - 1.0) * 0.3  # 30% влияния веса
            adjustments['adjustments'].append({
                'name': f'Вес: {weight_kg} кг',
                'amount': weight_adjustment,
                'percentage': (weight_factor - 1.0) * 30
            })
        
        # 5. Корректировка по объему
        if volume_m3:
            volume_factor = min(volume_m3 / 2, 2.0)  # Максимум 2x за объем
            volume_adjustment = base_price * (volume_factor - 1.0) * 0.2  # 20% влияния объема
            adjustments['adjustments'].append({
                'name': f'Объем: {volume_m3} м³',
                'amount': volume_adjustment,
                'percentage': (volume_factor - 1.0) * 20
            })
        
        # Суммируем все корректировки
        total_adjustment = sum(adj['amount'] for adj in adjustments['adjustments'])
        final_price = base_price + total_adjustment
        
        adjustments['total_adjustment'] = total_adjustment
        adjustments['final_price'] = final_price
        
        return adjustments
    
    def calculate_delivery_price(self,
                               origin: str,
                               destination: str,
                               item_category: ItemCategory,
                               weight_kg: float = None,
                               volume_m3: float = None,
                               urgency: DeliveryUrgency = DeliveryUrgency.STANDARD,
                               special_requirement: SpecialRequirements = SpecialRequirements.NONE) -> Dict[str, Any]:
        """
        Основная функция расчета стоимости доставки
        
        Args:
            origin: Адрес забора
            destination: Адрес доставки
            item_category: Категория груза
            weight_kg: Вес груза (кг)
            volume_m3: Объем груза (м³)
            urgency: Срочность доставки
            special_requirement: Особые требования
            
        Returns:
            Dict: Полные результаты расчета
        """
        print("\n" + "="*60)
        print("🚚 РАСЧЕТ СТОИМОСТИ ДОСТАВКИ")
        print("="*60)
        
        try:
            # 1. Определяем тип транспорта
            vehicle_type = self.determine_vehicle_type(item_category, weight_kg, volume_m3)
            
            # 2. Получаем данные о маршруте и погоде
            delivery_data = self.get_delivery_data(origin, destination, vehicle_type)
            
            # Выводим сводку
            self.delivery_service.print_delivery_summary(delivery_data)
            
            # 3. Подготавливаем признаки для ML модели
            features_df = self.prepare_prediction_features(
                delivery_data, vehicle_type, item_category, urgency, special_requirement
            )
            
            if features_df is None:
                return {
                    'success': False,
                    'error': 'Не удалось подготовить данные для расчета',
                    'timestamp': datetime.now().isoformat()
                }
            
            # 4. Применяем масштабирование и предсказываем базовую стоимость
            scaled_features = self.scaler.transform(features_df)
            base_price_rub = self.model.predict(scaled_features)[0]
            
            # 5. Получаем данные о расстоянии для корректировок
            distance_km = 0
            if delivery_data['route'].get('success'):
                distance_km = delivery_data['route']['distance_meters'] / 1000
            
            # 6. Рассчитываем корректировки
            adjustments = self.calculate_adjustments(
                base_price=base_price_rub,
                distance_km=distance_km,
                vehicle_type=vehicle_type,
                item_category=item_category,
                weight_kg=weight_kg,
                volume_m3=volume_m3,
                urgency=urgency,
                special_requirement=special_requirement
            )
            
            final_price_rub = adjustments['final_price']
            final_price_usd = final_price_rub / self.usd_exchange_rate
            
            # 7. Рассчитываем доверительный интервал
            confidence_interval = final_price_rub * (self.confidence_percentage / 100)
            
            # 8. Формируем полный результат
            result = {
                'success': True,
                'price_breakdown': {
                    'base_price_rub': float(base_price_rub),
                    'adjustments': adjustments['adjustments'],
                    'total_adjustment_rub': float(adjustments['total_adjustment']),
                    'final_price_rub': float(final_price_rub),
                    'final_price_usd': float(final_price_usd),
                    'confidence_interval': {
                        'lower_bound_rub': float(final_price_rub - confidence_interval),
                        'upper_bound_rub': float(final_price_rub + confidence_interval),
                        'percentage': float(self.confidence_percentage)
                    }
                },
                'delivery_details': {
                    'origin': delivery_data['metadata']['origin'],
                    'destination': delivery_data['metadata']['destination'],
                    'distance_km': float(distance_km),
                    'distance_text': delivery_data['route'].get('distance_text', ''),
                    'duration_minutes': float(delivery_data['route']['duration_seconds'] / 60) if delivery_data['route'].get('success') else 0,
                    'duration_text': delivery_data['route'].get('duration_text', ''),
                    'recommended_vehicle': vehicle_type.value,
                    'item_category': item_category.value,
                    'weight_kg': weight_kg,
                    'volume_m3': volume_m3,
                    'urgency': urgency.value,
                    'special_requirement': special_requirement.value
                },
                'weather_data': {
                    'temperature': float(delivery_data['weather'].get('temperature_value', 0)) if delivery_data['weather'].get('success') else 0,
                    'feels_like': float(delivery_data['weather'].get('feels_like', 0)) if delivery_data['weather'].get('success') else 0,
                    'humidity': int(delivery_data['weather'].get('humidity', 0)) if delivery_data['weather'].get('success') else 0,
                    'conditions': delivery_data['weather'].get('weather_desc', '') if delivery_data['weather'].get('success') else 'Нет данных'
                },
                'timestamp': datetime.now().isoformat(),
                'model_info': {
                    'model_type': 'XGBoost',
                    'r2_score': 0.8117,
                    'confidence_level': f"{self.confidence_percentage}%"
                }
            }
            
            # 9. Выводим результат
            self.print_delivery_result(result)
            
            return result
            
        except Exception as e:
            error_result = {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            print(f"❌ Ошибка при расчете: {e}")
            import traceback
            traceback.print_exc()
            return error_result
    
    def print_delivery_result(self, result: Dict[str, Any]):
        """Выводит результат расчета в удобном формате"""
        print("\n" + "="*60)
        print("🎯 РЕЗУЛЬТАТ РАСЧЕТА СТОИМОСТИ ДОСТАВКИ")
        print("="*60)
        
        if result['success']:
            price = result['price_breakdown']
            details = result['delivery_details']
            weather = result['weather_data']
            
            print(f"📍 Маршрут:")
            print(f"   От: {details['origin'][:50]}...")
            print(f"   До: {details['destination'][:50]}...")
            print(f"   Расстояние: {details['distance_text']} ({details['distance_km']:.2f} км)")
            print(f"   Время: {details['duration_text']} ({details['duration_minutes']:.1f} мин)")
            
            print(f"\n🚚 Характеристики доставки:")
            print(f"   Категория груза: {details['item_category']}")
            print(f"   Рекомендованный транспорт: {details['recommended_vehicle']}")
            if details['weight_kg']:
                print(f"   Вес: {details['weight_kg']} кг")
            if details['volume_m3']:
                print(f"   Объем: {details['volume_m3']} м³")
            print(f"   Срочность: {details['urgency']}")
            print(f"   Особые требования: {details['special_requirement']}")
            
            print(f"\n🌤️  Погодные условия:")
            print(f"   Температура: {weather['temperature']:.1f}°C")
            print(f"   Ощущается как: {weather['feels_like']:.1f}°C")
            print(f"   Влажность: {weather['humidity']}%")
            print(f"   Условия: {weather['conditions']}")
            
            print(f"\n💰 РАСЧЕТ СТОИМОСТИ:")
            print(f"   Базовая стоимость: {price['base_price_rub']:.2f} RUB")
            
            if price['adjustments']:
                print(f"   Корректировки:")
                for adj in price['adjustments']:
                    sign = "+" if adj['amount'] >= 0 else ""
                    print(f"     {adj['name']}: {sign}{adj['amount']:.2f} RUB ({adj['percentage']:+.1f}%)")
            
            print(f"   Итоговая стоимость: {price['final_price_rub']:.2f} RUB")
            print(f"   Итоговая стоимость: {price['final_price_usd']:.2f} USD (курс {self.usd_exchange_rate:.1f} RUB/USD)")
            
            print(f"   Доверительный интервал ({price['confidence_interval']['percentage']}%):")
            print(f"     От: {price['confidence_interval']['lower_bound_rub']:.2f} RUB")
            print(f"     До: {price['confidence_interval']['upper_bound_rub']:.2f} RUB")
            
            # Сравнение со средней стоимостью
            avg_price_rub = 303.36
            comparison = (price['final_price_rub'] / avg_price_rub - 1) * 100
            
            print(f"\n📊 Сравнение со средней стоимостью:")
            print(f"   Средняя стоимость доставки: {avg_price_rub:.2f} RUB")
            print(f"   Разница: {comparison:+.1f}%")
            
            print(f"\n📈 Качество модели:")
            print(f"   R²: {result['model_info']['r2_score']:.4f} (очень хорошее)")
            print(f"   Уверенность: {result['model_info']['confidence_level']}")
            
        else:
            print(f"❌ Ошибка: {result.get('error', 'Неизвестная ошибка')}")
        
        print("="*60)
    
    def save_delivery_result(self, result: Dict[str, Any], filename: str = None):
        """Сохраняет результат расчета в JSON файл"""
        if not result['success']:
            print("⚠ Не удалось сохранить результат (ошибка расчета)")
            return
        
        # Создаем директорию для сохранения
        output_dir = 'delivery_predictions'
        os.makedirs(output_dir, exist_ok=True)
        
        # Генерируем имя файла
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            origin_short = result['delivery_details']['origin'][:20].replace(' ', '_')
            dest_short = result['delivery_details']['destination'][:20].replace(' ', '_')
            filename = f"delivery_{timestamp}_{origin_short}_to_{dest_short}.json"
        
        filepath = os.path.join(output_dir, filename)
        
        # Сохраняем в JSON
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Результат сохранен: {filepath}")
        return filepath


# Класс DeliveryDataService остается без изменений
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
        """Извлекает название города из адреса"""
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
        
        address_lower = address.lower()
        for pattern in city_patterns:
            match = re.search(pattern, address, re.IGNORECASE)
            if match:
                return match.group(1)
        
        parts = address.split(',')
        if len(parts) >= 2:
            possible_city = parts[-2].strip()
            if possible_city and len(possible_city) > 2:
                return possible_city
        
        return parts[-1].strip() if parts else address
    
    def get_coordinates_from_address(self, address: str) -> Optional[Tuple[float, float]]:
        """Получает координаты из адреса"""
        try:
            normalized_address = address.strip()
            if not normalized_address:
                return None
            
            cache_key = f"geocode_{normalized_address}"
            
            if cache_key in self.cache:
                cached_data = self.cache[cache_key]
                if time.time() - cached_data['timestamp'] < self.cache_timeout:
                    return cached_data['data']
            
            print(f"🌍 Геокодирование адреса: {normalized_address}")
            
            # Попробуем OpenWeatherMap
            geocode_url = "http://api.openweathermap.org/geo/1.0/direct"
            params = {
                'q': normalized_address,
                'limit': 5,
                'appid': self.weather_api_key,
                'lang': 'en'
            }
            
            response = requests.get(geocode_url, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    best_match = data[0]
                    for result in data:
                        if result.get('country') == 'RU':
                            best_match = result
                            break
                    
                    coords = (best_match['lat'], best_match['lon'])
                    self.cache[cache_key] = {'timestamp': time.time(), 'data': coords}
                    return coords
            
            # Fallback: Nominatim
            nominatim_url = "https://nominatim.openstreetmap.org/search"
            params = {
                'q': normalized_address,
                'format': 'json',
                'limit': 1,
                'countrycodes': 'ru',
                'accept-language': 'en'
            }
            
            headers = {'User-Agent': 'DeliveryDataService/1.0'}
            response = requests.get(nominatim_url, params=params, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    coords = (float(data[0]['lat']), float(data[0]['lon']))
                    self.cache[cache_key] = {'timestamp': time.time(), 'data': coords}
                    return coords
            
            return None
                
        except Exception:
            return None
    
    def get_weather_by_coordinates(self, lat: float, lon: float) -> Dict:
        """Получает погоду по координатам"""
        return self.get_weather_data(lat=lat, lon=lon)
    
    def get_weather_for_address(self, address: str) -> Dict:
        """Получает погоду для адреса"""
        coords = self.get_coordinates_from_address(address)
        
        if coords:
            lat, lon = coords
            return self.get_weather_by_coordinates(lat, lon)
        else:
            city_name = self.extract_city_from_address(address)
            if city_name:
                return self.get_weather_data(city=city_name, country_code="RU")
            else:
                return {'success': False, 'error': 'Не удалось определить местоположение'}
    
    def get_delivery_route_info(self, origin: str, destination: str, 
                               transport_mode: str = 'driving') -> Dict:
        """Получает информацию о маршруте"""
        try:
            cache_key = f"route_{origin}_{destination}_{transport_mode}"

            if cache_key in self.cache:
                cached_data = self.cache[cache_key]
                if time.time() - cached_data['timestamp'] < self.cache_timeout:
                    return cached_data['data']

            print(f"🌐 Запрос к DistanceMatrix API...")
            print(f"   Origin: {origin}")
            print(f"   Destination: {destination}")
            print(f"   Mode: {transport_mode}")

            params = {
                "origins": origin,
                "destinations": destination,
                "key": self.distance_api_key,
                "mode": transport_mode,
                "departure_time": "now",
                "units": "metric",
                "language": "en"
            }

            response = requests.get(self.distance_api_url, params=params, timeout=10)
            data = response.json()

            print(f"📊 Ответ API: {data.get('status')}")

            if data.get("status") == "OK":
                element = data["rows"][0]["elements"][0]
                print(f"   Element status: {element.get('status')}")

                if element.get("status") == "OK":
                    result = {
                        'success': True,
                        'distance_meters': element["distance"]["value"],
                        'distance_text': element["distance"]["text"],
                        'duration_seconds': element["duration"]["value"],
                        'duration_text': element["duration"]["text"],
                        'origin_address': data.get("origin_addresses", [origin])[0],
                        'destination_address': data.get("destination_addresses", [destination])[0],
                        'transport_mode': transport_mode,
                        'api_status': 'success'
                    }

                    if 'duration_in_traffic' in element:
                        result['duration_in_traffic_seconds'] = element["duration_in_traffic"]["value"]
                        result['duration_in_traffic_text'] = element["duration_in_traffic"]["text"]

                    print(f"   Расстояние: {result['distance_text']}")
                    print(f"   Время: {result['duration_text']}")

                    self.cache[cache_key] = {'timestamp': time.time(), 'data': result}
                    return result
                else:
                    print(f"   Ошибка элемента: {element.get('status')}")
                    print(f"   Полный ответ: {data}")

            # Fallback: возвращаем фиктивные данные для тестирования
            print("⚠ Используем фиктивные данные для тестирования")
            # Рассчитываем реалистичное расстояние на основе координат
            estimated_distance = self.estimate_distance(origin, destination)
            estimated_time = self.estimate_time(estimated_distance, transport_mode)

            result = {
                'success': True,
                'distance_meters': estimated_distance,
                'distance_text': f"{estimated_distance/1000:.1f} km",
                'duration_seconds': estimated_time,
                'duration_text': f"{estimated_time//60} mins",
                'origin_address': origin,
                'destination_address': destination,
                'transport_mode': transport_mode,
                'api_status': 'fallback'
            }

            self.cache[cache_key] = {'timestamp': time.time(), 'data': result}
            return result

        except Exception as e:
            print(f"❌ Ошибка при получении маршрута: {e}")
            import traceback
            traceback.print_exc()

            # Fallback в случае ошибки
            estimated_distance = 5000  # 5 км
            estimated_time = 600  # 10 минут
            
            return {
                'success': True,
                'distance_meters': estimated_distance,
                'distance_text': "5.0 km",
                'duration_seconds': estimated_time,
                'duration_text': "10 mins",
                'origin_address': origin,
                'destination_address': destination,
                'transport_mode': transport_mode,
                'api_status': 'error_fallback'
            }
    
    def estimate_distance(self, origin: str, destination: str) -> int:
        """Оценивает расстояние между адресами (в метрах)"""
        # Простая эвристика: если адреса в одном городе, расстояние 5-15 км
        # Если разные города, расстояние больше
        
        origin_city = self.extract_city_from_address(origin)
        dest_city = self.extract_city_from_address(destination)
        
        if origin_city and dest_city and origin_city.lower() == dest_city.lower():
            # В одном городе: 5-15 км
            return np.random.randint(5000, 15000)
        else:
            # Между городами: 50-300 км
            return np.random.randint(50000, 300000)
    
    def estimate_time(self, distance_meters: int, transport_mode: str) -> int:
        """Оценивает время поездки (в секундах)"""
        # Средняя скорость в городе: 30-50 км/ч
        # Средняя скорость между городами: 60-90 км/ч
        
        distance_km = distance_meters / 1000
        
        if distance_km < 20:
            # Городская поездка
            avg_speed_kmh = np.random.randint(30, 50)
        else:
            # Загородная поездка
            avg_speed_kmh = np.random.randint(60, 90)
        
        # Время = расстояние / скорость (в часах) * 3600 секунд
        time_hours = distance_km / avg_speed_kmh
        return int(time_hours * 3600)
    
    def get_weather_data(self, lat: float = None, lon: float = None, 
                        city: str = None, country_code: str = None) -> Dict:
        """Получает данные о погоде"""
        try:
            if lat is not None and lon is not None:
                cache_key = f"weather_{lat}_{lon}"
                params = {'lat': lat, 'lon': lon, 'appid': self.weather_api_key, 'units': 'metric'}
            elif city is not None:
                cache_key = f"weather_{city}_{country_code}"
                query = f"{city},{country_code}" if country_code else city
                params = {'q': query, 'appid': self.weather_api_key, 'units': 'metric'}
            else:
                return {'success': False, 'error': 'Не указаны координаты или город'}
            
            if cache_key in self.cache:
                cached_data = self.cache[cache_key]
                if time.time() - cached_data['timestamp'] < self.cache_timeout:
                    return cached_data['data']
            
            response = requests.get(self.weather_api_url, params=params, timeout=10)
            data = response.json()
            
            if data.get("cod") != 200:
                return {'success': False, 'error': data.get("message", "Ошибка API погоды")}
            
            weather_data = {
                'success': True,
                'temperature_value': data['main']['temp'],
                'feels_like': data['main']['feels_like'],
                'humidity': data['main']['humidity'],
                'wind_speed': data['wind'].get('speed', 0),
                'cloudness': data['clouds']['all'],
                'weather_main': data['weather'][0]['main'],
                'weather_desc': data['weather'][0]['description'],
                'location': {'city': data.get('name'), 'country': data['sys'].get('country')}
            }
            
            self.cache[cache_key] = {'timestamp': time.time(), 'data': weather_data}
            return weather_data
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def get_complete_delivery_data(self, origin: str, destination: str, 
                                  transport_mode: str = 'driving',
                                  weather_location: str = None) -> Dict:
        """Получает полные данные о доставке"""
        route_info = self.get_delivery_route_info(origin, destination, transport_mode)
        
        weather_location_to_use = weather_location if weather_location else origin
        weather_info = self.get_weather_for_address(weather_location_to_use)
        
        if not weather_info.get('success') and weather_location_to_use != destination:
            weather_info = self.get_weather_for_address(destination)
        
        return {
            'route': route_info,
            'weather': weather_info,
            'metadata': {
                'origin': origin,
                'destination': destination,
                'transport_mode': transport_mode,
                'timestamp': time.time(),
                'weather_location': weather_location_to_use,
                'route_api_status': route_info.get('api_status', 'unknown')
            }
        }
    
    def print_delivery_summary(self, delivery_data: Dict) -> None:
        """Выводит сводку данных о доставке"""
        route = delivery_data['route']
        weather = delivery_data['weather']
        metadata = delivery_data['metadata']
        
        print("\n" + "="*60)
        print("📦 СВОДКА ДАННЫХ О ДОСТАВКЕ")
        print("="*60)
        
        if route.get('success'):
            print(f"📍 Маршрут: {route.get('origin_address', 'N/A')[:50]}...")
            print(f"          → {route.get('destination_address', 'N/A')[:50]}...")
            print(f"📏 Расстояние: {route['distance_text']}")
            print(f"⏱️  Время: {route['duration_text']}")
            print(f"🚗 Режим: {route.get('transport_mode', 'N/A')}")
            print(f"📡 Статус API: {route.get('api_status', 'unknown')}")
        
        print("\n🌤️  Погодные условия:")
        if weather.get('success'):
            print(f"✅ Погода: {weather['temperature_value']:.1f}°C, {weather['weather_desc']}")
            print(f"   Влажность: {weather['humidity']}%, Ветер: {weather['wind_speed']} м/с")
        else:
            print(f"⚠ Данные о погоде недоступны")
        
        print("="*60)


def main():
    """Основная функция демонстрации"""
    print("\n" + "="*60)
    print("🚚 КАЛЬКУЛЯТОР СТОИМОСТИ ДОСТАВКИ")
    print("="*60)
    
    try:
        predictor = DeliveryPricePredictor()
        
        # Пример 1: Документы (срочная доставка)
        print("\n📋 ПРИМЕР 1: Документы (срочная доставка)")
        print("-" * 40)
        
        result1 = predictor.calculate_delivery_price(
            origin="ул. Тверская, 7, Москва",
            destination="Красная площадь, Москва",
            item_category=ItemCategory.DOCUMENTS_SMALL,
            weight_kg=2.5,
            urgency=DeliveryUrgency.URGENT,
            special_requirement=SpecialRequirements.NONE
        )
        
        if result1['success']:
            predictor.save_delivery_result(result1, "документы_москва.json")
        
        # Пример 2: Мебель
        print("\n📋 ПРИМЕР 2: Мебель (стандартная доставка)")
        print("-" * 40)
        
        result2 = predictor.calculate_delivery_price(
            origin="Невский проспект, Санкт-Петербург",
            destination="Петропавловская крепость, Санкт-Петербург",
            item_category=ItemCategory.FURNITURE_APPLIANCES,
            weight_kg=85,
            volume_m3=4.5,
            urgency=DeliveryUrgency.STANDARD,
            special_requirement=SpecialRequirements.FRAGILE
        )
        
        if result2['success']:
            predictor.save_delivery_result(result2, "мебель_спб.json")
        
        # Пример 3: Продукты питания (охлаждаемые)
        print("\n📋 ПРИМЕР 3: Продукты питания (охлаждаемые)")
        print("-" * 40)
        
        result3 = predictor.calculate_delivery_price(
            origin="улица Ленина, 1, Казань",
            destination="Казанский Кремль, Казань",
            item_category=ItemCategory.FOOD_BEVERAGES,
            weight_kg=35,
            volume_m3=1.2,
            urgency=DeliveryUrgency.STANDARD,
            special_requirement=SpecialRequirements.REFRIGERATED
        )
        
        if result3['success']:
            predictor.save_delivery_result(result3, "продукты_казань.json")
        
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
    print("💬 ИНТЕРАКТИВНЫЙ РЕЖИМ КАЛЬКУЛЯТОРА ДОСТАВКИ")
    print("="*60)
    
    predictor = DeliveryPricePredictor()
    
    # Справочник категорий
    print("\n📦 КАТЕГОРИИ ГРУЗОВ:")
    for i, category in enumerate(ItemCategory, 1):
        print(f"{i}. {category.value}")
    
    # Справочник срочности
    print("\n⏰ СРОЧНОСТЬ ДОСТАВКИ:")
    for i, urgency in enumerate(DeliveryUrgency, 1):
        print(f"{i}. {urgency.value}")
    
    # Справочник особых требований
    print("\n⚠ ОСОБЫЕ ТРЕБОВАНИЯ:")
    for i, requirement in enumerate(SpecialRequirements, 1):
        print(f"{i}. {requirement.value}")
    
    while True:
        try:
            print("\n" + "-"*40)
            print("Введите данные для расчета стоимости доставки:")
            print("(или 'exit' для выхода)")
            
            origin = input("\n📍 Откуда забрать груз: ")
            if origin.lower() == 'exit':
                break
            
            destination = input("📍 Куда доставить груз: ")
            if destination.lower() == 'exit':
                break
            
            print("\n📦 Выберите категорию груза (1-6):")
            for i, category in enumerate(ItemCategory, 1):
                print(f"{i}. {category.value}")
            
            category_choice = input("Ваш выбор: ")
            if category_choice.lower() == 'exit':
                break
            
            try:
                item_category = list(ItemCategory)[int(category_choice) - 1]
            except:
                print("⚠ Неверный выбор, используется 'Другое'")
                item_category = ItemCategory.OTHER
            
            weight_input = input("📊 Вес груза (кг, опционально): ")
            weight_kg = float(weight_input) if weight_input else None
            
            volume_input = input("📦 Объем груза (м³, опционально): ")
            volume_m3 = float(volume_input) if volume_input else None
            
            print("\n⏰ Выберите срочность доставки (1-3):")
            for i, urgency in enumerate(DeliveryUrgency, 1):
                print(f"{i}. {urgency.value}")
            
            urgency_choice = input("Ваш выбор: ")
            try:
                urgency = list(DeliveryUrgency)[int(urgency_choice) - 1]
            except:
                print("⚠ Неверный выбор, используется 'Стандартная'")
                urgency = DeliveryUrgency.STANDARD
            
            print("\n⚠ Выберите особые требования (1-5):")
            for i, requirement in enumerate(SpecialRequirements, 1):
                print(f"{i}. {requirement.value}")
            
            requirement_choice = input("Ваш выбор: ")
            try:
                special_requirement = list(SpecialRequirements)[int(requirement_choice) - 1]
            except:
                print("⚠ Неверный выбор, используется 'Нет особых требований'")
                special_requirement = SpecialRequirements.NONE
            
            print("\n" + "="*40)
            print("🔍 Расчет стоимости...")
            
            result = predictor.calculate_delivery_price(
                origin=origin,
                destination=destination,
                item_category=item_category,
                weight_kg=weight_kg,
                volume_m3=volume_m3,
                urgency=urgency,
                special_requirement=special_requirement
            )
            
            if result['success']:
                save = input("\n💾 Сохранить результат? (y/n): ")
                if save.lower() == 'y':
                    predictor.save_delivery_result(result)
            
            continue_prompt = input("\n📝 Рассчитать еще одну доставку? (y/n): ")
            if continue_prompt.lower() != 'y':
                break
                
        except Exception as e:
            print(f"❌ Ошибка ввода: {e}")
            continue
    
    print("\n👋 Спасибо за использование калькулятора доставки!")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "interactive":
        interactive_mode()
    else:
        main()