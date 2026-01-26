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

const colors = [[205, 127, 50], [30, 90, 60], [128, 0, 32]];
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

  ['A', 'B', 'C'].forEach(k => {
    soundSystem[k].bgGain = new Tone.Gain(0).connect(masterReverb);
    soundSystem[k].centerGain = new Tone.Gain(0).connect(masterReverb);
  });

  navigator.geolocation.watchPosition(pos => {
    userPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    // Initialisierung der Punkte, sobald GPS verfügbar ist
    if (points.length === 0) setPoints();
  }, null, { enableHighAccuracy: true });

  document.getElementById('fix3').onclick = () => { mode = 'fix3'; setPoints(); updateUI(); };
  document.getElementById('var3').onclick = () => { mode = 'var3'; setPoints(); updateUI(); };
}

function draw() {
  background('#F8F8F4');

  if (!audioStarted) { drawStartScreen(); return; }
  if (!userPos || points.length < 3) { renderStatus("Warte auf GPS..."); return; }

  // Distanzen berechnen
  EntfernungA = getDistance(userPos.lat, userPos.lon, points[0].lat, points[0].lon);
  EntfernungB = getDistance(userPos.lat, userPos.lon, points[1].lat, points[1].lon);
  EntfernungC = getDistance(userPos.lat, userPos.lon, points[2].lat, points[2].lon);

  updateAudio();

  // Daten für Visualisierung aufbereiten
  let data = [
    { d: EntfernungA, c: colors[0], label: 'A' },
    { d: EntfernungB, c: colors[1], label: 'B' },
    { d: EntfernungC, c: colors[2], label: 'C' }
  ];

  // LOGIK: Größter Kreis oben.
  // "Näher dran" bedeutet "Größerer Kreis".
  // Damit der größte oben liegt, muss er ZULETZT gezeichnet werden.
  // Wir sortieren also von WEIT ENTFERNT (klein) nach NAH DRAN (groß).
  data.sort((a, b) => b.d - a.d); 

  noStroke();
  data.forEach(item => {
    fill(item.c);
    // 200m = 10px, 0m = 80% Bildschirmbreite
    let size = map(item.d, 200, 0, 10, width * 0.8, true);
    ellipse(width / 2, height / 2, size);
    
    // Optional: Distanz-Text anzeigen
    fill(255);
    textAlign(CENTER);
    if (size > 40) text(floor(item.d) + "m", width/2, height/2 + (data.indexOf(item)*15));
  });
}

function updateAudio() {
  applyVolume(soundSystem.A, EntfernungA);
  applyVolume(soundSystem.B, EntfernungB);
  applyVolume(soundSystem.C, EntfernungC);
}

function applyVolume(sys, d) {
  // Lauter werden beim Annähern (150m: -40dB, 0m: 0dB)
  let bgVol = map(d, 150, 0, -40, 0, true);
  sys.bgGain.gain.rampTo(Tone.dbToGain(bgVol), 0.5);
  
  // Center Sound nur ganz nah (20m)
  let cVol = map(d, 20, 0, -60, 0, true);
  sys.centerGain.gain.rampTo(d > 20 ? 0 : Tone.dbToGain(cVol), 0.5);
}

function setPoints() {
  if (!userPos) return;
  points = [];

  if (mode === 'fix3') {
    let saved = JSON.parse(localStorage.getItem('gpsPoints'));
    if (saved) {
        points = saved;
    } else {
        // Fallback falls nichts gespeichert: 3 Punkte in der Nähe generieren
        for(let i=0; i<3; i++) points.push(generateRandomPoint(userPos, 50, 100));
    }
  } else {
    // VAR3 Modus: Randomisierung mit Abstandsregeln
    for (let i = 0; i < 3; i++) {
      let p, found = false;
      let attempts = 0;
      while (!found && attempts < 500) {
        p = generateRandomPoint(userPos, 100, 200); // 100-200m von User
        
        // Prüfen, ob Punkt zu nah an bereits generierten Punkten (min 100m)
        let tooCloseToOthers = points.some(other => 
          getDistance(p.lat, p.lon, other.lat, other.lon) < 100
        );
        
        if (!tooCloseToOthers) found = true;
        attempts++;
      }
      points.push(p);
    }
  }
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * PI / 180;
  const dLon = (lon2 - lon1) * PI / 180;
  const a = sin(dLat/2)**2 + cos(lat1*PI/180) * cos(lat2*PI/180) * sin(dLon/2)**2;
  return R * 2 * atan2(sqrt(a), sqrt(1-a));
}

function generateRandomPoint(center, minD, maxD) {
  const r = random(minD, maxD) / 111320; // Umrechnung Meter in Grad (ungefähr)
  const angle = random(TWO_PI);
  return { 
    lat: center.lat + r * cos(angle), 
    lon: center.lon + (r * sin(angle)) / cos(center.lat * PI / 180) 
  };
}

// ... Restliche Hilfsfunktionen (mousePressed, startEverything, etc.) bleiben gleich ...
