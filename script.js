const NUM_TRACKS = 7;
const ACTIVE_TRACKS = 2;
const MIN_ACTIVE = 1;
const MAX_ACTIVE = 4;
const FADE_DURATION = 4000;
const RESYNC_INTERVAL = 30000; // Re-sync (not working now)

let swapInterval = 20000;

let context;
let buffers = [];
let sources = [];
let gains = [];
let activeIndices = [];
let startTime = 0;
let swapTimer, resyncTimer;
let loopPoint = 0;
let isPlaying = false;
let baseName = "music";
let progressInterval;

async function loadTracks(name) {
  const promises = [];
  const failed = [];

  for (let i = 1; i <= NUM_TRACKS; i++) {
    const url = `musics/${name}${i}.ogg`;
    promises.push(
      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error(`Faixa ${i} não encontrada`);
          return res.arrayBuffer();
        })
        .catch(err => {
          failed.push(i);
          return null;
        })
    );
  }

  const arrayBuffers = await Promise.all(promises);

  if (failed.length > 0) {
    throw new Error("Músicas não encontradas: " + failed.map(i => `${name}${i}.ogg`).join(", "));
  }

  buffers = await Promise.all(
    arrayBuffers.map((b, i) =>
      b ? context.decodeAudioData(b) : null
    )
  );
}


function createSources(offset = 0) {
  sources = [];
  gains = [];

  for (let i = 0; i < NUM_TRACKS; i++) {
    const source = context.createBufferSource();
    const gain = context.createGain();

    source.buffer = buffers[i];
    source.loop = true;
    source.loopStart = loopPoint;
    source.loopEnd = buffers[i].duration;

    source.connect(gain).connect(context.destination);
    sources.push(source);
    gains.push(gain);
  }

  // Volumes
  for (let i = 0; i < NUM_TRACKS; i++) {
    const vol = activeIndices.includes(i) ? 1 : 0;
    gains[i].gain.setValueAtTime(vol, context.currentTime);
    sources[i].start(0, offset);
  }

  startTime = context.currentTime - offset;
}

function randomizeActives() {
  const all = [...Array(NUM_TRACKS).keys()];
  const n = Math.floor(Math.random() * (MAX_ACTIVE - MIN_ACTIVE + 1)) + MIN_ACTIVE;
  activeIndices = [];

  while (activeIndices.length < n && all.length > 0) {
    const pick = all.splice(Math.floor(Math.random() * all.length), 1)[0];
    activeIndices.push(pick);
  }
}

function startSwapTimer() {
  swapTimer = setInterval(() => {
    const current = [...activeIndices];
    const inactive = [...Array(NUM_TRACKS).keys()].filter(i => !activeIndices.includes(i));

    let howManyToRemove = Math.floor(Math.random() * current.length) + 1;
    let howManyToAdd = Math.floor(Math.random() * (NUM_TRACKS - current.length)) + 1;

    // calculates new total with limits
    let newTotal = current.length - howManyToRemove + howManyToAdd;
    if (newTotal > MAX_ACTIVE) {
      howManyToAdd -= newTotal - MAX_ACTIVE;
    }
    if (newTotal < MIN_ACTIVE) {
      howManyToRemove -= MIN_ACTIVE - newTotal;
    }

    // apply removals
    for (let i = 0; i < howManyToRemove; i++) {
      const out = current[Math.floor(Math.random() * current.length)];
      fadeVolume(out, 1, 0, FADE_DURATION);
      activeIndices = activeIndices.filter(id => id !== out);
      current.splice(current.indexOf(out), 1);
    }

    // activate new
    for (let i = 0; i < howManyToAdd; i++) {
      const available = [...Array(NUM_TRACKS).keys()].filter(i => !activeIndices.includes(i));
      if (available.length === 0) break;
      const inn = available[Math.floor(Math.random() * available.length)];
      fadeVolume(inn, 0, 1, FADE_DURATION);
      activeIndices.push(inn);
    }

    updateStatus();
  }, swapInterval);
}

function fadeVolume(index, from, to, duration) {
  const g = gains[index].gain;
  const now = context.currentTime;
  g.setValueAtTime(from, now);
  g.linearRampToValueAtTime(to, now + duration / 1000);
}

function updateStatus() {
  const list = document.getElementById("trackStatus");
  list.innerHTML = "";
  for (let i = 0; i < NUM_TRACKS; i++) {
    const li = document.createElement("li");
    li.textContent = `Track ${i + 1}`;
    li.className = activeIndices.includes(i) ? "active" : "inactive";
    list.appendChild(li);
  }
}

function updateProgressBar() {
  const now = context.currentTime;
  const currentOffset = (now - startTime);
  const duration = buffers[0]?.duration || 1;
  const progress = (currentOffset % duration) / duration;

  const bar = document.getElementById("progressBar");
  if (bar) bar.value = progress * 100;
}

function startProgressTracking() {
  progressInterval = setInterval(updateProgressBar, 100);
}

function stopProgressTracking() {
  clearInterval(progressInterval);
}

async function start() {
  if (isPlaying) return;
  isPlaying = true;

  if (!context) context = new (window.AudioContext)();

  baseName = document.getElementById("baseName").value || "nothing";
  loopPoint = parseFloat(document.getElementById("loopPoint").value || "0");
  swapInterval = parseFloat(document.getElementById("swapInterval").value || "20") * 1000;

  try {
    await loadTracks(baseName);
  } catch (err) {
    alert(err.message);
    isPlaying = false;
    return;
  }

  randomizeActives();
  createSources();
  updateStatus();
  startSwapTimer();
  startProgressTracking();
}

function stop() {
  if (!isPlaying) return;
  isPlaying = false;

  if (swapTimer) clearInterval(swapTimer);
  stopProgressTracking();

  const stopAt = context.currentTime + FADE_DURATION / 1000;

  for (let i = 0; i < sources.length; i++) {
    const g = gains[i].gain;
    g.cancelScheduledValues(context.currentTime);
    g.setValueAtTime(g.value, context.currentTime);
    g.linearRampToValueAtTime(0.0, stopAt);
    sources[i].stop(stopAt);
  }

  sources = [];
  gains = [];
  activeIndices = [];
  setTimeout(updateStatus, FADE_DURATION + 50);
}

// Dark Theme
function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
}

window.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("theme");
  if (saved === "dark") document.body.classList.add("dark");
});