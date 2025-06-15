let chartInstance = null;
let parcelasGlobal = [];
let nombreParcelaSeleccionada = "";





function traducirDescripcion(desc) {
  const mapa = {
    "clear sky": "Cielo despejado",
    "few clouds": "Pocas nubes",
    "scattered clouds": "Nubes dispersas",
    "broken clouds": "Nubes rotas",
    "overcast clouds": "Nublado",
    "light rain": "Lluvia ligera",
    "moderate rain": "Lluvia moderada",
    "heavy intensity rain": "Lluvia intensa",
    "very heavy rain": "Lluvia muy intensa",
    "extreme rain": "Lluvia extrema",
    "freezing rain": "Lluvia helada",
    "light intensity shower rain": "Chubasco ligero",
    "shower rain": "Chubasco",
    "heavy intensity shower rain": "Chubasco intenso",
    "ragged shower rain": "Chubasco irregular",
    "thunderstorm": "Tormenta eléctrica",
    "thunderstorm with light rain": "Tormenta con lluvia ligera",
    "thunderstorm with heavy rain": "Tormenta con lluvia intensa",
    "light thunderstorm": "Tormenta leve",
    "heavy thunderstorm": "Tormenta fuerte",
    "ragged thunderstorm": "Tormenta irregular",
    "thunderstorm with drizzle": "Tormenta con llovizna",
    "light snow": "Nieve ligera",
    "snow": "Nieve",
    "heavy snow": "Nieve intensa",
    "sleet": "Aguanieve",
    "light shower sleet": "Aguanieve ligera",
    "shower sleet": "Aguanieve en chubasco",
    "light rain and snow": "Lluvia y nieve ligera",
    "rain and snow": "Lluvia y nieve",
    "light shower snow": "Chubasco de nieve ligera",
    "shower snow": "Chubasco de nieve",
    "heavy shower snow": "Chubasco de nieve intensa",
    "mist": "Neblina",
    "smoke": "Humo",
    "haze": "Calina",
    "dust whirls": "Remolinos de polvo",
    "fog": "Niebla",
    "sand": "Arena",
    "volcanic ash": "Ceniza volcánica",
    "squalls": "Rachas de viento",
    "tornado": "Tornado"
  };

  return mapa[desc.toLowerCase()] || desc;
}






let ubicacionParcelaSeleccionada = "";


async function cargarParcelas() {
  try {
    const correo = localStorage.getItem("correoUsuario");
    if (!correo) {
      alert("No hay usuario logueado");
      return;
    }

    const res = await fetch(`http://127.0.0.1:5000/meteo/parcelas?correo=${encodeURIComponent(correo)}`);

    parcelasGlobal = await res.json();
    console.log("Parcelas recibidas:", parcelasGlobal);
    if (parcelasGlobal.length > 0) {
      nombreParcelaSeleccionada = `${parcelasGlobal[0].nombre} - Parcela ${parcelasGlobal[0].numero}`;
      ubicacionParcelaSeleccionada = parcelasGlobal[0].ubicacion;
      obtenerDatosPorCoords(parcelasGlobal[0].lat, parcelasGlobal[0].lon);
    }
  } catch (err) {
    console.error("Error al cargar parcelas:", err);
  }
}



function seleccionarParcela(value) {
  const [lat, lon] = value.split(",");
  const select = document.getElementById("parcela-select");
  const selectedOption = select.options[select.selectedIndex];
  const index = select.selectedIndex - 1; 

  nombreParcelaSeleccionada = selectedOption.textContent;
  ubicacionParcelaSeleccionada = parcelasGlobal[index].ubicacion;

  obtenerDatosPorCoords(lat, lon);
}



async function obtenerDatosPorCoords(lat, lon) {
  const url = `http://127.0.0.1:5000/meteo/clima?lat=${lat}&lon=${lon}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data || !data.city) {
      document.getElementById("ubicacion-info").innerText = "Error al obtener datos.";
      return;
    }
    actualizarUI(data);
  } catch (err) {
    console.error(err);
    document.getElementById("ubicacion-info").innerText = "Error al conectar con el servidor.";
  }
}




function actualizarUI(data) {
  const actual = data.list[0];
  const tempC = actual.main.temp.toFixed(1);
  const sensacion = actual.main.feels_like.toFixed(1);

  const humedad = `${actual.main.humidity}%`;
  const viento = `${(actual.wind.speed * 3.6).toFixed(1)} km/h`; 
  const presion = `${actual.main.pressure} hPa`;
  const icono = actual.weather[0].icon;
  const descripcion = traducirDescripcion(actual.weather[0].description);
  const probPrecipitacion = `${Math.round((actual.pop || 0) * 100)}%`;

  const fecha = new Date(actual.dt * 1000);
  const dia = fecha.toLocaleDateString("es-CL", { weekday: "long" });
  const offsetMs = data.city.timezone * 1000;
  const localFecha = new Date(actual.dt * 1000 + offsetMs);

  const hora = localFecha.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit"
  });


  document.getElementById("ubicacion-info").innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
      
      <!-- IZQUIERDA: Ciudad y buscador -->
      <div style="display: flex; flex-direction: column; align-items: flex-start;">
        <h1 style="margin: 0 0 0.5rem 0;">${ubicacionParcelaSeleccionada}</h1>

        ${
          nombreParcelaSeleccionada
            ? `<h3 style="margin: 0 0 0.5rem 0; font-weight: bold;">${nombreParcelaSeleccionada}</h3>`
            : ""
        }
        <div>
          <select id="parcela-select" onchange="seleccionarParcela(this.value)" style="padding: 8px; font-size: 16px;">
            <option value="" disabled selected>Seleccione una parcela</option>
          </select>
        </div>
      </div>


      <!-- CENTRO: Datos principales -->
      <div style="display: flex; align-items: center; gap: 16px;">
        <img src="https://openweathermap.org/img/wn/${icono}@2x.png" alt="${descripcion}" width="64" height="64">
        <div>
          <h2 style="margin: 0; font-size: 2rem;">${tempC} °C</h2>
          <p style="margin: 4px 0 0 0;">Prob. de precipitaciones: ${probPrecipitacion}</p>
          <p style="margin: 0;">Humedad: ${humedad}</p>
          <p style="margin: 0;">Viento: a ${viento}</p>
          <p style="margin: 0;">Presión: ${presion}</p>
        </div>
      </div>

      <!-- DERECHA: Clima y hora -->
      <div style="text-align: right;">
        <h3 style="margin: 0;">Clima</h3>
        <p style="margin: 0;">${descripcion}</p>
      </div>

    </div>
  `;
  const select = document.getElementById("parcela-select");
  if (select && parcelasGlobal.length > 0) {
    const valorSeleccionado = select.value;

    select.innerHTML = ''; 

    const defaultOption = document.createElement("option");
    defaultOption.textContent = "Seleccione una parcela";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    parcelasGlobal.sort((a, b) => {
      const nombreA = `${a.nombre} - Parcela ${a.numero}`.toLowerCase();
      const nombreB = `${b.nombre} - Parcela ${b.numero}`.toLowerCase();
      return nombreA.localeCompare(nombreB);
    });

    parcelasGlobal.forEach(p => {
      const value = `${p.lat},${p.lon}`;
      const option = document.createElement("option");
      option.value = value;
      option.textContent = `${p.nombre} - Parcela ${p.numero}`;

      if (value === valorSeleccionado) {
        option.selected = true;
        defaultOption.selected = false;
      }

      select.appendChild(option);
    });


  }
  const temperaturas = data.list.slice(0, 12).map(p => p.main.temp.toFixed(1));
  const horas = data.list.slice(0, 12).map(p => new Date(p.dt * 1000).getHours() + ":00");
  renderizarGrafico(temperaturas, horas);

  renderizarPronosticoDias(data.list);
}

function renderizarGrafico(temps, horas) {
  const ctx = document.getElementById("grafico-horas").getContext("2d");

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: horas,
      datasets: [{
        label: "Temperatura (C)",
        data: temps,
        borderColor: "#a3b18a",
        backgroundColor: "#a3b18a",
        tension: 0.3,
        fill: false
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#000" } },
        tooltip: { enabled: true }
      },
      scales: {
        x: { ticks: { color: "#000" }, grid: { color: "#ccc" } },
        y: { ticks: { color: "#000" }, grid: { color: "#ccc" }, beginAtZero: false }
      },
      layout: {
        padding: 20
      },
      backgroundColor: "#ffffff"
    },
    plugins: [{
      id: 'customCanvasBackgroundColor',
      beforeDraw: (chart) => {
        const ctx = chart.canvas.getContext('2d');
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
      }
    }]
  });
}

function renderizarPronosticoDias(lista) {
  const contenedor = document.getElementById("pronostico-dias");
  contenedor.innerHTML = "";
  contenedor.insertAdjacentHTML("beforeend", "<h1>Pronóstico de 5 días</h>");

  const fila = document.createElement("div");
  fila.style.display = "flex";
  fila.style.justifyContent = "center";
  fila.style.flexWrap = "wrap";
  fila.style.gap = "16px";
  fila.style.marginTop = "1rem";

  for (let i = 0; i < lista.length; i += 8) {
  const diaGrupo = lista.slice(i, i + 8); 

  const temps = diaGrupo.map(d => d.main.temp);
  const min = Math.min(...temps).toFixed(1);
  const max = Math.max(...temps).toFixed(1);

  const fecha = new Date(diaGrupo[0].dt * 1000);
  const diaSemana = fecha.toLocaleDateString("es-CL", { weekday: "long" });

  const icono = diaGrupo[0].weather[0].icon;
  const desc = traducirDescripcion(diaGrupo[0].weather[0].description);

  const card = document.createElement("div");
  card.style.display = "flex";
  card.style.flexDirection = "column";
  card.style.alignItems = "center";
  card.style.padding = "8px";
  card.style.minWidth = "100px";

  card.innerHTML = `
    <img src="https://openweathermap.org/img/wn/${icono}@2x.png" alt="${desc}" width="48" height="48">
    <strong>${diaSemana}</strong>
    <span>${min}°C / ${max}°C</span>
    <span>${desc}</span>
  `;

  fila.appendChild(card);
}


  contenedor.appendChild(fila);
}

window.onload = () => {
  cargarParcelas();
};
