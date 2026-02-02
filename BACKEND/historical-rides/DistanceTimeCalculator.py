import requests

# 1. Replace with your actual API key (sign up at distancematrix.ai)
api_key = "NFLqNsgalupmIuzDS6zKuprvodMgjdaGAxBtGYNpOT9TUwnCnC4Z9Do6T2drMT4Y"

# 2. Define your addresses in Russia (origin and destination)
origin_address = "ул. Тверская, 7, Москва, Russia"
destination_address = "Красная площадь, Москва, Russia"

# 3. Build the API request URL
url = "https://api.distancematrix.ai/maps/api/distancematrix/json"

params = {
    "origins": origin_address,
    "destinations": destination_address,
    "key": api_key,
    "mode": "walking",  # Can be "driving", "walking", "bicycling", "transit"
    "departure_time": "now"  # For real-time traffic (optional)
}

# 4. Make the request
response = requests.get(url, params=params)
data = response.json()

# 5. Print the travel time and distance
if data["status"] == "OK":
    element = data["rows"][0]["elements"][0]
    if element["status"] == "OK":
        time = element["duration"]["text"]
        distance = element["distance"]["text"]
        print(f"Travel Time: {time}")
        print(f"Distance: {distance}")
    else:
        print("Could not calculate route between these points.")
else:
    print(f"API request failed. Status: {data['status']}")