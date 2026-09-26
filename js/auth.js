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

      // Supabase devuelve como máximo 1.000 filas por consulta: se pide por tramos.
      function cargarTodos() {
        var filas = [];
        function pagina(desde) {
          return sb
            .from("erosion_videos")
            .select("autor,curso,titulo,drive_id,orden")
            .order("autor", { ascending: true })
            .order("curso", { ascending: true })
            .order("orden", { ascending: true })
            .range(desde, desde + 999)
            .then(function (r) {
              if (r.error) throw r.error;
              var datos = r.data || [];
              filas = filas.concat(datos);
              return datos.length === 1000 ? pagina(desde + 1000) : filas;
            });
        }
        return pagina(0);
      }

      // Árbol autor > curso > vídeo con <details>; el reproductor se crea al abrir cada vídeo.
      function pintar(videos) {
        var autores = {};
        var ordenAutores = [];
        videos.forEach(function (v) {
          var a = autores[v.autor];
          if (!a) {
            a = autores[v.autor] = { cursos: {}, orden: [], total: 0 };
            ordenAutores.push(v.autor);
          }
          var c = a.cursos[v.curso];
          if (!c) {
            c = a.cursos[v.curso] = [];
            a.orden.push(v.curso);
          }
          c.push(v);
          a.total++;
        });
        grid.innerHTML = ordenAutores
          .map(function (nombre) {
            var a = autores[nombre];
            return (
              '<details class="vid-autor"><summary>' + esc(nombre) + " <span>" + a.total + "</span></summary>" +
              a.orden
                .map(function (cn) {
                  var lista = a.cursos[cn];
                  return (
                    '<details class="vid-curso"><summary>' + esc(cn) + " <span>" + lista.length + "</span></summary><ul>" +
                    lista
                      .map(function (v) {
                        return (
                          '<li><details class="vid-item" data-id="' + esc(v.drive_id) + '"><summary>' +
                          esc(v.titulo) + '</summary><div class="video-embed"></div></details></li>'
                        );
                      })
                      .join("") +
                    "</ul></details>"
                  );
                })
                .join("") +
              "</details>"
            );
          })
          .join("");
      }

      // El reproductor de Drive no se puede pausar desde fuera: para parar un vídeo se destruye su iframe.
      function cerrarVideo(item) {
        item.open = false;
        item.querySelector(".video-embed").innerHTML = "";
      }

      grid.addEventListener(
        "toggle",
        function (ev) {
          var d = ev.target;
          if (!d.classList) return;
          if (d.classList.contains("vid-item")) {
            var caja = d.querySelector(".video-embed");
            if (!d.open) {
              caja.innerHTML = ""; // se ha minimizado: parar
              return;
            }
            // Solo un vídeo a la vez: al abrir uno, se cierran (y paran) los demás.
            grid.querySelectorAll(".vid-item[open]").forEach(function (o) {
              if (o !== d) cerrarVideo(o);
            });
            if (caja.firstChild) return;
            var f = document.createElement("iframe");
            f.src = "https://drive.google.com/file/d/" + encodeURIComponent(d.getAttribute("data-id")) + "/preview";
            f.allow = "autoplay";
            f.title = d.querySelector("summary").textContent;
            caja.appendChild(f);
          } else if (d.classList.contains("vid-curso") || d.classList.contains("vid-autor")) {
            // Abrir o cerrar otro autor/curso también para el vídeo en marcha.
            grid.querySelectorAll(".vid-item[open]").forEach(cerrarVideo);
          }
        },
        true
      );

      cargarTodos().then(
        function (videos) {
          if (!videos.length) {
            // Sin filas: o todavía no hay vídeos, o la cuenta no está dada de alta como alumno.
            estado.textContent =
              "No hay vídeos disponibles para tu cuenta. Si eres alumno y deberías verlos, habla con la academia.";
            return;
          }
          estado.classList.add("oculto");
          pintar(videos);
          grid.classList.add("visible", "videos-arbol");
        },
        function () {
          estado.textContent = "No hemos podido cargar los vídeos. Inténtalo de nuevo en unos minutos.";
        }
      );
    });
  }
})();
