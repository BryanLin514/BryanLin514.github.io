const galleryList = document.querySelector("#gallery-list");
const statusBox = document.querySelector("#status");
const titleEl = document.querySelector("#artwork-title");
const equipmentEl = document.querySelector("#artwork-equipment");

let gallery = [];
let activeSlug = "";
let viewer;

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
  equipmentEl.textContent = `拍攝器材：${item.equipment}`;
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

function openArtwork(slug, pushHash = false) {
  const item = gallery.find((entry) => entry.slug === slug) ?? gallery[0];
  if (!item || !viewer) return;

  activeSlug = item.slug;
  updateInfo(item);
  markActive();
  setStatus("載入圖磚中");

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
    setStatus("");
  });

  window.moonViewer = viewer;
}

async function boot() {
  if (!window.OpenSeadragon) {
    setStatus("OpenSeadragon 載入失敗，請確認 vendor 檔案是否存在。");
    return;
  }

  const response = await fetch("gallery.json", { cache: "no-store" });
  if (!response.ok) {
    setStatus("找不到 gallery.json，請先執行建置腳本。");
    return;
  }

  const data = await response.json();
  gallery = data.items ?? [];
  if (!gallery.length) {
    setStatus("尚未產生任何作品，請把照片放入 source-images 後執行建置腳本。");
    return;
  }

  renderGallery();
  initViewer();
  openArtwork(getInitialSlug(), false);
}

window.addEventListener("hashchange", () => openArtwork(getInitialSlug(), false));

boot().catch((error) => {
  console.error(error);
  setStatus("網站載入失敗，請檢查 gallery.json 與 tiles。");
});
