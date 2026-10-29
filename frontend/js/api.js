(function () {
    const TOKEN_KEY = "exam_system_token";
    let token = localStorage.getItem(TOKEN_KEY) || "";

    class ApiError extends Error {
        constructor(message, status, details) {
            super(message);
            this.name = "ApiError";
            this.status = status;
            this.details = details;
        }
    }

    async function request(path, options) {
        const config = options || {};
        const headers = Object.assign({}, config.headers || {});
        if (config.body !== undefined) {
            headers["Content-Type"] = "application/json";
        }
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        let response;
        try {
            response = await fetch(`${window.EXAM_CONFIG.apiBase}${path}`, {
                method: config.method || "GET",
                headers,
                body:
                    config.body === undefined
                        ? undefined
                        : JSON.stringify(config.body),
            });
        } catch (error) {
            throw new ApiError(
                "无法连接后端服务，请确认服务已启动或检查网络。",
                0
            );
        }

        let data = null;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            data = await response.json();
        }

        if (!response.ok) {
            if (
                response.status === 401 &&
                token &&
                !path.startsWith("/auth/login")
            ) {
                clearToken();
                window.dispatchEvent(new CustomEvent("exam-auth-expired"));
            }
            throw new ApiError(
                (data && data.error) || `请求失败（${response.status}）`,
                response.status,
                data && data.details
            );
        }

        return data;
    }

    function setToken(value) {
        token = value || "";
        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
        } else {
            localStorage.removeItem(TOKEN_KEY);
        }
    }

    function clearToken() {
        setToken("");
    }

    function hasToken() {
        return Boolean(token);
    }

    window.ExamAPI = {
        ApiError,
        request,
        setToken,
        clearToken,
        hasToken,
        get: (path) => request(path),
        post: (path, body) => request(path, { method: "POST", body }),
        patch: (path, body) => request(path, { method: "PATCH", body }),
        delete: (path) => request(path, { method: "DELETE" }),
    };
})();
