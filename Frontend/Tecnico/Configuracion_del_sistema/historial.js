document.getElementById("btn-ver-parcelas").addEventListener("click", async () => {
  const contenedor = document.getElementById("contenedor-historial");

  if (contenedor.dataset.cargado === "true") {
    contenedor.style.display = contenedor.style.display === "none" ? "block" : "none";
    return;
  }

  contenedor.innerHTML = "<p>Cargando parcelas...</p>";
  contenedor.style.display = "block";

  try {
    const resParcelas = await fetch("http://localhost:5000/api/parcelas-detalle");
    const parcelas = await resParcelas.json();

    contenedor.innerHTML = ""; 

    for (const parcela of parcelas) {
      const divParcela = document.createElement("div");
      divParcela.style.border = "1px solid white";
      divParcela.style.padding = "20px";
      divParcela.style.marginBottom = "20px";
      divParcela.style.borderRadius = "12px";
      divParcela.style.background = "#3e5c49";

      const idLista = `puntos-${parcela.nombre.replace(/\s+/g, '')}-${parcela.numero}`;

      const info = `
        <strong>${parcela.nombre} - Parcela ${parcela.numero}</strong><br/>
        <span><strong>Ubicación:</strong> ${parcela.ubicacion}</span><br/>
        <span><strong>Cultivo:</strong> ${parcela.cultivo}</span><br/>
        <span><strong>Usuario:</strong> ${parcela.usuario || "No asignado"}</span><br/>

        <button onclick="mostrarSensores('${parcela.nombre} - Parcela ${parcela.numero}', this)" style="margin-top: 10px; padding: 6px 12px;">📡 Sensores</button>
        <div class="sensor-lista" style="display:none; margin-top: 10px;"></div>

        <button onclick="mostrarPuntosParcela('${parcela.nombre}', ${parcela.numero}, '${idLista}', this)" style="margin-top: 10px; padding: 6px 12px;">📌 Ver Puntos Parcela</button>
        <div id="${idLista}" class="puntos-lista" style="display: none; margin-top: 10px; background: #ffffff11; padding: 10px; border-radius: 6px;"></div>
        `;


      divParcela.innerHTML = info;
      contenedor.appendChild(divParcela);
    }

    contenedor.dataset.cargado = "true";
  } catch (err) {
    console.error("Error al cargar historial:", err);
    contenedor.innerHTML = "<p>No se pudieron cargar las parcelas.</p>";
  }
});

async function mostrarSensores(parcelaTexto, btn) {
  const contenedor = btn.nextElementSibling;
  const visible = contenedor.style.display === "block";
  contenedor.style.display = visible ? "none" : "block";

  if (visible || contenedor.dataset.cargado === "true") return;

  try {
    const res = await fetch("http://localhost:5000/api/sensores-por-parcela?parcela=" + encodeURIComponent(parcelaTexto));
    const sensores = await res.json();

    if (!Array.isArray(sensores) || sensores.length === 0) {
      contenedor.innerHTML = "<em>Sin sensores registrados</em>";
    } else {
      contenedor.innerHTML = sensores.map(s => `
        <div style="margin-bottom: 5px; padding: 5px; background: #ffffff22; border-radius: 6px;">
          <strong>${s.tipo}</strong> - lat: ${s.ubicacion.lat}, lng: ${s.ubicacion.lng}
        </div>
      `).join("");
    }

    contenedor.dataset.cargado = "true";
  } catch (err) {
    console.error("Error al obtener sensores:", err);
    contenedor.innerHTML = "<p>Error al cargar sensores.</p>";
  }
}

async function mostrarPuntosParcela(nombre, numero, idLista, btn) {
  const contenedor = document.getElementById(idLista);
  const visible = contenedor.style.display === "block";
  contenedor.style.display = visible ? "none" : "block";

  if (visible || contenedor.dataset.cargado === "true") return;

  try {
    const res = await fetch(`http://localhost:5000/parcela?nombre=${encodeURIComponent(nombre)}&numero=${numero}`);
    const data = await res.json();

    if (!data.puntos || data.puntos.length === 0) {
      contenedor.innerHTML = "<em>Sin puntos registrados</em>";
      return;
    }

    contenedor.innerHTML = data.puntos.map((p, i) => `
      <div>📍 Punto ${i + 1}: lat = ${p.lat}, lng = ${p.lng}</div>
    `).join("");

    contenedor.dataset.cargado = "true";
  } catch (err) {
    console.error("Error al cargar puntos de la parcela:", err);
    contenedor.innerHTML = "<p>Error al cargar puntos de la parcela.</p>";
  }
}
