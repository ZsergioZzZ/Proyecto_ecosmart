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
  fetch(`http://localhost:5000/historial_chats`)
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
  fetch(`http://localhost:5000/historial/${chat_id}`)
    .then((res) => {
      if (!res.ok) throw new Error("No se pudo cargar el historial");
      return res.json();
    })
    .then((mensajes) => {
      chatBox.innerHTML = "";
      mensajes.forEach((elem) => {
        const nodoUsuario = document.createElement("div");
        nodoUsuario.classList.add("mensaje", "mensaje-usuario");
        nodoUsuario.textContent = elem.pregunta;
        chatBox.appendChild(nodoUsuario);

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
  if (!confirmar) {
    return;
  }

  const nuevoNombre = window.prompt(
    "Ingresa el nuevo nombre para este chat:",
    nombreActual
  );
  if (nuevoNombre === null) {
    return;
  }
  const nombreTrim = nuevoNombre.trim();
  if (nombreTrim === "") {
    alert("El nombre no puede estar vacío.");
    return;
  }

  fetch(`http://localhost:5000/renombrar_chat/${chat_id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre_chat: nombreTrim }),
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
  fetch("http://localhost:5000/crear_chat", {
    method: "POST",
  })
    .then((res) => {
      if (!res.ok) throw new Error("No se pudo crear el chat en el servidor");
      return res.json();
    })
    .then((data) => {
      const nuevoChatId = data.chat_id;
      document.querySelectorAll(".chat-item.activo").forEach((item) => {
        item.classList.remove("activo");
      });
      const li = crearElementoChatListItem(nuevoChatId, "");
      listaChatsUL.insertBefore(li, listaChatsUL.firstChild);
      li.classList.add("activo");

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

// ------------------------------
// 8) Enviar un mensaje a la IA (chat)
//    (sin cambios en esta parte)
// ------------------------------
function enviarMensaje() {
  const texto = mensajeInput.value.trim();
  if (texto === "") return;

  const nodoUsuario = document.createElement("div");
  nodoUsuario.classList.add("mensaje", "mensaje-usuario");
  nodoUsuario.textContent = texto;
  chatBox.appendChild(nodoUsuario);
  mensajeInput.value = "";
  chatBox.scrollTop = chatBox.scrollHeight;

  const payload = {
    pregunta: texto,
    chat_id: chatIdActual,
    nombre_chat: nombreChatActual,
    tipo_peticion: "texto_libre"
  };

  fetch("http://localhost:5000/consulta-ia", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Error en la consulta a la IA");
      return res.json();
    })
    .then((data) => {
      const respuestaIA = data.respuesta;
      chatIdActual = data.chat_id;

      const nodoIA = document.createElement("div");
      nodoIA.classList.add("mensaje", "mensaje-ia");
      nodoIA.textContent = respuestaIA;
      chatBox.appendChild(nodoIA);
      chatBox.scrollTop = chatBox.scrollHeight;

      if (!document.querySelector(`li.chat-item[data-chat-id="${chatIdActual}"]`)) {
        cargarListaChats();
      }
    })
    .catch((err) => {
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
  if (!confirmar) {
    return;
  }

  fetch(`http://localhost:5000/eliminar_chat/${chat_id}`, {
    method: "DELETE",
  })
    .then((res) => {
      if (!res.ok) throw new Error("Error al eliminar el chat");
      return res.json();
    })
    .then((data) => {
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
  fetch(`http://localhost:5000/parcelas_recomendacion-ia`)
    .then((res) => {
      if (!res.ok) throw new Error("No se pudo obtener la lista de parcelas");
      return res.json();
    })
    .then((parcArr) => {
      // parcArr = [ { _id: "628f...", displayName: "Parcelas Aires de Colchagua - Parcela 1" }, ... ]
      parcArr.forEach((parcela) => {
        const opt = document.createElement("option");
        opt.value = parcela.displayName; // guardamos displayName como value
        opt.textContent = parcela.displayName;
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
  const tipoSeleccionado = sensorSelect.value;

  // 1) Mostrar un mensaje provisional en el chat
  const nodoTemp = document.createElement("div");
  nodoTemp.classList.add("mensaje", "mensaje-ia");
  nodoTemp.textContent = "Obteniendo recomendación para sensor…";
  chatBox.appendChild(nodoTemp);
  chatBox.scrollTop = chatBox.scrollHeight;

  // 2) Llamar al endpoint /consulta-ia indicando que es tipo_peticion = "sensor"
  fetch("http://localhost:5000/consulta-ia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tipo_peticion: "sensor", // <--- Esto es vital
      parcela: parcelaSeleccionada,
      sensor: tipoSeleccionado,
      chat_id: chatIdActual, // puede venir null si es chat nuevo
      nombre_chat: nombreChatActual, // opcional, si en tu UI manejas nombre
    }),
  })
    .then((res) => {
      // Si hay error en el status, eliminamos el mensaje temporal y lanzamos excepción
      if (!res.ok) {
        if (chatBox.contains(nodoTemp)) chatBox.removeChild(nodoTemp);
        return res.json().then((err) => Promise.reject(err));
      }
      return res.json();
    })
    .then((data) => {
      // 3) Eliminar el mensaje provisional
      if (chatBox.contains(nodoTemp)) {
        chatBox.removeChild(nodoTemp);
      }

      // 4) Actualizar chatIdActual con el que venga del backend
      chatIdActual = data.chat_id;

      // 5) Mostrar la recomendación de IA dentro del chat
      const nodoIA = document.createElement("div");
      nodoIA.classList.add("mensaje", "mensaje-ia");
      nodoIA.textContent = data.respuesta;
      chatBox.appendChild(nodoIA);
      chatBox.scrollTop = chatBox.scrollHeight;

      // 6) Si era un chat nuevo, recargamos la lista de chats en la sidebar
      if (
        !document.querySelector(`li.chat-item[data-chat-id="${chatIdActual}"]`)
      ) {
        cargarListaChats();
      }
    })
    .catch((err) => {
      // 7) Si falla, quitar provisional y mostrar error
      if (chatBox.contains(nodoTemp)) {
        chatBox.removeChild(nodoTemp);
      }
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
  let promptTexto = "";

  // Para la parte de “Interpretación de datos”, necesitamos traer
  // primero temperatura y humedad actuales de los sensores:
  if (accion === "interpretacion") {
    const parcela = parcelaSelect.value;
    if (!parcela) {
      alert("Primero selecciona una parcela para interpretar sus datos.");
      return;
    }

    try {
      // 1) Obtener temperatura ambiente
      const resTemp = await fetch(
        `http://localhost:5000/ultimo_sensor?parcela=${encodeURIComponent(
          parcela
        )}&tipo=Temperatura Ambiente`
      );
      if (!resTemp.ok) throw new Error("No se pudo obtener la temperatura.");
      const dataTemp = await resTemp.json();
      const valorTemp = dataTemp.valor; // por ejemplo 14.19

      // 2) Obtener humedad del suelo
      const resHum = await fetch(
        `http://localhost:5000/ultimo_sensor?parcela=${encodeURIComponent(
          parcela
        )}&tipo=Humedad del suelo`
      );
      if (!resHum.ok) throw new Error("No se pudo obtener la humedad.");
      const dataHum = await resHum.json();
      const valorHum = dataHum.valor; // por ejemplo 45.75

      // 3) Construir prompt incluyendo esos valores
      promptTexto = `La temperatura actual es ${valorTemp}°C y la humedad del suelo es ${valorHum}%. ¿Cuál es la mejor época para sembrar mi cultivo en esta parcela?`;

    } catch (err) {
      console.error("Error al obtener valores de sensores:", err);
      // Opcional: mostrar mensaje al usuario
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
  // Fin de “interpretacion”

  // ----------------------------------
  // Para las otras acciones (diagnostico, optimizacion, planificacion),
  // dejamos el texto fijo como antes:
  // ----------------------------------
  if (accion === "diagnostico") {
    promptTexto = "Por favor, realiza un diagnóstico de enfermedades en mi cultivo.";
  }
  if (accion === "optimizacion") {
    promptTexto = "Optimiza el plan de riego para mi cultivo.";
  }
  if (accion === "planificacion") {
    promptTexto = "Ayúdame con la planificación de cultivos a largo plazo.";
  }

  // ----------------------------------
  // 1) Insertar el mensaje del usuario en el chat
  // ----------------------------------
  const nodoUsuario = document.createElement("div");
  nodoUsuario.classList.add("mensaje", "mensaje-usuario");
  nodoUsuario.textContent = promptTexto;
  chatBox.appendChild(nodoUsuario);
  chatBox.scrollTop = chatBox.scrollHeight;

  // ----------------------------------
  // 2) Armar payload y enviarlo a /consulta-ia
  // ----------------------------------
  const payload = {
    pregunta: promptTexto,
    chat_id: chatIdActual,
    nombre_chat: nombreChatActual,
    tipo_peticion: "texto_libre",
    // Podrías incluir acá también "cultivo" si lo tuvieras en el front:
    // cultivo: <valorSeleccionado>,
  };

  fetch("http://localhost:5000/consulta-ia", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Error en la consulta a la IA");
      return res.json();
    })
    .then((data) => {
      const respuestaIA = data.respuesta;
      chatIdActual = data.chat_id;

      const nodoIA = document.createElement("div");
      nodoIA.classList.add("mensaje", "mensaje-ia");
      nodoIA.textContent = respuestaIA;
      chatBox.appendChild(nodoIA);
      chatBox.scrollTop = chatBox.scrollHeight;

      // Si era un chat nuevo, recargamos la lista de chats en la sidebar
      if (
        !document.querySelector(`li.chat-item[data-chat-id="${chatIdActual}"]`)
      ) {
        cargarListaChats();
      }
    })
    .catch((err) => {
      console.error("Error al enviar acción funcional:", err);
    });
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
