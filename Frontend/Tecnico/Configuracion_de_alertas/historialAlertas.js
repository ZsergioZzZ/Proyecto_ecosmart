document.getElementById("btn-ver-alertas").addEventListener("click", async () => {
  const contenedor = document.getElementById("contenedor-historial-alertas");

  if (contenedor.dataset.cargado === "true") {
    contenedor.style.display = contenedor.style.display === "none" ? "block" : "none";
    return;
  }

  contenedor.innerHTML = "<p>Cargando alertas...</p>";
  contenedor.style.display = "block";

  try {
    const res = await fetch("http://localhost:5000/configuracion-alertas/historial");
    const data = await res.json();

    data.sort((a, b) => a.nombre_alerta.localeCompare(b.nombre_alerta));


    contenedor.innerHTML = "";

    for (const alerta of data) {
    const div = document.createElement("div");
    div.style.border = "1px solid white";
    div.style.padding = "20px";
    div.style.marginBottom = "20px";
    div.style.borderRadius = "12px";
    div.style.background = "#3e5c49";

    const idDetalle = `detalle-umbrales-${Math.random().toString(36).substring(2, 8)}`;

    let html = `
        <h2>${alerta.nombre_alerta}</h2>
        <strong>${alerta.parcela}</strong><br/>
        <strong>Sensor:</strong> ${alerta.sensor}<br/>
        <strong>Usuario:</strong> ${alerta.usuario || "No asignado"}<br/>
        <strong>Notificaciones:</strong> ${alerta.notificaciones.join(", ") || "Ninguna"}<br/><br/>
        ${alerta.estado ? `<button disabled style="background-color:rgba(230, 57, 71, 0.47); color: white; border: none;
        padding: 5px 10px; border-radius: 6px; font-weight: bold; margin-top: 8px; cursor: default;">
        🚨 ${alerta.estado}</button><br/>` : ""}
        
        <button onclick="toggleDetalle('${idDetalle}', this)" style="margin-top: 10px; padding: 6px 12px;">
        🔍 Ver umbrales
        </button>

        <div id="${idDetalle}" style="display: none; margin-top: 10px; background: #ffffff22; padding: 10px; border-radius: 8px;">
    `;

    if (alerta.nutrientes && Object.keys(alerta.nutrientes).length > 0) {
        for (const nutriente in alerta.nutrientes) {
        const n = alerta.nutrientes[nutriente];
        html += `
            <div style="margin-bottom: 10px;">
            <strong>🌿 Nutriente ${nutriente.toUpperCase()}</strong><br/>
            🔺 Alto: ${n.umbral_alto} (${n.descripcion_alto})<br/>
            🔻 Bajo: ${n.umbral_bajo} (${n.descripcion_bajo})<br/>
            </div>
        `;
        }
    } else {
        html += `
        <div>
            <strong>🔺 Umbral Alto:</strong> ${alerta.umbral_alto} (${alerta.descripcion_alto})<br/>
            <strong>🔻 Umbral Bajo:</strong> ${alerta.umbral_bajo} (${alerta.descripcion_bajo})<br/>
        </div>
        `;
    }

    html += `</div>`; 
    div.innerHTML = html;
    contenedor.appendChild(div);
    }


    contenedor.dataset.cargado = "true";
  } catch (err) {
    console.error("Error al cargar historial de alertas:", err);
    contenedor.innerHTML = "<p>No se pudieron cargar las alertas.</p>";
  }
});

function toggleDetalle(id, btn) {
  const contenedor = document.getElementById(id);
  const visible = contenedor.style.display === "block";
  contenedor.style.display = visible ? "none" : "block";
  btn.textContent = visible ? "🔍 Ver umbrales" : "🔽 Ocultar umbrales";
}
