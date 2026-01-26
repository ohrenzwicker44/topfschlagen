let EntfernungA, EntfernungB, EntfernungC;
let audioStarted = false;
let mode = 'fix3';
let points = []; 
let userPos = null;

let soundSystem = { A: { bgGain: null, centerGain: null }, B: { bgGain: null, centerGain: null }, C: { bgGain: null, centerGain: null } };
let masterReverb;
const colors = [[205, 127, 50], [30, 90, 60], [128, 0, 32]];

// Konfiguration (Pfade wie gehabt)
const config = {
  A: { bg: ["audio/a1.mp3", "audio/a2.mp3", "audio/a3.mp3"], center: "audio/a_center.mp3" },
  B: { bg: ["audio/b1.mp3", "audio/b2.mp3", "audio/b3.mp3"], center: "audio/b_center.mp3" },
  C: { bg: ["audio/c1.mp3", "audio/c2.mp3", "audio/c3.mp3"], center: "audio/c_center.mp3" }
};

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('IBM Plex Sans');
  
  masterReverb = new Tone.Reverb({ decay: 4, wet: 0.4 }).toDestination();
  masterReverb.generate();

  ['A', 'B', 'C'].forEach(key => {
    soundSystem[key].bgGain = new Tone.Gain(0).connect(masterReverb);
    soundSystem[key].centerGain = new Tone.Gain(0).connect(masterReverb);
  });

  // GPS Tracking starten
  navigator.geolocation.watchPosition(pos => {
    userPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    if (mode === 'fix3') setPoints(); // Nur bei fix3 Punkte laden, falls noch nicht geschehen
  }, err => console.error(err), { enableHighAccuracy: true });

  document.getElementById('fix3').onclick = () => { mode = 'fix3'; setPoints(); updateUI(); };
  document.getElementById('var3').onclick = () => { mode = 'var3'; setPoints(); updateUI(); };
}

function draw() {
  background('#F8F8F4');

  if (!audioStarted) {
    drawStartScreen();
    return; 
  }

  if (!userPos || points.length < 3) {
    fill(50); textAlign(CENTER); text("Warte auf GPS Signal...", width/2, height/2);
    return;
  }

  // Abstände in METERN berechnen
  EntfernungA = getDistance(userPos.lat, userPos.lon, points[0].lat, points[0].lon);
  EntfernungB = getDistance(userPos.lat, userPos.lon, points[1].lat, points[1].lon);
  EntfernungC = getDistance(userPos.lat, userPos.lon, points[2].lat, points[2].lon);

  updateAudio();

  // Visualisierung (Wir skalieren die Meter für das Display um)
  let data = [
    { d: EntfernungA, c: colors[0] },
    { d: EntfernungB, c: colors[1] },
    { d: EntfernungC, c: colors[2] }
  ].sort((a, b) => b.d - a.d);

  noStroke();
  data.forEach(item => {
    fill(item.c);
    // 100m Entfernung wird hier als halbe Bildschirmbreite dargestellt
    let displaySize = map(item.d, 0, 150, width * 0.8, 10, true);
    ellipse(width / 2, height / 2, displaySize);
  });
}

function setPoints() {
  if (mode === 'fix3') {
    let saved = JSON.parse(localStorage.getItem('gpsPoints'));
    if (saved) points = saved;
  } else if (mode === 'var3' && userPos) {
    points = [];
    for (let i = 0; i < 3; i++) {
      let found = false;
      let p, attempts = 0;
      while (!found && attempts < 100) {
        p = generateRandomPoint(userPos, 100, 200);
        let tooClose = false;
        for (let other of points) {
          if (getDistance(p.lat, p.lon, other.lat, other.lon) < 100) tooClose = true;
        }
        if (!tooClose) found = true;
        attempts++;
      }
      points.push(p);
    }
  }
}

// --- GPS MATH ---

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Erde Radius in Metern
  const dLat = (lat2 - lat1) * PI / 180;
  const dLon = (lon2 - lon1) * PI / 180;
  const a = sin(dLat/2) * sin(dLat/2) + cos(lat1 * PI / 180) * cos(lat2 * PI / 180) * sin(dLon/2) * sin(dLon/2);
  const c = 2 * atan2(sqrt(a), sqrt(1-a));
  return R * c; 
}

function generateRandomPoint(center, minD, maxD) {
  const r = random(minD, maxD) / 111320; // Meter in Grad umrechnen (grob)
  const angle = random(TWO_PI);
  return {
    lat: center.lat + r * cos(angle),
    lon: center.lon + (r * sin(angle)) / cos(center.lat * PI / 180)
  };
}

function updateAudio() {
  // Wir passen die Meter-Werte für die Lautstärke an
  // Ab 100m leise (-40dB), bei 0m laut (0dB)
  applyVolume(soundSystem.A, EntfernungA);
  applyVolume(soundSystem.B, EntfernungB);
  applyVolume(soundSystem.C, EntfernungC);
}

function applyVolume(system, d) {
  let bgVol = map(d, 100, 0, -40, 0, true);
  system.bgGain.gain.rampTo(Tone.dbToGain(bgVol), 0.5);

  let centerVol = map(d, 15, 0, -60, 0, true); // Center Sound ab 15 Metern
  system.centerGain.gain.rampTo(d > 15 ? 0 : Tone.dbToGain(centerVol), 0.5);
}

// --- RESTLICHE HELFER (StartScreen, mousePressed, loadSpot wie zuvor) ---
function mousePressed() { if (!audioStarted) startEverything(); }
async function startEverything() { 
    await Tone.start(); 
    ['A','B','C'].forEach(k => loadSpot(k)); 
    audioStarted = true; 
    document.getElementById('hotbar').style.display = 'flex'; 
}
function loadSpot(key) {
  config[key].bg.forEach(url => new Tone.Player({ url, loop: true, autostart: true, fadeIn: 2 }).connect(soundSystem[key].bgGain));
  new Tone.Player({ url: config[key].center, loop: true, autostart: true, fadeIn: 0.5 }).connect(soundSystem[key].centerGain);
}
function drawStartScreen() { fill(50); textAlign(CENTER, CENTER); textSize(18); text("unmute your phone\nand press anywhere to start", width / 2, height / 2); }
function updateUI() {
  document.getElementById('fix3').classList.toggle('active', mode === 'fix3');
  document.getElementById('var3').classList.toggle('active', mode === 'var3');
}
