(() => {
    const STORAGE_KEYS = { mods: "modkid-mod-favorites", plugins: "modkid-plugin-favorites" };
    const pagePath = location.pathname.toLowerCase();
    const pageType = pagePath.includes("mods-favorites.html") || pagePath.includes("mods.html")
        ? "mods"
        : location.pathname.toLowerCase().includes("favorites.html") ? "all" : "plugins";
    let activeCategory = "all";
    let savedOnly = false;

    function readFavorites(type = pageType) {
        try {
            if (type === "all") return [...readFavorites("mods"), ...readFavorites("plugins")];
            const saved = localStorage.getItem(STORAGE_KEYS[type]);
            const legacy = type === "mods" ? localStorage.getItem("modkid-favorites") : null;
            const value = JSON.parse(saved || legacy || "[]");
            return Array.isArray(value) ? value : [];
        } catch {
            return [];
        }
    }

    function writeFavorites(favorites, type = pageType) {
        localStorage.setItem(STORAGE_KEYS[type], JSON.stringify(favorites));
    }

    function getCardType(card) {
        if (card.dataset.favoriteType) return card.dataset.favoriteType;
        if (card.classList.contains("game-card")) return "mods";
        if (card.classList.contains("plugin-card")) return "plugins";
        return pageType === "all" ? "mods" : pageType;
    }

    function getCardData(card) {
        const title = card.querySelector("h3")?.textContent.trim();
        const image = card.querySelector(".catalog-image, .card-image")?.getAttribute("src");
        const description = card.querySelector(".catalog-body p, .card-body p")?.textContent.trim() || "";
        const link = card.querySelector(".catalog-body a, .card-body a, a")?.getAttribute("href") || "#";
        const tag = card.querySelector(".card-tag")?.textContent.trim() || (getCardType(card) === "mods" ? "МОД" : "ПЛАГІН");
        const id = card.dataset.id || title?.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-");
        return id && title ? { id, type: getCardType(card), title, image, description, link, tag } : null;
    }

    function refreshLikeButtons() {
        document.querySelectorAll(".catalog-card[data-id], .game-card[data-id], .plugin-card[data-id]").forEach((card) => {
            const button = card.querySelector(".like-btn");
            if (!button) return;
            const type = getCardType(card);
            const liked = readFavorites(type).some((item) => item.id === card.dataset.id);
            button.classList.toggle("is-liked", liked);
            button.setAttribute("aria-pressed", String(liked));
            button.setAttribute("aria-label", liked ? "Прибрати зі збереженого" : "Додати до збереженого");
            button.textContent = type === "mods" ? (liked ? "★" : "☆") : (liked ? "♥" : "♡");
        });
    }

    function displayFavorites() {
        const grid = document.getElementById("favorites-grid");
        if (!grid) return;
        const type = document.getElementById("favorites-grid")?.dataset.favoritesType || "all";
        const favorites = readFavorites(type);
        if (!favorites.length) {
            grid.innerHTML = `<p class="empty-favorites">Тут поки порожньо. Натисни ${type === "mods" ? "☆" : "♡"} на картці, щоб зберегти її.</p>`;
            return;
        }
        grid.innerHTML = favorites.map((item) => `
            <article class="catalog-card favorite-card" data-id="${escapeHtml(item.id)}" data-favorite-type="${escapeHtml(item.type || "mods")}">
                ${item.image ? `<img class="catalog-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy">` : ""}
                <div class="catalog-body">
                    <span class="card-tag">${escapeHtml(item.tag)}</span>
                    <h3>${escapeHtml(item.title)}</h3>
                    <p>${escapeHtml(item.description)}</p>
                    <div class="card-actions">
                        <a class="blue-button" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">Відкрити</a>
                        <button class="like-btn is-liked" type="button" data-remove-favorite="${escapeHtml(item.id)}" data-favorite-type="${escapeHtml(item.type || "mods")}" aria-label="Прибрати зі збереженого" aria-pressed="true">${item.type === "mods" ? "★" : "♥"}</button>
                    </div>
                </div>
            </article>`).join("");
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[char]);
    }

    function toggleFavorite(card) {
        const item = getCardData(card);
        if (!item) return;
        const favorites = readFavorites(getCardType(card));
        const exists = favorites.some((favorite) => favorite.id === item.id);
        writeFavorites(exists ? favorites.filter((favorite) => favorite.id !== item.id) : [...favorites, item], item.type);
        refreshLikeButtons();
        applyCatalogControls();
    }

    function applyCatalogControls() {
        const grid = document.querySelector(".catalog-tools")?.nextElementSibling;
        const cards = [...document.querySelectorAll(".catalog-card[data-category]")];
        if (!cards.length) return;

        const query = document.getElementById("catalog-search")?.value.trim().toLocaleLowerCase("uk") || "";
        const sort = document.getElementById("catalog-sort")?.value || "name-asc";
        const favoriteIds = new Set(readFavorites().map((item) => item.id));
        cards.sort((first, second) => {
            const titleA = first.querySelector("h3")?.textContent.trim() || "";
            const titleB = second.querySelector("h3")?.textContent.trim() || "";
            const comparison = titleA.localeCompare(titleB, "uk", { sensitivity: "base" });
            return sort === "name-desc" ? -comparison : comparison;
        });

        let visibleCount = 0;
        cards.forEach((card) => {
            const text = `${card.querySelector("h3")?.textContent || ""} ${card.querySelector(".catalog-body p")?.textContent || ""} ${card.querySelector(".card-tag")?.textContent || ""}`.toLocaleLowerCase("uk");
            const matches = (activeCategory === "all" || card.dataset.category === activeCategory)
                && (!query || text.includes(query))
                && (!savedOnly || favoriteIds.has(card.dataset.id));
            card.hidden = !matches;
            if (matches) visibleCount += 1;
            grid?.append(card);
        });

        const count = document.querySelector(".catalog-count");
        if (count) count.textContent = `Знайдено: ${visibleCount}`;
        let emptyState = document.querySelector(".catalog-empty");
        if (!emptyState && grid) {
            emptyState = document.createElement("p");
            emptyState.className = "catalog-empty";
            emptyState.textContent = "Нічого не знайшлося. Спробуй змінити пошук або категорію.";
            grid.after(emptyState);
        }
        if (emptyState) emptyState.hidden = visibleCount !== 0;
        const savedButton = document.querySelector(".saved-filter");
        if (savedButton) {
            savedButton.classList.toggle("active", savedOnly);
            savedButton.setAttribute("aria-pressed", String(savedOnly));
            const icon = pageType === "mods" ? "★" : "♥";
            savedButton.textContent = savedOnly ? `${icon} Показати всі` : `${icon} Лише збережені`;
        }
    }

    document.addEventListener("click", (event) => {
        const likeButton = event.target.closest(".like-btn");
        if (likeButton) {
            if (likeButton.dataset.removeFavorite) {
                const type = likeButton.dataset.favoriteType || "mods";
                writeFavorites(readFavorites(type).filter((item) => item.id !== likeButton.dataset.removeFavorite), type);
                displayFavorites();
            } else {
                const card = likeButton.closest(".catalog-card, .game-card, .plugin-card");
                if (card?.dataset.id) toggleFavorite(card);
            }
        }

        const filterButton = event.target.closest(".filter");
        if (filterButton) {
            activeCategory = filterButton.dataset.filter || filterButton.dataset.category || "all";
            document.querySelectorAll(".filter").forEach((button) => button.classList.toggle("active", button === filterButton));
            applyCatalogControls();
        }

        if (event.target.closest(".saved-filter")) {
            savedOnly = !savedOnly;
            applyCatalogControls();
        }
    });

    document.addEventListener("input", (event) => {
        if (event.target.matches("#catalog-search")) applyCatalogControls();
    });
    document.addEventListener("change", (event) => {
        if (event.target.matches("#catalog-sort")) applyCatalogControls();
    });

    function initializePageMotion() {
        const revealTargets = document.querySelectorAll(
            ".catalog-card, .game-card, .plugin-card, .page-title, .section-heading, .contacts, .newsletter"
        );
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (!reduceMotion && "IntersectionObserver" in window) {
            const observer = new IntersectionObserver((entries, currentObserver) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        currentObserver.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.12 });
            revealTargets.forEach((element) => {
                element.classList.add("scroll-reveal");
                observer.observe(element);
            });
        }

        const backToTop = document.createElement("button");
        backToTop.className = "back-to-top";
        backToTop.type = "button";
        backToTop.setAttribute("aria-label", "Повернутися нагору");
        backToTop.title = "Нагору";
        backToTop.textContent = "↑";
        document.body.append(backToTop);

        const updateBackToTop = () => backToTop.classList.toggle("is-visible", window.scrollY > 420);
        window.addEventListener("scroll", updateBackToTop, { passive: true });
        updateBackToTop();
        backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    }

    document.addEventListener("DOMContentLoaded", () => {
        initializePageMotion();
        document.querySelectorAll(".catalog-card, .game-card, .plugin-card").forEach((card) => {
            const title = card.querySelector("h3")?.textContent.trim();
            if (!card.dataset.id && title) {
                card.dataset.id = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
            }
            if (!card.querySelector(".like-btn")) {
                const link = card.querySelector(".catalog-body a, .card-body a, a");
                const actions = document.createElement("div");
                actions.className = "card-actions";
                if (link) actions.append(link);
                const button = document.createElement("button");
                button.className = "like-btn";
                button.type = "button";
                button.textContent = pageType === "mods" ? "☆" : "♡";
                actions.append(button);
                (card.querySelector(".catalog-body, .card-body") || card).append(actions);
            }
        });
        refreshLikeButtons();
        displayFavorites();
        applyCatalogControls();
    });
})();
