document.addEventListener("DOMContentLoaded", () => {
  const parcelaSelect = document.getElementById("parcelaSelect");
  const tipoDatoSelect = document.getElementById("tipoDato");

 async function cargarParcelas() {
  try {
    const response = await fetch("http://127.0.0.1:5000/api/parcelas");
    const parcelas = await response.json();
    parcelas.forEach(parcela => {
      const option = document.createElement("option");
      if (typeof parcela === 'object' && parcela.nombre && parcela.numero) {
        option.value = `${parcela.nombre} - Parcela ${parcela.numero}`;
        option.textContent = `${parcela.nombre} - Parcela ${parcela.numero}`;
      } else {
        option.value = parcela;
        option.textContent = parcela;
      }
      parcelaSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error cargando parcelas:", error);
  }
}





  async function cargarDatos() {
  const parcela = parcelaSelect.value;
  const tipoDato = tipoDatoSelect.value;
  if (!parcela || !tipoDato) return;

  try {
    const response = await fetch(`http://127.0.0.1:5000/api/datos-sensores/${parcela}`);
    const datos = await response.json();

    const fechas = datos.map(d => new Date(d.fecha).toLocaleDateString());
    const todasLasVariables = {
      "Temperatura Ambiente": datos.map(d => d.temperatura ?? null),
      "Humedad del suelo": datos.map(d => d.humedad_suelo ?? null),
      "Nivel de PH": datos.map(d => d.ph_suelo ?? null),
      "Nivel de Nutrientes": datos.map(d => {
        const n = (d.nutrientes?.nitrogeno ?? 0) + (d.nutrientes?.fosforo ?? 0) + (d.nutrientes?.potasio ?? 0);
        return n / 3;
      })
    };

    // 👇 Obtener el tipo de cultivo desde la API sensores/parcela
    const [nombre, numero] = parcela.split(" - Parcela ");
    const cultivoRes = await fetch(`http://127.0.0.1:5000/api/sensores/parcela?nombre=${encodeURIComponent(nombre)}&numero=${numero}`);
    const cultivoData = await cultivoRes.json();
    const cultivo = cultivoData.cultivo || "Sin definir";

    renderizarGrafico(fechas, todasLasVariables[tipoDato], tipoDato);
    generarAnalisisDetallado(todasLasVariables, parcela, cultivo, "Semana del 3 al 10 de junio");

  } catch (error) {
    console.error("Error cargando datos del sensor:", error);
  }
}







  function renderizarGrafico(labels, data, label) {
    const ctx = document.getElementById("graficoSensor").getContext("2d");
    if (window.miGrafico) window.miGrafico.destroy();
    window.miGrafico = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
  label: label,
  data: data,
  fill: false,
  borderColor: "rgb(75, 192, 192)",
  tension: 0.3,
  spanGaps: true  
}]

      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  parcelaSelect.addEventListener("change", cargarDatos);
  tipoDatoSelect.addEventListener("change", cargarDatos);
  cargarParcelas();
});








function generarAnalisisDetallado(data, parcela, tipoCultivo, periodo) {
  document.getElementById("contexto").innerHTML = `
    <strong>Cultivo:</strong> ${tipoCultivo}<br>
    <strong>Parcela:</strong> ${parcela}<br>
    <strong>Periodo analizado:</strong> ${periodo}
  `;

  const temperatura = data["Temperatura Ambiente"];
  const humedad = data["Humedad del suelo"];
  const ph = data["Nivel de PH"];
  const nutrientes = data["Nivel de Nutrientes"];

  const tempMin = Math.min(...temperatura);
  const tempMax = Math.max(...temperatura);
  const tempTrend = temperatura[0] > temperatura[temperatura.length - 1] ? "descenso" : "ascenso";
  const tempCritica = tempMin < 5 ? "Posible riesgo de heladas" : "Sin riesgo crítico identificado";

  const humedadProm = promedio(humedad);
  const humedadCritica = humedad.some(h => h < 30 || h > 70)
    ? "Humedad fuera del rango óptimo detectada. Se recomienda ajustar el riego."
    : "Humedad dentro del rango adecuado.";

  const phProm = promedio(ph);
  const phComentario = phProm < 6 ? "Aplicar cal agrícola."
    : phProm > 7 ? "Aplicar azufre elemental."
    : "pH dentro del rango recomendado.";

  const nutTrend = nutrientes[0] > nutrientes[nutrientes.length - 1] ? "descenso" : "ascenso";
  const nutComentario = nutTrend === "descenso"
    ? "Tendencia a reducción de nutrientes. Aplicar fertilización rica en N, P y K."
    : "Nutrientes en aumento. Sin necesidad de ajuste inmediato.";

  document.getElementById("analisisVariables").innerHTML = `
    <h3>🌡️ Temperatura</h3>
    <p>Tendencia: ${tempTrend}. Rango observado: ${tempMin}°C - ${tempMax}°C. ${tempCritica}.</p>
    
    <h3>💧 Humedad del Suelo</h3>
    <p>Promedio: ${humedadProm.toFixed(1)}%. ${humedadCritica}</p>

    <h3>⚗️ pH del Suelo</h3>
    <p>Promedio: ${phProm.toFixed(2)}. ${phComentario}</p>

    <h3>🌱 Nutrientes (N, P, K)</h3>
    <p>Tendencia: ${nutTrend}. ${nutComentario}</p>
  `;

  document.getElementById("alertasCriticas").innerHTML = `
    <h3>📌 Eventos Críticos</h3>
    <p>${tempCritica}. ${humedadCritica.includes("fuera") ? "Humedad inadecuada detectada." : ""}</p>
  `;

  document.getElementById("recomendacionesFinales").innerHTML = `
    <h3>📌 Recomendaciones</h3>
    <ul>
      <li>Monitorear temperaturas si se acercan al umbral de 5°C.</li>
      <li>Revisar sistema de riego si humedad < 30% o > 70%.</li>
      <li>${phComentario}</li>
      <li>${nutComentario}</li>
    </ul>
  `;
}

function promedio(array) {
  return array.reduce((acc, val) => acc + val, 0) / array.length;
}

function descargarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(12);
  doc.text("Análisis de Tendencias", 10, 10);
  doc.setFontSize(10);
  const sanitize = text => text.replace(/[^a-zA-Z0-9\sáéíóúÁÉÍÓÚñÑ:.,()%]/g, '');

const contenido = `
${sanitize(document.getElementById("contexto").innerText)}

Temperatura:
${sanitize(document.querySelector("#analisisVariables h3:nth-of-type(1)").nextElementSibling.innerText)}

Humedad:
${sanitize(document.querySelector("#analisisVariables h3:nth-of-type(2)").nextElementSibling.innerText)}

pH del Suelo:
${sanitize(document.querySelector("#analisisVariables h3:nth-of-type(3)").nextElementSibling.innerText)}

Nutrientes:
${sanitize(document.querySelector("#analisisVariables h3:nth-of-type(4)").nextElementSibling.innerText)}

Eventos Críticos:
${sanitize(document.getElementById("alertasCriticas").innerText.replace(/^.*Eventos Críticos\s*/i, ''))}

Recomendaciones:
${sanitize(document.getElementById("recomendacionesFinales").innerText.replace(/^.*Recomendaciones\s*/i, ''))}

`;

  const lines = doc.splitTextToSize(contenido, 180);
  doc.text(lines, 10, 20);
  doc.save("analisis_parcela.pdf");
}
