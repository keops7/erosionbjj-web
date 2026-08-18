/**
 * Asistente de preguntas frecuentes de Erosión Jiu Jitsu.
 *
 * Es un FAQ programático, no un chatbot con IA: no "entiende" texto libre,
 * solo ofrece botones con las preguntas más habituales y responde con
 * información real de la academia (horarios.json, config.json, inyectados
 * en window.EROSION_DATOS desde build/build.js). Sin dependencias externas,
 * sin coste, sin backend.
 */
(function () {
  var datos = window.EROSION_DATOS;
  if (!datos) return;

  // ---------- Preguntas y respuestas ----------

  function respuestaHorarios() {
    var niveles = datos.niveles && datos.niveles.length ? datos.niveles.join(", ") : "varios niveles";
    return (
      "Tenemos clases de lunes a viernes en estos niveles: " +
      niveles +
      ". El cuadrante completo, con días y horas, está en " +
      '<a href="/horarios/">Horarios</a>. Si quieres, puedes venir a probar una clase cuando te encaje.'
    );
  }

  function respuestaDireccion() {
    return (
      "Estamos en " +
      datos.direccion +
      '. Aquí tienes la ubicación en el mapa: <a href="' +
      datos.mapaHref +
      '" target="_blank" rel="noopener">abrir en Google Maps</a>.'
    );
  }

  function respuestaPrecios() {
    if (!datos.tarifas) {
      return (
        "Todavía no tenemos las tarifas publicadas en la web. Escríbenos por teléfono, email" +
        (datos.whatsapp ? " o WhatsApp" : "") +
        " y te las confirmamos."
      );
    }
    var notaAdultos = datos.tarifas.condiciones
      ? "<small>" + datos.tarifas.condiciones + "</small>"
      : "";
    return (
      '<ul class="eb-lista-datos">' +
      "<li><span>Adultos</span><span>" + datos.tarifas.adultos + notaAdultos + "</span></li>" +
      "<li><span>Niños</span><span>" + datos.tarifas.ninos + "</span></li>" +
      "</ul>"
    );
  }

  function respuestaContacto() {
    var enlaces = [
      '<li><a href="' + datos.telHref + '">' + datos.telefono + "</a></li>",
      '<li><a href="mailto:' + datos.email + '">' + datos.email + "</a></li>",
    ];
    if (datos.instagram) enlaces.push('<li><a href="' + datos.instagram + '" target="_blank" rel="noopener">Instagram</a></li>');
    if (datos.whatsapp) enlaces.push('<li><a href="' + datos.whatsapp + '" target="_blank" rel="noopener">WhatsApp</a></li>');
    return "Puedes contactar con nosotros por aquí:" + '<ul class="eb-lista-enlaces">' + enlaces.join("") + "</ul>";
  }

  var PREGUNTAS = [
    { id: "horarios", texto: "Horarios", responder: respuestaHorarios },
    { id: "direccion", texto: "¿Dónde estáis?", responder: respuestaDireccion },
    { id: "apuntarse", texto: "¿Cómo me apunto?", formulario: true },
    { id: "precios", texto: "Precios", responder: respuestaPrecios },
    { id: "contacto", texto: "Contacto", responder: respuestaContacto },
  ];

  // ---------- Formulario de inscripción (Netlify Forms, sin backend) ----------
  // Envía por fetch al formulario estático "apuntarme" que existe oculto en
  // el HTML (build/build.js) para que Netlify lo detecte y lo procese.

  function mostrarFormulario() {
    var envoltorio = document.createElement("div");
    envoltorio.className = "eb-form-envoltorio";
    envoltorio.innerHTML =
      '<form class="eb-form" id="eb-form-apuntarme">' +
      '<label>Nombre<input type="text" name="nombre" required /></label>' +
      '<label>Teléfono<input type="tel" name="telefono" required /></label>' +
      '<label>Email<input type="email" name="email" required /></label>' +
      '<label>Mensaje (opcional)<textarea name="mensaje" rows="2"></textarea></label>' +
      '<button type="submit" class="eb-form-enviar">Enviar</button>' +
      "</form>";
    body.appendChild(envoltorio);
    body.scrollTop = body.scrollHeight;

    var form = envoltorio.querySelector("#eb-form-apuntarme");
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var boton = form.querySelector(".eb-form-enviar");
      boton.disabled = true;
      boton.textContent = "Enviando…";

      var datosForm = new FormData(form);
      datosForm.append("form-name", "apuntarme");
      var body_ = new URLSearchParams();
      datosForm.forEach(function (valor, clave) {
        body_.append(clave, valor);
      });

      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body_.toString(),
      })
        .then(function (r) {
          envoltorio.remove();
          if (r.ok) {
            mensaje("Hemos recibido tus datos. Te contactaremos en breve para concretar día y horario.");
          } else {
            throw new Error("respuesta no ok");
          }
        })
        .catch(function () {
          envoltorio.remove();
          mensaje(
            "No he podido enviar el formulario. Escríbenos directamente y te atendemos igual: " +
              respuestaContacto()
          );
        })
        .finally(function () {
          botones([{ texto: "⬅ Volver al menú", click: volverAlMenu }]);
        });
    });
  }

  // ---------- Construcción del widget ----------

  var raiz = document.createElement("div");
  raiz.className = "eb-chat";
  raiz.innerHTML =
    '<button class="eb-chat-burbuja" id="eb-chat-toggle" aria-label="Abrir asistente de ' +
    datos.nombre +
    '">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a1 1 0 011 1v11a1 1 0 01-1 1H9l-4.4 3.3A1 1 0 013 19.5V6a1 1 0 011-1z"/></svg>' +
    "</button>" +
    '<div class="eb-chat-panel" id="eb-chat-panel">' +
    '<div class="eb-chat-header">' +
    "<span>" +
    datos.nombre +
    "</span>" +
    '<button class="eb-chat-cerrar" id="eb-chat-cerrar" aria-label="Cerrar asistente">&times;</button>' +
    "</div>" +
    '<div class="eb-chat-body" id="eb-chat-body"></div>' +
    "</div>";
  document.body.appendChild(raiz);

  var toggle = document.getElementById("eb-chat-toggle");
  var panel = document.getElementById("eb-chat-panel");
  var cerrar = document.getElementById("eb-chat-cerrar");
  var body = document.getElementById("eb-chat-body");
  var abierto = false;

  function mensaje(html, deQuien) {
    var burbuja = document.createElement("div");
    burbuja.className = "eb-msg eb-msg-" + (deQuien || "bot");
    burbuja.innerHTML = html;
    body.appendChild(burbuja);
    body.scrollTop = body.scrollHeight;
  }

  function botones(lista) {
    var contenedor = document.createElement("div");
    contenedor.className = "eb-opciones";
    lista.forEach(function (opcion) {
      var btn = document.createElement("button");
      btn.className = "eb-opcion";
      btn.textContent = opcion.texto;
      btn.addEventListener("click", opcion.click);
      contenedor.appendChild(btn);
    });
    body.appendChild(contenedor);
    body.scrollTop = body.scrollHeight;
  }

  function mostrarMenu() {
    var opciones = PREGUNTAS.map(function (p) {
      return {
        texto: p.texto,
        click: function () {
          mensaje(p.texto, "user");
          if (p.formulario) {
            mensaje(
              "Déjanos tus datos y te contactamos para concretar día y horario. Cuando quieras, vienes, pruebas y decides con calma: aquí no hay prisa."
            );
            mostrarFormulario();
          } else {
            mensaje(p.responder());
            botones([{ texto: "⬅ Volver al menú", click: volverAlMenu }]);
          }
        },
      };
    });
    botones(opciones);
  }

  // Vuelve al menú principal borrando antes la pregunta/respuesta anterior,
  // en vez de apilar una copia nueva del menú debajo de la conversación.
  function volverAlMenu() {
    body.innerHTML = "";
    mostrarMenu();
  }

  function iniciar() {
    if (body.childElementCount) return; // ya iniciado
    mensaje("Hola, soy el asistente de " + datos.nombre + ". ¿En qué te puedo ayudar?");
    mostrarMenu();
  }

  function abrirPanel() {
    panel.classList.add("abierto");
    abierto = true;
    toggle.setAttribute("aria-expanded", "true");
    iniciar();
  }

  function cerrarPanel() {
    panel.classList.remove("abierto");
    abierto = false;
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", function () {
    if (abierto) cerrarPanel();
    else abrirPanel();
  });
  cerrar.addEventListener("click", cerrarPanel);
})();
