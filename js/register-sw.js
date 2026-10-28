if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then(registration => {
        console.info("O5 app-shell cache registered:", registration.scope);
      })
      .catch(error => {
        console.warn("O5 app-shell cache registration failed:", error);
      });
  });
}
