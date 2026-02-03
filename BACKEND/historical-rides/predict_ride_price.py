import pandas as pd
import numpy as np
import joblib
import json
from datetime import datetime
import sys
import os

class RidePricePredictor:
    def __init__(self, models_dir='E:/DiplomaWork/BACKEND/historical-rides/models'):
        """
        Инициализация предсказателя стоимости поездки
        
        Args:
            models_dir: Директория с сохраненными моделями
        """
        self.models_dir = models_dir
        self.model = None
        self.scaler = None
        self.feature_names = None
        self.model_info = {}
        
        # Загружаем модель и вспомогательные файлы
        self.load_model()
    
    def load_model(self):
        """Загружает сохраненную модель и вспомогательные файлы"""
        try:
            # Загружаем модель
            model_path = os.path.join(self.models_dir, 'best_model_xgboost.joblib')
            self.model = joblib.load(model_path)
            print(f"✅ Модель загружена: {model_path}")
            
            # Загружаем scaler
            scaler_path = os.path.join(self.models_dir, 'scaler.joblib')
            self.scaler = joblib.load(scaler_path)
            print(f"✅ Scaler загружен: {scaler_path}")
            
            # Загружаем названия признаков
            features_path = os.path.join(self.models_dir, 'feature_names.joblib')
            self.feature_names = joblib.load(features_path)
            print(f"✅ Названия признаков загружены: {features_path}")
            
            # Информация о модели
            self.model_info = {
                'loaded_at': datetime.now().isoformat(),
                'model_type': type(self.model).__name__,
                'num_features': len(self.feature_names),
                'features': self.feature_names[:10] + ['...'] if len(self.feature_names) > 10 else self.feature_names
            }
            
        except Exception as e:
            print(f"❌ Ошибка при загрузке модели: {e}")
            raise
    
    def prepare_features(self, input_data):
        """
        Подготавливает признаки из входных данных
        
        Args:
            input_data: Словарь с входными данными
            
        Returns:
            pd.DataFrame: Подготовленные признаки
        """
        # Создаем DataFrame из входных данных
        input_df = pd.DataFrame([input_data])
        
        print("🔧 Подготовка признаков...")
        
        # 1. Добавляем вычисляемые признаки
        if 'distance_kms' in input_df.columns and 'total_time_minutes' in input_df.columns:
            input_df['speed_kmh'] = input_df['distance_kms'] / (input_df['total_time_minutes'] / 60)
            print(f"  ✓ Добавлен признак: speed_kmh = {input_df['speed_kmh'].iloc[0]:.2f} км/ч")
        
        # 2. Создаем погодный индекс
        if all(col in input_df.columns for col in ['temperature_value', 'humidity', 'wind_speed']):
            input_df['weather_index'] = (
                input_df['temperature_value'] * 0.4 +
                input_df['humidity'] * 0.01 * 0.3 +  # humidity в процентах
                input_df['wind_speed'] * 0.3
            )
            print(f"  ✓ Добавлен признак: weather_index = {input_df['weather_index'].iloc[0]:.2f}")
        
        # 3. Определяем время суток (если указан час)
        if 'hour' in input_df.columns:
            hour = input_df['hour'].iloc[0]
            if 5 <= hour < 12:
                time_of_day = 'morning'
            elif 12 <= hour < 17:
                time_of_day = 'afternoon'
            elif 17 <= hour < 22:
                time_of_day = 'evening'
            else:
                time_of_day = 'night'
            input_df['time_of_day'] = time_of_day
            print(f"  ✓ Определено время суток: {time_of_day}")
        
        # 4. Определяем день недели (если указана дата)
        if 'date' in input_df.columns:
            try:
                date_obj = pd.to_datetime(input_df['date'].iloc[0])
                is_weekend = 1 if date_obj.dayofweek >= 5 else 0
                input_df['is_weekend'] = is_weekend
                print(f"  ✓ Определен выходной день: {'Да' if is_weekend else 'Нет'}")
            except:
                pass
        
        # 5. Добавляем дополнительные признаки
        if 'surge_multiplier' not in input_df.columns:
            input_df['surge_multiplier'] = 1.0  # Базовый множитель
        
        # 6. Кодируем категориальные признаки
        categorical_mappings = {
            'transport_mode': ['driving', 'walking', 'bicycling'],
            'weather_main': ['Broken Clouds', 'Clear', 'Clouds', 'Rain', 'Snow', 'Fog', 'Mist'],
            'city': ['Moscow', 'Saint Petersburg', 'Other'],
            'time_of_day': ['morning', 'afternoon', 'evening', 'night']
        }
        
        for cat_col, possible_values in categorical_mappings.items():
            if cat_col in input_df.columns:
                for value in possible_values:
                    col_name = f"{cat_col}_{value.replace(' ', '_')}"
                    input_df[col_name] = (input_df[cat_col] == value).astype(int)
        
        # 7. Убираем оригинальные категориальные колонки
        cat_cols_to_drop = ['transport_mode', 'weather_main', 'city', 'country', 
                           'time_of_day', 'weather_desc', 'precipitation']
        for col in cat_cols_to_drop:
            if col in input_df.columns:
                input_df = input_df.drop(col, axis=1)
        
        # 8. Добавляем недостающие колонки
        for col in self.feature_names:
            if col not in input_df.columns:
                input_df[col] = 0  # Заполняем нулями отсутствующие признаки
        
        # 9. Упорядочиваем колонки
        input_df = input_df[self.feature_names]
        
        print(f"✅ Подготовлено {input_df.shape[1]} признаков")
        return input_df
    
    def predict_price(self, input_data, usd_exchange_rate=90.0):
        """
        Предсказывает стоимость поездки
        
        Args:
            input_data: Словарь с входными данными
            usd_exchange_rate: Курс USD к RUB
            
        Returns:
            dict: Результаты предсказания
        """
        print("\n🎯 ПРЕДСКАЗАНИЕ СТОИМОСТИ ПОЕЗДКИ")
        print("-" * 40)
        
        # Проверяем обязательные поля
        required_fields = ['distance_kms', 'total_time_minutes']
        for field in required_fields:
            if field not in input_data:
                raise ValueError(f"Отсутствует обязательное поле: {field}")
        
        # Подготавливаем признаки
        features_df = self.prepare_features(input_data)
        
        # Применяем масштабирование
        if self.scaler:
            scaled_features = self.scaler.transform(features_df)
        else:
            scaled_features = features_df.values
        
        # Предсказываем стоимость
        predicted_price_rub = self.model.predict(scaled_features)[0]
        predicted_price_usd = predicted_price_rub / usd_exchange_rate
        
        # Рассчитываем доверительный интервал (15%)
        confidence_interval = predicted_price_rub * 0.15
        
        # Формируем результат
        result = {
            'predicted_price_rub': float(predicted_price_rub),
            'predicted_price_usd': float(predicted_price_usd),
            'confidence_interval': {
                'lower_bound_rub': float(predicted_price_rub - confidence_interval),
                'upper_bound_rub': float(predicted_price_rub + confidence_interval),
                'percentage': 15.0
            },
            'input_parameters': input_data,
            'prediction_timestamp': datetime.now().isoformat(),
            'exchange_rate_usd_rub': usd_exchange_rate,
            'model_info': self.model_info
        }
        
        # Выводим результаты
        print(f"\n📊 РЕЗУЛЬТАТЫ:")
        print(f"   Стоимость: {predicted_price_rub:.2f} RUB")
        print(f"   Стоимость: {predicted_price_usd:.2f} USD (курс {usd_exchange_rate:.1f} RUB/USD)")
        print(f"   Доверительный интервал (±15%):")
        print(f"     Нижняя граница: {predicted_price_rub - confidence_interval:.2f} RUB")
        print(f"     Верхняя граница: {predicted_price_rub + confidence_interval:.2f} RUB")
        
        return result
    
    def predict_batch(self, input_data_list, usd_exchange_rate=90.0):
        """
        Предсказывает стоимость для нескольких поездок
        
        Args:
            input_data_list: Список словарей с входными данными
            usd_exchange_rate: Курс USD к RUB
            
        Returns:
            list: Результаты предсказания для каждой поездки
        """
        print(f"🔍 Пакетное предсказание для {len(input_data_list)} поездок")
        
        results = []
        all_features = []
        
        # Подготавливаем признаки для всех поездок
        for i, input_data in enumerate(input_data_list, 1):
            print(f"\nПоездка #{i}:")
            features_df = self.prepare_features(input_data)
            all_features.append(features_df)
        
        # Объединяем все признаки
        if all_features:
            combined_features = pd.concat(all_features, ignore_index=True)
            
            # Применяем масштабирование
            if self.scaler:
                scaled_features = self.scaler.transform(combined_features)
            else:
                scaled_features = combined_features.values
            
            # Предсказываем стоимость для всех поездок
            predicted_prices = self.model.predict(scaled_features)
            
            # Формируем результаты
            for i, (input_data, price_rub) in enumerate(zip(input_data_list, predicted_prices), 1):
                price_usd = price_rub / usd_exchange_rate
                confidence_interval = price_rub * 0.15
                
                result = {
                    'trip_id': i,
                    'predicted_price_rub': float(price_rub),
                    'predicted_price_usd': float(price_usd),
                    'confidence_interval': {
                        'lower_bound_rub': float(price_rub - confidence_interval),
                        'upper_bound_rub': float(price_rub + confidence_interval),
                        'percentage': 15.0
                    },
                    'input_parameters': input_data
                }
                results.append(result)
                
                print(f"  Поездка #{i}: {price_rub:.2f} RUB ({price_usd:.2f} USD)")
        
        return results
    
    def save_prediction(self, prediction_result, output_dir='predictions'):
        """
        Сохраняет результаты предсказания в JSON файл
        
        Args:
            prediction_result: Результат предсказания
            output_dir: Директория для сохранения
            
        Returns:
            str: Путь к сохраненному файлу
        """
        # Создаем директорию, если её нет
        os.makedirs(output_dir, exist_ok=True)
        
        # Генерируем имя файла с timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"prediction_{timestamp}.json"
        filepath = os.path.join(output_dir, filename)
        
        # Сохраняем в JSON
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(prediction_result, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Результаты сохранены: {filepath}")
        return filepath


def get_sample_input_data():
    """Возвращает пример входных данных для тестирования"""
    return {
        'distance_kms': 3.5,
        'total_time_minutes': 9.57,
        'transport_mode': 'driving',
        'temperature_value': -18.7,
        'feels_like': -24.6,
        'humidity': 100,  # Процент
        'wind_speed': 2.19,
        'cloudness': 73,  # Процент
        'weather_main': 'Broken Clouds',
        'city': 'Moscow',
        'country': 'RU',
        'hour': 14,  # 14:00
        'date': '2024-01-15'
    }


def main():
    """Основная функция для запуска предсказания"""
    print("🚖 ПРЕДСКАЗАТЕЛЬ СТОИМОСТИ ПОЕЗДОК")
    print("=" * 50)
    
    try:
        # Инициализируем предсказатель
        predictor = RidePricePredictor(models_dir='E:/DiplomaWork/BACKEND/historical-rides/models')
        
        # Пример 1: Одиночное предсказание
        print("\n📋 ПРИМЕР 1: Одиночное предсказание")
        print("-" * 30)
        
        input_data = get_sample_input_data()
        result = predictor.predict_price(input_data)
        
        # Сохраняем результат
        predictor.save_prediction(result)
        
        # Пример 2: Пакетное предсказание
        print("\n📋 ПРИМЕР 2: Пакетное предсказание")
        print("-" * 30)
        
        batch_data = [
            {
                'distance_kms': 5.2,
                'total_time_minutes': 15.3,
                'transport_mode': 'driving',
                'temperature_value': 10.5,
                'weather_main': 'Clear',
                'city': 'Saint Petersburg',
                'hour': 18
            },
            {
                'distance_kms': 2.1,
                'total_time_minutes': 8.2,
                'transport_mode': 'driving',
                'temperature_value': 5.0,
                'weather_main': 'Rain',
                'city': 'Moscow',
                'hour': 9
            }
        ]
        
        batch_results = predictor.predict_batch(batch_data)
        
        # Сохраняем пакетные результаты
        batch_filename = f"batch_predictions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(os.path.join('predictions', batch_filename), 'w', encoding='utf-8') as f:
            json.dump(batch_results, f, indent=2, ensure_ascii=False)
        
        print(f"\n✅ Пакетные результаты сохранены: predictions/{batch_filename}")
        
        # Пример 3: Использование через командную строку
        if len(sys.argv) > 1:
            print("\n📋 ПРИМЕР 3: Использование через командную строку")
            print("-" * 30)
            
            try:
                # Парсим аргументы командной строки
                distance = float(sys.argv[1]) if len(sys.argv) > 1 else 3.5
                time_minutes = float(sys.argv[2]) if len(sys.argv) > 2 else 10.0
                
                custom_data = {
                    'distance_kms': distance,
                    'total_time_minutes': time_minutes,
                    'transport_mode': 'driving',
                    'weather_main': 'Clear',
                    'city': 'Moscow',
                    'hour': 12
                }
                
                custom_result = predictor.predict_price(custom_data)
                
                print(f"\n📊 РЕЗУЛЬТАТ ДЛЯ КОМАНДНОЙ СТРОКИ:")
                print(f"   Расстояние: {distance} км")
                print(f"   Время: {time_minutes} минут")
                print(f"   Стоимость: {custom_result['predicted_price_rub']:.2f} RUB")
            
            except Exception as e:
                print(f"Ошибка при обработке аргументов командной строки: {e}")
        
        print("\n" + "=" * 50)
        print("🎉 ПРЕДСКАЗАНИЕ ЗАВЕРШЕНО УСПЕШНО!")
        
        return result
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    main()