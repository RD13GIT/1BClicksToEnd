<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Global Counter</title>

    <!-- Odometer styles and script -->
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/odometer.js/0.4.8/themes/odometer-theme-default.min.css"
      integrity="sha512-HCZZpJ8Kb5rIvCwY/Hxwm3b2UDNa9ITy4J5qf05Pznz52k6u7bf5qn6zzLwHDo2q1p5jZyFfJzH3LrgrDF+8oA=="
      crossorigin="anonymous"
      referrerpolicy="no-referrer"
    />
    <script
      src="https://cdnjs.cloudflare.com/ajax/libs/odometer.js/0.4.8/odometer.min.js"
      integrity="sha512-WtceX5F5bS3jZDjKYF4jr9gj7vfzK3l5P0dhKNoTK5aYfy1QT5y4VfIh3d25Hz3aZlcvLq2yWP+Y0nrK0yb5OQ=="
      crossorigin="anonymous"
      referrerpolicy="no-referrer"
      defer
    ></script>

    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        height: 100vh;
        display: grid;
        place-items: center;
        background: #0b1220;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue",
          Ubuntu, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
        color: #e5e7eb;
      }
      .card {
        display: grid;
        gap: 16px;
        padding: 32px 40px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.05);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
        text-align: center;
      }
      .title { opacity: 0.8; font-size: 14px; letter-spacing: 0.08em; }
      .odometer {
        font-size: 72px;
        font-weight: 800;
        line-height: 1;
      }
      button {
        font-size: 18px;
        padding: 12px 18px;
        border-radius: 12px;
        border: none;
        color: white;
        background: #2563eb;
        cursor: pointer;
      }
      button:hover { background: #1d4ed8; }
      button:active { transform: translateY(1px); }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="title">Global Clicks</div>
      <div id="counter" class="odometer">0</div>
      <button id="inc">+1</button>
    </div>

    <script>
      const counterEl = document.getElementById('counter');
      const incBtn = document.getElementById('inc');

      async function fetchJSON(url, opts) {
        const res = await fetch(url, opts);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }

      // Initialize
      (async function init() {
        try {
          // Get current count
          const { count } = await fetchJSON('/count');
          counterEl.innerHTML = count; // odometer animates on value change

          // Live updates via SSE
          const es = new EventSource('/events');
          es.addEventListener('count', (e) => {
            const { count } = JSON.parse(e.data);
            counterEl.innerHTML = count; // triggers odometer animation
          });

          // Increment on click
          incBtn.addEventListener('click', async () => {
            incBtn.disabled = true;
            try {
              await fetch('/increment', { method: 'POST' });
              // no need to manually update; SSE will push it to everyone
            } catch (err) {
              console.error(err);
              alert('Failed to increment. Try again.');
            } finally {
              incBtn.disabled = false;
            }
          });
        } catch (err) {
          console.error(err);
          alert('Failed to load counter.');
        }
      })();
    </script>
  </body>
</html>
