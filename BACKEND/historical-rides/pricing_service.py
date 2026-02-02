# pricing_service.py - FIXED VERSION
import joblib
import pandas as pd
import numpy as np
from datetime import datetime
import json
import pickle
import requests
from typing import Dict, List, Optional, Tuple
import time

class PricingModel:
    def __init__(self, model_path='pricing_model.pkl', feature_info_path='feature_info.pkl'):
        """Initialize the pricing model"""
        try:
            self.model = joblib.load(model_path)
            self.feature_info = joblib.load(feature_info_path)
            print("✓ ML Model loaded successfully")
        except FileNotFoundError:
            print("⚠ Warning: ML model files not found. Using rule-based pricing only.")
            self.model = None
            self.feature_info = None
        
        # DistanceMatrix.ai API configuration
        self.distance_api_key = "NFLqNsgalupmIuzDS6zKuprvodMgjdaGAxBtGYNpOT9TUwnCnC4Z9Do6T2drMT4Y"
        self.distance_api_url = "https://api.distancematrix.ai/maps/api/distancematrix/json"
        
        # Fallback configuration
        self.use_api_primary = True
        self.api_timeout = 5  # seconds
        
        # Pricing configuration
        self.minimum_price = 3.0  # Minimum price for any delivery
        self.platform_fee_percentage = 0.15  # 15% platform fee
        
        # Base rates (USD per km) - adjusted for realism
        self.base_rates = {
            'walking': 2.5,      # For very short distances (< 1 km)
            'bicycling': 1.8,    # For short-medium distances (1-5 km)
            'standard': 1.5,     # For car deliveries (5-20 km)
            'van': 2.0,          # For larger items
            'truck': 2.5         # For furniture/large items
        }
        
        # Maximum practical distances per vehicle type (km)
        self.max_distances = {
            'walking': 2.0,
            'bicycling': 8.0,
            'standard': 50.0,
            'van': 100.0,
            'truck': 200.0
        }
        
        print(f"✓ Pricing service initialized at {datetime.now().strftime('%H:%M:%S')}")
    
    def _calculate_distance_haversine(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two coordinates using Haversine formula"""
        R = 6371  # Earth's radius in kilometers
        
        lat1_rad = np.radians(lat1)
        lat2_rad = np.radians(lat2)
        delta_lat = np.radians(lat2 - lat1)
        delta_lon = np.radians(lon2 - lon1)
        
        a = np.sin(delta_lat/2)**2 + np.cos(lat1_rad) * np.cos(lat2_rad) * np.sin(delta_lon/2)**2
        c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1-a))
        
        return R * c
    
    def _get_distance_and_time_api(self, origin: str, destination: str, 
                                  transport_mode: str = 'driving') -> Optional[Dict]:
        """Get distance and time using DistanceMatrix.ai API"""
        if not self.distance_api_key:
            print("⚠ Warning: DistanceMatrix API key not configured")
            return None
        
        try:
            params = {
                "origins": origin,
                "destinations": destination,
                "key": self.distance_api_key,
                "mode": transport_mode,
                "departure_time": "now",
                "language": "en",
                "units": "metric"
            }
            
            response = requests.get(self.distance_api_url, params=params, timeout=self.api_timeout)
            data = response.json()
            
            if data.get("status") == "OK":
                element = data["rows"][0]["elements"][0]
                if element.get("status") == "OK":
                    return {
                        'distance_km': element["distance"]["value"] / 1000,  # meters to km
                        'distance_text': element["distance"]["text"],
                        'duration_minutes': element["duration"]["value"] / 60,  # seconds to minutes
                        'duration_text': element["duration"]["text"],
                        'source': 'distancematrix_api',
                        'status': 'success'
                    }
                else:
                    print(f"⚠ API route error: {element.get('status')}")
            else:
                print(f"⚠ API error: {data.get('status')} - {data.get('error_message', '')}")
                
        except requests.exceptions.Timeout:
            print(f"⚠ DistanceMatrix API timeout after {self.api_timeout} seconds")
        except requests.exceptions.RequestException as e:
            print(f"⚠ DistanceMatrix API request error: {str(e)}")
        except Exception as e:
            print(f"⚠ Error calling DistanceMatrix API: {str(e)}")
        
        return None
    
    def _select_appropriate_vehicle(self, distance_km: float, item_category: str, 
                                   weight_kg: Optional[float] = None) -> str:
        """Select appropriate vehicle type based on distance and item"""
        
        # First, determine vehicle by item type
        if item_category == 'Documents and small packages':
            if weight_kg and weight_kg < 2 and distance_km <= 2:
                return 'walking'
            elif distance_km <= 8:
                return 'bicycling'
            else:
                return 'standard'
        elif item_category in ['Furniture and appliances', 'Construction materials']:
            return 'truck'
        elif item_category in ['Food and beverages', 'Electronics and Fragile Items']:
            return 'van'
        else:
            return 'standard'
    
    def calculate_distance_and_time(self, customer_input: Dict) -> Dict:
        """Calculate distance and time using best available method"""
        
        transport_mode = customer_input.get('transport_mode', 'driving')
        
        # Priority 1: Use provided coordinates directly
        if all(k in customer_input for k in ['pickup_lat', 'pickup_long', 'dropoff_lat', 'dropoff_long']):
            distance_km = self._calculate_distance_haversine(
                customer_input['pickup_lat'],
                customer_input['pickup_long'],
                customer_input['dropoff_lat'],
                customer_input['dropoff_long']
            )
            
            # Estimate time based on distance and transport mode
            avg_speeds = {'walking': 4, 'bicycling': 12, 'driving': 30, 'transit': 20, 'van': 25, 'truck': 20}
            avg_speed = avg_speeds.get(transport_mode, 25)
            duration_minutes = (distance_km / avg_speed) * 60
            
            return {
                'distance_km': round(distance_km, 2),
                'distance_text': f"{distance_km:.1f} km",
                'duration_minutes': round(duration_minutes, 1),
                'duration_text': f"{duration_minutes:.0f} mins",
                'source': 'coordinates_haversine',
                'status': 'success'
            }
        
        # Priority 2: Use provided distance directly
        elif 'distance_kms' in customer_input:
            distance_km = float(customer_input['distance_kms'])
            avg_speeds = {'walking': 4, 'bicycling': 12, 'driving': 30, 'transit': 20, 'van': 25, 'truck': 20}
            avg_speed = avg_speeds.get(transport_mode, 25)
            duration_minutes = (distance_km / avg_speed) * 60
            
            return {
                'distance_km': round(distance_km, 2),
                'distance_text': f"{distance_km:.1f} km",
                'duration_minutes': round(duration_minutes, 1),
                'duration_text': f"{duration_minutes:.0f} mins",
                'source': 'provided_distance',
                'status': 'success'
            }
        
        # Priority 3: Use DistanceMatrix API with addresses
        elif all(k in customer_input for k in ['pickup_address', 'delivery_address']):
            if self.use_api_primary and self.distance_api_key:
                api_result = self._get_distance_and_time_api(
                    customer_input['pickup_address'],
                    customer_input['delivery_address'],
                    transport_mode
                )
                
                if api_result:
                    return api_result
                else:
                    print("⚠ API failed, using fallback estimation")
            
            # Fallback: Estimate based on typical city distances
            # In a real app, you might use a local geocoding database
            return {
                'distance_km': 5.0,  # Average city delivery distance
                'distance_text': "5.0 km",
                'duration_minutes': 20.0,
                'duration_text': "20 mins",
                'source': 'fallback_estimation',
                'status': 'estimated'
            }
        
        # Default values
        else:
            return {
                'distance_km': 5.0,
                'distance_text': "5.0 km",
                'duration_minutes': 20.0,
                'duration_text': "20 mins",
                'source': 'default_values',
                'status': 'estimated'
            }
    
    def _get_time_features(self):
        """Get current time features"""
        now = datetime.now()
        
        return {
            'hour': now.hour,
            'day_of_week': now.weekday(),  # Monday=0, Sunday=6
            'is_weekend': 1 if now.weekday() >= 5 else 0,
            'is_rush_hour': 1 if (7 <= now.hour <= 9) or (16 <= now.hour <= 19) else 0,
            'is_night': 1 if (22 <= now.hour <= 24) or (0 <= now.hour <= 5) else 0,
            'month': now.month
        }
    
    def _calculate_surge_multiplier(self, delivery_urgency: str, is_rush_hour: bool, 
                                   is_night: bool) -> float:
        """Calculate surge multiplier based on delivery urgency and time"""
        base_multiplier = 1.0
        
        # Delivery urgency multiplier
        urgency_multiplier = {
            'standard': 1.0,
            'urgent': 1.4,    # Reduced from 1.5
            'scheduled': 0.85 # Slightly better discount
        }
        
        base_multiplier *= urgency_multiplier.get(delivery_urgency, 1.0)
        
        # Time-based multiplier
        if is_rush_hour:
            base_multiplier *= 1.15  # Reduced from 1.2
        if is_night:
            base_multiplier *= 1.25  # Reduced from 1.3
        
        return round(base_multiplier, 3)
    
    def _calculate_weight_volume_multiplier(self, weight_kg: Optional[float] = None, 
                                          volume_m3: Optional[float] = None) -> float:
        """Calculate multiplier based on weight and volume"""
        multiplier = 1.0
        
        if weight_kg:
            if weight_kg > 50:
                multiplier *= 1.4  # Reduced from 1.5
            elif weight_kg > 20:
                multiplier *= 1.25 # Reduced from 1.3
            elif weight_kg > 10:
                multiplier *= 1.15 # Reduced from 1.2
            elif weight_kg > 5:
                multiplier *= 1.05 # Reduced from 1.1
        
        if volume_m3:
            if volume_m3 > 2:
                multiplier *= 1.5  # Kept
            elif volume_m3 > 1:
                multiplier *= 1.3  # Reduced from 1.4
            elif volume_m3 > 0.5:
                multiplier *= 1.15 # Reduced from 1.2
            elif volume_m3 > 0.2:
                multiplier *= 1.05 # Reduced from 1.1
        
        return round(multiplier, 3)
    
    def _calculate_special_requirements_multiplier(self, special_requirements: List[str]) -> float:
        """Calculate multiplier for special requirements"""
        multiplier = 1.0
        
        if special_requirements:
            if 'Fragile items' in special_requirements:
                multiplier *= 1.15  # Reduced from 1.2
            if 'Refrigerated transport' in special_requirements:
                multiplier *= 1.4   # Reduced from 1.5
            if 'Oversized items' in special_requirements:
                multiplier *= 1.25  # Reduced from 1.3
            if 'Hazardous materials' in special_requirements:
                multiplier *= 1.6   # Reduced from 1.8
        
        return round(multiplier, 3)
    
    def prepare_features(self, customer_input: Dict) -> Dict:
        """Prepare all features for prediction"""
        
        # Get current time features
        time_features = self._get_time_features()
        
        # Calculate distance and time
        distance_info = self.calculate_distance_and_time(customer_input)
        distance_km = distance_info['distance_km']
        
        # Select appropriate vehicle type
        vehicle_type = self._select_appropriate_vehicle(
            distance_km,
            customer_input.get('item_category', 'others'),
            customer_input.get('weight_kg')
        )
        
        # Update transport mode if needed
        if 'transport_mode' not in customer_input:
            customer_input['transport_mode'] = vehicle_type
        
        # Calculate surge multiplier
        surge_multiplier = self._calculate_surge_multiplier(
            customer_input.get('delivery_urgency', 'standard'),
            time_features['is_rush_hour'],
            time_features['is_night']
        )
        
        # Calculate additional multipliers
        weight_volume_multiplier = self._calculate_weight_volume_multiplier(
            customer_input.get('weight_kg'),
            customer_input.get('volume_m3')
        )
        
        special_req_multiplier = self._calculate_special_requirements_multiplier(
            customer_input.get('special_requirements', [])
        )
        
        # Combine all multipliers
        total_multiplier = round(surge_multiplier * weight_volume_multiplier * special_req_multiplier, 3)
        
        # Prepare feature dictionary
        features = {
            'distance_kms': distance_km,
            'hour': time_features['hour'],
            'day_of_week': time_features['day_of_week'],
            'is_weekend': time_features['is_weekend'],
            'is_rush_hour': time_features['is_rush_hour'],
            'is_night': time_features['is_night'],
            'temperature_value': 20.0,  # Default temperature
            'humidity': 60.0,  # Default humidity
            'surge_multiplier': total_multiplier,
            'vehicle_type': vehicle_type,
            'distance_source': distance_info['source'],
            'status': distance_info['status']
        }
        
        # Add duration if available
        if 'duration_minutes' in distance_info:
            features['duration_minutes'] = distance_info['duration_minutes']
        
        return features
    
    def predict_price_with_ml(self, features: Dict) -> Optional[Dict]:
        """Predict price using ML model"""
        if not self.model or not self.feature_info:
            return None
        
        try:
            # Create features dataframe
            features_df = pd.DataFrame(0, index=[0], columns=self.feature_info['features'])
            
            # Fill in features
            for feature, value in features.items():
                if feature in features_df.columns:
                    features_df[feature] = value
            
            # Handle categorical features
            if 'vehicle_type' in features:
                vehicle_type = features['vehicle_type']
                vehicle_cols = [col for col in features_df.columns if 'vehicle_type_' in col]
                for col in vehicle_cols:
                    if vehicle_type in col:
                        features_df[col] = 1
            
            # Handle surge category
            surge_multiplier = features.get('surge_multiplier', 1.0)
            if surge_multiplier <= 1:
                category = 'no_surge'
            elif surge_multiplier <= 1.3:
                category = 'low_surge'
            elif surge_multiplier <= 1.7:
                category = 'medium_surge'
            else:
                category = 'high_surge'
            
            surge_cols = [col for col in features_df.columns if 'surge_category_' in col]
            for col in surge_cols:
                if category in col:
                    features_df[col] = 1
            
            # Make prediction
            price_per_km = float(self.model.predict(features_df)[0])
            distance_km = features['distance_kms']
            base_price = price_per_km * distance_km
            
            return {
                'price_per_km': round(price_per_km, 3),
                'base_price': round(base_price, 2),
                'model_used': 'ml_model'
            }
            
        except Exception as e:
            print(f"⚠ ML prediction error: {str(e)}")
            return None
    
    def predict_price_rule_based(self, features: Dict) -> Dict:
        """Predict price using rule-based method"""
        vehicle_type = features.get('vehicle_type', 'standard')
        
        # Get base rate
        base_rate = self.base_rates.get(vehicle_type, 1.5)
        
        # Apply distance-based adjustment
        distance_km = features['distance_kms']
        max_distance = self.max_distances.get(vehicle_type, 50.0)
        
        # Reduce rate slightly for longer distances (economies of scale)
        if distance_km > max_distance * 0.5:
            base_rate *= 0.95
        elif distance_km > max_distance * 0.8:
            base_rate *= 0.9
        
        # Calculate price per km
        price_per_km = round(base_rate * features.get('surge_multiplier', 1.0), 3)
        base_price = round(price_per_km * distance_km, 2)
        
        return {
            'price_per_km': price_per_km,
            'base_price': base_price,
            'model_used': 'rule_based'
        }
    
    def predict_price(self, customer_input: Dict) -> Dict:
        """Predict price based on customer input"""
        
        try:
            # Prepare features
            prepared_features = self.prepare_features(customer_input)
            
            # Try ML prediction first
            ml_prediction = None
            if self.model:
                ml_prediction = self.predict_price_with_ml(prepared_features)
            
            # Fallback to rule-based if ML fails
            if ml_prediction:
                prediction = ml_prediction
                prediction_method = 'ml_model'
            else:
                prediction = self.predict_price_rule_based(prepared_features)
                prediction_method = 'rule_based'
            
            base_price = prediction['base_price']
            price_per_km = prediction['price_per_km']
            
            # Calculate platform fee and driver earnings
            platform_fee = base_price * self.platform_fee_percentage
            driver_earnings = base_price - platform_fee
            
            # Apply minimum price
            total_price = max(base_price, self.minimum_price)
            
            # Prepare breakdown
            breakdown = {
                'base_price': round(base_price, 2),
                'distance_km': round(prepared_features['distance_kms'], 2),
                'price_per_km': round(price_per_km, 3),
                'surge_multiplier': prepared_features['surge_multiplier'],
                'vehicle_type': prepared_features['vehicle_type'],
                'time_of_day': prepared_features['hour'],
                'is_rush_hour': bool(prepared_features['is_rush_hour']),
                'is_night': bool(prepared_features['is_night']),
                'platform_fee': round(platform_fee, 2),
                'driver_earnings': round(driver_earnings, 2),
                'distance_source': prepared_features['distance_source'],
                'prediction_method': prediction_method,
                'calculation_status': prepared_features.get('status', 'success')
            }
            
            # Add estimated time if available
            if 'duration_minutes' in prepared_features:
                breakdown['estimated_duration_minutes'] = round(prepared_features['duration_minutes'], 1)
            
            return {
                'success': True,
                'total_price': round(total_price, 2),
                'breakdown': breakdown,
                'currency': 'USD',
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Pricing calculation error: {str(e)}",
                'timestamp': datetime.now().isoformat()
            }
    
    def save_to_file(self, filepath='pricing_service.pkl'):
        """Save the entire service to a file"""
        with open(filepath, 'wb') as f:
            pickle.dump(self, f)
        print(f"✓ Service saved to {filepath}")

# Helper function to load the service
def load_pricing_service(filepath='pricing_service.pkl'):
    """Load the pricing service from file"""
    with open(filepath, 'rb') as f:
        service = pickle.load(f)
    return service

# Example usage and testing
if __name__ == "__main__":
    print("🚀 Initializing Pricing Service...")
    
    # Initialize the model
    pricing_model = PricingModel()
    
    print("\n" + "="*50)
    print("TEST 1: Address-based delivery (Documents)")
    print("="*50)
    customer_input = {
        'pickup_address': 'ул. Тверская, 7, Москва, Russia',
        'delivery_address': 'Красная площадь, Москва, Russia',
        'item_category': 'Documents and small packages',
        'weight_kg': 1.5,
        'volume_m3': 0.01,
        'delivery_urgency': 'standard',
        'special_requirements': ['Fragile items'],
        'transport_mode': 'driving'
    }
    
    result = pricing_model.predict_price(customer_input)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    print("\n" + "="*50)
    print("TEST 2: Coordinate-based delivery (Food)")
    print("="*50)
    customer_input2 = {
        'pickup_lat': 55.7558,
        'pickup_long': 37.6173,
        'dropoff_lat': 55.7539,
        'dropoff_long': 37.6208,
        'item_category': 'Food and beverages',
        'weight_kg': 8.0,
        'delivery_urgency': 'urgent',
        'transport_mode': 'van'
    }
    
    result2 = pricing_model.predict_price(customer_input2)
    print(json.dumps(result2, indent=2, ensure_ascii=False))
    
    print("\n" + "="*50)
    print("TEST 3: Distance-based delivery (Furniture)")
    print("="*50)
    customer_input3 = {
        'distance_kms': 12.5,
        'item_category': 'Furniture and appliances',
        'weight_kg': 45.0,
        'delivery_urgency': 'scheduled',
        'special_requirements': ['Oversized items'],
        'transport_mode': 'truck'
    }
    
    result3 = pricing_model.predict_price(customer_input3)
    print(json.dumps(result3, indent=2, ensure_ascii=False))
    
    # Save the service
    pricing_model.save_to_file()
    
    print("\n" + "="*50)
    print("✅ All tests completed successfully!")
    print(f"Service ready to use in your order-service")