// ------------------- MAIN JS (clean + clear) -------------------

// ---------------- CONFIG ----------------
const API_KEY = "21480b77eb33ed197e62b8e6a1422a57"; // use your key
let currentWeather = null;   // { current, forecast }
let unit = "C";              // "C" or "F"
let autoRefreshTimer = null;

// ---------------- DOM ----------------
const q = id => document.getElementById(id);

const locSpan = q("location");
const tempVal = q("temp-val");
const tempUnit = q("temp-unit");
const feelsLikeEl = q("feels-like");
const humidityEl = q("humidity");
const windSpeedEl = q("wind-speed");
const uvEl = q("uv-index");
const descEl = q("weather-desc");
const iconEl = q("weather-icon");
const forecastBox = q("forecast-items");
const dateTimeEl = q("date-time");
const lastUpdated = q("last-updated");

const searchBtn = q("search-btn");
const searchInput = q("search-input");
const locationBtn = q("location-btn");
const refreshBtn = q("refresh-btn");
const cBtn = q("celsius-btn");
const fBtn = q("fahrenheit-btn");
const checkSuitBtn = q("check-suitability");
const themeToggle = q("theme-toggle");

// ---------------- Utilities ----------------
function showLoading() {
  const el = q("loading"); if (el) el.style.display = "flex";
  const w = q("weather-display"); if (w) w.style.display = "none";
  const err = q("error-message"); if (err) err.style.display = "none";
}
function hideLoading() { const el = q("loading"); if (el) el.style.display = "none"; }
function showError(msg) { const e = q("error-message"); if (e) { e.textContent = msg; e.style.display = "block"; } const w = q("weather-display"); if (w) w.style.display = "none"; hideLoading(); }
function clearError() { const e = q("error-message"); if (e) e.style.display = "none"; }

function updateTime() { dateTimeEl.textContent = new Date().toLocaleString(); }
setInterval(updateTime, 1000);
updateTime();

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(()=>res.statusText);
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json();
}

// ---------------- Tab Switch ----------------
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        document.querySelectorAll(".content").forEach(c => c.style.display="none");
        q(btn.dataset.tab).style.display = "flex";
    });
});

// ---------------- Weather Fetch ----------------
async function fetchWeather(city) {
  if (!city) return;
  showLoading();
  try {
    const cur = await fetchJSON(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`);
    const fore = await fetchJSON(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`);
    currentWeather = { current: cur, forecast: fore };
    updateWeatherUI();
    scheduleAutoRefresh();
  } catch (err) {
    showError("City not found or network error");
    console.error(err);
  } finally { hideLoading(); }
}

async function fetchWeatherCoords(lat, lon) {
  showLoading();
  try {
    const cur = await fetchJSON(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`);
    const fore = await fetchJSON(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`);
    currentWeather = { current: cur, forecast: fore };
    updateWeatherUI();
    scheduleAutoRefresh();
  } catch (err) {
    showError("Failed to fetch location weather");
    console.error(err);
  } finally { hideLoading(); }
}

function scheduleAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(() => {
    if (currentWeather && currentWeather.current && currentWeather.current.name) {
      fetchWeather(currentWeather.current.name);
    }
  }, 15 * 60 * 1000); // 15 minutes
}

// ---------------- UI Update ----------------
function updateWeatherUI() {
  if (!currentWeather || !currentWeather.current) return;
  clearError();

  const cur = currentWeather.current;
  const container = q("weather-display"); if (container) container.style.display = "block";

  locSpan.textContent = `${cur.name}, ${cur.sys?.country || ''}`;
  descEl.textContent = cur.weather?.[0]?.description || '';

  const icon = cur.weather?.[0]?.icon;
  if (icon && iconEl) iconEl.src = `https://openweathermap.org/img/wn/${icon}@2x.png`;

  setTemperatures(cur.main.temp, cur.main.feels_like);
  humidityEl.textContent = `${cur.main.humidity}%`;
  windSpeedEl.textContent = `${Math.round(cur.wind.speed * 3.6)} km/h`;
  // Simple mock UV index based on temp and a max value
  uvEl.textContent = Math.min(Math.floor(cur.main.temp / 5), 11);

  renderForecast(currentWeather.forecast);
  lastUpdated.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
}

function setTemperatures(tempC, feelsC) {
  if (unit === "C") {
    tempVal.textContent = Math.round(tempC);
    tempUnit.textContent = "C";
    feelsLikeEl.textContent = `${Math.round(feelsC)}°C`;
  } else {
    const tF = Math.round((tempC * 9/5) + 32);
    const fF = Math.round((feelsC * 9/5) + 32);
    tempVal.textContent = tF;
    tempUnit.textContent = "F";
    feelsLikeEl.textContent = `${fF}°F`;
  }
}

function renderForecast(forecast) {
  forecastBox.innerHTML = "";
  if (!forecast || !forecast.list) return;

  const daily = {};
  forecast.list.forEach(item => {
    const dateStr = new Date(item.dt * 1000).toDateString();
    if (!daily[dateStr]) daily[dateStr] = [];
    daily[dateStr].push(item);
  });

  const dates = Object.keys(daily).slice(1,7); // next 6 days
  dates.forEach(dateStr => {
    const items = daily[dateStr];
    // Try to find the reading closest to noon (12:00-14:00 UTC)
    let chosen = items.find(it => {
      const h = new Date(it.dt * 1000).getUTCHours();
      return h >= 11 && h <= 14;
    }) || items[Math.floor(items.length/2)] || items[0]; // Fallback if noon reading is missing
    if (!chosen) return;

    let t = chosen.main.temp;
    if (unit === "F") t = (t * 9/5) + 32;
    const icon = chosen.weather?.[0]?.icon || '';
    const desc = chosen.weather?.[0]?.description || '';

    const div = document.createElement("div");
    div.className = "forecast-item";
    div.innerHTML = `
      <div>${new Date(chosen.dt * 1000).toLocaleDateString(undefined,{weekday:'short'})}</div>
      <img src="https://openweathermap.org/img/wn/${icon}.png" alt="${desc}" />
      <div>${Math.round(t)}°</div>
      <div style="font-size:11px;color:var(--muted);">${desc.split(' ')[0]}</div>
    `;
    forecastBox.appendChild(div);
  });
}

// ---------------- UNIT SWITCH ----------------
if (cBtn) cBtn.addEventListener("click", () => {
  if (unit === "C") return;
  unit = "C"; cBtn.classList.add("active"); if (fBtn) fBtn.classList.remove("active");
  if (currentWeather && currentWeather.current) {
    setTemperatures(currentWeather.current.main.temp, currentWeather.current.main.feels_like);
    renderForecast(currentWeather.forecast);
  }
});
if (fBtn) fBtn.addEventListener("click", () => {
  if (unit === "F") return;
  unit = "F"; fBtn.classList.add("active"); if (cBtn) cBtn.classList.remove("active");
  if (currentWeather && currentWeather.current) {
    setTemperatures(currentWeather.current.main.temp, currentWeather.current.main.feels_like);
    renderForecast(currentWeather.forecast);
  }
});

// ---------------- UI EVENTS ----------------
if (searchBtn) searchBtn.addEventListener("click", () => {
  const qv = (searchInput && searchInput.value) ? searchInput.value.trim() : "";
  if (qv) fetchWeather(qv);
});
if (searchInput) searchInput.addEventListener("keypress", e => {
  if (e.key === "Enter") {
    const qv = searchInput.value.trim();
    if (qv) fetchWeather(qv);
  }
});
if (locationBtn) locationBtn.addEventListener("click", () => {
  if (!navigator.geolocation) { showError("Geolocation not supported"); return; }
  navigator.geolocation.getCurrentPosition(
    pos => fetchWeatherCoords(pos.coords.latitude, pos.coords.longitude),
    err => showError("Location permission denied or unavailable."),
    { timeout: 8000 }
  );
});
if (refreshBtn) refreshBtn.addEventListener("click", () => {
  if (currentWeather && currentWeather.current && currentWeather.current.name) {
    fetchWeather(currentWeather.current.name);
  } else showError("No city to refresh");
});

// ---------------- AUTO REQUEST LOCATION ON LOAD ----------------
window.addEventListener("load", () => {
  // restore theme from localStorage, or default to "dark" if none is saved
  const savedTheme = localStorage.getItem("ui-theme");
  
  if (savedTheme === "light") {
    // Keep Light Mode
  } else {
    // Default to Dark Mode if savedTheme is "dark" or null/undefined
    document.body.classList.add("dark");
  }

  // update theme toggle icon
  updateThemeButton();

  // request location permission immediately
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => fetchWeatherCoords(pos.coords.latitude, pos.coords.longitude),
      err => {
        // fallback default city
        fetchWeather("Bengaluru");
      },
      { timeout: 8000 }
    );
  } else {
    fetchWeather("Bengaluru");
  }
});

// ---------------- PREDICTION / CROP SUITABILITY ----------------
const crops = {
  rice:{minTemp:20,maxTemp:35,minRain:100,maxRain:300, soil:["clay","loam","alluvial"],growingDays:120},
  wheat:{minTemp:10,maxTemp:25,minRain:20,maxRain:100, soil:["loam","sandy-loam"],growingDays:110},
  maize:{minTemp:18,maxTemp:30,minRain:20,maxRain:120, soil:["loam","sandy","red soil"],growingDays:95},
  ragi:{minTemp:20,maxTemp:30,minRain:50,maxRain:100, soil:["red soil","loam"],growingDays:100},
  sugarcane:{minTemp:20,maxTemp:40,minRain:100,maxRain:200, soil:["black soil","loam"],growingDays:300},
  tur:{minTemp:18,maxTemp:35,minRain:60,maxRain:100, soil:["red soil","black soil"],growingDays:150},
  cotton:{minTemp:20,maxTemp:35,minRain:50,maxRain:100, soil:["black soil"],growingDays:180},
  groundnut:{minTemp:20,maxTemp:30,minRain:50,maxRain:80, soil:["sandy-loam","red soil"],growingDays:140},
};

// Simple deterministic simulation for weather based on city name
function getWeatherSim(city) {
  let seed = 0;
  for (let i=0;i<city.length;i++) seed = (seed<<5)-seed + city.charCodeAt(i);
  seed = Math.abs(seed);
  // Sim Temp: 15°C to 34°C
  const temp = 15 + (seed % 20);
  // Sim Rain: 0mm to 120mm
  const rain = seed % 121;
  return { temp, rain };
}
function addDays(d,n){ const c=new Date(d); c.setDate(c.getDate()+n); return c; }

/**
 * Prediction logic attached to the button's click listener.
 */
function checkSuitability() {
  const city = q("city").value;
  const cropName = q("crop").value;
  const soil = q("soil").value;
  const crop = crops[cropName];
  if (!crop) { q("result").innerHTML = "<p style='color:#b00020'>Invalid crop</p>"; return; }

  const w = getWeatherSim(city);
  const soilOK = (crop.soil || []).includes(soil);
  const tempOK = w.temp >= crop.minTemp && w.temp <= crop.maxTemp;
  const rainOK = w.rain >= crop.minRain && w.rain <= crop.maxRain;
  const suitable = soilOK && tempOK && rainOK;

  // Calculate planting and growth phases
  const start = suitable ? new Date() : addDays(new Date(),7); // Delay 7 days if not suitable
  const days = crop.growingDays || 100;
  const g1 = addDays(start,7);
  const g2 = addDays(g1, Math.floor(days * 0.5));
  const g3 = addDays(g2, Math.floor(days * 0.3));
  const g4 = addDays(g3, Math.floor(days * 0.2));

  q("result").innerHTML = `
    <h3>Crop Suitability</h3>
    <p><b>Crop:</b> ${cropName}</p>
    <p><b>City:</b> ${city}</p>
    <p><b>Temp (sim):</b> ${w.temp}°C (Range: ${crop.minTemp}°C - ${crop.maxTemp}°C)</p>
    <p><b>Rain (sim):</b> ${w.rain} mm (Range: ${crop.minRain}mm - ${crop.maxRain}mm)</p>
    <p><b>Soil match:</b> ${soilOK ? '✅ Yes' : '❌ No'}</p>
    <p style="font-weight:700; color:${suitable ? 'green' : 'red'}"><b>Suitable today:</b> ${suitable ? 'YES' : 'NO'}</p>
    <p><b>Recommended planting:</b> ${start.toDateString()}</p>

    <div class="calendar-card"><b>🌱 Germination:</b><br>${start.toDateString()} → ${g1.toDateString()}</div>
    <div class="calendar-card"><b>🌿 Vegetative:</b><br>${g1.toDateString()} → ${g2.toDateString()}</div>
    <div class="calendar-card"><b>🌸 Flowering:</b><br>${g2.toDateString()} → ${g3.toDateString()}</div>
    <div class="calendar-card"><b>🌾 Harvest:</b><br>${g3.toDateString()} → ${g4.toDateString()}</div>
  `;
}

// Attach the function to the button
if (checkSuitBtn) checkSuitBtn.addEventListener("click", checkSuitability);


// ---------------- THEME TOGGLE ----------------
function updateThemeButton() {
  if (!themeToggle) return;
  if (document.body.classList.contains("dark")) themeToggle.textContent = "☀️";
  else themeToggle.textContent = "🌙";
}
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const mode = document.body.classList.contains("dark") ? "dark" : "light";
    localStorage.setItem("ui-theme", mode);
    updateThemeButton();
  });
}