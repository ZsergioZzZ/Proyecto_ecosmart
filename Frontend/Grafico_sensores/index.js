let datosGlobales = null; // Datos completos de todas las parcelas
let datosParcelaActual = null; // Solo datos de la parcela seleccionada
let graficos = []; // Guardamos referencias a los gráficos para destruirlos luego

async function obtenerDatos() {
  const response = await fetch('http://localhost:5000/api/sensores');
  const data = await response.json();
  return data;
}

function crearGrafico(idCanvas, etiqueta, datos, color, labels, tituloY) {
  const ctx = document.getElementById(idCanvas).getContext('2d');
  
  const grafico = new Chart(ctx, {
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

  graficos.push(grafico);
}

function crearGraficosParcela(nombreParcela) {
  if (!datosGlobales || !datosGlobales[nombreParcela]) {
    console.error("Datos no encontrados para parcela:", nombreParcela);
    return;
  }

  // Limpiar gráficos existentes
  graficos.forEach(grafico => grafico.destroy());
  graficos = [];

  datosParcelaActual = datosGlobales[nombreParcela];

  crearGrafico('tempChart', 'Temperatura (°C)', datosParcelaActual.temperatura, 'red', datosParcelaActual.timestamps, 'Grados Celsius');
  crearGrafico('humChart', 'Humedad Suelo (%)', datosParcelaActual.humedad_suelo, 'blue', datosParcelaActual.timestamps, '% Humedad');
  crearGrafico('phChart', 'pH Suelo', datosParcelaActual.ph_suelo, 'green', datosParcelaActual.timestamps, 'Nivel de pH');

  // Gráfico combinado de nutrientes
  const ctxNut = document.getElementById('nutChart').getContext('2d');
  const graficoNut = new Chart(ctxNut, {
    type: 'line',
    data: {
      labels: datosParcelaActual.timestamps,
      datasets: [
        {
          label: 'Nitrógeno (ppm)',
          data: datosParcelaActual.nutrientes.nitrógeno,
          borderColor: 'pink',
          backgroundColor: 'pink33',
          fill: false,
          tension: 0.3
        },
        {
          label: 'Fósforo (ppm)',
          data: datosParcelaActual.nutrientes.fósforo,
          borderColor: 'orange',
          backgroundColor: 'orange33',
          fill: false,
          tension: 0.3
        },
        {
          label: 'Potasio (ppm)',
          data: datosParcelaActual.nutrientes.potasio,
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

  graficos.push(graficoNut);
}

async function inicializarApp() {
  // Grafico iniciales vacíos
  crearGrafico('tempChart', 'Temperatura (°C)', [], 'red', [], 'Grados Celsius');
  crearGrafico('humChart', 'Humedad Suelo (%)', [], 'blue', [], '% Humedad');
  crearGrafico('phChart', 'pH Suelo', [], 'green', [], 'Nivel de pH');
  crearGrafico('nutChart', 'Nutrientes en el Suelo', [], 'purple', [], 'Nivel de Nutrientes');

  datosGlobales = await obtenerDatos();

  const parcelaSelect = document.getElementById('parcelaSelect');
  parcelaSelect.innerHTML = '<option value="">Selecciona una parcela</option>';

  for (let parcela in datosGlobales) {
    const option = document.createElement('option');
    option.value = parcela;
    option.textContent = parcela;
    parcelaSelect.appendChild(option);
  }

  // Evento de cambio de parcela
  parcelaSelect.addEventListener('change', (e) => {
    const parcelaSeleccionada = e.target.value;
    if (parcelaSeleccionada) {
      crearGraficosParcela(parcelaSeleccionada);
      localStorage.setItem('parcelaSeleccionada', parcelaSeleccionada); 
    }
  });

  // Si hay una parcela guardada, la seleccionamos automáticamente
  const parcelaGuardada = localStorage.getItem('parcelaSeleccionada');
  if (parcelaGuardada && datosGlobales[parcelaGuardada]) {
    parcelaSelect.value = parcelaGuardada;
    crearGraficosParcela(parcelaGuardada);
  }
}


function exportarDatos() {
  if (!datosParcelaActual) {
    alert('Selecciona una parcela primero');
    return;
  }

  let csv = "Hora,Temperatura (°C),Humedad Suelo (%),pH Suelo,Nitrógeno (ppm),Fósforo (ppm),Potasio (ppm)\n";

  for (let i = 0; i < datosParcelaActual.timestamps.length; i++) {
    csv += `${datosParcelaActual.timestamps[i]},${datosParcelaActual.temperatura[i]},${datosParcelaActual.humedad_suelo[i]},${datosParcelaActual.ph_suelo[i]},${datosParcelaActual.nutrientes.nitrógeno[i]},${datosParcelaActual.nutrientes.fósforo[i]},${datosParcelaActual.nutrientes.potasio[i]}\n`;
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `datos_sensores_${document.getElementById('parcelaSelect').value}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Eventos
document.getElementById('exportBtn').addEventListener('click', exportarDatos);

// Inicializar la app
inicializarApp();

// Opcional: recargar página cada 1 minuto
setInterval(() => {
  location.reload();
}, 60000);
