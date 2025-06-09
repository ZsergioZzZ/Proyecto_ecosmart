document.addEventListener("DOMContentLoaded", async () => {
  const tipoDatoSelect = document.getElementById("tipoDato");
  const ctx = document.getElementById("graficoSensor").getContext("2d");
  let chart;

  async function cargarParcelas() {
    const response = await fetch("http://localhost:5000/parcelas");
    const parcelas = await response.json();
    console.log("Parcelas disponibles:", parcelas);

    const parcelaSelect = document.getElementById("parcelaSelect");
    parcelaSelect.innerHTML = "";

    parcelas.forEach(p => {
      const nombreCompleto = `${p.nombre} - Parcela ${p.numero}`;

      const option = document.createElement("option");
      option.value = nombreCompleto;
      option.textContent = nombreCompleto;
      parcelaSelect.appendChild(option);
    });

    parcelaSelect.addEventListener("change", async () => {
      await cargarDatos(parcelaSelect.value, tipoDatoSelect.value);
    });

    if (parcelas.length > 0) {
      const valorInicial = parcelas[0].nombre;
      parcelaSelect.value = valorInicial;
      await cargarDatos(valorInicial, tipoDatoSelect.value);
    }
  }

  async function cargarDatos(parcela, tipo) {
    const response = await fetch(`http://localhost:5000/datos_sensores?parcela=${encodeURIComponent(parcela)}&tipo=${encodeURIComponent(tipo)}`);
    const datos = await response.json();
    console.log("Datos recibidos:", datos);

    const tipoLower = tipo.toLowerCase();
    let campo = "";
    let esNutriente = false;

    if (tipoLower === "temperatura ambiente") campo = "temperatura";
    else if (tipoLower === "humedad del suelo") campo = "humedad_suelo";
    else if (tipoLower === "nivel de ph") campo = "ph_suelo";
    else if (tipoLower === "nivel de nutrientes") esNutriente = true;

    const labels = datos.map(d => new Date(d.timestamp).toLocaleString());

    const valores = datos.map(d => {
      if (esNutriente && d.nutrientes) {
        const n = d.nutrientes.n ?? 0;
        const p = d.nutrientes.p ?? 0;
        const k = d.nutrientes.k ?? 0;
        return (n + p + k) / 3;
      } else {
        return d[campo] ?? d.valor ?? 0;
      }
    });

    if (chart) chart.destroy();

    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: tipo,
          data: valores,
          borderWidth: 2,
          fill: false,
          borderColor: "#588157"
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: { display: true },
          y: { display: true, beginAtZero: true }
        }
      }
    });
  }

  tipoDatoSelect.addEventListener("change", async () => {
    const parcelaSelect = document.getElementById("parcelaSelect");
    await cargarDatos(parcelaSelect.value, tipoDatoSelect.value);
  });

  await cargarParcelas();
});
