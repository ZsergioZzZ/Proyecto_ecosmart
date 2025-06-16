document.addEventListener("DOMContentLoaded", async () => {
  const selector = document.getElementById("selector-parcela");
  const recomendacionDiv = document.getElementById("recomendacion-riego");
  const ctx = document.getElementById("grafico-riego").getContext("2d");

  const correo = localStorage.getItem("correoUsuario");
  if (!correo) {
    recomendacionDiv.textContent = "⚠️ No se encontró correo de usuario.";
    return;
  }

  // Obtener parcelas del usuario
  let parcelas = [];
  try {
    const res = await fetch(`http://localhost:5000/parcelas-del-usuario?correo=${correo}`);
    parcelas = await res.json();

    if (!Array.isArray(parcelas) || parcelas.length === 0) {
      recomendacionDiv.textContent = "⚠️ No se encontraron parcelas registradas.";
      return;
    }

    // Ordenar por nombre + número
    parcelas.sort((a, b) => {
      const nombreA = `${a.nombre} ${a.numero || ""}`.toLowerCase();
      const nombreB = `${b.nombre} ${b.numero || ""}`.toLowerCase();
      return nombreA.localeCompare(nombreB, "es", { numeric: true });
    });

    // Llenar el <select>
    parcelas.forEach(p => {
      const opt = document.createElement("option");
      opt.value = JSON.stringify(p); // Para poder extraer lat, lon, cultivo fácilmente
      opt.textContent = `${p.nombre} ${p.numero ? `#${p.numero}` : ""}`.trim();
      selector.appendChild(opt);
    });
  } catch (err) {
    console.error("Error al obtener parcelas:", err);
    recomendacionDiv.textContent = "❌ Error al obtener parcelas del servidor.";
  }

  // Escuchar cambio en el selector
  selector.addEventListener("change", async (e) => {
    const parcela = JSON.parse(e.target.value);
    recomendacionDiv.textContent = "⏳ Consultando análisis...";

    try {
      const url = `http://localhost:5000/analisis-riego?lat=${parcela.lat}&lon=${parcela.lon}&cultivo=${parcela.cultivo}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        recomendacionDiv.textContent = `⚠️ Error: ${data.error || "No se pudo obtener análisis"}`;
        return;
      }

      // Mostrar recomendación
      recomendacionDiv.textContent = data.recomendacion;

      // Mostrar gráfico
      const etiquetas = data.grafico.map(d => d.hora.split(" ")[1].slice(0, 5));
      const temperaturas = data.grafico.map(d => d.temperatura);
      const humedades = data.grafico.map(d => d.humedad);

      new Chart(ctx, {
        type: "line",
        data: {
          labels: etiquetas,
          datasets: [
            {
              label: "Temperatura (°C)",
              data: temperaturas,
              borderWidth: 2,
              fill: false
            },
            {
              label: "Humedad (%)",
              data: humedades,
              borderWidth: 2,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom' }
          },
          scales: {
            y: { beginAtZero: false }
          }
        }
      });

    } catch (err) {
      console.error("Error al obtener análisis de riego:", err);
      recomendacionDiv.textContent = "❌ Error al generar la recomendación.";
    }
  });
});
