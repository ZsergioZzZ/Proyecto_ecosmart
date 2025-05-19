document.addEventListener("DOMContentLoaded", () => {
  const mensajeInput = document.getElementById("mensajeInput");
  const enviarBtn = document.getElementById("enviarBtn");
  const chatBox = document.getElementById("chatBox");

  const nuevoChatBtn = document.getElementById("nuevoChatBtn");
  const diagnosticoBtn = document.getElementById("diagnosticoBtn");
  const interpretacionBtn = document.getElementById("interpretacionBtn");
  const optimizacionBtn = document.getElementById("optimizacionBtn");
  const planificacionBtn = document.getElementById("planificacionBtn");

  const chatSidebar = document.createElement("div");
  chatSidebar.id = "chatSidebar";
  chatSidebar.style.position = "fixed";
  chatSidebar.style.top = "0";
  chatSidebar.style.left = "0";
  chatSidebar.style.width = "220px";
  chatSidebar.style.height = "100%";
  chatSidebar.style.backgroundColor = "#344E41";
  chatSidebar.style.color = "white";
  chatSidebar.style.padding = "20px";
  chatSidebar.style.overflowY = "auto";
  chatSidebar.style.fontFamily = "IBM Plex Mono";
  chatSidebar.style.zIndex = "999";
  chatSidebar.innerHTML = `
  <div style="display: flex; align-items: center; gap: 10px;">
    <img src="imagenes/plantacion (6).png" alt= "Logo" style="width: 24px; height: 24px;" />
    <h2 style="color:#A3B18A; margin: 0;">EcoSmart</h2>
  </div>
  <hr style="border-color:#A3B18A">
`;

  document.body.appendChild(chatSidebar);

  const contenido = document.querySelector("main");
  contenido.style.marginLeft = "240px";

  let chat_id = null;
  let nombre_chat = null;

  function agregarMensaje(texto, tipo = 'ia') {
    const burbuja = document.createElement("div");
    burbuja.innerText = texto;
    burbuja.classList.add("mensaje", tipo);
    chatBox.appendChild(burbuja);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  async function enviarMensaje(texto) {
    agregarMensaje(texto, 'usuario');

    try {
      const res = await fetch("http://localhost:5000/consulta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pregunta: texto,
          chat_id: chat_id,
          nombre_chat: nombre_chat
        })
      });

      const data = await res.json();
      chat_id = data.chat_id;
      agregarMensaje(data.respuesta || "Error en la respuesta", 'ia');
      cargarListaChats();
    } catch (error) {
      agregarMensaje("No se pudo conectar con el servidor", 'ia');
    }
  }

  enviarBtn.addEventListener("click", () => {
    const texto = mensajeInput.value.trim();
    if (texto) {
      enviarMensaje(texto);
      mensajeInput.value = "";
    }
  });

  mensajeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") enviarBtn.click();
  });

  if (nuevoChatBtn) {
    nuevoChatBtn.addEventListener("click", () => {
      chat_id = null;
      nombre_chat = null;
      chatBox.innerHTML = '';
    });
  }

  if (diagnosticoBtn) {
    diagnosticoBtn.addEventListener("click", () => {
      enviarMensaje("¿Qué enfermedad podría tener mi cultivo según estos síntomas?");
    });
  }

  if (interpretacionBtn) {
    interpretacionBtn.addEventListener("click", () => {
      enviarMensaje("¿Qué interpretación puedo hacer de estos datos de sensores?");
    });
  }

  if (optimizacionBtn) {
    optimizacionBtn.addEventListener("click", () => {
      enviarMensaje("¿Cómo puedo optimizar el riego según la humedad del suelo?");
    });
  }

  if (planificacionBtn) {
    planificacionBtn.addEventListener("click", () => {
      enviarMensaje("¿Cuál es la mejor planificación de cultivos para esta temporada?");
    });
  }

  async function cargarListaChats() {
    try {
      const res = await fetch("http://localhost:5000/historial_chats");
      const lista = await res.json();

      chatSidebar.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="imagenes/plantacion (6).png" alt="Logo EcoSmart" style="width: 24px; height: 24px;" />
          <h2 style="color:#A3B18A; margin: 0;">EcoSmart</h2>
        </div>
        <hr style="border-color:#A3B18A">
      `;

      lista.forEach((item, index) => {
        const chatItem = document.createElement("div");
        chatItem.style.display = "flex";
        chatItem.style.justifyContent = "space-between";
        chatItem.style.alignItems = "center";
        chatItem.style.marginBottom = "10px";
        chatItem.style.fontSize = "14px";
        chatItem.style.gap = "4px";
        chatItem.style.position = "relative";

        const nombreContainer = document.createElement("div");
        nombreContainer.style.display = "flex";
        nombreContainer.style.alignItems = "center";
        nombreContainer.style.gap = "6px";

        const chatLabel = document.createElement("span");
        chatLabel.innerText = item.nombre_chat || "Chat " + (index + 1);
        chatLabel.style.cursor = "pointer";
        chatLabel.style.color = "#A3B18A";

        const editarBtn = document.createElement("span");
        editarBtn.innerText = "✏️";
        editarBtn.style.cursor = "pointer";
        editarBtn.title = "Editar nombre";

        editarBtn.addEventListener("click", () => {
          const input = document.createElement("input");
          input.type = "text";
          input.value = chatLabel.innerText;
          input.style.padding = "2px";
          input.style.borderRadius = "6px";
          input.style.border = "1px solid #ccc";
          input.style.fontSize = "13px";
          input.style.width = "90px";

          chatLabel.replaceWith(input);
          input.focus();

          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              const nuevoNombre = input.value.trim();
              if (nuevoNombre && nuevoNombre !== chatLabel.innerText) {
                fetch(`http://localhost:5000/renombrar_chat/${item.chat_id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ nombre_chat: nuevoNombre })
                }).then(() => {
                  if (chat_id === item.chat_id) nombre_chat = nuevoNombre;
                  cargarListaChats();
                });
              }
            }
          });

          input.addEventListener("blur", () => cargarListaChats());
        });

        chatLabel.addEventListener("click", () => {
          chat_id = item.chat_id;
          nombre_chat = item.nombre_chat || "Chat " + (index + 1);
          cargarHistorial(chat_id);
        });

        const eliminarBtn = document.createElement("span");
        eliminarBtn.innerText = "🗑️";
        eliminarBtn.style.cursor = "pointer";
        eliminarBtn.title = "Eliminar chat";
        eliminarBtn.addEventListener("click", async () => {
          await fetch(`http://localhost:5000/eliminar_chat/${item.chat_id}`, { method: "DELETE" });
          if (chat_id === item.chat_id) {
            chatBox.innerHTML = '';
            chat_id = null;
            nombre_chat = null;
          }
          cargarListaChats();
        });

        nombreContainer.appendChild(chatLabel);
        nombreContainer.appendChild(editarBtn);
        chatItem.appendChild(nombreContainer);
        chatItem.appendChild(eliminarBtn);
        chatSidebar.appendChild(chatItem);
      });
    } catch (err) {
      console.warn("No se pudo cargar la lista de chats.");
    }
  }

  async function cargarHistorial(chatId) {
    try {
      const res = await fetch(`http://localhost:5000/historial/${chatId}`);
      const historial = await res.json();
      chatBox.innerHTML = '';
      historial.forEach(conv => {
        agregarMensaje(conv.pregunta, 'usuario');
        agregarMensaje(conv.respuesta, 'ia');
      });
    } catch (err) {
      console.warn("No se pudo cargar el historial del chat.");
    }
  }

  cargarListaChats();
});
