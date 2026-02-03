"""
API для предсказания стоимости поездок
Использование: python api_predictor.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import numpy as np
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Разрешаем CORS для всех доменов

class APIPricePredictor:
    def __init__(self, models_dir='E:/DiplomaWork/BACKEND/historical-rides/models'):
        """Инициализация API предсказателя"""
        self.models_dir = models_dir
        self.load_models()
    
    def load_models(self):
        """Загружает модели при старте API"""
        try:
            # Загружаем модель
            self.model = joblib.load(os.path.join(self.models_dir, 'best_model_xgboost.joblib'))
            
            # Загружаем scaler
            self.scaler = joblib.load(os.path.join(self.models_dir, 'scaler.joblib'))
            
            # Загружаем названия признаков
            self.feature_names = joblib.load(os.path.join(self.models_dir, 'feature_names.joblib'))
            
            print("✅ Модели успешно загружены в API")
            return True
        except Exception as e:
            print(f"❌ Ошибка загрузки моделей: {e}")
            return False
    
    def prepare_input_features(self, data):
        """Подготавливает признаки для предсказания"""
        input_df = pd.DataFrame([data])
        
        # Добавляем вычисляемые признаки
        if 'distance_kms' in input_df.columns and 'total_time_minutes' in input_df.columns:
            input_df['speed_kmh'] = input_df['distance_kms'] / (input_df['total_time_minutes'] / 60)
        
        # Добавляем погодный индекс
        if all(col in input_df.columns for col in ['temperature_value', 'humidity', 'wind_speed']):
            input_df['weather_index'] = (
                input_df['temperature_value'] * 0.4 +
                input_df['humidity'] * 0.01 * 0.3 +
                input_df['wind_speed'] * 0.3
            )
        
        # Кодируем категориальные признаки
        categorical_cols = {
            'transport_mode': ['driving', 'walking', 'bicycling'],
            'weather_main': ['Broken Clouds', 'Clear', 'Clouds', 'Rain', 'Snow', 'Fog'],
            'city': ['Moscow', 'Saint Petersburg', 'Other']
        }
        
        for cat_col, possible_values in categorical_cols.items():
            if cat_col in input_df.columns:
                for value in possible_values:
                    col_name = f"{cat_col}_{value.replace(' ', '_')}"
                    input_df[col_name] = (input_df[cat_col] == value).astype(int)
        
        # Удаляем оригинальные категориальные колонки
        cat_cols_to_drop = ['transport_mode', 'weather_main', 'city', 'country']
        for col in cat_cols_to_drop:
            if col in input_df.columns:
                input_df = input_df.drop(col, axis=1)
        
        # Добавляем недостающие колонки
        for col in self.feature_names:
            if col not in input_df.columns:
                input_df[col] = 0
        
        # Упорядочиваем колонки
        input_df = input_df[self.feature_names]
        
        return input_df
    
    def predict(self, input_data, usd_rate=90.0):
        """Выполняет предсказание"""
        try:
            # Подготавливаем признаки
            features_df = self.prepare_input_features(input_data)
            
            # Применяем масштабирование
            scaled_features = self.scaler.transform(features_df)
            
            # Предсказываем стоимость
            price_rub = float(self.model.predict(scaled_features)[0])
            price_usd = price_rub / usd_rate
            
            # Доверительный интервал
            confidence = price_rub * 0.15
            
            return {
                'success': True,
                'prediction': {
                    'price_rub': round(price_rub, 2),
                    'price_usd': round(price_usd, 2),
                    'confidence_interval': {
                        'lower_bound_rub': round(price_rub - confidence, 2),
                        'upper_bound_rub': round(price_rub + confidence, 2),
                        'percentage': 15.0
                    }
                },
                'timestamp': datetime.now().isoformat(),
                'input_parameters': input_data
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }

# Инициализируем предсказатель
predictor = APIPricePredictor()

@app.route('/')
def home():
    """Домашняя страница API"""
    return jsonify({
        'message': 'API для предсказания стоимости поездок Uber/Gett',
        'endpoints': {
            '/predict': 'POST - Предсказать стоимость поездки',
            '/health': 'GET - Проверка состояния API',
            '/model-info': 'GET - Информация о модели'
        },
        'status': 'active'
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Проверка состояния API"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': predictor.model is not None,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/model-info', methods=['GET'])
def model_info():
    """Информация о загруженной модели"""
    return jsonify({
        'model_type': type(predictor.model).__name__ if predictor.model else 'Not loaded',
        'feature_count': len(predictor.feature_names) if predictor.feature_names else 0,
        'features_sample': predictor.feature_names[:10] if predictor.feature_names else []
    })

@app.route('/predict', methods=['POST'])
def predict():
    """Эндпоинт для предсказания стоимости поездки"""
    try:
        # Получаем данные из запроса
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # Проверяем обязательные поля
        required_fields = ['distance_kms', 'total_time_minutes']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        # Получаем курс USD (если указан)
        usd_rate = data.get('usd_exchange_rate', 90.0)
        
        # Выполняем предсказание
        result = predictor.predict(data, usd_rate)
        
        # Возвращаем результат
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/predict-batch', methods=['POST'])
def predict_batch():
    """Эндпоинт для пакетного предсказания"""
    try:
        data = request.get_json()
        
        if not data or 'trips' not in data:
            return jsonify({
                'success': False,
                'error': 'No trips data provided'
            }), 400
        
        trips = data['trips']
        usd_rate = data.get('usd_exchange_rate', 90.0)
        
        results = []
        for i, trip_data in enumerate(trips):
            result = predictor.predict(trip_data, usd_rate)
            result['trip_id'] = i + 1
            results.append(result)
        
        return jsonify({
            'success': True,
            'results': results,
            'total_trips': len(trips),
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

if __name__ == '__main__':
    print("🚀 Запуск API для предсказания стоимости поездок...")
    print("📡 API доступно по адресу: http://localhost:5000")
    print("📋 Документация: http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)