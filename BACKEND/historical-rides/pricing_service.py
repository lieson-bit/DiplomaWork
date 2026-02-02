import requests
import json
from typing import Dict, Optional, Tuple, List
import time
import re

class DeliveryDataService:
    """Combined service for getting distance, time, and weather data"""
    
    def __init__(self):
        # DistanceMatrix.ai API configuration
        self.distance_api_key = "NFLqNsgalupmIuzDS6zKuprvodMgjdaGAxBtGYNpOT9TUwnCnC4Z9Do6T2drMT4Y"
        self.distance_api_url = "https://api.distancematrix.ai/maps/api/distancematrix/json"
        
        # OpenWeatherMap API configuration
        self.weather_api_key = "bd5e378503939ddaee76f12ad7a97608"
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


# Example usage and testing
if __name__ == "__main__":
    # Initialize the service
    delivery_service = DeliveryDataService()
    
    # Test geocoding first
    print("\n" + "🌍 TEST: Geocoding Capabilities")
    print("-" * 40)
    
    test_addresses = [
        "ул. Тверская, 7, Москва, Россия",
        "Красная площадь, Москва",
        "Невский проспект, Санкт-Петербург",
        "улица Ленина, 1, Казань",
        "London, UK"  # Test non-Russian address
    ]
    
    for address in test_addresses:
        print(f"\nTesting: {address}")
        coords = delivery_service.get_coordinates_from_address(address)
        if coords:
            print(f"✅ Coordinates: {coords}")
        else:
            print(f"❌ Failed to get coordinates")
    
    # Test case 1: Basic route with automatically extracted weather
    print("\n\n" + "🚀 TEST 1: Basic Delivery Route")
    print("-" * 40)
    
    origin_address = "ул. Тверская, 7, Москва, Россия"
    destination_address = "Красная площадь, Москва"
    
    result = delivery_service.get_complete_delivery_data(
        origin=origin_address,
        destination=destination_address,
        transport_mode='driving'
    )
    
    delivery_service.print_delivery_summary(result)
    
    # Test case 2: Different city
    print("\n\n" + "📍 TEST 2: Different City Delivery")
    print("-" * 40)
    
    result2 = delivery_service.get_complete_delivery_data(
        origin="Невский проспект, Санкт-Петербург",
        destination="Петропавловская крепость, Санкт-Петербург",
        transport_mode='walking',
        weather_location="Санкт-Петербург"  # Optional: specify weather location
    )
    
    delivery_service.print_delivery_summary(result2)
    
    # Test case 3: Direct weather by address
    print("\n\n" + "🌤️  TEST 3: Direct Weather by Address")
    print("-" * 40)
    
    weather_result = delivery_service.get_weather_for_address("улица Ленина, 1, Казань")
    if weather_result.get('success'):
        print(f"✅ Weather success for Казань")
        print(f"🌡️  Temperature: {weather_result['temperature_value']}°C")
        print(f"🌈 Conditions: {weather_result['weather_desc']}")
    else:
        print(f"❌ Weather failed: {weather_result.get('error')}")
    
    # Save results to JSON for inspection
    with open('delivery_data_automatic.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Sample data saved to 'delivery_data_automatic.json'")
    
    # Show data structure for pricing model
    print("\n📊 Data structure for pricing model:")
    if result['route'].get('success') and result['weather'].get('success'):
        pricing_data = {
            'distance_kms': result['route']['distance_meters'] / 1000,
            'duration_minutes': result['route']['duration_seconds'] / 60,
            'transport_mode': result['route'].get('transport_mode'),
            'temperature_value': result['weather'].get('temperature_value'),
            'feels_like': result['weather'].get('feels_like'),
            'humidity': result['weather'].get('humidity'),
            'wind_speed': result['weather'].get('wind_speed'),
            'cloudness': result['weather'].get('cloudness'),
            'weather_main': result['weather'].get('weather_main'),
            'weather_desc': result['weather'].get('weather_desc'),
            'coordinates_extracted': True
        }
        
        print(json.dumps(pricing_data, indent=2, ensure_ascii=False))