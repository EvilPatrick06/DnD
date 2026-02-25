"""BMO Weather Service — Open-Meteo API (free, no API key required)."""

import threading
import time

import requests

# Colorado Springs coordinates
LATITUDE = 38.8339
LONGITUDE = -104.8214
TIMEZONE = "America/Denver"

# WMO Weather codes → descriptions and icons
WMO_CODES = {
    0: ("Clear sky", "clear"),
    1: ("Mainly clear", "clear"),
    2: ("Partly cloudy", "cloudy"),
    3: ("Overcast", "cloudy"),
    45: ("Foggy", "fog"),
    48: ("Rime fog", "fog"),
    51: ("Light drizzle", "rain"),
    53: ("Moderate drizzle", "rain"),
    55: ("Dense drizzle", "rain"),
    56: ("Freezing drizzle", "snow"),
    57: ("Dense freezing drizzle", "snow"),
    61: ("Slight rain", "rain"),
    63: ("Moderate rain", "rain"),
    65: ("Heavy rain", "rain"),
    66: ("Freezing rain", "snow"),
    67: ("Heavy freezing rain", "snow"),
    71: ("Slight snow", "snow"),
    73: ("Moderate snow", "snow"),
    75: ("Heavy snow", "snow"),
    77: ("Snow grains", "snow"),
    80: ("Slight showers", "rain"),
    81: ("Moderate showers", "rain"),
    82: ("Violent showers", "rain"),
    85: ("Slight snow showers", "snow"),
    86: ("Heavy snow showers", "snow"),
    95: ("Thunderstorm", "storm"),
    96: ("Thunderstorm + hail", "storm"),
    99: ("Thunderstorm + heavy hail", "storm"),
}

POLL_INTERVAL = 1800  # 30 minutes


class WeatherService:
    """Fetches weather data from Open-Meteo API with background caching."""

    def __init__(self, socketio=None):
        self.socketio = socketio
        self._cache: dict | None = None
        self._running = False
        self._poll_thread = None

    # ── Fetch Weather ────────────────────────────────────────────────

    def get_current(self) -> dict:
        """Get current weather conditions."""
        if self._cache:
            return self._cache

        return self._fetch()

    def _fetch(self) -> dict:
        """Fetch weather from Open-Meteo API."""
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": LATITUDE,
            "longitude": LONGITUDE,
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
            "daily": "temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset",
            "temperature_unit": "fahrenheit",
            "wind_speed_unit": "mph",
            "timezone": TIMEZONE,
            "forecast_days": 3,
        }

        try:
            resp = requests.get(url, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"[weather] Fetch failed: {e}")
            return self._cache or {"error": str(e)}

        current = data.get("current", {})
        daily = data.get("daily", {})
        weather_code = current.get("weather_code", 0)
        desc, icon = WMO_CODES.get(weather_code, ("Unknown", "clear"))

        result = {
            "temperature": round(current.get("temperature_2m", 0)),
            "feels_like": round(current.get("apparent_temperature", 0)),
            "humidity": current.get("relative_humidity_2m", 0),
            "wind_speed": round(current.get("wind_speed_10m", 0)),
            "description": desc,
            "icon": icon,
            "weather_code": weather_code,
            "forecast": [],
        }

        # Daily forecast
        if daily.get("time"):
            for i, date in enumerate(daily["time"]):
                day_code = daily.get("weather_code", [0])[i] if i < len(daily.get("weather_code", [])) else 0
                day_desc, day_icon = WMO_CODES.get(day_code, ("Unknown", "clear"))
                result["forecast"].append({
                    "date": date,
                    "high": round(daily.get("temperature_2m_max", [0])[i]) if i < len(daily.get("temperature_2m_max", [])) else 0,
                    "low": round(daily.get("temperature_2m_min", [0])[i]) if i < len(daily.get("temperature_2m_min", [])) else 0,
                    "description": day_desc,
                    "icon": day_icon,
                })

        self._cache = result
        return result

    # ── Background Polling ───────────────────────────────────────────

    def start_polling(self):
        """Start background weather updates every 30 minutes."""
        if self._running:
            return
        self._running = True
        self._poll_thread = threading.Thread(target=self._poll_loop, daemon=True)
        self._poll_thread.start()

    def stop_polling(self):
        self._running = False

    def _poll_loop(self):
        while self._running:
            weather = self._fetch()
            self._emit("weather_update", weather)
            time.sleep(POLL_INTERVAL)

    # ── Helpers ──────────────────────────────────────────────────────

    def _emit(self, event: str, data: dict):
        if self.socketio:
            self.socketio.emit(event, data)
