(function () {
    "use strict";

    const api = window.ExamAPI;
    const appEl = document.getElementById("app");
    const modalRoot = document.getElementById("modal-root");
    const toastRoot = document.getElementById("toast-root");

    const DEFAULT_SITE = {
        site_name: "知考",
        site_description:
            "多科目、多题型在线考试，自动判分、逐题解析、错题沉淀与学情分析，帮助你把时间用在真正需要加强的地方。",
    };

    const state = {
        user: null,
        authMode: "login",
        subjects: null,
        subjectsPromise: null,
        renderSeq: 0,
        timerInterval: null,
        exam: null,
        quickSubjects: {},
        adminSubjects: [],
        adminQuestions: [],
        adminQuestionPagination: null,
        adminUsers: [],
        currentRoute: null,
        site: { ...DEFAULT_SITE },
    };

    const ICONS = {
        dashboard:
            '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
        play: '<path d="m8 5 11 7-11 7V5Z"/>',
        bookOpen:
            '<path d="M2 4.5A2.5 2.5 0 0 1 4.5 2H11v18H4.5A2.5 2.5 0 0 0 2 22V4.5Z"/><path d="M22 4.5A2.5 2.5 0 0 0 19.5 2H13v18h6.5A2.5 2.5 0 0 1 22 22V4.5Z"/>',
        book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
        history:
            '<path d="M3 12a9 9 0 1 0 2.6-6.3L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
        layers:
            '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
        listChecks:
            '<path d="m3 6 2 2 4-4"/><path d="m3 13 2 2 4-4"/><path d="m3 20 2 2 4-4"/><path d="M13 6h8M13 13h8M13 20h8"/>',
        users:
            '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        user:
            '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        logout:
            '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
        menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
        x: '<path d="M18 6 6 18M6 6l12 12"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
        edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
        trash:
            '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>',
        arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
        chevronLeft: '<path d="m15 18-6-6 6-6"/>',
        chevronRight: '<path d="m9 18 6-6-6-6"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        target:
            '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
        check: '<path d="m5 12 4 4L19 6"/>',
        checkCircle:
            '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
        alert:
            '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/>',
        eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
        eyeOff:
            '<path d="m3 3 18 18"/><path d="M10.6 5.2A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.2 4.1"/><path d="M6.2 6.2A18.4 18.4 0 0 0 2 12s3.5 7 10 7a10.7 10.7 0 0 0 4.1-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
        shield:
            '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
        settings:
            '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
        award:
            '<circle cx="12" cy="8" r="6"/><path d="m8.5 13.5-1.5 8 5-3 5 3-1.5-8"/>',
        chart:
            '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
        refresh:
            '<path d="M21 12a9 9 0 1 1-2.6-6.3"/><path d="M21 3v6h-6"/>',
        lock:
            '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
        sparkles:
            '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
        clip:
            '<path d="M9 5h6M9 3h6v4H9z"/><path d="M7 5H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="M8 13h8M8 17h5"/>',
        filter: '<path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z"/>',
    };

    function icon(name, size, className) {
        const s = size || 18;
        return `<svg class="${className || ""}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
    }

    function esc(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function parseDbDate(value) {
        if (!value) return null;
        const normalized = String(value).replace(" ", "T");
        const date = new Date(`${normalized}Z`);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatDate(value, withTime) {
        const date = parseDbDate(value);
        if (!date) return "—";
        const options = {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        };
        if (withTime !== false) {
            options.hour = "2-digit";
            options.minute = "2-digit";
        }
        return new Intl.DateTimeFormat("zh-CN", options).format(date);
    }

    function durationText(start, end) {
        const from = parseDbDate(start);
        const to = parseDbDate(end) || new Date();
        if (!from) return "—";
        const seconds = Math.max(0, Math.floor((to - from) / 1000));
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const rest = seconds % 60;
        if (hours > 0) {
            return `${hours} 小时 ${minutes} 分`;
        }
        if (minutes > 0) {
            return `${minutes} 分 ${String(rest).padStart(2, "0")} 秒`;
        }
        return `${rest} 秒`;
    }

    function clockText(start) {
        const from = parseDbDate(start);
        if (!from) return "00:00:00";
        const seconds = Math.max(0, Math.floor((Date.now() - from.getTime()) / 1000));
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return [h, m, s].map((part) => String(part).padStart(2, "0")).join(":");
    }

    function formatNumber(value) {
        const number = Number(value) || 0;
        return Number.isInteger(number) ? String(number) : number.toFixed(1);
    }

    function typeLabel(type) {
        return { single: "单选题", multiple: "多选题", judge: "是非题" }[type] || "题目";
    }

    function typeBadge(type, small) {
        const cls = { single: "blue", multiple: "orange", judge: "purple" }[type] || "gray";
        return `<span class="badge ${cls}${small ? " badge-sm" : ""}">${typeLabel(type)}</span>`;
    }

    function optionKeyLabel(question, key) {
        if (question.type === "judge") {
            return key === "T" ? "对" : key === "F" ? "错" : key;
        }
        return key;
    }

    function answerText(question, selected) {
        if (!selected || !selected.length) return "未作答";
        return selected
            .map((key) => {
                const option = (question.options || []).find((item) => item.key === key);
                const text = option ? option.text : "未知选项";
                return `${optionKeyLabel(question, key)}. ${text}`;
            })
            .join("；");
    }

    function initials(name) {
        const value = String(name || "?").trim();
        return value ? value.slice(0, value === value.toLowerCase() ? 2 : 1).toUpperCase() : "?";
    }

    function displayName(user) {
        if (!user) return "";
        return String(user.nickname || "").trim() || user.username;
    }

    function siteName() {
        const value = state.site && String(state.site.site_name || "").trim();
        return value || DEFAULT_SITE.site_name;
    }

    function siteDescription() {
        const value =
            state.site && String(state.site.site_description || "").trim();
        return value || DEFAULT_SITE.site_description;
    }

    function siteMark() {
        return siteName().slice(0, 2);
    }

    async function loadSiteSettings() {
        try {
            const data = await api.get("/settings");
            if (data && data.settings) {
                state.site = data.settings;
                const bootMark = document.getElementById("boot-mark");
                if (bootMark) bootMark.textContent = siteMark();
            }
        } catch (error) {
            console.warn("网站设置加载失败，将使用默认配置。", error);
        }
    }

    function greeting() {
        const hour = new Date().getHours();
        if (hour < 6) return "夜深了";
        if (hour < 12) return "早上好";
        if (hour < 14) return "中午好";
        if (hour < 18) return "下午好";
        return "晚上好";
    }

    function toast(message, type) {
        const kind = type || "success";
        const iconName = kind === "error" ? "alert" : kind === "info" ? "info" : "check";
        const el = document.createElement("div");
        el.className = `toast ${kind}`;
        el.innerHTML = `<span class="toast-icon">${icon(iconName, 13)}</span><span class="toast-message">${esc(message)}</span>`;
        toastRoot.appendChild(el);
        window.setTimeout(() => {
            el.classList.add("leaving");
            window.setTimeout(() => el.remove(), 220);
        }, 3400);
    }

    function emptyState(title, description, actionHtml, iconName) {
        return `
            <div class="empty-card">
                <div class="empty-icon">${icon(iconName || "bookOpen", 24)}</div>
                <h3>${esc(title)}</h3>
                <p>${esc(description)}</p>
                ${actionHtml || ""}
            </div>`;
    }

    function errorPage(error) {
        return emptyState(
            "页面加载失败",
            error && error.message ? error.message : "请稍后重试。",
            `<button class="btn btn-secondary" data-action="reload">${icon("refresh", 15)}重新加载</button>`,
            "alert"
        );
    }

    function loadingPage() {
        return `
            <div class="loading-grid">
                <div class="skeleton loading-box"></div>
                <div class="skeleton loading-box"></div>
                <div class="skeleton loading-box"></div>
                <div class="skeleton loading-box"></div>
            </div>
            <div class="section-head"><h2>正在加载</h2></div>
            <div class="skeleton loading-box tall"></div>`;
    }

    function setPage(html) {
        const container = document.getElementById("page-content");
        if (container) container.innerHTML = html;
    }

    function go(hash) {
        if (window.location.hash === hash) {
            renderRoute();
        } else {
            window.location.hash = hash;
        }
    }

    function buildHash(path, params) {
        const search = new URLSearchParams();
        Object.entries(params || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
                search.set(key, value);
            }
        });
        const query = search.toString();
        return `#${path}${query ? `?${query}` : ""}`;
    }

    // --------------------------------------------------------------- modal

    function closeModal() {
        modalRoot.innerHTML = "";
        document.body.style.overflow = "";
    }

    function openModal(options) {
        const config = options || {};
        modalRoot.innerHTML = `
            <div class="modal-backdrop">
                <div class="modal ${config.size || ""}" role="dialog" aria-modal="true">
                    <div class="modal-head">
                        <div>
                            <h3>${esc(config.title || "")}</h3>
                            ${config.subtitle ? `<p>${esc(config.subtitle)}</p>` : ""}
                        </div>
                        <button class="modal-close" type="button" data-modal-close aria-label="关闭">${icon("x", 18)}</button>
                    </div>
                    <div class="modal-body">${config.body || ""}</div>
                    ${config.footer ? `<div class="modal-foot">${config.footer}</div>` : ""}
                </div>
            </div>`;
        document.body.style.overflow = "hidden";

        const backdrop = modalRoot.querySelector(".modal-backdrop");
        backdrop.addEventListener("mousedown", (event) => {
            if (event.target === backdrop) closeModal();
        });

        return {
            root: backdrop,
            close: closeModal,
        };
    }

    function confirmDialog(options) {
        const config = options || {};
        openModal({
            title: config.title || "确认操作",
            size: "small",
            body: `<p class="confirm-copy">${config.message || ""}</p>`,
            footer: `
                <button class="btn btn-secondary" data-modal-close>取消</button>
                <button class="btn ${config.danger ? "btn-danger" : "btn-primary"}" id="confirm-dialog-btn">
                    ${esc(config.confirmText || "确认")}
                </button>`,
        });
        const button = document.getElementById("confirm-dialog-btn");
        button.addEventListener("click", async () => {
            button.disabled = true;
            button.classList.add("is-loading");
            try {
                await config.onConfirm();
            } finally {
                button.disabled = false;
                button.classList.remove("is-loading");
            }
        });
    }

    // --------------------------------------------------------------- auth

    function renderAuth() {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
        closeModal();
        appEl.innerHTML = authPageHtml(state.authMode);
        document.title = `登录 · ${siteName()}`;
        bindAuth();
    }

    function authPageHtml(mode) {
        const isRegister = mode === "register";
        return `
        <div class="auth-page">
            <section class="auth-brand">
                <div class="auth-brand-inner">
                    <div class="auth-logo">
                        <span class="logo-tile" title="${esc(siteName())}">${esc(siteMark())}</span>
                        <span>${esc(siteName())} · 在线考试系统</span>
                    </div>
                    <div class="auth-brand-copy">
                        <div class="auth-eyebrow">Smart Exam Platform</div>
                        <h1>让每一次练习<br><span>都看得见进步</span></h1>
                        <p>${esc(siteDescription())}</p>
                        <div class="auth-features">
                            <div class="auth-feature">
                                <span class="feature-icon">${icon("layers", 18)}</span>
                                <div><strong>灵活科目题库</strong><span>科目与题型自由组合，按需随机抽题</span></div>
                            </div>
                            <div class="auth-feature">
                                <span class="feature-icon">${icon("target", 18)}</span>
                                <div><strong>智能错题复盘</strong><span>自动记录错题与错题率，针对性复习</span></div>
                            </div>
                            <div class="auth-feature">
                                <span class="feature-icon">${icon("chart", 18)}</span>
                                <div><strong>清晰学情分析</strong><span>科目维度统计得分、正确率与薄弱项</span></div>
                            </div>
                        </div>
                    </div>
                    <div class="auth-brand-foot">${esc(siteName())} · 专注高效学习与测评</div>
                </div>
            </section>
            <section class="auth-panel">
                <div class="auth-card">
                    <div class="auth-mobile-logo">
                        <span class="logo-tile" title="${esc(siteName())}">${esc(siteMark())}</span>
                        <span>${esc(siteName())}</span>
                    </div>
                    <h2>${isRegister ? "创建你的学习账号" : "欢迎回来"}</h2>
                    <p class="auth-subtitle">${isRegister ? "注册后即可参加考试并查看学习分析" : "登录后继续你的备考与错题复习"}</p>
                    <div class="auth-tabs">
                        <button type="button" class="auth-tab ${isRegister ? "" : "active"}" data-auth-tab="login">登录</button>
                        <button type="button" class="auth-tab ${isRegister ? "active" : ""}" data-auth-tab="register">注册</button>
                    </div>
                    <form class="auth-form" id="auth-form" novalidate>
                        <div class="form-field">
                            <label for="auth-username">用户名</label>
                            <input class="input" id="auth-username" name="username" autocomplete="username" placeholder="请输入用户名" maxlength="32" required>
                        </div>
                        <div class="form-field">
                            <label for="auth-password">密码</label>
                            <div class="password-wrap">
                                <input class="input" id="auth-password" name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" placeholder="请输入密码" maxlength="64" required>
                                <button class="password-toggle" type="button" data-password-toggle aria-label="显示密码">${icon("eye", 17)}</button>
                            </div>
                        </div>
                        ${
                            isRegister
                                ? `<div class="form-field">
                                    <label for="auth-confirm">确认密码</label>
                                    <input class="input" id="auth-confirm" name="confirm" type="password" autocomplete="new-password" placeholder="请再次输入密码" maxlength="64" required>
                                </div>`
                                : ""
                        }
                        <div class="form-message" id="auth-error"></div>
                        <button class="btn btn-primary btn-lg auth-submit" type="submit" id="auth-submit">
                            ${isRegister ? "注册并登录" : "登录系统"}
                        </button>
                    </form>
                    ${
                        !isRegister
                            ? `<div class="auth-demo">${icon("info", 16)}<div>管理员初始账号：<code>admin</code>，密码：<code>admin123</code>。首次部署后请及时修改。</div></div>`
                            : `<p class="auth-footnote">注册即表示你同意合理使用本系统进行学习与测评</p>`
                    }
                </div>
            </section>
        </div>`;
    }

    function bindAuth() {
        const tabs = document.querySelectorAll("[data-auth-tab]");
        tabs.forEach((tab) => {
            tab.addEventListener("click", () => {
                state.authMode = tab.dataset.authTab;
                renderAuth();
            });
        });

        const toggle = document.querySelector("[data-password-toggle]");
        if (toggle) {
            toggle.addEventListener("click", () => {
                const input = document.getElementById("auth-password");
                const show = input.type === "password";
                input.type = show ? "text" : "password";
                toggle.innerHTML = icon(show ? "eyeOff" : "eye", 17);
            });
        }

        const form = document.getElementById("auth-form");
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const errorBox = document.getElementById("auth-error");
            const submit = document.getElementById("auth-submit");
            const username = document.getElementById("auth-username").value.trim();
            const password = document.getElementById("auth-password").value;
            errorBox.textContent = "";

            if (!username || !password) {
                errorBox.textContent = "请填写用户名和密码。";
                return;
            }
            if (state.authMode === "register") {
                const confirm = document.getElementById("auth-confirm").value;
                if (password.length < 6) {
                    errorBox.textContent = "密码长度至少为 6 位。";
                    return;
                }
                if (password !== confirm) {
                    errorBox.textContent = "两次输入的密码不一致。";
                    return;
                }
            }

            submit.disabled = true;
            submit.classList.add("is-loading");
            try {
                const path = state.authMode === "register" ? "/auth/register" : "/auth/login";
                const result = await api.post(path, { username, password });
                api.setToken(result.token);
                state.user = result.user;
                state.subjects = null;
                toast(state.authMode === "register" ? "注册成功，欢迎加入" : "登录成功");
                go("#/dashboard");
            } catch (error) {
                errorBox.textContent = error.message;
            } finally {
                submit.disabled = false;
                submit.classList.remove("is-loading");
            }
        });
    }

    // --------------------------------------------------------------- shell

    const ROUTE_META = {
        dashboard: { title: "学习概览", subtitle: "掌握学习进度与薄弱环节" },
        exams: { title: "开始考试", subtitle: "选择科目，随机抽题开始练习" },
        exam: { title: "正在考试", subtitle: "认真审题，逐题作答" },
        result: { title: "考试结果", subtitle: "查看成绩与逐题解析" },
        wrong: { title: "错题本", subtitle: "回顾错题，巩固薄弱知识点" },
        history: { title: "考试记录", subtitle: "查看历次考试成绩与答题详情" },
        "admin-subjects": { title: "科目管理", subtitle: "维护考试科目与题目分类" },
        "admin-questions": { title: "题库管理", subtitle: "增删改查各科目考试题目" },
        "admin-users": { title: "用户管理", subtitle: "管理平台用户、角色与状态" },
        "admin-settings": { title: "网站设置", subtitle: "配置网站系统名称与详细介绍" },
    };

    function navLink(routeName, label, iconName, active) {
        return `<a class="nav-link ${active ? "active" : ""}" href="#/${routeName}">${icon(iconName, 18)}<span>${label}</span></a>`;
    }

    function renderShell(route) {
        const meta = ROUTE_META[route.name] || { title: siteName(), subtitle: "" };
        const isAdmin = state.user && state.user.role === "admin";
        const active = route.name;
        const userName = displayName(state.user);
        document.title = `${meta.title} · ${siteName()}`;

        appEl.innerHTML = `
        <div class="app-shell">
            <aside class="sidebar">
                <div class="sidebar-brand">
                    <span class="logo-tile" title="${esc(siteName())}">${esc(siteMark())}</span>
                    <div class="brand-copy"><strong title="${esc(siteName())}">${esc(siteName())}</strong><span>Exam System</span></div>
                </div>
                <div class="nav-scroll">
                    <div class="nav-group">
                        <div class="nav-label">学习中心</div>
                        ${navLink("dashboard", "学习概览", "dashboard", active === "dashboard")}
                        ${navLink("exams", "开始考试", "play", active === "exams" || active === "exam")}
                        ${navLink("wrong", "错题本", "bookOpen", active === "wrong")}
                        ${navLink("history", "考试记录", "history", active === "history" || active === "result")}
                    </div>
                    ${
                        isAdmin
                            ? `<div class="nav-group">
                                <div class="nav-label">管理后台</div>
                                ${navLink("admin/subjects", "科目管理", "layers", active === "admin-subjects")}
                                ${navLink("admin/questions", "题库管理", "listChecks", active === "admin-questions")}
                                ${navLink("admin/users", "用户管理", "users", active === "admin-users")}
                                ${navLink("admin/settings", "网站设置", "settings", active === "admin-settings")}
                            </div>`
                            : ""
                    }
                </div>
                <div class="sidebar-user">
                    <div class="user-menu">
                        <button class="user-line user-menu-trigger" type="button" data-user-menu-toggle aria-haspopup="menu" aria-expanded="false" title="个人设置">
                            <span class="avatar" data-user-avatar>${esc(initials(userName))}</span>
                            <div class="user-meta">
                                <strong data-user-name>${esc(userName)}</strong>
                                <span>${isAdmin ? "系统管理员" : "普通学员"}</span>
                            </div>
                            ${icon("chevronRight", 15)}
                        </button>
                        <div class="user-dropdown" role="menu">
                            <button class="dropdown-item" type="button" role="menuitem" data-open-settings>${icon("user", 16)}<span>个人设置</span></button>
                            <button class="dropdown-item" type="button" role="menuitem" data-logout>${icon("logout", 16)}<span>退出登录</span></button>
                        </div>
                    </div>
                </div>
            </aside>
            <button class="sidebar-overlay" type="button" data-sidebar-close aria-label="关闭菜单"></button>
            <div class="main-shell">
                <header class="topbar">
                    <button class="icon-button menu-button" type="button" data-sidebar-toggle aria-label="打开菜单">${icon("menu", 20)}</button>
                    <div class="topbar-title">
                        <h1>${esc(meta.title)}</h1>
                        <p>${esc(meta.subtitle)}</p>
                    </div>
                    <div class="topbar-right">
                        <span class="role-chip">${isAdmin ? "管理员" : "学员"}</span>
                        <div class="user-menu topbar-user-menu">
                            <button class="topbar-user user-menu-trigger" type="button" data-user-menu-toggle aria-haspopup="menu" aria-expanded="false" title="个人设置">
                                <span class="avatar sm" data-user-avatar>${esc(initials(userName))}</span>
                                <span data-user-name>${esc(userName)}</span>
                            </button>
                            <div class="user-dropdown align-right" role="menu">
                                <button class="dropdown-item" type="button" role="menuitem" data-open-settings>${icon("user", 16)}<span>个人设置</span></button>
                                <button class="dropdown-item" type="button" role="menuitem" data-logout>${icon("logout", 16)}<span>退出登录</span></button>
                            </div>
                        </div>
                    </div>
                </header>
                <main class="page-content" id="page-content">${loadingPage()}</main>
            </div>
        </div>`;
    }

    // ------------------------------------------------------------- dashboard

    function statCard(label, value, unit, note, iconName, tone, noteClass) {
        return `
        <div class="stat-card">
            <div class="stat-icon ${tone || ""}">${icon(iconName, 20)}</div>
            <div class="stat-body">
                <div class="stat-label">${esc(label)}</div>
                <div class="stat-value">${esc(value)}${unit ? `<small>${esc(unit)}</small>` : ""}</div>
                <div class="stat-note ${noteClass || ""}">${esc(note || "")}</div>
            </div>
        </div>`;
    }

    function subjectCardHtml(subject, index, options) {
        const config = options || {};
        const tones = [
            { accent: "#3d5ce4", soft: "#eef2ff" },
            { accent: "#0e9f78", soft: "#e8f8f2" },
            { accent: "#e79122", soft: "#fff5e3" },
            { accent: "#7a5ce5", soft: "#f1edff" },
        ];
        const tone = tones[index % tones.length];
        const typeCounts = subject.type_counts;
        const chips = typeCounts
            ? `
                <span class="chip blue">单选 ${typeCounts.single}</span>
                <span class="chip orange">多选 ${typeCounts.multiple}</span>
                <span class="chip" style="color:#6d4ed8;background:#f1edff;border-color:#e5ddff">判断 ${typeCounts.judge}</span>`
            : `<span class="chip">共 ${subject.question_count || 0} 道题</span>`;
        const disabled = !subject.question_count;
        const extraChip =
            config.showWrongRate && subject.answered
                ? `<span class="chip">错题率 ${formatNumber(subject.wrong_rate)}%</span>`
                : "";
        return `
        <article class="subject-card" style="--card-accent:${tone.accent};--card-soft:${tone.soft}">
            <div class="subject-card-top">
                <div>
                    <h3>${esc(subject.name)}</h3>
                    <p class="subject-desc">${esc(subject.description || "暂无科目说明")}</p>
                </div>
                <span class="subject-icon">${icon("bookOpen", 19)}</span>
            </div>
            <div class="chip-row">${chips}${extraChip}</div>
            <div class="subject-foot">
                <span class="count"><strong>${subject.question_count || 0}</strong> 道可用题目</span>
                <button class="btn btn-primary btn-sm" type="button" data-quick-start="${subject.id}" ${disabled ? "disabled" : ""}>
                    ${disabled ? "暂无题目" : `开始考试 ${icon("arrowRight", 13)}`}
                </button>
            </div>
        </article>`;
    }

    async function renderDashboard(route, seq) {
        const data = await api.get("/stats/summary");
        if (seq !== state.renderSeq) return;
        const stats = data.stats;
        const subjects = data.subjects || [];
        state.quickSubjects = {};
        subjects.forEach((subject) => {
            state.quickSubjects[subject.id] = subject;
        });

        const recentHtml = data.recent_attempts.length
            ? `<div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>科目</th><th>状态</th><th>得分</th><th>答题情况</th><th>时间</th><th></th></tr></thead>
                    <tbody>
                        ${data.recent_attempts
                            .map(
                                (attempt) => `
                            <tr>
                                <td class="cell-main">${esc(attempt.subject_name)}</td>
                                <td>${attempt.status === "submitted" ? `<span class="badge green">已完成</span>` : `<span class="badge orange">进行中</span>`}</td>
                                <td>${attempt.status === "submitted" ? `<strong>${formatNumber(attempt.score)}</strong> 分` : "—"}</td>
                                <td>${attempt.correct_count}/${attempt.total_questions} 题</td>
                                <td class="cell-muted">${formatDate(attempt.submitted_at || attempt.started_at)}</td>
                                <td><a class="link" href="#/${attempt.status === "submitted" ? "result" : "exam"}/${attempt.id}">${attempt.status === "submitted" ? "查看解析" : "继续答题"} ${icon("chevronRight", 13)}</a></td>
                            </tr>`
                            )
                            .join("")}
                    </tbody>
                </table>
            </div>`
            : `<div class="table-empty">还没有考试记录，选择科目开始第一次练习吧。</div>`;

        setPage(`
            <section class="hero-card">
                <div class="hero-inner">
                    <div>
                        <div class="hero-eyebrow">${esc(greeting())}，<span data-user-name>${esc(displayName(state.user))}</span></div>
                        <h2>保持节奏，<span>稳步提升</span></h2>
                        <p>从一次随机练习开始，系统会自动记录成绩、错题与薄弱知识点，让每一次复习更有方向。</p>
                        <div class="hero-actions">
                            <a class="btn btn-hero" href="#/exams">${icon("play", 15)}开始考试</a>
                            <a class="btn btn-hero-ghost" href="#/wrong">${icon("bookOpen", 15)}查看错题本</a>
                        </div>
                    </div>
                    <div class="hero-visual">
                        <span class="ring one"></span>
                        <span class="ring two"></span>
                        <div class="score-mini"><strong>${formatNumber(stats.accuracy)}</strong><span>正确率</span></div>
                    </div>
                </div>
            </section>

            <div class="stat-grid">
                ${statCard("已完成考试", stats.total_exams, "场", `平均得分 ${formatNumber(stats.average_score)} 分`, "clip", "")}
                ${statCard("答题正确率", formatNumber(stats.accuracy), "%", `共作答 ${stats.total_answered} 道题`, "target", "green")}
                ${statCard("累计错题率", formatNumber(stats.wrong_rate), "%", `答错 ${stats.total_wrong} 次`, "chart", "orange")}
                ${statCard("错题本", stats.wrong_question_count, "道", `最高得分 ${formatNumber(stats.best_score)} 分`, "bookOpen", "red")}
            </div>

            <div class="section-head">
                <div><h2>科目练习</h2><p>选择科目，从题库中随机抽取题目开始考试</p></div>
                <a class="link" href="#/exams">全部科目 ${icon("arrowRight", 13)}</a>
            </div>
            ${
                subjects.length
                    ? `<div class="subject-grid">${subjects
                          .slice(0, 6)
                          .map((subject, index) =>
                              subjectCardHtml(subject, index, { showWrongRate: true })
                          )
                          .join("")}</div>`
                    : emptyState(
                          "暂无科目",
                          "管理员还没有创建考试科目，请稍后再来。",
                          "",
                          "layers"
                      )
            }

            <div class="section-head">
                <div><h2>最近考试</h2><p>继续未完成的考试，或回顾最近一次的答题情况</p></div>
                <a class="link" href="#/history">全部记录 ${icon("arrowRight", 13)}</a>
            </div>
            <div class="two-col">
                <div class="panel">${recentHtml}</div>
                <div class="panel">
                    <div class="panel-head"><div><h3>学习提示</h3><p>基于当前答题数据</p></div></div>
                    <div class="panel-pad">
                        <div class="info-list">
                            <div class="info-row">
                                <span class="info-icon">${icon("target", 16)}</span>
                                <div><strong>整体正确率</strong><span>已提交考试的累计表现</span></div>
                                <span class="value">${formatNumber(stats.accuracy)}%</span>
                            </div>
                            <div class="info-row">
                                <span class="info-icon">${icon("bookOpen", 16)}</span>
                                <div><strong>待复习错题</strong><span>按题目去重统计</span></div>
                                <span class="value">${stats.wrong_question_count}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-icon">${icon("award", 16)}</span>
                                <div><strong>历史最高分</strong><span>单场考试最高得分</span></div>
                                <span class="value">${formatNumber(stats.best_score)}</span>
                            </div>
                        </div>
                        <a class="btn btn-secondary btn-block mt-16" href="#/wrong">${icon("refresh", 14)}去巩固错题</a>
                    </div>
                </div>
            </div>
        `);
    }

    async function renderExams(route, seq) {
        const subjects = await fetchSubjects();
        if (seq !== state.renderSeq) return;
        state.quickSubjects = {};
        subjects.forEach((subject) => {
            state.quickSubjects[subject.id] = subject;
        });

        setPage(`
            <div class="page-intro">
                <div>
                    <h2>选择考试科目</h2>
                    <p>每个科目支持单选、多选与是非题。系统会从对应科目中随机抽题，提交后立即判分并提供逐题解析。</p>
                </div>
            </div>
            <div class="notice-strip">${icon("info", 16)}考试题目随机抽取，提交前请确认所有答案。退出后可在考试记录中继续未完成的考试。</div>
            ${
                subjects.length
                    ? `<div class="subject-grid">${subjects
                          .map((subject, index) => subjectCardHtml(subject, index))
                          .join("")}</div>`
                    : emptyState(
                          "暂无可参加的考试",
                          "管理员尚未创建科目或录入题目，请稍后再试。",
                          "",
                          "layers"
                      )
            }
        `);
    }

    async function fetchSubjects(force) {
        if (state.subjects && !force) return state.subjects;
        if (state.subjectsPromise) return state.subjectsPromise;
        state.subjectsPromise = api
            .get("/subjects")
            .then((data) => {
                state.subjects = data.items || [];
                return state.subjects;
            })
            .finally(() => {
                state.subjectsPromise = null;
            });
        return state.subjectsPromise;
    }

    function openStartExam(subject) {
        if (!subject) return;
        const max = Number(subject.question_count) || 0;
        if (max <= 0) {
            toast("该科目暂无可用于考试的题目", "error");
            return;
        }
        const defaultCount = Math.min(10, max);
        const quickValues = Array.from(
            new Set([5, 10, 20, max].filter((value) => value > 0 && value <= max))
        ).slice(0, 4);
        const typeCounts = subject.type_counts;

        openModal({
            title: "开始考试",
            subtitle: "系统将从题库中随机抽取题目",
            body: `
                <div class="exam-start-summary">
                    <span class="subject-icon">${icon("bookOpen", 19)}</span>
                    <div>
                        <h4>${esc(subject.name)}</h4>
                        <p>${esc(subject.description || "暂无科目说明")}</p>
                    </div>
                </div>
                ${
                    typeCounts
                        ? `<div class="chip-row" style="margin-top:-6px;margin-bottom:18px">
                            <span class="chip blue">单选题 ${typeCounts.single} 道</span>
                            <span class="chip orange">多选题 ${typeCounts.multiple} 道</span>
                            <span class="chip" style="color:#6d4ed8;background:#f1edff;border-color:#e5ddff">是非题 ${typeCounts.judge} 道</span>
                        </div>`
                        : ""
                }
                <div class="form-field">
                    <label for="exam-count">本次抽题数量 <span class="field-hint">最多 ${max} 题</span></label>
                    <input class="input" id="exam-count" type="number" min="1" max="${max}" value="${defaultCount}">
                    <div class="count-options">
                        ${quickValues
                            .map(
                                (value) =>
                                    `<button class="count-chip ${value === defaultCount ? "active" : ""}" type="button" data-count="${value}">${value} 题</button>`
                            )
                            .join("")}
                        <button class="count-chip" type="button" data-count="${max}">全部 ${max} 题</button>
                    </div>
                </div>`,
            footer: `
                <button class="btn btn-secondary" data-modal-close>取消</button>
                <button class="btn btn-primary" id="start-exam-btn">${icon("play", 14)}开始答题</button>`,
        });

        const input = document.getElementById("exam-count");
        document.querySelectorAll("[data-count]").forEach((chip) => {
            chip.addEventListener("click", () => {
                input.value = chip.dataset.count;
                document
                    .querySelectorAll("[data-count]")
                    .forEach((item) => item.classList.remove("active"));
                chip.classList.add("active");
            });
        });
        input.addEventListener("input", () => {
            document
                .querySelectorAll("[data-count]")
                .forEach((item) =>
                    item.classList.toggle(
                        "active",
                        Number(item.dataset.count) === Number(input.value)
                    )
                );
        });

        const button = document.getElementById("start-exam-btn");
        const start = async () => {
            const count = Number(input.value);
            if (!Number.isInteger(count) || count < 1 || count > max) {
                toast(`请输入 1-${max} 之间的题目数量`, "error");
                input.focus();
                return;
            }
            button.disabled = true;
            button.classList.add("is-loading");
            try {
                const result = await api.post("/exams/start", {
                    subject_id: subject.id,
                    question_count: count,
                });
                closeModal();
                toast("考试已开始，祝你顺利");
                go(`#/exam/${result.attempt.id}`);
            } catch (error) {
                toast(error.message, "error");
                button.disabled = false;
                button.classList.remove("is-loading");
            }
        };
        button.addEventListener("click", start);
        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") start();
        });
    }

    // --------------------------------------------------------------- router

    function parseRoute() {
        const raw = window.location.hash.replace(/^#\/?/, "");
        const [pathPart, queryPart] = raw.split("?");
        const segments = pathPart.split("/").filter(Boolean);
        const name = segments[0] || "dashboard";
        const query = Object.fromEntries(new URLSearchParams(queryPart || ""));
        if ((name === "exam" || name === "result") && segments[1]) {
            return { name, id: Number(segments[1]), query };
        }
        if (name === "admin") {
            return { name: `admin-${segments[1] || "subjects"}`, query };
        }
        return { name, query };
    }

    async function renderRoute() {
        const seq = ++state.renderSeq;
        clearInterval(state.timerInterval);
        state.timerInterval = null;
        closeModal();

        if (!state.user) {
            renderAuth();
            return;
        }

        const route = parseRoute();
        state.currentRoute = route;

        if (route.name.startsWith("admin-") && state.user.role !== "admin") {
            go("#/dashboard");
            return;
        }

        renderShell(route);

        try {
            switch (route.name) {
                case "dashboard":
                    await renderDashboard(route, seq);
                    break;
                case "exams":
                    await renderExams(route, seq);
                    break;
                case "exam":
                    await renderExam(route, seq);
                    break;
                case "result":
                    await renderResult(route, seq);
                    break;
                case "wrong":
                    await renderWrong(route, seq);
                    break;
                case "history":
                    await renderHistory(route, seq);
                    break;
                case "admin-subjects":
                    await renderAdminSubjects(route, seq);
                    break;
                case "admin-questions":
                    await renderAdminQuestions(route, seq);
                    break;
                case "admin-users":
                    await renderAdminUsers(route, seq);
                    break;
                case "admin-settings":
                    await renderAdminSettings(route, seq);
                    break;
                default:
                    if (seq !== state.renderSeq) return;
                    setPage(
                        emptyState(
                            "页面不存在",
                            "你访问的页面可能已被移除，请返回学习概览。",
                            `<a class="btn btn-primary" href="#/dashboard">返回首页</a>`,
                            "alert"
                        )
                    );
            }
        } catch (error) {
            if (seq !== state.renderSeq) return;
            if (error.status === 401) {
                if (state.user) {
                    state.user = null;
                    renderAuth();
                }
                return;
            }
            setPage(errorPage(error));
            console.error(error);
        }
    }

    // ---------------------------------------------------------------- events

    function closeUserMenus() {
        document.querySelectorAll(".user-menu.open").forEach((menu) => {
            menu.classList.remove("open");
            const trigger = menu.querySelector("[data-user-menu-toggle]");
            if (trigger) trigger.setAttribute("aria-expanded", "false");
        });
    }

    function refreshUserChrome() {
        if (!state.user) return;
        const name = displayName(state.user);
        document.querySelectorAll("[data-user-name]").forEach((el) => {
            el.textContent = name;
        });
        document.querySelectorAll("[data-user-avatar]").forEach((el) => {
            el.textContent = initials(name);
        });
    }

    function openProfileModal() {
        const user = state.user;
        const name = displayName(user);
        openModal({
            title: "个人设置",
            subtitle: "修改昵称或登录密码",
            body: `
                <form class="modal-form" id="profile-form" novalidate>
                    <div class="profile-summary">
                        <span class="avatar">${esc(initials(name))}</span>
                        <div>
                            <strong>${esc(name)}</strong>
                            <span>登录账号：${esc(user.username)}</span>
                        </div>
                    </div>
                    <div class="form-field">
                        <label for="profile-nickname">昵称 <span class="field-hint">最多 32 个字符，留空显示用户名</span></label>
                        <input class="input" id="profile-nickname" name="nickname" maxlength="32" value="${esc(user.nickname || "")}" placeholder="${esc(user.username)}">
                    </div>
                    <div class="form-divider"><span>修改密码</span></div>
                    <p class="field-hint">如不需要修改密码，以下三项请留空。</p>
                    <div class="form-field">
                        <label for="profile-current-password">当前密码</label>
                        <input class="input" id="profile-current-password" name="current_password" type="password" autocomplete="current-password" maxlength="64" placeholder="请输入当前密码">
                    </div>
                    <div class="form-field">
                        <label for="profile-new-password">新密码</label>
                        <input class="input" id="profile-new-password" name="new_password" type="password" autocomplete="new-password" maxlength="64" placeholder="6-64 位新密码">
                    </div>
                    <div class="form-field">
                        <label for="profile-confirm-password">确认新密码</label>
                        <input class="input" id="profile-confirm-password" name="confirm_password" type="password" autocomplete="new-password" maxlength="64" placeholder="请再次输入新密码">
                    </div>
                    <div class="form-message" id="profile-form-error"></div>
                </form>`,
            footer: `
                <button class="btn btn-secondary" data-modal-close>取消</button>
                <button class="btn btn-primary" type="submit" form="profile-form" id="save-profile-btn">保存修改</button>`,
        });

        const form = document.getElementById("profile-form");
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const errorBox = document.getElementById("profile-form-error");
            const button = document.getElementById("save-profile-btn");
            const nickname = document
                .getElementById("profile-nickname")
                .value.trim();
            const currentPassword = document.getElementById(
                "profile-current-password"
            ).value;
            const newPassword =
                document.getElementById("profile-new-password").value;
            const confirmPassword = document.getElementById(
                "profile-confirm-password"
            ).value;
            errorBox.textContent = "";

            if (nickname.length > 32) {
                errorBox.textContent = "昵称不能超过 32 个字符。";
                return;
            }

            const changingPassword = Boolean(
                currentPassword || newPassword || confirmPassword
            );
            if (changingPassword) {
                if (!currentPassword) {
                    errorBox.textContent = "请输入当前密码。";
                    return;
                }
                if (!newPassword) {
                    errorBox.textContent = "请输入新密码。";
                    return;
                }
                if (newPassword.length < 6 || newPassword.length > 64) {
                    errorBox.textContent = "新密码长度需为 6-64 位。";
                    return;
                }
                if (newPassword !== confirmPassword) {
                    errorBox.textContent = "两次输入的新密码不一致。";
                    return;
                }
            }

            const payload = { nickname };
            if (changingPassword) {
                payload.current_password = currentPassword;
                payload.new_password = newPassword;
            }

            button.disabled = true;
            button.classList.add("is-loading");
            try {
                const result = await api.patch("/auth/profile", payload);
                state.user = result.user;
                closeModal();
                refreshUserChrome();
                toast("个人设置已更新");
            } catch (error) {
                errorBox.textContent = error.message;
                button.disabled = false;
                button.classList.remove("is-loading");
            }
        });
    }

    function logout() {
        api.clearToken();
        state.user = null;
        state.subjects = null;
        state.subjectsPromise = null;
        state.quickSubjects = {};
        clearInterval(state.timerInterval);
        state.timerInterval = null;
        closeModal();
        toast("已退出登录", "info");
        window.location.hash = "#/dashboard";
        renderAuth();
    }

    document.addEventListener("click", (event) => {
        const closeTrigger = event.target.closest("[data-modal-close]");
        if (closeTrigger) {
            closeModal();
            return;
        }
        if (event.target.closest("[data-sidebar-toggle]")) {
            const shell = document.querySelector(".app-shell");
            if (shell) shell.classList.add("sidebar-open");
            return;
        }
        if (event.target.closest("[data-sidebar-close]")) {
            const shell = document.querySelector(".app-shell");
            if (shell) shell.classList.remove("sidebar-open");
            return;
        }
        const menuToggle = event.target.closest("[data-user-menu-toggle]");
        if (menuToggle) {
            const menu = menuToggle.closest(".user-menu");
            const wasOpen = menu.classList.contains("open");
            closeUserMenus();
            if (!wasOpen) {
                menu.classList.add("open");
                menuToggle.setAttribute("aria-expanded", "true");
            }
            return;
        }
        if (event.target.closest("[data-open-settings]")) {
            closeUserMenus();
            openProfileModal();
            return;
        }
        if (!event.target.closest(".user-menu")) {
            closeUserMenus();
        }
        if (event.target.closest("[data-logout]")) {
            closeUserMenus();
            logout();
            return;
        }
        if (event.target.closest('[data-action="reload"]')) {
            renderRoute();
            return;
        }
        const quick = event.target.closest("[data-quick-start]");
        if (quick) {
            event.preventDefault();
            openStartExam(state.quickSubjects[quick.dataset.quickStart]);
            return;
        }
        const navLinkEl = event.target.closest(".nav-link");
        if (navLinkEl) {
            const shell = document.querySelector(".app-shell");
            if (shell) shell.classList.remove("sidebar-open");
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            if (modalRoot.children.length) {
                closeModal();
                return;
            }
            if (document.querySelector(".user-menu.open")) {
                closeUserMenus();
                return;
            }
            const shell = document.querySelector(".app-shell");
            if (shell) shell.classList.remove("sidebar-open");
        }
    });

    window.addEventListener("hashchange", renderRoute);
    window.addEventListener("exam-auth-expired", () => {
        if (state.user) {
            state.user = null;
            state.subjects = null;
            toast("登录状态已失效，请重新登录", "error");
            renderAuth();
        }
    });

    // ----------------------------------------------------------- exam runner

    function savedAnswersFor(attemptId, questions) {
        let saved = null;
        try {
            saved = JSON.parse(
                localStorage.getItem(`exam_answers_${attemptId}`) || "null"
            );
        } catch (error) {
            saved = null;
        }
        const answers = {};
        questions.forEach((question) => {
            const fromSaved =
                saved && Array.isArray(saved[question.id]) ? saved[question.id] : null;
            const initial = fromSaved || question.selected || [];
            answers[question.id] = Array.isArray(initial)
                ? initial.filter((key) =>
                      (question.options || []).some((option) => option.key === key)
                  )
                : [];
        });
        return answers;
    }

    function questionCardHtml(question, index, answers) {
        const selected = answers[question.id] || [];
        const inputType = question.type === "multiple" ? "checkbox" : "radio";
        const hint =
            question.type === "multiple"
                ? "多选题：少选、多选或错选均不得分"
                : question.type === "judge"
                ? "是非题：请选择正确或错误"
                : "单选题：请选择一个最符合题意的选项";
        return `
        <article class="question-card" id="question-${question.id}">
            <div class="question-meta">
                <span class="question-index">第 ${index + 1} 题</span>
                ${typeBadge(question.type)}
                ${question.type === "multiple" ? '<span class="badge gray">可多选</span>' : ""}
            </div>
            <h3 class="question-title">${esc(question.content)}</h3>
            <p class="question-hint">${icon("info", 13)}${hint}</p>
            <div class="option-list">
                ${(question.options || [])
                    .map(
                        (option) => `
                    <label class="option-item">
                        <input type="${inputType}" name="question_${question.id}" value="${esc(option.key)}" data-qid="${question.id}" data-key="${esc(option.key)}" ${selected.includes(option.key) ? "checked" : ""}>
                        <span class="option-key">${esc(optionKeyLabel(question, option.key))}</span>
                        <span class="option-text">${esc(option.text)}</span>
                        <span class="option-mark"></span>
                    </label>`
                    )
                    .join("")}
            </div>
        </article>`;
    }

    function examPageHtml(attempt, questions, answers, subjectName) {
        const answered = questions.filter(
            (question) => (answers[question.id] || []).length > 0
        ).length;
        const progress = questions.length
            ? Math.round((answered / questions.length) * 100)
            : 0;
        return `
        <div class="exam-layout">
            <div>
                <div class="exam-header">
                    <div class="exam-name">
                        <h2>${esc(subjectName)}</h2>
                        <p>共 ${questions.length} 道题 · 已答 <span data-answered>${answered}</span> 题</p>
                    </div>
                    <div class="exam-timer">${icon("clock", 15)}<span id="exam-timer">${clockText(attempt.started_at)}</span></div>
                    <div class="exam-progress">
                        <div class="progress-meta"><span>答题进度</span><span data-progress-text>${progress}%</span></div>
                        <div class="progress-track"><div class="progress-fill" data-progress-fill style="width:${progress}%"></div></div>
                    </div>
                </div>
                <div class="questions-stack">
                    ${questions
                        .map((question, index) => questionCardHtml(question, index, answers))
                        .join("")}
                </div>
                <div class="exam-mobile-actions">
                    <button class="btn btn-primary btn-lg btn-block" type="button" data-submit-exam>交卷并查看结果</button>
                </div>
            </div>
            <aside class="exam-side">
                <div class="palette-card">
                    <div class="palette-head"><h3>答题卡</h3><span><span data-answered>${answered}</span> / ${questions.length}</span></div>
                    <div class="palette-grid">
                        ${questions
                            .map(
                                (question, index) => `
                            <button class="palette-btn ${(answers[question.id] || []).length ? "answered" : ""}" type="button" data-scroll-q="${question.id}" title="第 ${index + 1} 题">${index + 1}</button>`
                            )
                            .join("")}
                    </div>
                    <div class="palette-legend">
                        <span><i class="legend-box"></i>未作答</span>
                        <span><i class="legend-box done"></i>已作答</span>
                    </div>
                </div>
                <div class="submit-card">
                    <p>提交后将立即判分并生成逐题解析，请确认所有答案。</p>
                    <button class="btn btn-primary btn-block" type="button" data-submit-exam>${icon("checkCircle", 15)}提交试卷</button>
                    <a class="btn btn-ghost btn-block" href="#/history" style="margin-top:6px">暂存并退出</a>
                </div>
            </aside>
        </div>`;
    }

    async function renderExam(route, seq) {
        if (!route.id) {
            go("#/exams");
            return;
        }
        const data = await api.get(`/exams/${route.id}`);
        if (seq !== state.renderSeq) return;
        if (data.attempt.status === "submitted") {
            go(`#/result/${route.id}`);
            return;
        }
        const answers = savedAnswersFor(route.id, data.questions);
        state.exam = {
            attempt: data.attempt,
            questions: data.questions,
            answers,
        };
        setPage(
            examPageHtml(
                data.attempt,
                data.questions,
                answers,
                data.attempt.subject_name
            )
        );
        bindExamRunner(route.id, data.questions, answers, data.attempt.started_at);
    }

    function bindExamRunner(attemptId, questions, answers, startedAt) {
        const updateOverview = () => {
            const answered = questions.filter(
                (question) => (answers[question.id] || []).length > 0
            ).length;
            document.querySelectorAll("[data-answered]").forEach((el) => {
                el.textContent = answered;
            });
            const percent = questions.length
                ? Math.round((answered / questions.length) * 100)
                : 0;
            const fill = document.querySelector("[data-progress-fill]");
            if (fill) fill.style.width = `${percent}%`;
            const text = document.querySelector("[data-progress-text]");
            if (text) text.textContent = `${percent}%`;
            document.querySelectorAll("[data-scroll-q]").forEach((button) => {
                button.classList.toggle(
                    "answered",
                    (answers[Number(button.dataset.scrollQ)] || []).length > 0
                );
            });
        };

        let saveTimer = null;
        const persist = () => {
            localStorage.setItem(
                `exam_answers_${attemptId}`,
                JSON.stringify(answers)
            );
            window.clearTimeout(saveTimer);
            saveTimer = window.setTimeout(async () => {
                try {
                    await api.patch(`/exams/${attemptId}/progress`, {
                        answers,
                    });
                } catch (error) {
                    // Progress saving is best-effort; submission still validates all answers.
                }
            }, 450);
        };

        document.querySelectorAll(".option-item input[data-qid]").forEach((input) => {
            input.addEventListener("change", () => {
                const questionId = Number(input.dataset.qid);
                const question = questions.find((item) => item.id === questionId);
                const key = input.dataset.key;
                if (!question) return;
                if (input.type === "radio") {
                    answers[questionId] = [key];
                } else {
                    const current = new Set(answers[questionId] || []);
                    if (input.checked) current.add(key);
                    else current.delete(key);
                    const order = (question.options || []).map((option) => option.key);
                    answers[questionId] = Array.from(current).sort(
                        (a, b) => order.indexOf(a) - order.indexOf(b)
                    );
                }
                persist();
                updateOverview();
            });
        });

        document.querySelectorAll("[data-scroll-q]").forEach((button) => {
            button.addEventListener("click", () => {
                const target = document.getElementById(
                    `question-${button.dataset.scrollQ}`
                );
                if (!target) return;
                target.scrollIntoView({ behavior: "smooth", block: "start" });
                document
                    .querySelectorAll("[data-scroll-q]")
                    .forEach((item) => item.classList.remove("current"));
                button.classList.add("current");
            });
        });

        const timer = document.getElementById("exam-timer");
        const tick = () => {
            if (timer) timer.textContent = clockText(startedAt);
        };
        tick();
        state.timerInterval = window.setInterval(tick, 1000);

        const askSubmit = () => {
            const unanswered = questions.filter(
                (question) => !(answers[question.id] || []).length
            ).length;
            const message =
                unanswered > 0
                    ? `还有 <strong>${unanswered}</strong> 道题未作答。提交后将立即判分，未作答题目按错误计算，确定要交卷吗？`
                    : "所有题目均已作答。提交后将立即判分并生成逐题解析，确定要交卷吗？";
            confirmDialog({
                title: "确认提交试卷",
                message,
                confirmText: "确认交卷",
                onConfirm: async () => {
                    try {
                        const payload = {};
                        questions.forEach((question) => {
                            payload[question.id] = answers[question.id] || [];
                        });
                        await api.post(`/exams/${attemptId}/submit`, {
                            answers: payload,
                        });
                        localStorage.removeItem(`exam_answers_${attemptId}`);
                        closeModal();
                        toast("交卷成功，正在生成成绩");
                        go(`#/result/${attemptId}`);
                    } catch (error) {
                        toast(error.message, "error");
                    }
                },
            });
        };

        document.querySelectorAll("[data-submit-exam]").forEach((button) => {
            button.addEventListener("click", askSubmit);
        });
    }

    // ---------------------------------------------------------------- result

    function reviewOptionsHtml(question, selected) {
        return `<div class="review-options">
            ${(question.options || [])
                .map((option) => {
                    const isCorrect = (question.answer || []).includes(option.key);
                    const isSelected = (selected || []).includes(option.key);
                    const className = isCorrect
                        ? "correct-answer"
                        : isSelected
                        ? "user-wrong"
                        : "";
                    const tags = [];
                    if (isCorrect) tags.push('<span class="review-tag correct">正确答案</span>');
                    if (isSelected)
                        tags.push(
                            `<span class="review-tag ${isCorrect ? "neutral" : "wrong"}">你的选择</span>`
                        );
                    return `
                    <div class="review-option ${className}">
                        <span class="key">${esc(optionKeyLabel(question, option.key))}</span>
                        <span class="review-option-text">${esc(option.text)}</span>
                        ${tags.join("")}
                    </div>`;
                })
                .join("")}
        </div>`;
    }

    function reviewCardHtml(question, index) {
        const selected = question.selected || [];
        const isCorrect = question.is_correct;
        const isUnanswered = !selected.length;
        const statusClass = isCorrect ? "correct" : isUnanswered ? "unanswered" : "wrong";
        const statusLabel = isCorrect ? "回答正确" : isUnanswered ? "未作答" : "回答错误";
        const statusIcon = isCorrect ? "checkCircle" : "alert";
        return `
        <article class="review-card ${statusClass}">
            <div class="review-head">
                <span class="question-index">第 ${index + 1} 题</span>
                ${typeBadge(question.type)}
                <span class="spacer"></span>
                <span class="review-status ${statusClass}">${icon(statusIcon, 14)}${statusLabel}</span>
            </div>
            <h3 class="review-question">${esc(question.content)}</h3>
            ${reviewOptionsHtml(question, selected)}
            <div class="answer-summary">
                <div class="answer-box ${isCorrect ? "good" : isUnanswered ? "" : "bad"}">
                    <span>你的答案</span>
                    <strong>${esc(answerText(question, selected))}</strong>
                </div>
                <div class="answer-box good">
                    <span>正确答案</span>
                    <strong>${esc(answerText(question, question.answer))}</strong>
                </div>
            </div>
            ${
                question.explanation
                    ? `<div class="explanation"><strong>解析：</strong>${esc(question.explanation)}</div>`
                    : ""
            }
        </article>`;
    }

    async function renderResult(route, seq) {
        if (!route.id) {
            go("#/history");
            return;
        }
        const data = await api.get(`/exams/${route.id}`);
        if (seq !== state.renderSeq) return;
        if (data.attempt.status !== "submitted") {
            go(`#/exam/${route.id}`);
            return;
        }
        const attempt = data.attempt;
        const questions = data.questions;
        const answered = questions.filter((question) => question.selected.length).length;
        const unanswered = questions.length - answered;
        const wrongCount = questions.length - attempt.correct_count;
        const score = Number(attempt.score) || 0;
        const passed = score >= 60;
        const degree = Math.min(360, Math.max(0, score * 3.6));

        setPage(`
            <section class="result-hero ${passed ? "" : "low"}">
                <div class="score-ring" style="--score:${degree}deg">
                    <div class="score-ring-inner">
                        <strong>${formatNumber(score)}</strong>
                        <span>SCORE</span>
                    </div>
                </div>
                <div class="result-copy">
                    <div class="eyebrow">${passed ? "Exam Completed" : "Keep Improving"}</div>
                    <h2>${passed ? "考试完成，表现不错" : "考试完成，继续加油"}</h2>
                    <p>${esc(attempt.subject_name)} · ${formatDate(attempt.submitted_at, true)} · 用时 ${durationText(attempt.started_at, attempt.submitted_at)}</p>
                    <div class="result-metrics">
                        <div class="result-metric"><strong>${attempt.correct_count}/${questions.length}</strong><span>答对题数</span></div>
                        <div class="result-metric"><strong>${wrongCount}</strong><span>答错 / 未答</span></div>
                        <div class="result-metric"><strong>${formatNumber(answered ? (wrongCount / questions.length) * 100 : 0)}%</strong><span>本场错题率</span></div>
                        <div class="result-metric"><strong>${unanswered}</strong><span>未作答</span></div>
                    </div>
                </div>
                <div class="result-actions">
                    <a class="btn btn-hero" href="#/wrong">${icon("bookOpen", 15)}复习错题</a>
                    <a class="btn btn-hero-ghost" href="#/exams">${icon("refresh", 15)}再考一次</a>
                </div>
            </section>

            <div class="section-head">
                <div><h2>逐题解析</h2><p>对照正确答案与解析，复盘每一道题</p></div>
                <label class="check-row"><input type="checkbox" id="only-wrong-review">只看错题</label>
            </div>
            <div class="review-list" id="review-list">
                ${questions.map((question, index) => reviewCardHtml(question, index)).join("")}
            </div>
            <div class="page-toolbar mt-24">
                <a class="btn btn-secondary" href="#/history">${icon("chevronLeft", 14)}返回考试记录</a>
                <div class="grow"></div>
                <a class="btn btn-primary" href="#/exams">${icon("play", 14)}开始新的考试</a>
            </div>
        `);

        const checkbox = document.getElementById("only-wrong-review");
        checkbox.addEventListener("change", () => {
            document.querySelectorAll(".review-card").forEach((card) => {
                const hide =
                    checkbox.checked &&
                    !card.classList.contains("wrong") &&
                    !card.classList.contains("unanswered");
                card.classList.toggle("hidden", hide);
            });
        });
    }

    // ------------------------------------------------------------ wrong book

    function wrongCardHtml(question) {
        return `
        <article class="wrong-card">
            <div class="wrong-head">
                <span class="badge blue">${esc(question.subject_name)}</span>
                ${typeBadge(question.type)}
                <span class="spacer"></span>
                <span class="wrong-count">${icon("alert", 13)}答错 ${question.wrong_count} 次</span>
            </div>
            <h3 class="wrong-question">${esc(question.content)}</h3>
            ${reviewOptionsHtml(question, question.last_selected || [])}
            <div class="answer-summary">
                <div class="answer-box bad">
                    <span>最近一次错选</span>
                    <strong>${esc(answerText(question, question.last_selected || []))}</strong>
                </div>
                <div class="answer-box good">
                    <span>正确答案</span>
                    <strong>${esc(answerText(question, question.answer))}</strong>
                </div>
            </div>
            ${
                question.explanation
                    ? `<div class="explanation"><strong>解析：</strong>${esc(question.explanation)}</div>`
                    : ""
            }
            <div class="wrong-meta">
                <span>${icon("history", 12)}最近答错：${formatDate(question.last_wrong_at)}</span>
                <span>${icon("target", 12)}作答 ${question.attempted_count} 次 · 本题错题率 ${formatNumber(question.wrong_rate)}%</span>
            </div>
        </article>`;
    }

    async function renderWrong(route, seq) {
        const page = Math.max(1, Number(route.query.page) || 1);
        const filters = {
            subject_id: route.query.subject_id || "",
            type: route.query.type || "",
            search: route.query.search || "",
        };
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value) params.set(key, value);
        });
        params.set("page", String(page));
        params.set("page_size", "8");

        const [subjects, data] = await Promise.all([
            fetchSubjects(),
            api.get(`/wrong-questions?${params.toString()}`),
        ]);
        if (seq !== state.renderSeq) return;

        const baseParams = {};
        Object.entries(filters).forEach(([key, value]) => {
            if (value) baseParams[key] = value;
        });
        const pageLink = (targetPage) =>
            buildHash("/wrong", { ...baseParams, page: targetPage });

        setPage(`
            <div class="page-intro">
                <div>
                    <h2>错题本</h2>
                    <p>系统自动汇总你在考试中答错的题目，并记录错选答案、错误次数与题目错题率。针对性复习，避免重复失分。</p>
                </div>
            </div>
            <div class="panel">
                <form class="filter-bar" id="wrong-filter-form">
                    <div class="form-field">
                        <label>科目</label>
                        <select class="select" name="subject_id">
                            <option value="">全部科目</option>
                            ${subjects
                                .map(
                                    (subject) =>
                                        `<option value="${subject.id}" ${String(filters.subject_id) === String(subject.id) ? "selected" : ""}>${esc(subject.name)}</option>`
                                )
                                .join("")}
                        </select>
                    </div>
                    <div class="form-field">
                        <label>题型</label>
                        <select class="select" name="type">
                            <option value="">全部题型</option>
                            <option value="single" ${filters.type === "single" ? "selected" : ""}>单选题</option>
                            <option value="multiple" ${filters.type === "multiple" ? "selected" : ""}>多选题</option>
                            <option value="judge" ${filters.type === "judge" ? "selected" : ""}>是非题</option>
                        </select>
                    </div>
                    <div class="search-box">
                        <label class="hidden" for="wrong-search">搜索</label>
                        ${icon("search", 15)}
                        <input class="input" id="wrong-search" name="search" value="${esc(filters.search)}" placeholder="搜索题目内容">
                    </div>
                    <button class="btn btn-primary" type="submit">${icon("filter", 14)}筛选</button>
                    <button class="btn btn-ghost" type="button" id="reset-wrong-filter">重置</button>
                </form>
                ${
                    data.items.length
                        ? `<div class="wrong-stack" style="padding:18px">${data.items
                              .map(wrongCardHtml)
                              .join("")}</div>
                           <div class="pagination">
                               ${
                                   page > 1
                                       ? `<a class="btn btn-secondary btn-sm" href="${pageLink(page - 1)}">${icon("chevronLeft", 13)}上一页</a>`
                                       : ""
                               }
                               <span>第 ${page} / ${data.pages || 1} 页 · 共 ${data.total} 道错题</span>
                               ${
                                   page < data.pages
                                       ? `<a class="btn btn-secondary btn-sm" href="${pageLink(page + 1)}">下一页${icon("chevronRight", 13)}</a>`
                                       : ""
                               }
                           </div>`
                        : emptyState(
                              "暂无错题",
                              filters.search || filters.subject_id || filters.type
                                  ? "当前筛选条件下没有错题，试试调整筛选条件。"
                                  : "目前还没有答错的题目，继续保持！",
                              `<a class="btn btn-primary" href="#/exams">去参加考试</a>`,
                              "award"
                          )
                }
            </div>
        `);

        const form = document.getElementById("wrong-filter-form");
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const formData = new FormData(form);
            go(
                buildHash("/wrong", {
                    subject_id: formData.get("subject_id"),
                    type: formData.get("type"),
                    search: String(formData.get("search") || "").trim(),
                })
            );
        });
        document.getElementById("reset-wrong-filter").addEventListener("click", () => {
            go("#/wrong");
        });
    }

    // --------------------------------------------------------------- history

    async function renderHistory(route, seq) {
        const page = Math.max(1, Number(route.query.page) || 1);
        const data = await api.get(`/exams?page=${page}&page_size=10`);
        if (seq !== state.renderSeq) return;

        const rows = data.items
            .map((attempt) => {
                const isSubmitted = attempt.status === "submitted";
                return `
                <tr>
                    <td class="cell-main">${esc(attempt.subject_name)}</td>
                    <td>${isSubmitted ? '<span class="badge green">已完成</span>' : '<span class="badge orange">进行中</span>'}</td>
                    <td>${isSubmitted ? `<strong>${formatNumber(attempt.score)}</strong> 分` : "—"}</td>
                    <td>${attempt.answered_count}/${attempt.total_questions} 题</td>
                    <td class="cell-muted">${formatDate(attempt.started_at)}</td>
                    <td class="cell-muted">${isSubmitted ? durationText(attempt.started_at, attempt.submitted_at) : "—"}</td>
                    <td class="nowrap">
                        <a class="btn ${isSubmitted ? "btn-secondary" : "btn-primary"} btn-sm" href="#/${isSubmitted ? "result" : "exam"}/${attempt.id}">
                            ${isSubmitted ? "查看解析" : "继续答题"}
                        </a>
                    </td>
                </tr>`;
            })
            .join("");

        setPage(`
            <div class="page-intro">
                <div>
                    <h2>考试记录</h2>
                    <p>查看所有考试场次、成绩与用时。未完成的考试可以从这里继续作答。</p>
                </div>
                <a class="btn btn-primary" href="#/exams">${icon("play", 14)}开始新考试</a>
            </div>
            <div class="panel">
                ${
                    data.items.length
                        ? `<div class="table-wrap">
                            <table class="data-table">
                                <thead><tr><th>科目</th><th>状态</th><th>得分</th><th>答题进度</th><th>开始时间</th><th>用时</th><th></th></tr></thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                        <div class="pagination">
                            ${
                                page > 1
                                    ? `<a class="btn btn-secondary btn-sm" href="${buildHash("/history", { page: page - 1 })}">${icon("chevronLeft", 13)}上一页</a>`
                                    : ""
                            }
                            <span>第 ${page} / ${data.pages || 1} 页 · 共 ${data.total} 场考试</span>
                            ${
                                page < data.pages
                                    ? `<a class="btn btn-secondary btn-sm" href="${buildHash("/history", { page: page + 1 })}">下一页${icon("chevronRight", 13)}</a>`
                                    : ""
                            }
                        </div>`
                        : emptyState(
                              "还没有考试记录",
                              "参加一次考试后，这里会展示你的成绩与答题明细。",
                              `<a class="btn btn-primary" href="#/exams">${icon("play", 14)}开始考试</a>`,
                              "history"
                          )
                }
            </div>
        `);
    }

    // ------------------------------------------------------------ admin base

    function invalidateSubjects() {
        state.subjects = null;
        state.subjectsPromise = null;
    }

    function adminIntro(title, description, actionHtml) {
        return `
        <div class="admin-intro">
            <div><h2>${esc(title)}</h2><p>${esc(description)}</p></div>
            ${actionHtml || ""}
        </div>`;
    }

    function tableEmpty(text) {
        return `<div class="table-empty">${esc(text)}</div>`;
    }

    // --------------------------------------------------------- admin subjects

    async function renderAdminSubjects(route, seq) {
        const subjects = await fetchSubjects(true);
        if (seq !== state.renderSeq) return;
        state.adminSubjects = subjects;

        setPage(`
            ${adminIntro(
                "科目管理",
                "科目用于组织题库，可按需创建多个考试分类，例如科目一、科目二。",
                `<button class="btn btn-primary" id="add-subject-btn">${icon("plus", 15)}新增科目</button>`
            )}
            <div class="panel">
                ${
                    subjects.length
                        ? `<div class="table-wrap">
                            <table class="data-table">
                                <thead><tr><th>科目名称</th><th>题目数量</th><th>题型分布</th><th>排序</th><th>创建时间</th><th></th></tr></thead>
                                <tbody>
                                    ${subjects
                                        .map(
                                            (subject) => `
                                        <tr>
                                            <td>
                                                <div class="table-primary">
                                                    <span class="subject-dot"></span>
                                                    <div><div class="cell-main">${esc(subject.name)}</div><div class="cell-muted">${esc(subject.description || "暂无描述")}</div></div>
                                                </div>
                                            </td>
                                            <td><span class="badge blue">${subject.question_count} 道</span></td>
                                            <td>
                                                <div class="chip-row" style="margin-top:0">
                                                    <span class="chip blue">单选 ${subject.type_counts.single}</span>
                                                    <span class="chip orange">多选 ${subject.type_counts.multiple}</span>
                                                    <span class="chip">判断 ${subject.type_counts.judge}</span>
                                                </div>
                                            </td>
                                            <td>${subject.sort_order}</td>
                                            <td class="cell-muted">${formatDate(subject.created_at, false)}</td>
                                            <td>
                                                <div class="table-actions">
                                                    <button class="btn btn-secondary btn-sm" data-edit-subject="${subject.id}">${icon("edit", 13)}编辑</button>
                                                    <button class="btn btn-danger btn-sm" data-delete-subject="${subject.id}">${icon("trash", 13)}删除</button>
                                                </div>
                                            </td>
                                        </tr>`
                                        )
                                        .join("")}
                                </tbody>
                            </table>
                        </div>`
                        : tableEmpty("暂无科目，点击右上角新增科目。")
                }
            </div>
        `);

        document.getElementById("add-subject-btn").addEventListener("click", () => {
            openSubjectModal();
        });
        document.querySelectorAll("[data-edit-subject]").forEach((button) => {
            button.addEventListener("click", () => {
                const subject = state.adminSubjects.find(
                    (item) => item.id === Number(button.dataset.editSubject)
                );
                if (subject) openSubjectModal(subject);
            });
        });
        document.querySelectorAll("[data-delete-subject]").forEach((button) => {
            button.addEventListener("click", () => {
                const subject = state.adminSubjects.find(
                    (item) => item.id === Number(button.dataset.deleteSubject)
                );
                if (subject) deleteSubject(subject);
            });
        });
    }

    function openSubjectModal(subject) {
        const editing = Boolean(subject);
        openModal({
            title: editing ? "编辑科目" : "新增科目",
            subtitle: editing ? "修改科目信息后保存" : "创建新的考试科目分类",
            body: `
                <form class="modal-form" id="subject-form" novalidate>
                    <div class="form-field">
                        <label for="subject-name">科目名称</label>
                        <input class="input" id="subject-name" name="name" maxlength="50" placeholder="例如：科目一" value="${esc(subject ? subject.name : "")}" required>
                    </div>
                    <div class="form-field">
                        <label for="subject-description">科目描述 <span class="field-hint">可选</span></label>
                        <textarea class="textarea" id="subject-description" name="description" maxlength="500" rows="3" placeholder="简要说明该科目的考试范围">${esc(subject ? subject.description : "")}</textarea>
                    </div>
                    <div class="form-field" style="max-width:180px">
                        <label for="subject-sort">排序值</label>
                        <input class="input" id="subject-sort" name="sort_order" type="number" min="0" max="9999" value="${subject ? subject.sort_order : 0}">
                        <span class="field-hint">数字越小越靠前</span>
                    </div>
                    <div class="form-message" id="subject-form-error"></div>
                </form>`,
            footer: `
                <button class="btn btn-secondary" data-modal-close>取消</button>
                <button class="btn btn-primary" type="submit" form="subject-form" id="save-subject-btn">${editing ? "保存修改" : "创建科目"}</button>`,
        });

        const form = document.getElementById("subject-form");
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const errorBox = document.getElementById("subject-form-error");
            const button = document.getElementById("save-subject-btn");
            errorBox.textContent = "";
            const name = document.getElementById("subject-name").value.trim();
            const description = document
                .getElementById("subject-description")
                .value.trim();
            const sortOrder = Number(document.getElementById("subject-sort").value || 0);
            if (!name) {
                errorBox.textContent = "请填写科目名称。";
                return;
            }

            button.disabled = true;
            button.classList.add("is-loading");
            try {
                const payload = { name, description, sort_order: sortOrder };
                if (editing) {
                    await api.patch(`/admin/subjects/${subject.id}`, payload);
                } else {
                    await api.post("/admin/subjects", payload);
                }
                closeModal();
                invalidateSubjects();
                toast(editing ? "科目已更新" : "科目已创建");
                renderRoute();
            } catch (error) {
                errorBox.textContent = error.message;
                button.disabled = false;
                button.classList.remove("is-loading");
            }
        });
    }

    function deleteSubject(subject) {
        confirmDialog({
            title: "删除科目",
            message: `确定删除科目 <strong>${esc(subject.name)}</strong> 吗？该科目下的题目将不再显示，已有考试记录仍然保留。`,
            danger: true,
            confirmText: "删除科目",
            onConfirm: async () => {
                try {
                    await api.delete(`/admin/subjects/${subject.id}`);
                    closeModal();
                    invalidateSubjects();
                    toast("科目已删除");
                    renderRoute();
                } catch (error) {
                    toast(error.message, "error");
                }
            },
        });
    }

    // -------------------------------------------------------- admin questions

    function questionFilterParams(filters) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value) params.set(key, value);
        });
        return params;
    }

    async function renderAdminQuestions(route, seq) {
        const page = Math.max(1, Number(route.query.page) || 1);
        const filters = {
            subject_id: route.query.subject_id || "",
            type: route.query.type || "",
            search: route.query.search || "",
        };
        const params = questionFilterParams(filters);
        params.set("page", String(page));
        params.set("page_size", "15");

        const [subjects, data] = await Promise.all([
            fetchSubjects(),
            api.get(`/admin/questions?${params.toString()}`),
        ]);
        if (seq !== state.renderSeq) return;
        state.adminSubjects = subjects;
        state.adminQuestions = data.items;

        const baseFilters = {};
        Object.entries(filters).forEach(([key, value]) => {
            if (value) baseFilters[key] = value;
        });
        const pageLink = (targetPage) =>
            buildHash("/admin/questions", { ...baseFilters, page: targetPage });

        setPage(`
            ${adminIntro(
                "题库管理",
                "维护各科目下的单选题、多选题与是非题，支持按科目、题型和关键词筛选。",
                `<button class="btn btn-primary" id="add-question-btn">${icon("plus", 15)}新增题目</button>`
            )}
            <div class="panel">
                <form class="filter-bar" id="question-filter-form">
                    <div class="form-field">
                        <label>科目</label>
                        <select class="select" name="subject_id">
                            <option value="">全部科目</option>
                            ${subjects
                                .map(
                                    (subject) =>
                                        `<option value="${subject.id}" ${String(filters.subject_id) === String(subject.id) ? "selected" : ""}>${esc(subject.name)}</option>`
                                )
                                .join("")}
                        </select>
                    </div>
                    <div class="form-field">
                        <label>题型</label>
                        <select class="select" name="type">
                            <option value="">全部题型</option>
                            <option value="single" ${filters.type === "single" ? "selected" : ""}>单选题</option>
                            <option value="multiple" ${filters.type === "multiple" ? "selected" : ""}>多选题</option>
                            <option value="judge" ${filters.type === "judge" ? "selected" : ""}>是非题</option>
                        </select>
                    </div>
                    <div class="search-box">
                        ${icon("search", 15)}
                        <input class="input" name="search" value="${esc(filters.search)}" placeholder="搜索题目内容">
                    </div>
                    <button class="btn btn-primary" type="submit">${icon("filter", 14)}筛选</button>
                    <button class="btn btn-ghost" type="button" id="reset-question-filter">重置</button>
                </form>
                ${
                    data.items.length
                        ? `<div class="table-wrap">
                            <table class="data-table">
                                <thead><tr><th>题目内容</th><th>科目</th><th>题型</th><th>答案</th><th>更新时间</th><th></th></tr></thead>
                                <tbody>
                                    ${data.items
                                        .map(
                                            (question) => `
                                        <tr>
                                            <td><div class="cell-question" title="${esc(question.content)}">${esc(question.content)}</div></td>
                                            <td><span class="badge blue">${esc(question.subject_name)}</span></td>
                                            <td>${typeBadge(question.type)}</td>
                                            <td><span class="badge gray">${esc((question.answer || []).join(" / "))}</span></td>
                                            <td class="cell-muted">${formatDate(question.updated_at, false)}</td>
                                            <td>
                                                <div class="table-actions">
                                                    <button class="btn btn-secondary btn-sm" data-edit-question="${question.id}">${icon("edit", 13)}编辑</button>
                                                    <button class="btn btn-danger btn-sm" data-delete-question="${question.id}">${icon("trash", 13)}删除</button>
                                                </div>
                                            </td>
                                        </tr>`
                                        )
                                        .join("")}
                                </tbody>
                            </table>
                        </div>
                        <div class="pagination">
                            ${
                                page > 1
                                    ? `<a class="btn btn-secondary btn-sm" href="${pageLink(page - 1)}">${icon("chevronLeft", 13)}上一页</a>`
                                    : ""
                            }
                            <span>第 ${page} / ${data.pages || 1} 页 · 共 ${data.total} 道题</span>
                            ${
                                page < data.pages
                                    ? `<a class="btn btn-secondary btn-sm" href="${pageLink(page + 1)}">下一页${icon("chevronRight", 13)}</a>`
                                    : ""
                            }
                        </div>`
                        : tableEmpty(
                              subjects.length
                                  ? "当前筛选条件下没有题目，点击右上角新增题目。"
                                  : "请先创建科目，再录入题目。"
                          )
                }
            </div>
        `);

        document.getElementById("add-question-btn").addEventListener("click", () => {
            openQuestionModal(null, filters.subject_id);
        });
        document
            .getElementById("question-filter-form")
            .addEventListener("submit", (event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                go(
                    buildHash("/admin/questions", {
                        subject_id: formData.get("subject_id"),
                        type: formData.get("type"),
                        search: String(formData.get("search") || "").trim(),
                    })
                );
            });
        document
            .getElementById("reset-question-filter")
            .addEventListener("click", () => {
                go("#/admin/questions");
            });
        document.querySelectorAll("[data-edit-question]").forEach((button) => {
            button.addEventListener("click", () => {
                const question = state.adminQuestions.find(
                    (item) => item.id === Number(button.dataset.editQuestion)
                );
                if (question) openQuestionModal(question);
            });
        });
        document.querySelectorAll("[data-delete-question]").forEach((button) => {
            button.addEventListener("click", () => {
                const question = state.adminQuestions.find(
                    (item) => item.id === Number(button.dataset.deleteQuestion)
                );
                if (question) deleteQuestion(question);
            });
        });
    }

    function initialOptionState(question, qtype) {
        if (qtype === "judge") {
            return [
                {
                    text: "正确",
                    correct: question
                        ? (question.answer || []).includes("T")
                        : false,
                },
                {
                    text: "错误",
                    correct: question
                        ? (question.answer || []).includes("F")
                        : false,
                },
            ];
        }
        if (question) {
            return (question.options || []).map((option) => ({
                text: option.text,
                correct: (question.answer || []).includes(option.key),
            }));
        }
        return [
            { text: "", correct: false },
            { text: "", correct: false },
            { text: "", correct: false },
            { text: "", correct: false },
        ];
    }

    function openQuestionModal(question, defaultSubjectId) {
        const subjects = state.subjects || state.adminSubjects || [];
        if (!subjects.length) {
            toast("请先创建至少一个科目", "error");
            return;
        }
        const editing = Boolean(question);
        let qtype = question ? question.type : "single";
        let options = initialOptionState(question, qtype);

        const subjectOptions = subjects
            .map(
                (subject) =>
                    `<option value="${subject.id}" ${String(
                        question ? question.subject_id : defaultSubjectId || subjects[0].id
                    ) === String(subject.id) ? "selected" : ""}>${esc(subject.name)}</option>`
            )
            .join("");

        openModal({
            title: editing ? "编辑题目" : "新增题目",
            subtitle: "选择科目与题型，填写题干、选项、正确答案和解析",
            size: "wide",
            body: `
                <form class="modal-form" id="question-form" novalidate>
                    <div class="form-grid">
                        <div class="form-field">
                            <label for="question-subject">所属科目</label>
                            <select class="select" id="question-subject" name="subject_id">${subjectOptions}</select>
                        </div>
                        <div class="form-field">
                            <label for="question-type">题型</label>
                            <select class="select" id="question-type" name="qtype">
                                <option value="single" ${qtype === "single" ? "selected" : ""}>单选题</option>
                                <option value="multiple" ${qtype === "multiple" ? "selected" : ""}>多选题</option>
                                <option value="judge" ${qtype === "judge" ? "selected" : ""}>是非题</option>
                            </select>
                        </div>
                        <div class="form-field span-2">
                            <label for="question-content">题目内容</label>
                            <textarea class="textarea" id="question-content" name="content" rows="3" maxlength="2000" placeholder="请输入完整题干">${esc(question ? question.content : "")}</textarea>
                        </div>
                        <div class="form-field span-2">
                            <label>选项与正确答案 <span class="field-hint">选择正确选项；多选题可勾选多个</span></label>
                            <div class="option-editor" id="option-editor"></div>
                            <div class="option-editor-foot">
                                <button class="btn btn-secondary btn-sm" type="button" id="add-option-btn">${icon("plus", 13)}添加选项</button>
                                <span class="field-hint" id="option-count-hint"></span>
                            </div>
                        </div>
                        <div class="form-field span-2">
                            <label for="question-explanation">答案解析 <span class="field-hint">可选</span></label>
                            <textarea class="textarea" id="question-explanation" name="explanation" rows="3" maxlength="2000" placeholder="解释本题的正确答案与知识点">${esc(question ? question.explanation : "")}</textarea>
                        </div>
                        <div class="form-message span-2" id="question-form-error"></div>
                    </div>
                </form>`,
            footer: `
                <button class="btn btn-secondary" data-modal-close>取消</button>
                <button class="btn btn-primary" type="submit" form="question-form" id="save-question-btn">${editing ? "保存修改" : "添加题目"}</button>`,
        });

        const editor = document.getElementById("option-editor");
        const typeSelect = document.getElementById("question-type");
        const addButton = document.getElementById("add-option-btn");
        const countHint = document.getElementById("option-count-hint");
        const errorBox = document.getElementById("question-form-error");

        const renderOptions = () => {
            const inputType = qtype === "multiple" ? "checkbox" : "radio";
            const isJudge = qtype === "judge";
            editor.innerHTML = options
                .map(
                    (option, index) => `
                <div class="option-edit-row">
                    <span class="option-key-static">${
                        isJudge ? (index === 0 ? "对" : "错") : String.fromCharCode(65 + index)
                    }</span>
                    <input class="input" data-option-text="${index}" value="${esc(option.text)}" maxlength="500" placeholder="选项内容" ${isJudge ? "readonly" : ""}>
                    <label class="option-correct">
                        <input type="${inputType}" name="correct-option" data-option-correct="${index}" ${option.correct ? "checked" : ""}>
                        正确
                    </label>
                    ${
                        !isJudge && options.length > 2
                            ? `<button class="option-remove" type="button" data-remove-option="${index}" aria-label="删除选项">${icon("trash", 14)}</button>`
                            : ""
                    }
                </div>`
                )
                .join("");
            addButton.style.display = isJudge ? "none" : "";
            addButton.disabled = options.length >= 8;
            countHint.textContent = isJudge
                ? "是非题固定为「正确 / 错误」两个选项"
                : `共 ${options.length} 个选项（2-8 个）`;
        };

        editor.addEventListener("input", (event) => {
            const input = event.target.closest("[data-option-text]");
            if (!input) return;
            options[Number(input.dataset.optionText)].text = input.value;
        });

        editor.addEventListener("change", (event) => {
            const input = event.target.closest("[data-option-correct]");
            if (!input) return;
            const index = Number(input.dataset.optionCorrect);
            if (qtype === "multiple") {
                options[index].correct = input.checked;
            } else {
                options.forEach((option, optionIndex) => {
                    option.correct = optionIndex === index ? input.checked : false;
                });
            }
        });

        editor.addEventListener("click", (event) => {
            const button = event.target.closest("[data-remove-option]");
            if (!button) return;
            options.splice(Number(button.dataset.removeOption), 1);
            renderOptions();
        });

        addButton.addEventListener("click", () => {
            if (options.length >= 8) return;
            options.push({ text: "", correct: false });
            renderOptions();
            const inputs = editor.querySelectorAll("[data-option-text]");
            const last = inputs[inputs.length - 1];
            if (last) last.focus();
        });

        typeSelect.addEventListener("change", () => {
            const previous = qtype;
            qtype = typeSelect.value;
            if (qtype === "judge") {
                options = initialOptionState(null, "judge");
            } else if (previous === "judge") {
                options = [
                    { text: "", correct: false },
                    { text: "", correct: false },
                    { text: "", correct: false },
                    { text: "", correct: false },
                ];
            } else if (qtype === "single") {
                let found = false;
                options.forEach((option) => {
                    if (option.correct && !found) {
                        found = true;
                    } else {
                        option.correct = false;
                    }
                });
            }
            renderOptions();
        });

        renderOptions();

        const form = document.getElementById("question-form");
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const button = document.getElementById("save-question-btn");
            errorBox.textContent = "";
            const subjectId = Number(document.getElementById("question-subject").value);
            const content = document
                .getElementById("question-content")
                .value.trim();
            const explanation = document
                .getElementById("question-explanation")
                .value.trim();

            if (!content) {
                errorBox.textContent = "请填写题目内容。";
                return;
            }
            if (options.some((option) => !String(option.text).trim())) {
                errorBox.textContent = "所有选项内容都不能为空。";
                return;
            }
            const correctIndexes = options
                .map((option, index) => (option.correct ? index : -1))
                .filter((index) => index >= 0);
            if (!correctIndexes.length) {
                errorBox.textContent = "请至少设置一个正确答案。";
                return;
            }
            if (qtype === "single" && correctIndexes.length !== 1) {
                errorBox.textContent = "单选题只能设置一个正确答案。";
                return;
            }

            let answer;
            if (qtype === "judge") {
                answer = [correctIndexes[0] === 0 ? "T" : "F"];
            } else {
                answer = correctIndexes.map((index) => String.fromCharCode(65 + index));
            }

            const payload = {
                subject_id: subjectId,
                qtype,
                content,
                options: options.map((option) => ({ text: option.text.trim() })),
                answer,
                explanation,
            };

            button.disabled = true;
            button.classList.add("is-loading");
            try {
                if (editing) {
                    await api.patch(`/admin/questions/${question.id}`, payload);
                } else {
                    await api.post("/admin/questions", payload);
                }
                closeModal();
                invalidateSubjects();
                toast(editing ? "题目已更新" : "题目已添加");
                renderRoute();
            } catch (error) {
                errorBox.textContent = error.message;
                button.disabled = false;
                button.classList.remove("is-loading");
            }
        });
    }

    function deleteQuestion(question) {
        confirmDialog({
            title: "删除题目",
            message: `确定删除这道题目吗？<br><br><strong>${esc(question.content)}</strong><br><br>删除后题目不会再出现在考试中，已有考试记录仍会保留。`,
            danger: true,
            confirmText: "删除题目",
            onConfirm: async () => {
                try {
                    await api.delete(`/admin/questions/${question.id}`);
                    closeModal();
                    invalidateSubjects();
                    toast("题目已删除");
                    renderRoute();
                } catch (error) {
                    toast(error.message, "error");
                }
            },
        });
    }

    // --------------------------------------------------------- admin settings

    async function renderAdminSettings(route, seq) {
        const data = await api.get("/settings");
        if (seq !== state.renderSeq) return;
        state.site = data.settings || state.site;
        const info = state.site;

        setPage(`
            ${adminIntro(
                "网站设置",
                "配置网站系统名称和详细介绍，保存后会立即应用到登录页、侧边栏和浏览器标题。"
            )}
            <div class="settings-layout">
                <div class="panel settings-panel">
                    <form class="settings-form" id="site-settings-form" novalidate>
                        <div class="form-field">
                            <label for="site-name">网站系统名称 <span class="field-hint">1-50 个字符</span></label>
                            <input class="input" id="site-name" name="site_name" maxlength="50" value="${esc(info.site_name || "")}" placeholder="例如：知考">
                        </div>
                        <div class="form-field">
                            <label for="site-description">网站详细介绍 <span class="field-hint">最多 1000 个字符</span></label>
                            <textarea class="textarea" id="site-description" name="site_description" maxlength="1000" rows="7" placeholder="介绍网站定位、功能与特色">${esc(info.site_description || "")}</textarea>
                        </div>
                        <div class="form-message" id="site-settings-error"></div>
                        <div class="settings-actions">
                            <button class="btn btn-primary" type="submit" id="save-site-settings-btn">${icon("check", 15)}保存设置</button>
                        </div>
                    </form>
                </div>
                <aside class="settings-preview">
                    <div class="preview-label">界面预览</div>
                    <div class="preview-brand">
                        <span class="logo-tile">${esc(siteMark())}</span>
                        <div class="brand-copy"><strong>${esc(siteName())}</strong><span>Exam System</span></div>
                    </div>
                    <p class="preview-description">${esc(siteDescription())}</p>
                </aside>
            </div>
        `);

        const form = document.getElementById("site-settings-form");
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const errorBox = document.getElementById("site-settings-error");
            const button = document.getElementById("save-site-settings-btn");
            const site_name = document.getElementById("site-name").value.trim();
            const site_description = document
                .getElementById("site-description")
                .value.trim();
            errorBox.textContent = "";

            if (!site_name) {
                errorBox.textContent = "请填写网站系统名称。";
                return;
            }
            if (site_name.length > 50) {
                errorBox.textContent = "网站系统名称不能超过 50 个字符。";
                return;
            }
            if (site_description.length > 1000) {
                errorBox.textContent = "网站详细介绍不能超过 1000 个字符。";
                return;
            }

            button.disabled = true;
            button.classList.add("is-loading");
            try {
                const result = await api.patch("/admin/settings", {
                    site_name,
                    site_description,
                });
                state.site = result.settings;
                toast("网站设置已更新");
                renderRoute();
            } catch (error) {
                errorBox.textContent = error.message;
                button.disabled = false;
                button.classList.remove("is-loading");
            }
        });
    }

    // ------------------------------------------------------------ admin users

    async function renderAdminUsers(route, seq) {
        const search = String(route.query.search || "").trim();
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        const data = await api.get(`/admin/users?${params.toString()}`);
        if (seq !== state.renderSeq) return;
        state.adminUsers = data.items;

        setPage(`
            ${adminIntro(
                "用户管理",
                "查看平台用户，调整角色与账号状态，或重置用户密码。",
                `<button class="btn btn-primary" id="add-user-btn">${icon("plus", 15)}新增用户</button>`
            )}
            <div class="page-toolbar">
                <form class="search-box" id="user-search-form">
                    ${icon("search", 15)}
                    <input class="input" name="search" value="${esc(search)}" placeholder="搜索用户名">
                </form>
                <span class="toolbar-note">共 ${data.items.length} 位用户</span>
            </div>
            <div class="panel">
                ${
                    data.items.length
                        ? `<div class="table-wrap">
                            <table class="data-table">
                                <thead><tr><th>用户</th><th>角色</th><th>状态</th><th>考试次数</th><th>注册时间</th><th></th></tr></thead>
                                <tbody>
                                    ${data.items
                                        .map(
                                            (user) => `
                                        <tr>
                                            <td>
                                                <div class="table-primary">
                                                    <span class="avatar sm">${esc(initials(user.username))}</span>
                                                    <div>
                                                        <div class="cell-main">${esc(user.username)} ${user.id === state.user.id ? '<span class="badge blue">当前账号</span>' : ""}</div>
                                                        <div class="cell-muted">ID ${user.id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>${user.role === "admin" ? '<span class="badge purple">管理员</span>' : '<span class="badge gray">普通用户</span>'}</td>
                                            <td>${user.is_active ? '<span class="badge green">正常</span>' : '<span class="badge red">已停用</span>'}</td>
                                            <td>${user.attempt_count} 次</td>
                                            <td class="cell-muted">${formatDate(user.created_at, false)}</td>
                                            <td>
                                                <div class="table-actions">
                                                    <button class="btn btn-secondary btn-sm" data-edit-user="${user.id}">${icon("edit", 13)}编辑</button>
                                                    ${
                                                        user.id === state.user.id
                                                            ? ""
                                                            : `<button class="btn btn-danger btn-sm" data-delete-user="${user.id}">${icon("trash", 13)}删除</button>`
                                                    }
                                                </div>
                                            </td>
                                        </tr>`
                                        )
                                        .join("")}
                                </tbody>
                            </table>
                        </div>`
                        : tableEmpty("没有找到匹配的用户。")
                }
            </div>
        `);

        document.getElementById("add-user-btn").addEventListener("click", () => {
            openUserModal();
        });
        document
            .getElementById("user-search-form")
            .addEventListener("submit", (event) => {
                event.preventDefault();
                const value = new FormData(event.currentTarget).get("search");
                go(buildHash("/admin/users", { search: String(value || "").trim() }));
            });
        document.querySelectorAll("[data-edit-user]").forEach((button) => {
            button.addEventListener("click", () => {
                const user = state.adminUsers.find(
                    (item) => item.id === Number(button.dataset.editUser)
                );
                if (user) openUserModal(user);
            });
        });
        document.querySelectorAll("[data-delete-user]").forEach((button) => {
            button.addEventListener("click", () => {
                const user = state.adminUsers.find(
                    (item) => item.id === Number(button.dataset.deleteUser)
                );
                if (user) deleteUser(user);
            });
        });
    }

    function openUserModal(user) {
        const editing = Boolean(user);
        const isSelf = editing && user.id === state.user.id;
        openModal({
            title: editing ? "编辑用户" : "新增用户",
            subtitle: editing
                ? "调整账号角色、状态或重置登录密码"
                : "创建一个新的平台账号",
            body: `
                <form class="modal-form" id="user-form" novalidate>
                    <div class="form-field">
                        <label for="user-username">用户名</label>
                        <input class="input" id="user-username" name="username" maxlength="32" value="${esc(user ? user.username : "")}" ${editing ? "readonly" : ""} placeholder="3-32 个字符，不含空格">
                    </div>
                    <div class="form-field">
                        <label for="user-password">${editing ? "重置密码" : "登录密码"} <span class="field-hint">${editing ? "留空则不修改" : "至少 6 位"}</span></label>
                        <input class="input" id="user-password" name="password" type="password" maxlength="64" autocomplete="new-password" placeholder="${editing ? "留空保持原密码" : "请输入初始密码"}">
                    </div>
                    <div class="form-field">
                        <label>账号角色</label>
                        <div class="role-options">
                            <label class="radio-card"><input type="radio" name="role" value="user" ${!user || user.role === "user" ? "checked" : ""} ${isSelf ? "disabled" : ""}>普通用户</label>
                            <label class="radio-card"><input type="radio" name="role" value="admin" ${user && user.role === "admin" ? "checked" : ""} ${isSelf ? "disabled" : ""}>管理员</label>
                        </div>
                        ${isSelf ? '<span class="field-hint">不能修改自己的角色或停用自己的账号</span>' : ""}
                    </div>
                    <label class="check-row">
                        <input type="checkbox" id="user-active" ${!user || user.is_active ? "checked" : ""} ${isSelf ? "disabled" : ""}>
                        账号启用（关闭后用户将无法登录）
                    </label>
                    <div class="form-message" id="user-form-error"></div>
                </form>`,
            footer: `
                <button class="btn btn-secondary" data-modal-close>取消</button>
                <button class="btn btn-primary" type="submit" form="user-form" id="save-user-btn">${editing ? "保存修改" : "创建用户"}</button>`,
        });

        const form = document.getElementById("user-form");
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const errorBox = document.getElementById("user-form-error");
            const button = document.getElementById("save-user-btn");
            errorBox.textContent = "";
            const username = document.getElementById("user-username").value.trim();
            const password = document.getElementById("user-password").value;
            const roleInput = form.querySelector('input[name="role"]:checked');
            const role = roleInput ? roleInput.value : "user";
            const isActive = document.getElementById("user-active").checked;

            if (!editing && !username) {
                errorBox.textContent = "请填写用户名。";
                return;
            }
            if ((!editing || password) && password.length < 6) {
                errorBox.textContent = "密码长度至少为 6 位。";
                return;
            }

            button.disabled = true;
            button.classList.add("is-loading");
            try {
                if (editing) {
                    const payload = { role, is_active: isActive };
                    if (password) payload.password = password;
                    await api.patch(`/admin/users/${user.id}`, payload);
                } else {
                    await api.post("/admin/users", {
                        username,
                        password,
                        role,
                        is_active: isActive,
                    });
                }
                closeModal();
                toast(editing ? "用户信息已更新" : "用户已创建");
                renderRoute();
            } catch (error) {
                errorBox.textContent = error.message;
                button.disabled = false;
                button.classList.remove("is-loading");
            }
        });
    }

    function deleteUser(user) {
        confirmDialog({
            title: "删除用户",
            message: `确定删除用户 <strong>${esc(user.username)}</strong> 吗？该用户的考试记录与错题数据也会一并删除，此操作无法撤销。`,
            danger: true,
            confirmText: "删除用户",
            onConfirm: async () => {
                try {
                    await api.delete(`/admin/users/${user.id}`);
                    closeModal();
                    toast("用户已删除");
                    renderRoute();
                } catch (error) {
                    toast(error.message, "error");
                }
            },
        });
    }

    // ------------------------------------------------------------------ init

    async function init() {
        await loadSiteSettings();
        if (!api.hasToken()) {
            renderAuth();
            return;
        }
        try {
            const result = await api.get("/auth/me");
            state.user = result.user;
            renderRoute();
        } catch (error) {
            api.clearToken();
            state.user = null;
            renderAuth();
            if (error.status && error.status !== 401) {
                toast(error.message, "error");
            }
        }
    }

    init();
})();
