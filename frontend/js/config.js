(function () {
    const host = window.location.hostname || "127.0.0.1";
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    window.EXAM_CONFIG = {
        apiBase:
            window.EXAM_API_BASE ||
            `${protocol}//${host}:5001/api`,
    };
})();
