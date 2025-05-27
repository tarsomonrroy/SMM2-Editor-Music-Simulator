const NUM_TRACKS = 7;
const ACTIVE_TRACKS = 2;
const SWAP_INTERVAL = 20000;
const FADE_DURATION = 2000;
const RESYNC_INTERVAL = 30000; // Re-sync a cada 30 segundos

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
  for (let i = 1; i <= NUM_TRACKS; i++) {
    const url = `musics/${name}${i}.ogg`;
    promises.push(fetch(url).then(r => r.arrayBuffer()));
  }
  const arrayBuffers = await Promise.all(promises);
  buffers = await Promise.all(arrayBuffers.map(b => context.decodeAudioData(b)));
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
  activeIndices = [];
  while (activeIndices.length < ACTIVE_TRACKS) {
    const pick = all.splice(Math.floor(Math.random() * all.length), 1)[0];
    activeIndices.push(pick);
  }
}

function startSwapTimer() {
  swapTimer = setInterval(() => {
    const inactive = [];
    for (let i = 0; i < NUM_TRACKS; i++) {
      if (!activeIndices.includes(i)) inactive.push(i);
    }
    if (inactive.length === 0) return;

    const out = activeIndices[Math.floor(Math.random() * activeIndices.length)];
    const inn = inactive[Math.floor(Math.random() * inactive.length)];

    fadeVolume(out, 1, 0, FADE_DURATION);
    fadeVolume(inn, 0, 1, FADE_DURATION);

    activeIndices = activeIndices.filter(i => i !== out);
    activeIndices.push(inn);

    updateStatus();
  }, SWAP_INTERVAL);
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

  if (!context) context = new (window.AudioContext || window.webkitAudioContext)();

  baseName = document.getElementById("baseName").value || "music";
  loopPoint = parseFloat(document.getElementById("loopPoint").value || "4");

  await loadTracks(baseName);
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
