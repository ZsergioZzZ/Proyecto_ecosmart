let usuariosActualesParcela = [];
async function cargarParcelasAsignar() {
  try {
    const correo = localStorage.getItem("correoUsuario");
    const res = await fetch(`http://localhost:5000/api/parcelas-lista-completa?correo=${encodeURIComponent(correo)}`);
    const parcelas = await res.json();
    const select = document.getElementById('select-parcela-asignar');
    select.innerHTML = '<option value="">Seleccione una parcela</option>';
      parcelas.sort((a, b) => {
        const nombreA = a.nombre.toLowerCase();
        const nombreB = b.nombre.toLowerCase();
        if (nombreA < nombreB) return -1;
        if (nombreA > nombreB) return 1;
        return a.numero - b.numero;
      });
      parcelas.forEach(p => {
      const opt = document.createElement('option');
      opt.value = `${p.nombre}||${p.numero}`;
      opt.textContent = `${p.nombre} - Parcela ${p.numero}`;
      select.appendChild(opt);
    });
  } catch (err) {
    alert('Error al cargar parcelas');
    console.error(err);
  }
}

// --- Cargar usuarios (todos los roles) ---
async function cargarUsuariosAsignar() {
  try {
    const res = await fetch('http://localhost:5000/api/parcelas-configuracion/usuarios-todos');
    const usuarios = await res.json();
    const select = document.getElementById('select-usuario-asignar');
    select.innerHTML = '<option value="">Seleccione un usuario</option>';
    usuarios.sort((a, b) => a.label.localeCompare(b.label)); 
    usuarios.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.value; 
      opt.textContent = u.label;
      select.appendChild(opt);
    });
  } catch (err) {
    alert('Error al cargar usuarios');
    console.error(err);
  }
}

async function mostrarInfoParcelaAsignar() {
  const val = document.getElementById('select-parcela-asignar').value;
  const infoDiv = document.getElementById('info-parcela-asignar');
  if (!val) { infoDiv.style.display = 'none'; return; }
  const [nombre, numero] = val.split('||');
  const res = await fetch('http://localhost:5000/api/parcelas-lista-completa');
  const parcelas = await res.json();
  const p = parcelas.find(x => x.nombre === nombre && String(x.numero) === String(numero));
  if (!p) { infoDiv.style.display = 'none'; return; }
  document.getElementById('p-nombre-asignar').textContent = p.nombre;
  document.getElementById('p-ubicacion-asignar').textContent = p.ubicacion;
  document.getElementById('p-cultivo-asignar').textContent = p.cultivo;
}  

async function mostrarInfoParcelaAsignar() {
  const val = document.getElementById('select-parcela-asignar').value;
  const infoDiv = document.getElementById('info-parcela-asignar');
  if (!val) { infoDiv.style.display = 'none'; return; }
  const [nombre, numero] = val.split('||');
  const correo = localStorage.getItem("correoUsuario");
  const res = await fetch(`http://localhost:5000/api/parcelas-lista-completa?correo=${encodeURIComponent(correo)}`);
  const parcelas = await res.json();
  const p = parcelas.find(x => x.nombre === nombre && String(x.numero) === String(numero));
  if (!p) { infoDiv.style.display = 'none'; return; }
  document.getElementById('p-nombre-asignar').textContent = p.nombre;
  document.getElementById('p-ubicacion-asignar').textContent = p.ubicacion;
  document.getElementById('p-cultivo-asignar').textContent = p.cultivo;

  const usuariosParcela = (Array.isArray(p.usuario) ? p.usuario : [p.usuario]).filter(Boolean);
  usuariosActualesParcela = usuariosParcela;
  if (usuariosParcela.length > 0) {
    const infoUsuarios = await Promise.all(usuariosParcela.map(async correo => {
      try {
        const resU = await fetch(`http://localhost:5000/api/usuario-info?email=${encodeURIComponent(correo)}`);
        if (!resU.ok) return correo;
        const u = await resU.json();
        return u.rol
          ? `${u.rol.charAt(0).toUpperCase() + u.rol.slice(1)} - ${u.nombre} (${u.email})`
          : correo;
      } catch {
        return correo;
      }
    }));
    document.getElementById('p-usuario-asignar').innerHTML = infoUsuarios.map(u => `<div>${u}</div>`).join("");
  } else {
    document.getElementById('p-usuario-asignar').textContent = "No asignados";
  }

  infoDiv.style.display = 'block';
}





async function asignarUsuarioParcela() {
  const parcelaVal = document.getElementById('select-parcela-asignar').value;
  const usuarioVal = document.getElementById('select-usuario-asignar').value;
  if (!parcelaVal || !usuarioVal) {
    alert("Selecciona una parcela y un usuario.");
    return;
  }
  if (usuariosActualesParcela.includes(usuarioVal)) {
    alert("Este usuario ya está asignado a la parcela.");
    return;
  }  
  const [nombre, numero] = parcelaVal.split('||');
  const res = await fetch('http://localhost:5000/api/parcela/agregar-usuario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, numero, usuario: usuarioVal })
  });
  const data = await res.json();
  if (res.ok) {
    alert("Usuario asignado exitosamente.");

    // --- LIMPIAR TODOS LOS CAMPOS ---
    document.getElementById('select-parcela-asignar').selectedIndex = 0;
    document.getElementById('select-usuario-asignar').selectedIndex = 0;
    document.getElementById('info-parcela-asignar').style.display = 'none';
    // Si tienes otros campos, límpialos aquí también

    // Refresca los select y la info
    cargarParcelasAsignar();
    cargarUsuariosAsignar();
  } else {
    alert(data.error || "Error al asignar usuario.");
  }
}



// --- Eventos y carga inicial ---
document.addEventListener('DOMContentLoaded', () => {
  cargarParcelasAsignar();
  cargarUsuariosAsignar();
  document.getElementById('select-parcela-asignar').addEventListener('change', mostrarInfoParcelaAsignar);
  document.getElementById('btn-asignar-usuario').addEventListener('click', asignarUsuarioParcela);
});
