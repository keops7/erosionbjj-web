/**
 * Autenticación de alumnos para la galería de vídeos privada.
 *
 * Usa Supabase (email + contraseña) solo para login: no hay autoregistro
 * en la web, las cuentas se dan de alta a mano desde el panel de Supabase.
 * La protección real de los vídeos es que el HTML nunca incluye los
 * iframes de Google Drive hasta que se confirma la sesión — no basta con
 * ocultarlos por CSS.
 */
(function () {
  var cfg = window.EROSION_SUPABASE;
  if (!cfg || !cfg.url || !cfg.anonKey) return; // proyecto de Supabase aún sin configurar
  if (!window.supabase || !window.supabase.createClient) return; // la librería no ha cargado

  var sb = window.supabase.createClient(cfg.url, cfg.anonKey);

  // ---------- Página de login ----------
  var formLogin = document.getElementById("form-login");
  if (formLogin) {
    formLogin.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var boton = formLogin.querySelector(".eb-form-enviar");
      var error = document.getElementById("login-error");
      error.classList.add("oculto");
      boton.disabled = true;
      boton.textContent = "Entrando…";

      sb.auth
        .signInWithPassword({
          email: formLogin.email.value.trim(),
          password: formLogin.password.value,
        })
        .then(function (res) {
          if (res.error) {
            error.textContent =
              "No hemos podido iniciar tu sesión. Revisa el email y la contraseña, o contacta con nosotros si el problema continúa.";
            error.classList.remove("oculto");
            boton.disabled = false;
            boton.textContent = "Entrar";
            return;
          }
          var params = new URLSearchParams(window.location.search);
          window.location.href = params.get("next") || "/videos/";
        });
    });
  }

  // ---------- Página de vídeos ----------
  var grid = document.getElementById("videos-grid");
  if (grid) {
    var estado = document.getElementById("videos-estado");
    var btnLogout = document.getElementById("btn-logout");

    sb.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      if (!session) {
        window.location.href = "/login/?next=/videos/";
        return;
      }

      var videos = window.EROSION_VIDEOS || [];
      if (!videos.length) {
        estado.textContent = "Todavía no hay vídeos disponibles. Vuelve a pasarte más adelante.";
      } else {
        estado.classList.add("oculto");
        grid.innerHTML = videos
          .map(function (v) {
            return (
              '<div class="video-card">' +
              '<div class="video-embed"><iframe src="https://drive.google.com/file/d/' +
              v.driveId +
              '/preview" allow="autoplay" loading="lazy" title="' +
              v.titulo +
              '"></iframe></div>' +
              "<h3>" +
              v.titulo +
              "</h3>" +
              (v.descripcion ? "<p>" + v.descripcion + "</p>" : "") +
              "</div>"
            );
          })
          .join("");
        grid.classList.add("visible");
      }

      btnLogout.classList.remove("oculto");
      btnLogout.addEventListener("click", function () {
        sb.auth.signOut().then(function () {
          window.location.href = "/";
        });
      });
    });
  }
})();
