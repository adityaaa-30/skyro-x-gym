(() => {
    const hostname = window.location.hostname || "localhost";
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    window.API_BASE_URL = `${protocol}//${hostname}:5000`;
})();
