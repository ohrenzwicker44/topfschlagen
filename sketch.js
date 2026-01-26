let EntfernungA, EntfernungB, EntfernungC;
let audioStarted = false;
let mode = 'fix3';
let points = []; 
let userPos = null;
let masterReverb;

let soundSystem = {
  A: { bgGain: null, centerGain: null },
  B: { bgGain: null, centerGain: null },
  C: { bgGain: null, centerGain: null }
};

// Farben wie gehabt
const colors = [[205, 127, 50], [30, 90, 60], [128, 0, 32]];
const config = {
  A: { bg: ["audio/a1.mp3", "audio/a2.mp3", "audio/a3.mp3"], center: "audio/a_center.mp3" },
  B: { bg: ["audio/b1.mp3", "audio/b2.mp3", "audio/b3.mp3"], center: "audio/b_center.mp3" },
  C: { bg: ["audio/c1.mp3", "audio/c2.mp3", "audio/c3.mp3"], center: "audio/c_center.mp3" }
};

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('IBM Plex Sans');
  
  masterReverb = new Tone.Reverb({ decay: 5, wet: 0.3 }).toDestination();
  masterReverb.generate();

  ['A', 'B', 'C'].forEach(k => {
    soundSystem[k].bgGain = new Tone.Gain(0).connect(masterReverb);
    soundSystem[k].centerGain = new Tone.Gain(0).connect(masterReverb);
  });

  navigator.geolocation.watchPosition(pos => {
    userPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    if (points.length === 0 && mode === 'fix3') setPoints();
  }, null, { enableHighAccuracy: true });

  document.getElementById('fix3').onclick = () => { mode = 'fix3'; setPoints(); updateUI(); };
  document.getElementById('var3').onclick = () => { mode = 'var3'; setPoints(); updateUI(); };
}

function draw() {
  background('#F8F8F4');

  if (!audioStarted) { drawStartScreen(); return; }
  if (!userPos || points.length < 3) { renderStatus("Warte auf GPS..."); return; }

  EntfernungA = getDistance(userPos.lat, userPos.lon, points[0].lat, points[0].lon);
  EntfernungB = getDistance(userPos.lat, userPos.lon, points[1].lat, points[1].lon);
  EntfernungC = getDistance(userPos.lat, userPos.lon, points[2].lat, points[2].lon);

  updateAudio();

  // DATEN SORTIEREN: Kleinste Entfernung (Nah) ZUERST zeichnen
  // Dadurch landet der größte Kreis ganz hinten.
  let data = [
    { d: EntfernungA, c: colors[0] },
    { d: EntfernungB, c: colors[1] },
    { d: EntfernungC, c: colors[2] }
  ].sort((a, b) => a.d - b.d); 

  noStroke();
  data.forEach(item => {
    fill(item.c);
    // Skalierung: 
    // 0m Entfernung -> Riesiger Kreis (2x Bildschirmbreite)
    // 200m Entfernung -> Kleiner Kreis (20px)
    let size = map(item.d, 0, 200, width * 2, 20, true);
    ellipse(width / 2, height / 2, size);
  });

  updateFooter();
}

function updateFooter() {
  const elA = document.getElementById('valA');
  const elB = document.getElementById('valB');
  const elC = document.getElementById('valC');

  // Ganzzahlen setzen
  elA.innerText = Math.floor(EntfernungA);
  elB.innerText = Math.floor(EntfernungB);
  elC.innerText = Math.floor(EntfernungC);

  // Farben zuweisen (RGB Format für CSS)
  elA.style.color = `rgb(${colors[0][0]}, ${colors[0][1]}, ${colors[0][2]})`;
  elB.style.color = `rgb(${colors[1][0]}, ${colors[1][1]}, ${colors[1][2]})`;
  elC.style.color = `rgb(${colors[2][0]}, ${colors[2][1]}, ${colors[2][2]})`;
}

// --- GPS & AUDIO LOGIK (Unverändert zum Vorherigen) ---

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function updateAudio() {
  applyVolume(soundSystem.A, EntfernungA);
  applyVolume(soundSystem.B, EntfernungB);
  applyVolume(soundSystem.C, EntfernungC);
}

function applyVolume(sys, d) {
  let bgVol = map(d, 150, 0, -45, 0, true);
  sys.bgGain.gain.rampTo(Tone.dbToGain(bgVol), 0.5);
  let cVol = map(d, 20, 0, -60, 0, true);
  sys.centerGain.gain.rampTo(d > 20 ? 0 : Tone.dbToGain(cVol), 0.5);
}

function setPoints() {
  if (mode === 'fix3') {
    let saved = JSON.parse(localStorage.getItem('gpsPoints'));
    if (saved) points = saved;
  } else if (userPos) {
    points = [];
    for (let i = 0; i < 3; i++) {
      let p, found = false;
      while (!found) {
        p = generateRandomPoint(userPos, 100, 200);
        let tooClose = points.some(other => getDistance(p.lat, p.lon, other.lat, other.lon) < 100);
        if (!tooClose) found = true;
      }
      points.push(p);
    }
  }
}

function generateRandomPoint(center, minD, maxD) {
  const r = random(minD, maxD) / 111320;
  const angle = random(TWO_PI);
  return { lat: center.lat + r * Math.cos(angle), lon: center.lon + (r * Math.sin(angle)) / Math.cos(center.lat * Math.PI / 180) };
}

function mousePressed() { if (!audioStarted) startEverything(); }

async function startEverything() {
  await Tone.start();
  ['A','B','C'].forEach(k => {
    config[k].bg.forEach(u => new Tone.Player({ url: u, loop: true, autostart: true, fadeIn: 3 }).connect(soundSystem[k].bgGain));
    new Tone.Player({ url: config[k].center, loop: true, autostart: true, fadeIn: 1 }).connect(soundSystem[k].centerGain);
  });
  audioStarted = true;
  document.getElementById('hotbar').style.display = 'flex';
  document.getElementById('footer').style.display = 'flex';
}

function drawStartScreen() { 
  fill(50); textAlign(CENTER, CENTER); textSize(16); 
  text("unmute your phone\n& tap to start exploration", width/2, height/2); 
}

function renderStatus(t) { fill(50); textAlign(CENTER); text(t, width/2, height/2); }

function updateUI() {
  document.getElementById('fix3').classList.toggle('active', mode === 'fix3');
  document.getElementById('var3').classList.toggle('active', mode === 'var3');
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
