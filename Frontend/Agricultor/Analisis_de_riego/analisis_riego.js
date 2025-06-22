// analisis_riego.js

document.addEventListener("DOMContentLoaded", async () => {
  const selector         = document.getElementById("selector-parcela");
  const recomendacionDiv = document.getElementById("recomendacion-riego");
  const ctx              = document.getElementById("grafico-riego").getContext("2d");

  // Recuperar correo del usuario
  const correo = localStorage.getItem("correoUsuario");
  if (!correo) {
    recomendacionDiv.textContent = "⚠️ No se encontró correo de usuario.";
    return;
  }

  // 1) Cargar lista de parcelas del usuario
  let parcelas = [];
  try {
    const resParcelas = await fetch(
      `http://localhost:5000/parcelas-del-usuario?correo=${encodeURIComponent(correo)}`
    );
    parcelas = await resParcelas.json();

    if (!Array.isArray(parcelas) || parcelas.length === 0) {
      recomendacionDiv.textContent = "⚠️ No se encontraron parcelas registradas.";
      return;
    }

    // Ordenar alfabéticamente por nombre y número
    parcelas.sort((a, b) => {
      const na = `${a.nombre} ${a.numero || ""}`.toLowerCase();
      const nb = `${b.nombre} ${b.numero || ""}`.toLowerCase();
      return na.localeCompare(nb, "es", { numeric: true });
    });

    // Llenar el <select>
    parcelas.forEach(p => {
      const opt = document.createElement("option");
      opt.value       = JSON.stringify(p);  // serializamos para luego extraer lat, lon, cultivo
      opt.textContent = `${p.nombre}${p.numero ? ` - Parcela ${p.numero}` : ""}`;
      selector.appendChild(opt);
    });

  } catch (err) {
    console.error("Error al obtener parcelas:", err);
    recomendacionDiv.textContent = "❌ Error al obtener parcelas del servidor.";
    return;
  }

  // Variable para referenciar el chart previo
  let chartRiego = null;

  // 2) Cuando se seleccione una parcela nueva
  selector.addEventListener("change", async (e) => {
    const parcela = JSON.parse(e.target.value);

    // Limpiar recomendación y destruir gráfico anterior si existe
    recomendacionDiv.textContent = "";
    if (chartRiego) {
      chartRiego.destroy();
      chartRiego = null;
    }

    // Indicamos que consultamos
    recomendacionDiv.textContent = "⏳ Consultando análisis...";

    try {
      // 3) Llamada al backend de análisis de riego
      const url = `http://localhost:5000/analisis-riego` +
                  `?lat=${encodeURIComponent(parcela.lat)}` +
                  `&lon=${encodeURIComponent(parcela.lon)}` +
                  `&cultivo=${encodeURIComponent(parcela.cultivo)}`;
      const res       = await fetch(url);
      const data      = await res.json();

      if (!res.ok) {
        recomendacionDiv.textContent = `⚠️ Error: ${data.error || "No se pudo obtener análisis"}`;
        return;
      }

      // 4) Mostrar recomendación de la IA
      recomendacionDiv.textContent = data.recomendacion;

      // 5) Preparar datos para el gráfico
      const etiquetas    = data.grafico.map(d => d.hora.split(" ")[1].slice(0,5));
      const temperaturas = data.grafico.map(d => d.temperatura);
      const humedades    = data.grafico.map(d => d.humedad);

      // 6) Crear nuevo Chart.js con dos ejes Y
      chartRiego = new Chart(ctx, {
        type: "line",
        data: {
          labels: etiquetas,
          datasets: [
            {
              label: "Temperatura (°C)",
              data: temperaturas,
              borderWidth: 2,
              fill: false,
              yAxisID: 'y'
            },
            {
              label: "Humedad (%)",
              data: humedades,
              borderWidth: 2,
              fill: false,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom' }
          },
          scales: {
            // Eje izquierdo: temperatura
            y: {
              type: 'linear',
              position: 'left',
              beginAtZero: false,
              title: {
                display: true,
                text: 'Temperatura (°C)'
              }
            },
            // Eje derecho: humedad
            y1: {
              type: 'linear',
              position: 'right',
              beginAtZero: true,
              grid: { drawOnChartArea: false },
              title: {
                display: true,
                text: 'Humedad (%)'
              }
            }
          }
        }
      });

    } catch (err) {
      console.error("Error al obtener análisis de riego:", err);
      recomendacionDiv.textContent = "❌ Error al generar la recomendación.";
    }
  });

});
