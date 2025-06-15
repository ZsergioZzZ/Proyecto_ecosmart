// prediccion.js

document.addEventListener("DOMContentLoaded", async () => {
  await cargarParcelas();

  document.getElementById("parcela-prediccion").addEventListener("change", manejarSeleccionParcela);
});

let infoParcelas = [];

async function cargarParcelas() {
  try {
    const correo = localStorage.getItem("correoUsuario");  // Obtener el correo logueado
    const res = await fetch(`http://localhost:5000/api/agronomo/parcelas?correo=${encodeURIComponent(correo)}`);
    const lista = await res.json();
    infoParcelas = lista;

    const selector = document.getElementById("parcela-prediccion");
    selector.innerHTML = '<option value="">Seleccione una parcela...</option>';

    lista
      .sort((a, b) => {
        const nameCmp = a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
        if (nameCmp !== 0) return nameCmp;
        return (a.numero || 0) - (b.numero || 0);
      })
      .forEach((p, idx) => {
        const option = document.createElement("option");
        option.value = idx;
        option.textContent = `${p.nombre} - Parcela ${p.numero}`;
        selector.appendChild(option);
      });

  } catch (error) {
    alert("No se pudieron cargar las parcelas.");
    console.error(error);
  }
}


async function manejarSeleccionParcela(e) {
  const idx = e.target.value;
  const panel = document.getElementById("panel-prediccion-parcela");
  const nombreSpan = document.getElementById("nombre-parcela-seleccionada");

  if (idx === "") {
    panel.style.display = "none";
    return;
  }

  const parcela = infoParcelas[idx];
  nombreSpan.textContent = `${parcela.nombre} (Cultivo: ${parcela.cultivo})`;

  // --- Nuevo: Obtener predicción real del backend ---
  try {
    const url = `http://localhost:5000/api/agronomo/prediccion?lat=${parcela.lat}&lon=${parcela.lon}&cultivo=${encodeURIComponent(parcela.cultivo)}`;
    const res = await fetch(url);
    const data = await res.json();

    // Mostrar pronóstico
    document.getElementById("datos-pronostico").innerHTML = data.pronostico.map(p =>
    `<img src="https://openweathermap.org/img/wn/${p.icon}@2x.png" alt="${p.desc}" width="48" height="48" style="vertical-align:middle;">
    <strong>${formateaFechaCorta(p.dia)}:</strong> ${p.max}°C / ${p.min}°C | <strong>Lluvia:</strong> ${p.lluvia} mm <br>
    <span style="font-size:13px">${p.desc}</span>`
    ).join('<br>');


    // Eventos críticos
    document.getElementById("eventos-criticos").innerHTML = data.eventos_criticos.length ?
      data.eventos_criticos.map(e => `• ${e}<br>`).join('') :
      "<span style='color:#8d99ae'>No hay eventos críticos detectados.</span>";

    // Recomendaciones IA
    document.getElementById("lista-recomendaciones").innerHTML =
      data.recomendaciones.split('\n').map(rec => rec.trim()).filter(Boolean)
      .map(rec => `<li>${rec.replace(/^[-•*]\s*/, "")}</li>`).join("");


      generarGraficoClimaConPronostico(data.pronostico);


    panel.style.display = "block";
  } catch (error) {
    alert("No se pudo obtener el pronóstico/recomendaciones.");
    console.error(error);
  }
}

function formateaFechaCorta(fecha) {
  // Entrada: "2025-06-12" => Salida: "Jue 12/06"
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const d = new Date(fecha);
  return `${dias[d.getDay()]} ${d.getDate()}/${(d.getMonth()+1).toString().padStart(2,'0')}`;
}

// Gráfico 
function generarGraficoClimaConPronostico(pronostico) {
  const ctx = document.getElementById('grafico-tendencia-clima').getContext('2d');
  if (window.graficoClimaInstance) window.graficoClimaInstance.destroy();

  const labels = pronostico.map(p => formateaFechaCorta(p.dia));
  const tempMin = pronostico.map(p => p.min);
  const tempMax = pronostico.map(p => p.max);
  const lluvia = pronostico.map(p => p.lluvia);

  window.graficoClimaInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Temp. mínima (°C)',
          data: tempMin,
          fill: false,
          borderWidth: 3,
          pointStyle: 'rectRot',
        },
        {
          label: 'Temp. máxima (°C)',
          data: tempMax,
          fill: false,
          borderWidth: 3,
          pointStyle: 'rectRot',
        },
        {
          label: 'Lluvia (mm)',
          data: lluvia,
          fill: false,
          borderDash: [5, 5],
          borderWidth: 2,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: false,
      plugins: {
        legend: { display: true }
      },
      interaction: { mode: 'index', intersect: false },
      onClick: function (e, elements) {
        if (elements.length > 0) {
          const idx = elements[0].index;
          mostrarDetalleDiaPronostico(pronostico[idx]);
        }
      },
      scales: {
        x: { display: true, title: { display: true, text: 'Día' }},
        y: { display: true, title: { display: true, text: '°C' }},
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: { display: true, text: 'Lluvia (mm)' },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

function mostrarDetalleDiaPronostico(dia) {
  document.getElementById("modal-titulo-dia").textContent = `Detalles para ${formateaFechaCorta(dia.dia)}`;

  // Quita el gráfico anterior si existe
  const div = document.getElementById("modal-detalle-dia");
  div.innerHTML = `
    <div style="display:flex;align-items:center;gap:20px;">
      <img src="https://openweathermap.org/img/wn/${dia.icon}@2x.png" width="60" height="60" alt="Icono clima"/>
      <div>
        <strong>Temperatura máxima:</strong> ${dia.max}°C<br>
        <strong>Temperatura mínima:</strong> ${dia.min}°C<br>
        <strong>Lluvia estimada:</strong> ${dia.lluvia} mm<br>
        <strong>Descripción:</strong> ${dia.desc}
      </div>
    </div>
    <hr>
    <div style="margin-top:10px;">
      <canvas id="grafico-horario-dia" width="440" height="200"></canvas>
    </div>
  `;

  // Datos horarios
  const labels = dia.bloques.map(b => b.hora);
  const temps = dia.bloques.map(b => b.temp);
  const lluvia = dia.bloques.map(b => b.lluvia);

  // Dibuja el gráfico con Chart.js
  if (window.graficoHorarioDiaInstance) window.graficoHorarioDiaInstance.destroy();
  const ctx = document.getElementById('grafico-horario-dia').getContext('2d');
  window.graficoHorarioDiaInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          type: 'line',
          label: "Temperatura (°C)",
          data: temps,
          borderColor: "#3083DC",
          backgroundColor: "#3083DC",
          borderWidth: 3,
          fill: false,
          tension: 0.3,
          yAxisID: 'y',
          pointStyle: 'circle',
          pointRadius: 4,
          order: 1
        },
        {
          type: 'bar',
          label: "Lluvia (mm)",
          data: lluvia,
          backgroundColor: "rgba(52, 78, 65, 0.27)",
          borderColor: "#344E41",
          borderWidth: 1,
          yAxisID: 'y1',
          order: 2
        }
      ]
    },
    options: {
      responsive: false,
      plugins: { legend: { display: true } },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { display: true, title: { display: true, text: 'Hora' }},
        y: { display: true, title: { display: true, text: 'Temp (°C)' }, position: 'left' },
        y1: { display: true, title: { display: true, text: 'Lluvia (mm)' }, position: 'right', grid: { drawOnChartArea: false } }
      }
    }
  });

  document.getElementById("modal-dia-pronostico").style.display = "flex";
}




