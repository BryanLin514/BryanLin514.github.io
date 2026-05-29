const galleryList = document.querySelector("#gallery-list");
const statusBox = document.querySelector("#status");
const titleEl = document.querySelector("#artwork-title");
const zoomInButton = document.querySelector("#zoom-in");
const zoomOutButton = document.querySelector("#zoom-out");
const zoomSlider = document.querySelector("#zoom-slider");

let gallery = [];
let activeSlug = "";
let viewer;
let isSliderChanging = false;

const text = {
  loadingArtwork: "\u8f09\u5165\u5716\u78da\u4e2d",
  osdMissing: "OpenSeadragon \u8f09\u5165\u5931\u6557\uff0c\u8acb\u78ba\u8a8d vendor \u6a94\u6848\u662f\u5426\u5b58\u5728\u3002",
  missingGallery: "\u627e\u4e0d\u5230 gallery.json\uff0c\u8acb\u5148\u57f7\u884c\u5efa\u7f6e\u8173\u672c\u3002",
  emptyGallery: "\u5c1a\u672a\u7522\u751f\u4efb\u4f55\u4f5c\u54c1\uff0c\u8acb\u628a\u7167\u7247\u653e\u5165\u4f86\u6e90\u8cc7\u6599\u593e\u5f8c\u57f7\u884c\u5efa\u7f6e\u8173\u672c\u3002",
  loadFailed: "\u7db2\u7ad9\u8f09\u5165\u5931\u6557\uff0c\u8acb\u6aa2\u67e5 gallery.json \u8207 tiles\u3002"
};

document.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("dragstart", (event) => event.preventDefault());

function setStatus(message) {
  statusBox.textContent = message;
  statusBox.classList.toggle("is-hidden", !message);
}

function getInitialSlug() {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  if (hash) return hash;
  return gallery[0]?.slug ?? "";
}

function updateInfo(item) {
  titleEl.textContent = item.title;
  document.title = `${item.title} | Mineral Moon Gallery`;
}

function renderGallery() {
  galleryList.replaceChildren();

  for (const item of gallery) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-item";
    button.dataset.slug = item.slug;

    const image = document.createElement("img");
    image.src = item.thumbnail;
    image.alt = "";

    const label = document.createElement("span");
    const title = document.createElement("strong");
    const dimensions = document.createElement("span");
    title.textContent = item.title;
    dimensions.textContent = `${item.width} x ${item.height}px`;
    label.append(title, dimensions);

    button.append(image, label);
    button.addEventListener("click", () => openArtwork(item.slug, true));
    galleryList.append(button);
  }
}

function markActive() {
  for (const item of galleryList.querySelectorAll(".gallery-item")) {
    item.classList.toggle("is-active", item.dataset.slug === activeSlug);
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getZoomBounds() {
  if (!viewer || !viewer.viewport) return { min: 0, max: 1 };
  const min = viewer.viewport.getMinZoom();
  const max = viewer.viewport.maxZoom || viewer.viewport.getMaxZoom();
  return { min, max: Math.max(min, max) };
}

function syncZoomControl() {
  if (!viewer || isSliderChanging) return;
  const { min, max } = getZoomBounds();
  const current = viewer.viewport.getZoom(true);
  const ratio = max === min ? 0 : (current - min) / (max - min);
  zoomSlider.value = Math.round(clamp(ratio, 0, 1) * 1000);
}

function zoomToSliderValue() {
  if (!viewer) return;
  const { min, max } = getZoomBounds();
  const ratio = Number(zoomSlider.value) / 1000;
  const nextZoom = min + (max - min) * ratio;
  viewer.viewport.zoomTo(nextZoom, viewer.viewport.getCenter(true), false);
  viewer.viewport.applyConstraints(false);
}

function zoomBy(factor) {
  if (!viewer) return;
  const { min, max } = getZoomBounds();
  const current = viewer.viewport.getZoom(true);
  const nextZoom = clamp(current * factor, min, max);
  viewer.viewport.zoomTo(nextZoom, viewer.viewport.getCenter(true), false);
  viewer.viewport.applyConstraints(false);
  syncZoomControl();
}

function openArtwork(slug, pushHash = false) {
  const item = gallery.find((entry) => entry.slug === slug) ?? gallery[0];
  if (!item || !viewer) return;

  activeSlug = item.slug;
  updateInfo(item);
  markActive();
  setStatus(text.loadingArtwork);

  viewer.open(item.dzi);

  if (pushHash) {
    history.replaceState(null, "", `#${encodeURIComponent(item.slug)}`);
  }
}

function initViewer() {
  viewer = OpenSeadragon({
    id: "viewer",
    prefixUrl: "vendor/openseadragon/images/",
    showNavigationControl: false,
    showHomeControl: false,
    showFullPageControl: false,
    showZoomControl: false,
    animationTime: 0.65,
    blendTime: 0.08,
    homeFillsViewer: false,
    constrainDuringPan: true,
    visibilityRatio: 1,
    minZoomImageRatio: 0.85,
    maxZoomPixelRatio: 1,
    preserveViewport: false,
    gestureSettingsMouse: {
      clickToZoom: false,
      dblClickToZoom: true,
      dragToPan: true,
      scrollToZoom: true
    },
    gestureSettingsTouch: {
      pinchToZoom: true,
      flickEnabled: true,
      dragToPan: true
    }
  });

  viewer.addHandler("open", () => {
    const tiledImage = viewer.world.getItemAt(0);
    viewer.viewport.maxZoom = tiledImage.imageToViewportZoom(1);
    viewer.viewport.goHome(true);
    syncZoomControl();
    setStatus("");
  });

  viewer.addHandler("zoom", syncZoomControl);
  viewer.addHandler("animation", syncZoomControl);

  window.moonViewer = viewer;
}

zoomInButton.addEventListener("click", () => zoomBy(1.28));
zoomOutButton.addEventListener("click", () => zoomBy(1 / 1.28));
zoomSlider.addEventListener("input", () => {
  isSliderChanging = true;
  zoomToSliderValue();
  isSliderChanging = false;
});

async function boot() {
  if (!window.OpenSeadragon) {
    setStatus(text.osdMissing);
    return;
  }

  const response = await fetch("gallery.json", { cache: "no-store" });
  if (!response.ok) {
    setStatus(text.missingGallery);
    return;
  }

  const data = await response.json();
  gallery = data.items ?? [];
  if (!gallery.length) {
    setStatus(text.emptyGallery);
    return;
  }

  renderGallery();
  initViewer();
  openArtwork(getInitialSlug(), false);
}

window.addEventListener("hashchange", () => openArtwork(getInitialSlug(), false));

boot().catch((error) => {
  console.error(error);
  setStatus(text.loadFailed);
});
