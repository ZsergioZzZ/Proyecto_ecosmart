// asistente.js

// ------------------------------
// 1) Variables globales
// ------------------------------
let chatBox = null;
let mensajeInput = null;
let btnEnviar = null;
let btnNuevoChat = null;
let listaChatsUL = null;

// ======== NUEVAS VARIABLES PARA PARCELAS/SENSORES ========
let parcelaSelect = null;          // <select> de parcelas
let sensorSelect = null;           // <select> de sensores (segundo select)
let btnRecomendarSensor = null;    // botón "Obtener recomendación"
let recomendacionOutput = null;    // contenedor donde se mostrará la recomendación
// ==========================================================

// Identificador del chat actualmente seleccionado.
// Si es null => "nuevo chat" (el servidor generará un chat_id).
let chatIdActual = null;

// (Opcional) Nombre legible del chat; podrías asignar uno por defecto o tomarlo del back.
let nombreChatActual = "";

// ------------------------------
// 2) Función para crear un <li> en la lista de chats
//    (sin cambios en esta parte)
// ------------------------------
function crearElementoChatListItem(chat_id, nombre_chat) {
  const li = document.createElement("li");
  li.classList.add("chat-item");
  li.setAttribute("data-chat-id", chat_id);

  const spanNombre = document.createElement("span");
  spanNombre.classList.add("chat-nombre");
  spanNombre.textContent = nombre_chat || "Chat sin nombre";
  li.appendChild(spanNombre);

  const spanEdit = document.createElement("span");
  spanEdit.classList.add("edit-icon");
  spanEdit.innerHTML = "✏️";
  li.appendChild(spanEdit);

  const spanDelete = document.createElement("span");
  spanDelete.classList.add("delete-icon");
  spanDelete.innerHTML = "🗑️";
  li.appendChild(spanDelete);

  return li;
}

// ------------------------------
// 3) Obtener lista de chats desde backend
//    (sin cambios en esta parte)
// ------------------------------
function cargarListaChats() {
    const email = localStorage.getItem("correoUsuario");
    if (!email) {
      console.error("No hay 'correoUsuario' en localStorage");
      return;
    }
// 3.2) Ahora sí hacemos el fetch incluyendo email
    fetch(`http://localhost:5000/historial_chats?email=${encodeURIComponent(email)}`)
    .then((res) => {
      if (!res.ok) throw new Error("No se pudo cargar la lista de chats");
      return res.json();
    })
    .then((lista) => {
      listaChatsUL.innerHTML = "";
      lista.forEach((chat) => {
        const li = crearElementoChatListItem(chat.chat_id, chat.nombre_chat);
        listaChatsUL.appendChild(li);
      });
    })
    .catch((err) => {
      console.error("Error al cargar lista de chats:", err);
    });
}

// ------------------------------
// 4) Obtener historial de un chat específico
//    (sin cambios en esta parte)
// ------------------------------
function cargarHistorial(chat_id) {
  // Obtener el email del usuario desde localStorage
  const email = localStorage.getItem("correoUsuario");
  if (!email) {
    console.error("No hay 'correoUsuario' en localStorage");
    return;
  }

  // Realizar la petición incluyendo el email como query
  fetch(
    `http://localhost:5000/historial/${encodeURIComponent(chat_id)}?email=${encodeURIComponent(email)}`
  )
    .then((res) => {
      if (!res.ok) throw new Error("No se pudo cargar el historial");
      return res.json();
    })
    .then((mensajes) => {
      chatBox.innerHTML = "";
      mensajes.forEach((elem) => {
        // Mensaje del usuario
        const nodoUsuario = document.createElement("div");
        nodoUsuario.classList.add("mensaje", "mensaje-usuario");
        nodoUsuario.textContent = elem.pregunta;
        chatBox.appendChild(nodoUsuario);

        // Respuesta de la IA
        const nodoIA = document.createElement("div");
        nodoIA.classList.add("mensaje", "mensaje-ia");
        nodoIA.textContent = elem.respuesta;
        chatBox.appendChild(nodoIA);
      });
      chatBox.scrollTop = chatBox.scrollHeight;
    })
    .catch((err) => {
      console.error("Error al cargar historial:", err);
    });
}


// ------------------------------
// 5) Manejar el click sobre un ítem de la lista de chats
//    (sin cambios en esta parte)
// ------------------------------
function alSeleccionarChatEnSidebar(evt) {
  const li = evt.target.closest("li.chat-item");
  if (!li) return;
  if (evt.target.classList.contains("edit-icon")) {
    return;
  }

  document.querySelectorAll(".chat-item.activo").forEach((item) => {
    item.classList.remove("activo");
  });
  li.classList.add("activo");

  chatIdActual = li.getAttribute("data-chat-id");
  nombreChatActual = li.querySelector(".chat-nombre").textContent;
  cargarHistorial(chatIdActual);
}

// ------------------------------
// 6) Manejar el click en el ícono de editar (✏️)
//    (sin cambios en esta parte)
// ------------------------------
function alClickEditarChat(evt) {
  if (!evt.target.classList.contains("edit-icon")) return;
  const li = evt.target.closest("li.chat-item");
  if (!li) return;

  const chat_id = li.getAttribute("data-chat-id");
  const nombreActual = li.querySelector(".chat-nombre").textContent;
  const confirmar = window.confirm(
    `¿Estás seguro que quieres cambiar el nombre del chat “${nombreActual}”?`
  );
  if (!confirmar) return;

  const nuevoNombre = window.prompt(
    "Ingresa el nuevo nombre para este chat:",
    nombreActual
  );
  if (nuevoNombre === null) return;
  const nombreTrim = nuevoNombre.trim();
  if (nombreTrim === "") {
    alert("El nombre no puede estar vacío.");
    return;
  }

  // Obtener email del usuario
  const email = localStorage.getItem("correoUsuario");
  if (!email) {
    console.error("No hay 'correoUsuario' en localStorage");
    return;
  }

  fetch(`http://localhost:5000/renombrar_chat/${encodeURIComponent(chat_id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email:       email,        // ✏️ Añadido
      nombre_chat: nombreTrim
    }),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Error al renombrar el chat");
      return res.json();
    })
    .then((data) => {
      li.querySelector(".chat-nombre").textContent = data.nombre_chat;
      if (chatIdActual === chat_id) {
        nombreChatActual = data.nombre_chat;
      }
    })
    .catch((err) => {
      console.error("Error al renombrar chat:", err);
      alert("Ocurrió un error al renombrar. Intenta nuevamente.");
    });
}


// ------------------------------
// 7) Botón “Nuevo Chat”
//    (sin cambios en esta parte)
// ------------------------------
function alNuevoChat() {
  // 1) Obtener el email del usuario desde localStorage
  const email = localStorage.getItem("correoUsuario");
  if (!email) {
    console.error("No hay 'correoUsuario' en localStorage");
    return;
  }

  // (Opcional) Pedir nombre para el chat, o usar nombreChatActual
  const nombreChat = prompt("Nombre para este chat:", "") || "";

  // 2) Llamar al endpoint con email y nombre_chat
  fetch("http://localhost:5000/crear_chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },    // ✏️ Añadido
    body: JSON.stringify({                               // ✏️ Añadido
      email:       email,
      nombre_chat: nombreChat
    })
  })
    .then((res) => {
      if (!res.ok) throw new Error("No se pudo crear el chat en el servidor");
      return res.json();
    })
    .then((data) => {
      const nuevoChatId = data.chat_id;

      // 3) Guardar el nuevo chat_id en localStorage
      localStorage.setItem("chat_id", nuevoChatId);      // ✏️ Añadido

      // 4) Actualizar la UI de la lista de chats
      document.querySelectorAll(".chat-item.activo").forEach((item) => {
        item.classList.remove("activo");
      });
      const li = crearElementoChatListItem(nuevoChatId, nombreChat);
      listaChatsUL.insertBefore(li, listaChatsUL.firstChild);
      li.classList.add("activo");

      // 5) Mensaje de bienvenida en el chat
      chatBox.innerHTML = "";  // limpiar chatBox
      const saludo = document.createElement("div");
      saludo.classList.add("mensaje", "mensaje-ia");
      saludo.textContent = "Chat creado. Empieza a escribir tu pregunta.";
      chatBox.appendChild(saludo);
      chatBox.scrollTop = chatBox.scrollHeight;
    })
    .catch((err) => {
      console.error("Error al crear nuevo chat:", err);
      alert("No se pudo crear un nuevo chat. Intenta nuevamente.");
    });
}

let nodoEscribiendo = null;

function showTypingIndicator() {
  // si ya existe, no crees otro
  if (nodoEscribiendo) return;
  nodoEscribiendo = document.createElement("div");
  nodoEscribiendo.classList.add("mensaje", "mensaje-ia", "mensaje-escribiendo");
  // tres puntitos
  nodoEscribiendo.innerHTML = "<span class='dot'></span><span class='dot'></span><span class='dot'></span>";
  chatBox.appendChild(nodoEscribiendo);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function hideTypingIndicator() {
  if (!nodoEscribiendo) return;
  chatBox.removeChild(nodoEscribiendo);
  nodoEscribiendo = null;
}



// ------------------------------
// 8) Enviar un mensaje a la IA (chat)
//    (sin cambios en esta parte)
// ------------------------------

function enviarMensaje() {
  const texto = mensajeInput.value.trim();
  if (texto === "") return;

  // 1) Mostrar el mensaje del usuario
  const nodoUsuario = document.createElement("div");
  nodoUsuario.classList.add("mensaje", "mensaje-usuario");
  nodoUsuario.textContent = texto;
  chatBox.appendChild(nodoUsuario);
  mensajeInput.value = "";
  chatBox.scrollTop = chatBox.scrollHeight;

  // 2) Mostrar indicador de “IA escribiendo…”
  showTypingIndicator();

  // 3) Preparar datos
  const email = localStorage.getItem("correoUsuario");
  if (!email) {
    console.error("No hay 'correoUsuario' en localStorage");
    hideTypingIndicator();
    return;
  }
  let chatIdActual = localStorage.getItem("chat_id") || null;

  const payload = {
    email,
    chat_id:      chatIdActual,
    nombre_chat:  nombreChatActual,
    tipo_peticion:"texto_libre",
    pregunta:     texto
  };

  // 4) Enviar petición
  fetch("http://localhost:5000/consulta-ia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      // 5) Ocultar indicador
      hideTypingIndicator();

      if (!res.ok) throw new Error("Error en la consulta a la IA");
      return res.json();
    })
    .then((data) => {
      // 6) Mostrar respuesta IA
      const respuestaIA = data.respuesta;
      chatIdActual = data.chat_id;
      localStorage.setItem("chat_id", chatIdActual);

      const nodoIA = document.createElement("div");
      nodoIA.classList.add("mensaje", "mensaje-ia");
      nodoIA.textContent = respuestaIA;
      chatBox.appendChild(nodoIA);
      chatBox.scrollTop = chatBox.scrollHeight;

      // 7) Si es nuevo chat, recargar la lista
      if (!document.querySelector(`li.chat-item[data-chat-id="${chatIdActual}"]`)) {
        cargarListaChats();
      }
    })
    .catch((err) => {
      // 8) Ocultar indicador y loguear
      hideTypingIndicator();
      console.error("Error al enviar mensaje:", err);
    });
}



// ------------------------------
// 9) Función para manejar clic en el ícono de eliminar (🗑️)
//    (sin cambios en esta parte)
// ------------------------------
function alClickEliminarChat(evt) {
  if (!evt.target.classList.contains("delete-icon")) return;
  const li = evt.target.closest("li.chat-item");
  if (!li) return;

  const chat_id = li.getAttribute("data-chat-id");
  const nombreActual = li.querySelector(".chat-nombre").textContent;
  const confirmar = window.confirm(
    `¿Estás seguro que quieres eliminar el chat “${nombreActual}”?`
  );
  if (!confirmar) return;

  // 1) Leer el email del usuario desde localStorage
  const email = localStorage.getItem("correoUsuario");
  if (!email) {
    console.error("No hay 'correoUsuario' en localStorage");
    return;
  }

  // 2) Llamar al endpoint pasando el email por query string
  fetch(
    `http://localhost:5000/eliminar_chat/${encodeURIComponent(chat_id)}?email=${encodeURIComponent(email)}`,
    { method: "DELETE" }
  )
    .then((res) => {
      if (!res.ok) throw new Error("Error al eliminar el chat");
      return res.json();
    })
    .then((data) => {
      // 3) Eliminar de la UI
      li.remove();
      if (chatIdActual === chat_id) {
        chatIdActual = null;
        nombreChatActual = "";
        chatBox.innerHTML = "";

        const aviso = document.createElement("div");
        aviso.classList.add("mensaje", "mensaje-ia");
        aviso.textContent =
          "El chat fue eliminado. Inicia un nuevo chat o selecciona otro.";
        chatBox.appendChild(aviso);
      }
    })
    .catch((err) => {
      console.error("Error al eliminar chat:", err);
      alert("Ocurrió un error al eliminar. Intenta nuevamente.");
    });
}


// ==============================
// === MÓDULO SENSORES (NUEVO) ===
// ==============================

// 10) Obtener todas las parcelas al cargar la página
function cargarParcelas() {
  // 1) Obtener correo del usuario desde localStorage
  const correo = localStorage.getItem("correoUsuario");
  if (!correo) {
    console.error("No hay 'correoUsuario' en localStorage");
    return;
  }

  // 2) Construir la URL con query-string ?email=<correo>
  const baseUrl = "http://localhost:5000/parcelas_recomendacion-ia";
  const url = `${baseUrl}?email=${encodeURIComponent(correo)}`;

  // 3) Hacer fetch al endpoint con el parámetro email
  fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json"
    }
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Error ${res.status}: no se pudo obtener la lista de parcelas`);
      }
      return res.json();
    })
    .then((parcArr) => {
      // 4) Vaciar el <select> antes de añadir nuevas opciones
      parcelaSelect.innerHTML = "";
      // (Opcional) añadir una opción placeholder
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Seleccione parcela";
      placeholder.disabled = true;
      placeholder.selected = true;
      parcelaSelect.appendChild(placeholder);

      // 5) Recorrer y agregar las parcelas filtradas
      parcArr.forEach(({ _id, displayName }) => {
        const opt = document.createElement("option");
        opt.value = displayName;    // o usar _id si prefieres
        opt.textContent = displayName;
        parcelaSelect.appendChild(opt);
      });
    })
    .catch((err) => {
      console.error("Error cargando parcelas:", err);
    });
}


// 11) Cuando cambie la parcela, solicitamos sus tipos de sensores
function onChangeParcela() {
  const parcelaSeleccionada = parcelaSelect.value;
  // Limpiamos el select de sensores
  sensorSelect.innerHTML = "<option value=''>-- Selecciona un sensor --</option>";
  sensorSelect.disabled = true;
  btnRecomendarSensor.disabled = true;
  recomendacionOutput.innerHTML = "";

  if (!parcelaSeleccionada) {
    return;
  }

  fetch(
    `http://localhost:5000/sensores_recomendacion-ia?parcela=${encodeURIComponent(
      parcelaSeleccionada
    )}`
  )
    .then((res) => {
      if (!res.ok) throw new Error("No se pudo obtener sensores");
      return res.json();
    })
    .then((tiposArr) => {
      // tiposArr = [ "Temperatura Ambiente", "Humedad del suelo", ... ]
      tiposArr.forEach((tipo) => {
        const opt = document.createElement("option");
        opt.value = tipo;
        opt.textContent = tipo;
        sensorSelect.appendChild(opt);
      });
      sensorSelect.disabled = false;
    })
    .catch((err) => {
      console.error("Error cargando tipos de sensores:", err);
    });
}

// 12) Cuando cambie el sensor, habilitar botón de recomendación
function onChangeSensor() {
  if (sensorSelect.value) {
    btnRecomendarSensor.disabled = false;
  } else {
    btnRecomendarSensor.disabled = true;
  }
  recomendacionOutput.innerHTML = "";
}

// 13) Al hacer clic en “Obtener recomendación”
function pedirRecomendacionEnChat() {
  const parcelaSeleccionada = parcelaSelect.value;
  const tipoSeleccionado    = sensorSelect.value;

  // 1) Mostrar indicador de “IA escribiendo…”
  showTypingIndicator();

  // 2) Obtener email y chat_id del usuario
  const email      = localStorage.getItem("correoUsuario");
  if (!email) {
    console.error("No hay 'correoUsuario' en localStorage");
    hideTypingIndicator();
    return;
  }
  let chatIdActual = localStorage.getItem("chat_id") || null;

  // 3) Preparar y enviar la petición
  fetch("http://localhost:5000/consulta-ia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email:         email,
      chat_id:       chatIdActual,
      nombre_chat:   nombreChatActual,
      tipo_peticion: "sensor",
      parcela:       parcelaSeleccionada,
      sensor:        tipoSeleccionado
    }),
  })
    .then((res) => {
      // 4) Ocultar indicador
      hideTypingIndicator();

      if (!res.ok) {
        return res.json().then((err) => Promise.reject(err));
      }
      return res.json();
    })
    .then((data) => {
      // 5) Actualizar chatIdActual y localStorage
      chatIdActual = data.chat_id;
      localStorage.setItem("chat_id", chatIdActual);

      // 6) Mostrar la recomendación de la IA
      const nodoIA = document.createElement("div");
      nodoIA.classList.add("mensaje", "mensaje-ia");
      nodoIA.textContent = data.respuesta;
      chatBox.appendChild(nodoIA);
      chatBox.scrollTop = chatBox.scrollHeight;

      // 7) Si es un chat nuevo, recargar lista de sesiones
      if (!document.querySelector(`li.chat-item[data-chat-id="${chatIdActual}"]`)) {
        cargarListaChats();
      }
    })
    .catch((err) => {
      // 8) Ocultar indicador y mostrar error
      hideTypingIndicator();
      const nodoError = document.createElement("div");
      nodoError.classList.add("mensaje", "mensaje-ia");
      nodoError.style.color = "red";
      nodoError.textContent =
        err.error || "Ocurrió un error al solicitar la recomendación.";
      chatBox.appendChild(nodoError);
      chatBox.scrollTop = chatBox.scrollHeight;
    });
}



// ==============================
// === MÓDULO FUNCIONES PREDEFINIDAS EN BOTONES INFERIORES ===
// ==============================
async function enviarAccionFuncional(accion) {
  // 1) Recuperar email y validar
  const email = localStorage.getItem("correoUsuario");
  if (!email) {
    console.error("No hay 'correoUsuario' en localStorage");
    return;
  }
  // chatIdActual ya existe como variable global y se actualiza tras cada llamada
  let currentChatId = localStorage.getItem("chat_id") || null;

  // 2) Construir prompt según la acción
  let promptTexto = "";
  if (accion === "interpretacion") {
    const parcela = parcelaSelect.value;
    if (!parcela) {
      alert("Primero selecciona una parcela para interpretar sus datos.");
      return;
    }
    try {
      const [resTemp, resHum] = await Promise.all([
        fetch(`http://localhost:5000/ultimo_sensor?parcela=${encodeURIComponent(parcela)}&tipo=Temperatura Ambiente`),
        fetch(`http://localhost:5000/ultimo_sensor?parcela=${encodeURIComponent(parcela)}&tipo=Humedad del suelo`)
      ]);
      if (!resTemp.ok || !resHum.ok) throw new Error("Error cargando datos de sensores");
      const dataTemp = await resTemp.json();
      const dataHum  = await resHum.json();
      promptTexto = `La temperatura actual es ${dataTemp.valor}°C y la humedad del suelo es ${dataHum.valor}%. ¿Cuál es la mejor época para sembrar mi cultivo en esta parcela?`;
    } catch (e) {
      console.error(e);
      const nodoError = document.createElement("div");
      nodoError.classList.add("mensaje", "mensaje-ia");
      nodoError.style.color = "red";
      nodoError.textContent =
        "No se pudo obtener información de clima actual. Intenta nuevamente.";
      chatBox.appendChild(nodoError);
      chatBox.scrollTop = chatBox.scrollHeight;
      return;
    }
  }
  else if (accion === "diagnostico") {
    promptTexto = "Por favor, realiza un diagnóstico de enfermedades en mi cultivo.";
  }
  else if (accion === "optimizacion") {
    promptTexto = "Optimiza el plan de riego para mi cultivo.";
  }
  else if (accion === "planificacion") {
    promptTexto = "Ayúdame con la planificación de cultivos a largo plazo.";
  }

  // 3) Insertar burbuja de usuario
  const nodoUsuario = document.createElement("div");
  nodoUsuario.classList.add("mensaje", "mensaje-usuario");
  nodoUsuario.textContent = promptTexto;
  chatBox.appendChild(nodoUsuario);
  chatBox.scrollTop = chatBox.scrollHeight;

  // 4) Mostrar indicador “IA escribiendo…”
  showTypingIndicator();

  // 5) Enviar petición al backend
  try {
    const res = await fetch("http://localhost:5000/consulta-ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        chat_id:      currentChatId,
        nombre_chat:  nombreChatActual,
        tipo_peticion:"texto_libre",
        pregunta:     promptTexto
      })
    });

    // Escondemos indicador justo después de recibir status
    hideTypingIndicator();

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Error en la consulta a la IA");
    }
    const data = await res.json();

    // 6) Actualizar chatId si es nuevo
    currentChatId = data.chat_id;
    localStorage.setItem("chat_id", currentChatId);

    // 7) Mostrar respuesta de la IA
    const nodoIA = document.createElement("div");
    nodoIA.classList.add("mensaje", "mensaje-ia");
    nodoIA.textContent = data.respuesta;
    chatBox.appendChild(nodoIA);
    chatBox.scrollTop = chatBox.scrollHeight;

    // 8) Si era nuevo chat, refrescar lista
    if (!document.querySelector(`li.chat-item[data-chat-id="${currentChatId}"]`)) {
      cargarListaChats();
    }
  } catch (err) {
    // 9) En caso de error, ocultar indicador y mostrar mensaje
    hideTypingIndicator();
    console.error("Error al enviar acción funcional:", err);
    const nodoError = document.createElement("div");
    nodoError.classList.add("mensaje", "mensaje-ia");
    nodoError.style.color = "red";
    nodoError.textContent = err.message || "Ocurrió un error en la acción.";
    chatBox.appendChild(nodoError);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

// ==============================
// ========== FIN BOTONES FUNCIONALES ==========
// ==============================

// ------------------------------
// 14) Inicialización (DOMContentLoaded)
// ------------------------------
document.addEventListener("DOMContentLoaded", function () {
  // Referencias a elementos del DOM (chat)
  chatBox = document.getElementById("chatBox");
  mensajeInput = document.getElementById("mensajeInput");
  btnEnviar = document.getElementById("btnEnviar");
  btnNuevoChat = document.getElementById("btnNuevoChat");
  listaChatsUL = document.getElementById("listaChats");

  // ======== Inicialización de PARCELAS/SENSORES ========
  parcelaSelect = document.getElementById("parcelaSelect");
  sensorSelect = document.getElementById("sensorSelect");
  btnRecomendarSensor = document.getElementById("btnRecomendarSensor");
  recomendacionOutput = document.getElementById("recomendacionOutput");

  // 1) Cargar lista de chats existentes
  cargarListaChats();

  // 2) Delegación: chat-sidebar
  listaChatsUL.addEventListener("click", alSeleccionarChatEnSidebar);
  listaChatsUL.addEventListener("click", alClickEditarChat);
  listaChatsUL.addEventListener("click", alClickEliminarChat);

  // 3) Cuando el usuario hace clic en “Nuevo Chat”
  btnNuevoChat.addEventListener("click", alNuevoChat);

  // 4) Cuando el usuario hace clic en “Enviar” (chat)
  btnEnviar.addEventListener("click", enviarMensaje);
  mensajeInput.addEventListener("keydown", function (evt) {
    if (evt.key === "Enter") {
      evt.preventDefault();
      enviarMensaje();
    }
  });

  // ========== MÓDULO SENSORES ==========
  // 5) Cargar las parcelas desde el backend
  cargarParcelas();

  // 6) Cuando el usuario cambie la parcela
  parcelaSelect.addEventListener("change", onChangeParcela);

  // 7) Cuando el usuario cambie el sensor
  sensorSelect.addEventListener("change", onChangeSensor);

  // 8) Al hacer click en “Obtener recomendación”
  btnRecomendarSensor.addEventListener("click", pedirRecomendacionEnChat);
  // ======================================

  // ========== MÓDULO BOTONES FUNCIONALES ==========
  document.querySelectorAll(".btn-funcional").forEach((btn) => {
    btn.addEventListener("click", () => {
      const accion = btn.getAttribute("data-accion");
      enviarAccionFuncional(accion);
    });
  });
  // ================================================

});
