// =======================
// KONFIGURATION
// =======================

// Dateipfade anpassen!
const soundConfig = [
  {
    id: 0,
    color: [255, 0, 0, 100], // Rot
    samples: {
      outer: ["audio/p1_out_1.mp3", "audio/p1_out_2.mp3", "audio/p1_out_3.mp3"],
      inner: ["audio/p1_in_1.mp3", "audio/p1_in_2.mp3", "audio/p1_in_3.mp3"],
      center: "audio/p1_center.mp3"
    }
  },
  {
    id: 1,
    color: [0, 255, 0, 100], // Grün
    samples: {
      outer: ["audio/p2_out_1.mp3", "audio/p2_out_2.mp3", "audio/p2_out_3.mp3"],
      inner: ["audio/p2_in_1.mp3", "audio/p2_in_2.mp3", "audio/p2_in_3.mp3"],
      center: "audio/p2_center.mp3"
    }
  },
  {
    id: 2,
    color: [0, 0, 255, 100], // Blau
    samples: {
      outer: ["audio/p3_out_1.mp3", "audio/p3_out_2.mp3", "audio/p3_out_3.mp3"],
      inner: ["audio/p3_in_1.mp3", "audio/p3_in_2.mp3", "audio/p3_in_3.mp3"],
      center: "audio/p3_center.mp3"
    }
  }
];

// Distanz-Einstellungen (Meter)
const DIST_MAX = 150;      // Ab hier beginnt Sound
const DIST_CROSSFADE = 40; // Hier Übergang Outer -> Inner
const DIST_CENTER = 8;     // Zentrum

// Variablen
let soundSpots = [];
let currentLat = 0, currentLon = 0;
let hasGPS = false;
let audioStarted = false;
let startBtn, randomizeBtn;

// =======================
// KLASSE: SOUNDSPOT (Vereinfacht)
// =======================
class SoundSpot {
  constructor(config) {
    this.color = config.color;
    this.lat = 0;
    this.lon = 0;
    this.active = false;
    this.distance = 9999;
    
    // --- AUDIO SETUP ---
    // Wir erstellen Gruppen-Gains statt Einzel-Gains
    this.groupGains = {
      outer: new Tone.Gain(0).toDestination(),
      inner: new Tone.Gain(0).toDestination(),
      center: new Tone.Gain(1).toDestination() // Center ist one-shot, Gain bleibt offen
    };

    // Players laden und in die Gruppen routen
    this.players = { outer: [], inner: [], center: null };

    // Outer Loops -> Outer Group Gain
    config.samples.outer.forEach(url => {
      // Loop aktiviert, autostart, volume 0 (wird über Group Gain geregelt)
      const p = new Tone.Player({ url: url, loop: true, fadeOut: 0.5 }).start();
      p.connect(this.groupGains.outer);
      this.players.outer.push(p);
    });

    // Inner Loops -> Inner Group Gain
    config.samples.inner.forEach(url => {
      const p = new Tone.Player({ url: url, loop: true, fadeOut: 0.5 }).start();
      p.connect(this.groupGains.inner);
      this.players.inner.push(p);
    });

    // Center -> Direkt raus
    this.players.center = new Tone.Player({ url: config.samples.center, loop: false }).toDestination();
    
    this.centerTriggered = false;
  }

  setCoordinates(lat, lon) {
    this.lat = lat;
    this.lon = lon;
    this.active = true;
  }

  update(userLat, userLon) {
    if (!this.active || !audioStarted) return;

    this.distance = calcGeoDistance(userLat, userLon, this.lat, this.lon);
    
    // === VEREINFACHTE LOGIK ===
    
    // 1. Zu weit weg? Alles aus.
    if (this.distance > DIST_MAX) {
      this.groupGains.outer.gain.rampTo(0, 0.5);
      this.groupGains.inner.gain.rampTo(0, 0.5);
      return;
    }

    // 2. Bereich "OUTER" (Zwischen 40m und 150m)
    if (this.distance > DIST_CROSSFADE) {
      // Mapping: Bei 150m = 0 Lautstärke, bei 40m = 1 Lautstärke
      let vol = map(this.distance, DIST_MAX, DIST_CROSSFADE, 0, 1, true);
      
      this.groupGains.outer.gain.rampTo(vol, 0.1); // Outer wird lauter je näher
      this.groupGains.inner.gain.rampTo(0, 0.1);   // Inner ist stumm
      this.centerTriggered = false; // Reset Center
    }
    
    // 3. Bereich "INNER" (Unter 40m)
    else {
      // Mapping: Bei 40m = 0 (für Inner), bei 8m = 1
      // Hier machen wir einen Crossfade: Outer geht weg, Inner kommt.
      
      let innerVol = map(this.distance, DIST_CROSSFADE, DIST_CENTER, 0, 1, true);
      let outerVol = 1 - innerVol; // Gegensätzlich
      
      this.groupGains.outer.gain.rampTo(outerVol, 0.1);
      this.groupGains.inner.gain.rampTo(innerVol, 0.1);
      
      // Center Trigger (< 8m)
      if (this.distance < DIST_CENTER && !this.centerTriggered) {
        this.players.center.start();
        this.centerTriggered = true;
        if (navigator.vibrate) navigator.vibrate(200);
      }
    }
  }

  draw() {
    if (!this.active) return;
    // Visuelle Darstellung:
    // Distanz bestimmt Größe. 
    // Wir begrenzen die visuelle Größe, damit der Screen nicht explodiert.
    let visualSize = map(this.distance, 0, DIST_MAX, windowWidth, 20, true);
    
    noStroke();
    fill(this.color);
    ellipse(width/2, height/2, visualSize);
  }
}

// =======================
// P5 SETUP & LOOP
// =======================

function setup() {
  createCanvas(windowWidth, windowHeight);
  textAlign(CENTER, CENTER);

  // Spots initialisieren
  soundConfig.forEach(conf => {
    soundSpots.push(new SoundSpot(conf));
  });

  // UI
  startBtn = createButton('Start Audio & GPS');
  styleButton(startBtn, height - 100);
  startBtn.mousePressed(startSystem);

  randomizeBtn = createButton('Neue Punkte würfeln');
  styleButton(randomizeBtn, height - 180);
  randomizeBtn.mousePressed(setRandomPoints);
  randomizeBtn.hide();

  // GPS Setup
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      pos => {
        currentLat = pos.coords.latitude;
        currentLon = pos.coords.longitude;
        hasGPS = true;
        soundSpots.forEach(s => s.update(currentLat, currentLon));
      },
      err => console.warn(err),
      { enableHighAccuracy: true, maximumAge: 0 }
    );
  }
}

function draw() {
  background(240);

  if (!audioStarted) {
    fill(0); textSize(16);
    text("Klicke Start für Sound", width/2, height/2);
    return;
  }

  // Sortieren: Größte Kreise (kleinste Distanz) zuerst zeichnen?
  // User Wunsch: "äußerster Rand soll zeigen, welchem ich am nächsten bin."
  // -> Das bedeutet, der größte Kreis muss HINTEN liegen, damit der Rand sichtbar ist?
  // Wenn Grün (nah/groß) über Rot (weit/klein) liegt, verdeckt Grün alles.
  // Damit man beide sieht, muss der kleine Rote VOR dem großen Grünen liegen.
  // Also: Zeichne von NAH (groß) nach WEIT (klein).
  // Array kopieren und sortieren nach Distanz (aufsteigend) -> 
  // [0] ist nah (groß), [end] ist weit (klein).
  
  let sorted = [...soundSpots].sort((a, b) => a.distance - b.distance);
  
  // Aber p5 malt wie ein Maler: Was zuerst gemalt wird, liegt UNTEN.
  // Wir wollen Groß UNTEN, Klein OBEN.
  // Also erst den Nahen malen.
  
  sorted.forEach(spot => spot.draw());
  
  // Spieler Punkt
  fill(0); circle(width/2, height/2, 8);
}

// =======================
// HELFER
// =======================

async function startSystem() {
  await Tone.start();
  audioStarted = true;
  startBtn.hide();
  randomizeBtn.show();
}

function setRandomPoints() {
  if (!hasGPS) return;
  
  // Punkte im Dreieck um den Spieler anordnen
  let dist = 100; // Meter
  for(let i=0; i<3; i++) {
    let angle = i * 120 + random(-10, 10);
    let newPos = movePoint(currentLat, currentLon, dist, angle);
    soundSpots[i].setCoordinates(newPos.lat, newPos.lon);
  }
}

function styleButton(btn, yPos) {
  btn.position(width/2 - 100, yPos);
  btn.size(200, 50);
  btn.style("background", "white");
  btn.style("border", "1px solid black");
  btn.style("font-size", "16px");
}

// Mathe Magie (Haversine & Destination Point)
function calcGeoDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; 
  const p1 = lat1 * Math.PI/180; const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180; const dl = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dp/2)*Math.sin(dp/2) + Math.cos(p1)*Math.cos(p2) * Math.sin(dl/2)*Math.sin(dl/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function movePoint(lat, lon, dist, brngDeg) {
  const R = 6371e3;
  const brng = brngDeg * Math.PI/180;
  const lat1 = lat * Math.PI/180, lon1 = lon * Math.PI/180;
  let lat2 = Math.asin(Math.sin(lat1)*Math.cos(dist/R) + Math.cos(lat1)*Math.sin(dist/R)*Math.cos(brng));
  let lon2 = lon1 + Math.atan2(Math.sin(brng)*Math.sin(dist/R)*Math.cos(lat1), Math.cos(dist/R)-Math.sin(lat1)*Math.sin(lat2));
  return { lat: lat2*180/Math.PI, lon: lon2*180/Math.PI };
}
