let datosGlobales = null; // Guardamos los datos para exportar luego

async function obtenerDatos() {
  const response = await fetch('http://localhost:5000/api/sensores');
  const data = await response.json();
  return data;
}

function crearGrafico(idCanvas, etiqueta, datos, color, labels, tituloY) {
  new Chart(document.getElementById(idCanvas), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: etiqueta,
        data: datos,
        borderColor: color,
        backgroundColor: color + '33',
        fill: false,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: 'black' } },
        title: {
          display: true,
          text: `Gráfico de ${etiqueta}`,
          color: 'black',
          font: { size: 18 }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Hora' } },
        y: { title: { display: true, text: tituloY } }
      }
    }
  });
}

async function inicializarGraficos() {
  const datos = await obtenerDatos();
  datosGlobales = datos; 

  crearGrafico('tempChart', 'Temperatura (°C)', datos.temperatura, 'red', datos.timestamps, 'Grados Celsius');
  crearGrafico('humChart', 'Humedad Suelo (%)', datos.humedad_suelo, 'blue', datos.timestamps, '% Humedad');
  crearGrafico('phChart', 'pH Suelo', datos.ph_suelo, 'green', datos.timestamps, 'Nivel de pH');

  // Gráfico combinado de nutrientes
  new Chart(document.getElementById('nutChart'), {
    type: 'line',
    data: {
      labels: datos.timestamps,
      datasets: [
        {
          label: 'Nitrógeno (ppm)',
          data: datos.nutrientes.nitrógeno,
          borderColor: 'pink',
          backgroundColor: 'pink33',
          fill: false,
          tension: 0.3
        },
        {
          label: 'Fósforo (ppm)',
          data: datos.nutrientes.fósforo,
          borderColor: 'orange',
          backgroundColor: 'orange33',
          fill: false,
          tension: 0.3
        },
        {
          label: 'Potasio (ppm)',
          data: datos.nutrientes.potasio,
          borderColor: 'purple',
          backgroundColor: 'purple33',
          fill: false,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: 'black' } },
        title: {
          display: true,
          text: 'Nutrientes en el Suelo',
          color: 'black',
          font: { size: 18 }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Hora' } },
        y: { title: { display: true, text: 'Nivel de Nutrientes' } }
      }
    }
  });
}

// Función para exportar datos a CSV
function exportarDatos() {
  if (!datosGlobales) {
    alert('No hay datos para exportar');
    return;
  }

  let csv = "Hora,Temperatura (°C),Humedad Suelo (%),pH Suelo,Nitrógeno (ppm),Fósforo (ppm),Potasio (ppm)\n";

  for (let i = 0; i < datosGlobales.timestamps.length; i++) {
    csv += `${datosGlobales.timestamps[i]},${datosGlobales.temperatura[i]},${datosGlobales.humedad_suelo[i]},${datosGlobales.ph_suelo[i]},${datosGlobales.nutrientes.nitrógeno[i]},${datosGlobales.nutrientes.fósforo[i]},${datosGlobales.nutrientes.potasio[i]}\n`;
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "datos_sensores.csv");
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Eventos
document.getElementById('exportBtn').addEventListener('click', exportarDatos);

// Inicializar gráficos
inicializarGraficos();

// Actualizar gráficos cada 1 minuto
setInterval(() => {
  location.reload();
}, 60000);
