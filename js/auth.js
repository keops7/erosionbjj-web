/**
 * Acceso de alumnos a la galería de vídeos privada.
 *
 * Supabase Auth (email + contraseña) sin autorregistro: las cuentas se dan de
 * alta a mano. La lista de vídeos (ids de Drive) vive en la tabla
 * erosion_videos, protegida por RLS: el servidor solo la devuelve a alumnos
 * activos, así que el HTML público no contiene ningún id de vídeo.
 */
(function () {
  var cfg = window.EROSION_SUPABASE;
  if (!cfg || !cfg.url || !cfg.anonKey) return; // proyecto de Supabase aún sin configurar
  if (!window.supabase || !window.supabase.createClient) return; // la librería no ha cargado

  var sb = window.supabase.createClient(cfg.url, cfg.anonKey);

  function esc(texto) {
    return String(texto).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Solo rutas internas: evita redirecciones abiertas (?next=https://…).
  function destinoSeguro(next) {
    return next && /^\/(?!\/)/.test(next) ? next : "/videos/";
  }

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

      function fallo(texto) {
        error.textContent = texto;
        error.classList.remove("oculto");
        boton.disabled = false;
        boton.textContent = "Entrar";
      }

      sb.auth
        .signInWithPassword({
          email: formLogin.email.value.trim(),
          password: formLogin.password.value,
        })
        .then(function (res) {
          if (res.error) {
            fallo(
              "No hemos podido iniciar tu sesión. Revisa el email y la contraseña, o contacta con nosotros si el problema continúa."
            );
            return;
          }
          var params = new URLSearchParams(window.location.search);
          window.location.href = destinoSeguro(params.get("next"));
        })
        .catch(function () {
          fallo("No hemos podido conectar con el servidor. Inténtalo de nuevo en unos minutos.");
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

      btnLogout.classList.remove("oculto");
      btnLogout.addEventListener("click", function () {
        sb.auth.signOut().then(function () {
          window.location.href = "/";
        });
      });

      sb.from("erosion_videos")
        .select("titulo,descripcion,drive_id")
        .order("orden", { ascending: true })
        .then(function (r) {
          if (r.error) {
            estado.textContent = "No hemos podido cargar los vídeos. Inténtalo de nuevo en unos minutos.";
            return;
          }
          var videos = r.data || [];
          if (!videos.length) {
            // Sin filas: o todavía no hay vídeos, o la cuenta no está dada de alta como alumno.
            estado.textContent =
              "No hay vídeos disponibles para tu cuenta. Si eres alumno y deberías verlos, habla con la academia.";
            return;
          }
          estado.classList.add("oculto");
          grid.innerHTML = videos
            .map(function (v) {
              return (
                '<div class="video-card">' +
                '<div class="video-embed"><iframe src="https://drive.google.com/file/d/' +
                encodeURIComponent(v.drive_id) +
                '/preview" allow="autoplay" loading="lazy" title="' +
                esc(v.titulo) +
                '"></iframe></div>' +
                "<h3>" +
                esc(v.titulo) +
                "</h3>" +
                (v.descripcion ? "<p>" + esc(v.descripcion) + "</p>" : "") +
                "</div>"
              );
            })
            .join("");
          grid.classList.add("visible");
        });
    });
  }
})();
