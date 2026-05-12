/*
 * Mini Preview SD
 * Floating, auto-updating preview panel for Stable Diffusion WebUI / Forge.
 */
(function () {
    "use strict";

    const NS = "mini-preview-sd";
    const STORAGE_KEY = `${NS}:state`;
    const BUTTON_ID = `${NS}-button`;
    const PANEL_ID = `${NS}-panel`;
    const MENU_ID = `${NS}-menu`;

    const state = {
        panel: null,
        image: null,
        title: null,
        menu: null,
        lastImageSrc: "",
        visible: false,
        followLatest: true,
        dragging: false,
        dragOffsetX: 0,
        dragOffsetY: 0,
        resizeObserver: null,
        mutationObserver: null,
        pipCanvas: null,
        pipContext: null,
        pipVideo: null,
        pipReady: false,
        nativePipOpen: false,
        fallbackPanelOpen: false,
        scanScheduled: false,
        lastNativePipDrawAt: 0,
    };

    function loadSavedState() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        } catch (error) {
            return {};
        }
    }

    function savePanelState() {
        if (!state.panel) return;

        const rect = state.panel.getBoundingClientRect();
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                followLatest: state.followLatest,
            }));
        } catch (error) {
            // Saving the panel state is optional; keep the preview working if storage is unavailable.
        }
    }

    function injectStyles() {
        if (document.getElementById(`${NS}-styles`)) return;

        const style = document.createElement("style");
        style.id = `${NS}-styles`;
        style.textContent = `
            #${PANEL_ID} {
                position: fixed;
                right: 24px;
                bottom: 24px;
                width: min(360px, 40vw);
                height: min(360px, 45vh);
                min-width: 180px;
                min-height: 160px;
                z-index: 9999;
                display: none;
                flex-direction: column;
                overflow: hidden;
                resize: both;
                background: var(--body-background-fill, #111);
                color: var(--body-text-color, #f5f5f5);
                border: 1px solid var(--border-color-primary, rgba(255, 255, 255, 0.2));
                border-radius: 10px;
                box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
            }

            #${PANEL_ID}.${NS}--visible {
                display: flex;
            }

            .${NS}__header {
                display: flex;
                align-items: center;
                gap: 8px;
                min-height: 34px;
                padding: 6px 8px 6px 10px;
                cursor: move;
                user-select: none;
                background: var(--block-title-background-fill, rgba(255, 255, 255, 0.08));
                border-bottom: 1px solid var(--border-color-primary, rgba(255, 255, 255, 0.15));
                font-size: 13px;
                font-weight: 600;
            }

            .${NS}__title {
                flex: 1 1 auto;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .${NS}__follow {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                flex: 0 0 auto;
                font-size: 12px;
                font-weight: 400;
                opacity: 0.9;
                cursor: pointer;
            }

            .${NS}__close,
            .${NS}__button,
            .${NS}__menu-button {
                border: 1px solid var(--button-secondary-border-color, rgba(255, 255, 255, 0.2));
                border-radius: 6px;
                background: var(--button-secondary-background-fill, rgba(255, 255, 255, 0.08));
                color: inherit;
                cursor: pointer;
            }

            .${NS}__close {
                width: 24px;
                height: 24px;
                line-height: 20px;
                padding: 0;
                flex: 0 0 auto;
                font-size: 16px;
            }

            .${NS}__image-wrap {
                display: flex;
                align-items: center;
                justify-content: center;
                flex: 1 1 auto;
                min-height: 0;
                background: rgba(0, 0, 0, 0.28);
            }

            #${PANEL_ID} img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                display: block;
            }

            .${NS}__empty {
                padding: 16px;
                text-align: center;
                opacity: 0.75;
                font-size: 13px;
            }

            .${NS}__button {
                margin: 8px 0;
                padding: 8px 12px;
                font-size: 13px;
                width: fit-content;
            }

            .${NS}__button:hover,
            .${NS}__close:hover,
            .${NS}__menu-button:hover {
                filter: brightness(1.12);
            }

            #${MENU_ID} {
                position: fixed;
                z-index: 10000;
                display: none;
                min-width: 170px;
                padding: 6px;
                background: var(--body-background-fill, #181818);
                color: var(--body-text-color, #f5f5f5);
                border: 1px solid var(--border-color-primary, rgba(255, 255, 255, 0.2));
                border-radius: 8px;
                box-shadow: 0 10px 26px rgba(0, 0, 0, 0.42);
            }

            #${MENU_ID}.${NS}--visible {
                display: block;
            }

            .${NS}__menu-button {
                display: block;
                width: 100%;
                padding: 8px 10px;
                text-align: left;
                background: transparent;
                border-color: transparent;
                font-size: 13px;
            }
        `;
        document.head.appendChild(style);
    }

    function getImageSrc(img) {
        if (!img) return "";
        return img.currentSrc || img.src || img.getAttribute("src") || "";
    }

    function isCandidatePreviewImage(img) {
        if (!(img instanceof HTMLImageElement)) return false;
        if (img.closest(`#${PANEL_ID}, #${MENU_ID}`)) return false;

        const src = getImageSrc(img);
        if (!src || src.startsWith("data:image/svg") || src.includes("file=html/")) return false;

        const rect = img.getBoundingClientRect();
        const width = img.naturalWidth || rect.width;
        const height = img.naturalHeight || rect.height;
        if (width < 64 || height < 64) return false;

        const container = img.closest("[id], .output-html, .gallery, .preview, .image-container, .thumbnail-item");
        const signature = container ? `${container.id || ""} ${container.className || ""}`.toLowerCase() : "";

        return /gallery|preview|result|output|image|thumbnail/.test(signature) || img.closest("gradio-app") !== null;
    }

    function findLatestPreviewImage() {
        const candidates = Array.from(document.querySelectorAll("img"))
            .filter(isCandidatePreviewImage)
            .filter((img) => getImageSrc(img))
            .map((img, index) => {
                const rect = img.getBoundingClientRect();
                const area = Math.max(0, rect.width) * Math.max(0, rect.height);
                const parent = img.parentElement;
                const signature = `${img.id || ""} ${img.className || ""} ${parent ? parent.id : ""} ${parent ? parent.className : ""}`.toLowerCase();
                const previewBoost = /preview|selected|active/.test(signature) ? 1000000 : 0;

                return { img, index, area, score: area + previewBoost };
            })
            .filter((candidate) => candidate.area > 0);

        if (!candidates.length) return null;

        candidates.sort((a, b) => (b.score - a.score) || (b.index - a.index));
        return candidates[0].img;
    }

    function setFloatingImage(src, label, sourceImage, forceRefresh) {
        if (!src) return;
        ensurePanel();

        const shouldUpdatePanelImage = src !== state.lastImageSrc;
        state.lastImageSrc = src;
        state.image.alt = label || "Mini Preview SD";
        state.title.textContent = label || "Mini Preview SD";

        if (shouldUpdatePanelImage) {
            state.image.src = src;
        }

        if (sourceImage) {
            const updatedFromElement = updateNativePipFromElement(sourceImage, forceRefresh);
            if (!updatedFromElement) updateNativePipImage(src, forceRefresh);
        } else {
            updateNativePipImage(src, forceRefresh);
        }
    }

    function supportsNativePictureInPicture() {
        return Boolean(
            document.pictureInPictureEnabled &&
            HTMLVideoElement.prototype.requestPictureInPicture &&
            HTMLCanvasElement.prototype.captureStream
        );
    }

    function drawPipPlaceholder() {
        if (!state.pipContext || !state.pipCanvas) return;

        state.pipCanvas.width = 640;
        state.pipCanvas.height = 360;
        state.pipContext.fillStyle = "#111";
        state.pipContext.fillRect(0, 0, state.pipCanvas.width, state.pipCanvas.height);
        state.pipContext.fillStyle = "#f5f5f5";
        state.pipContext.font = "24px sans-serif";
        state.pipContext.textAlign = "center";
        state.pipContext.textBaseline = "middle";
        state.pipContext.fillText("Mini Preview SD", state.pipCanvas.width / 2, state.pipCanvas.height / 2);
    }

    function drawImageToPipCanvas(image) {
        if (!state.pipContext || !state.pipCanvas || !image.naturalWidth || !image.naturalHeight) return;

        const maxSide = 960;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));

        if (state.pipCanvas.width !== width || state.pipCanvas.height !== height) {
            state.pipCanvas.width = width;
            state.pipCanvas.height = height;
        }

        state.pipContext.fillStyle = "#000";
        state.pipContext.fillRect(0, 0, width, height);
        state.pipContext.drawImage(image, 0, 0, width, height);
    }

    function ensureNativePipEngine() {
        if (!supportsNativePictureInPicture()) return false;
        if (state.pipReady) return true;

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        const video = document.createElement("video");

        if (!context) return false;

        state.pipCanvas = canvas;
        state.pipContext = context;
        drawPipPlaceholder();

        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        video.style.position = "fixed";
        video.style.width = "1px";
        video.style.height = "1px";
        video.style.opacity = "0";
        video.style.pointerEvents = "none";
        video.style.left = "-9999px";
        video.srcObject = canvas.captureStream(2);
        video.addEventListener("leavepictureinpicture", () => {
            state.nativePipOpen = false;
            state.visible = state.fallbackPanelOpen;
        });

        document.body.appendChild(video);
        state.pipVideo = video;
        state.pipReady = true;
        video.play().catch(() => {
            // Some browsers defer playback until the user clicks the Imagen en imagen button.
        });
        return true;
    }

    function canDrawNativePip(forceRefresh) {
        if (!state.pipReady) return false;

        const now = Date.now();
        const minInterval = forceRefresh ? 500 : 1000;
        return now - state.lastNativePipDrawAt >= minInterval;
    }

    function markNativePipDraw() {
        state.lastNativePipDrawAt = Date.now();
    }

    function updateNativePipFromElement(image, forceRefresh) {
        if (!(image instanceof HTMLImageElement) || !image.complete || !canDrawNativePip(forceRefresh)) return false;

        try {
            drawImageToPipCanvas(image);
            markNativePipDraw();
            return true;
        } catch (error) {
            return false;
        }
    }

    function updateNativePipImage(src, forceRefresh) {
        if (!src || !canDrawNativePip(forceRefresh)) return;

        markNativePipDraw();

        const image = new Image();
        image.onload = () => {
            try {
                drawImageToPipCanvas(image);
            } catch (error) {
                drawPipPlaceholder();
            }
        };
        image.src = src;
    }

    async function openNativePictureInPicture(img) {
        if (!ensureNativePipEngine()) return false;

        const sourceImage = img || findLatestPreviewImage();
        if (sourceImage) {
            const src = getImageSrc(sourceImage);
            setFloatingImage(src, sourceImage.alt || sourceImage.title || "Mini Preview SD", sourceImage, true);
        }

        try {
            const playPromise = state.pipVideo.play();
            if (document.pictureInPictureElement !== state.pipVideo) {
                await state.pipVideo.requestPictureInPicture();
            }
            if (playPromise && typeof playPromise.catch === "function") {
                await playPromise.catch(() => null);
            }
            state.nativePipOpen = true;
            state.visible = true;
            return true;
        } catch (error) {
            state.nativePipOpen = false;
            return false;
        }
    }

    async function openPictureInPicture(img) {
        const openedNativePip = await openNativePictureInPicture(img);
        if (!openedNativePip) {
            openFloatingPreview(img);
        }
    }

    function openFloatingPreview(img) {
        ensurePanel();

        const sourceImage = img || findLatestPreviewImage();
        if (sourceImage) {
            const src = getImageSrc(sourceImage);
            setFloatingImage(src, sourceImage.alt || sourceImage.title || "Mini Preview SD", sourceImage, true);
        }

        state.visible = true;
        state.fallbackPanelOpen = true;
        state.panel.classList.add(`${NS}--visible`);
        savePanelState();
    }

    function closeFloatingPreview() {
        if (!state.panel) return;
        state.fallbackPanelOpen = false;
        state.visible = state.nativePipOpen;
        state.panel.classList.remove(`${NS}--visible`);
        savePanelState();
    }

    function keepPanelInsideViewport() {
        if (!state.panel) return;

        const rect = state.panel.getBoundingClientRect();
        const maxLeft = Math.max(0, window.innerWidth - rect.width);
        const maxTop = Math.max(0, window.innerHeight - rect.height);
        const left = Math.min(Math.max(0, rect.left), maxLeft);
        const top = Math.min(Math.max(0, rect.top), maxTop);

        state.panel.style.left = `${left}px`;
        state.panel.style.top = `${top}px`;
        state.panel.style.right = "auto";
        state.panel.style.bottom = "auto";
    }

    function startDrag(event) {
        if (!state.panel || event.button !== 0 || event.target.closest("button, input, label")) return;

        const rect = state.panel.getBoundingClientRect();
        state.dragging = true;
        state.dragOffsetX = event.clientX - rect.left;
        state.dragOffsetY = event.clientY - rect.top;
        document.addEventListener("mousemove", dragPanel);
        document.addEventListener("mouseup", stopDrag, { once: true });
        event.preventDefault();
    }

    function dragPanel(event) {
        if (!state.dragging || !state.panel) return;

        const rect = state.panel.getBoundingClientRect();
        const left = Math.min(Math.max(0, event.clientX - state.dragOffsetX), Math.max(0, window.innerWidth - rect.width));
        const top = Math.min(Math.max(0, event.clientY - state.dragOffsetY), Math.max(0, window.innerHeight - rect.height));

        state.panel.style.left = `${left}px`;
        state.panel.style.top = `${top}px`;
        state.panel.style.right = "auto";
        state.panel.style.bottom = "auto";
    }

    function stopDrag() {
        state.dragging = false;
        document.removeEventListener("mousemove", dragPanel);
        savePanelState();
    }

    function ensurePanel() {
        if (state.panel) return state.panel;

        injectStyles();
        const saved = loadSavedState();
        state.followLatest = saved.followLatest !== false;

        const panel = document.createElement("div");
        panel.id = PANEL_ID;
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-label", "Mini Preview SD");

        if (Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
            panel.style.left = `${saved.left}px`;
            panel.style.top = `${saved.top}px`;
            panel.style.right = "auto";
            panel.style.bottom = "auto";
        }
        if (Number.isFinite(saved.width)) panel.style.width = `${saved.width}px`;
        if (Number.isFinite(saved.height)) panel.style.height = `${saved.height}px`;

        const header = document.createElement("div");
        header.className = `${NS}__header`;
        header.addEventListener("mousedown", startDrag);

        const title = document.createElement("span");
        title.className = `${NS}__title`;
        title.textContent = "Mini Preview SD";

        const followLabel = document.createElement("label");
        followLabel.className = `${NS}__follow`;
        followLabel.title = "Actualizar automáticamente con la última preview o generación";

        const followCheckbox = document.createElement("input");
        followCheckbox.type = "checkbox";
        followCheckbox.checked = state.followLatest;
        followCheckbox.addEventListener("change", () => {
            state.followLatest = followCheckbox.checked;
            savePanelState();
            if (state.followLatest) openFloatingPreview(findLatestPreviewImage());
        });
        followLabel.append(followCheckbox, "Seguir");

        const close = document.createElement("button");
        close.type = "button";
        close.className = `${NS}__close`;
        close.textContent = "×";
        close.title = "Cerrar Mini Preview SD";
        close.addEventListener("click", closeFloatingPreview);

        const imageWrap = document.createElement("div");
        imageWrap.className = `${NS}__image-wrap`;

        const image = document.createElement("img");
        image.alt = "Mini Preview SD";
        image.addEventListener("dblclick", () => window.open(state.lastImageSrc, "_blank", "noopener"));

        const empty = document.createElement("div");
        empty.className = `${NS}__empty`;
        empty.textContent = "Genera o selecciona una imagen para verla aquí.";

        image.addEventListener("load", () => {
            image.style.display = "block";
            empty.style.display = "none";
        });

        header.append(title, followLabel, close);
        imageWrap.append(empty, image);
        panel.append(header, imageWrap);
        document.body.appendChild(panel);

        state.panel = panel;
        state.image = image;
        state.title = title;

        if (window.ResizeObserver) {
            state.resizeObserver = new ResizeObserver(savePanelState);
            state.resizeObserver.observe(panel);
        }

        window.addEventListener("resize", keepPanelInsideViewport);
        keepPanelInsideViewport();
        return panel;
    }

    function ensureMenu() {
        if (state.menu) return state.menu;

        injectStyles();
        const menu = document.createElement("div");
        menu.id = MENU_ID;
        menu.setAttribute("role", "menu");

        const pipButton = document.createElement("button");
        pipButton.type = "button";
        pipButton.className = `${NS}__menu-button`;
        pipButton.textContent = "Imagen en imagen";
        pipButton.addEventListener("click", () => {
            const srcImg = state.menu.__sourceImage || findLatestPreviewImage();
            hideMenu();
            openPictureInPicture(srcImg);
        });

        menu.append(pipButton);
        document.body.appendChild(menu);
        state.menu = menu;
        return menu;
    }

    function showMenu(event, img) {
        const menu = ensureMenu();
        menu.__sourceImage = img;
        menu.classList.add(`${NS}--visible`);

        const menuWidth = 180;
        const menuHeight = 42;
        const left = Math.min(event.clientX, Math.max(0, window.innerWidth - menuWidth - 8));
        const top = Math.min(event.clientY, Math.max(0, window.innerHeight - menuHeight - 8));
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }

    function hideMenu() {
        if (!state.menu) return;
        state.menu.classList.remove(`${NS}--visible`);
        state.menu.__sourceImage = null;
    }

    function onContextMenu(event) {
        const img = event.target instanceof Element ? event.target.closest("img") : null;
        if (!isCandidatePreviewImage(img)) return;

        event.preventDefault();
        event.stopPropagation();
        showMenu(event, img);
    }

    function createButton() {
        const button = document.createElement("button");
        button.id = BUTTON_ID;
        button.type = "button";
        button.className = `${NS}__button`;
        button.textContent = "Imagen en imagen";
        button.title = "Abrir Mini Preview SD como Picture-in-Picture nativo; usa el panel interno si el navegador no lo soporta";
        button.addEventListener("click", () => openPictureInPicture(findLatestPreviewImage()));
        return button;
    }

    function findButtonHost() {
        const selectors = [
            "#txt2img_gallery",
            "#txt2img_results",
            "#txt2img_preview",
            "#img2img_gallery",
            "#img2img_results",
            "#img2img_preview",
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) return element;
        }

        const latestImage = findLatestPreviewImage();
        return latestImage ? latestImage.parentElement : null;
    }

    function ensureButton() {
        if (document.getElementById(BUTTON_ID)) return;

        injectStyles();
        const host = findButtonHost();
        if (!host || !host.parentElement) return;

        host.insertAdjacentElement("afterend", createButton());
    }

    function scanLatestPreview() {
        state.scanScheduled = false;
        if ((!state.visible && !state.nativePipOpen && !state.fallbackPanelOpen) || !state.followLatest) return;

        const latestImage = findLatestPreviewImage();
        const src = getImageSrc(latestImage);
        if (src) setFloatingImage(src, latestImage.alt || latestImage.title || "Mini Preview SD", latestImage, true);
    }

    function schedulePreviewScan() {
        ensureButton();
        if (state.scanScheduled) return;

        state.scanScheduled = true;
        window.setTimeout(scanLatestPreview, 250);
    }

    function initialize() {
        injectStyles();
        ensureButton();
        ensurePanel();

        document.addEventListener("contextmenu", onContextMenu, true);
        document.addEventListener("click", hideMenu, true);
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") hideMenu();
        });

        state.mutationObserver = new MutationObserver(schedulePreviewScan);
        state.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["src"],
        });

        setInterval(scanLatestPreview, 1000);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
}());
