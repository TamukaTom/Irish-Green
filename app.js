const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

const stateVal = document.getElementById('state-val');
const angleVal = document.getElementById('angle-val');
const feedbackVal = document.getElementById('feedback-val');
const totalShotsVal = document.getElementById('total-shots-val');
const formScoreVal = document.getElementById('form-score-val');
const statusBadge = document.getElementById('status-badge');
const btnToggle = document.getElementById('btn-toggle');
const btnClearHistory = document.getElementById('btn-clear-history');
const historyList = document.getElementById('history-list');

// Session State
let isTrackingActive = false;
let totalShots = 0;
let goodShots = 0;
let isDipping = false;

// Visual Model Variables
let objectModel = null;
let isDetecting = false;
let frameCounter = 0;
let lastBallBbox = null;
let ballTrail = [];
const MAX_TRAIL_POINTS = 20;

// Initialize Session History on Page Load
loadHistoryFromStorage();

// Load COCO-SSD Model
cocoSsd.load().then((loadedModel) => {
  objectModel = loadedModel;
  statusBadge.innerText = "Standby";
  feedbackVal.innerText = "Tap 'Start Tracking' to begin...";
  btnToggle.innerText = "▶ Start Tracking";
  btnToggle.disabled = false;
}).catch((err) => {
  statusBadge.innerText = "Pose Only";
  btnToggle.innerText = "▶ Start Tracking";
  btnToggle.disabled = false;
});

// Start / Save Session Button Handler
btnToggle.addEventListener('click', () => {
  if (!isTrackingActive) {
    // START SESSION
    isTrackingActive = true;
    totalShots = 0;
    goodShots = 0;
    isDipping = false;
    ballTrail = [];
    lastBallBbox = null;

    totalShotsVal.innerText = "0";
    formScoreVal.innerText = "0%";
    statusBadge.innerText = "Tracking Active";
    statusBadge.classList.add('active');

    btnToggle.innerText = "💾 Save & End Session";
    btnToggle.className = "btn-reset";

    speakFeedback("Tracking started");
  } else {
    // END & SAVE SESSION
    if (totalShots > 0) {
      saveSessionToStorage(totalShots, goodShots);
    }

    isTrackingActive = false;
    totalShots = 0;
    goodShots = 0;
    isDipping = false;
    ballTrail = [];
    lastBallBbox = null;

    totalShotsVal.innerText = "0";
    formScoreVal.innerText = "0%";
    stateVal.innerText = "IDLE";
    stateVal.style.color = "#00e676";
    statusBadge.innerText = "Standby";
    statusBadge.classList.remove('active');
    feedbackVal.innerText = "Session saved! Tap 'Start Tracking' to begin new workout.";

    btnToggle.innerText = "▶ Start Tracking";
    btnToggle.className = "btn-start";

    speakFeedback("Session saved");
  }
});

// Clear History Handler
btnClearHistory.addEventListener('click', () => {
  localStorage.removeItem('shot_analyzer_history');
  loadHistoryFromStorage();
});

// LocalStorage Helper Functions
function saveSessionToStorage(shots, good) {
  const accuracy = Math.round((good / shots) * 100);
  const now = new Date();
  
  const newEntry = {
    date: `${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`,
    total: shots,
    accuracy: accuracy
  };

  let history = JSON.parse(localStorage.getItem('shot_analyzer_history')) || [];
  history.unshift(newEntry);
  if (history.length > 10) history.pop(); // Keep 10 most recent

  localStorage.setItem('shot_analyzer_history', JSON.stringify(history));
  loadHistoryFromStorage();
}

function loadHistoryFromStorage() {
  const history = JSON.parse(localStorage.getItem('shot_analyzer_history')) || [];
  
  if (history.length === 0) {
    historyList.innerHTML = `<div class="history-empty">No workouts recorded yet.</div>`;
    return;
  }

  historyList.innerHTML = history.map(item => `
    <div class="history-item">
      <span class="history-date">${item.date}</span>
      <span>${item.total} Reps</span>
      <span class="history-score">${item.accuracy}% Form</span>
    </div>
  `).join('');
}

function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  return angle > 180.0 ? 360.0 - angle : angle;
}

function speakFeedback(text) {
  if ('speechSynthesis' in window && !window.speechSynthesis.speaking) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }
}

async function runThrottledBallDetection() {
  if (!objectModel || isDetecting || !videoElement.videoWidth) return;
  
  isDetecting = true;
  try {
    const predictions = await objectModel.detect(videoElement);
    const ball = predictions.find(p => p.class === 'sports ball' || p.class === 'ball');

    if (ball) {
      const [x, y, w, h] = ball.bbox;
      lastBallBbox = { x, y, w, h, score: ball.score };
      ballTrail.push({ x: x + w / 2, y: y + h / 2 });
      if (ballTrail.length > MAX_TRAIL_POINTS) ballTrail.shift();
    } else {
      lastBallBbox = null;
    }
  } catch (e) {
    console.error("Ball detection error:", e);
  }
  isDetecting = false;
}

function drawBallAndTrajectory() {
  if (lastBallBbox) {
    const { x, y, w, h, score } = lastBallBbox;
    canvasCtx.strokeStyle = '#FF6D00';
    canvasCtx.lineWidth = 3;
    canvasCtx.strokeRect(x, y, w, h);
    canvasCtx.fillStyle = '#FF6D00';
    canvasCtx.font = '14px sans-serif';
    canvasCtx.fillText(`Basketball (${Math.round(score * 100)}%)`, x, y > 10 ? y - 5 : 10);
  }

  if (ballTrail.length >= 2) {
    canvasCtx.beginPath();
    canvasCtx.moveTo(ballTrail[0].x, ballTrail[0].y);
    for (let i = 1; i < ballTrail.length; i++) {
      canvasCtx.lineTo(ballTrail[i].x, ballTrail[i].y);
    }
    canvasCtx.strokeStyle = '#FFD600';
    canvasCtx.lineWidth = 4;
    canvasCtx.stroke();
  }
}

function onResults(results) {
  if (!videoElement.videoWidth) return;

  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  frameCounter++;
  if (isTrackingActive && frameCounter % 6 === 0) {
    runThrottledBallDetection();
  }

  if (isTrackingActive) {
    drawBallAndTrajectory();
  }

  if (results.poseLandmarks) {
    const landmarks = results.poseLandmarks;
    const shoulder = landmarks[12];
    const elbow = landmarks[14];
    const wrist = landmarks[16];

    const elbowAngle = calculateAngle(shoulder, elbow, wrist);
    angleVal.innerText = `${Math.round(elbowAngle)}°`;

    if (isTrackingActive) {
      if (wrist.y > shoulder.y) {
        isDipping = true;
        stateVal.innerText = "SET / DIP";
        stateVal.style.color = "#FFB300";
        feedbackVal.innerText = "Gathering ball. Prepare release...";
      } else if (isDipping && elbowAngle >= 150 && wrist.y < shoulder.y) {
        isDipping = false;
        totalShots++;
        goodShots++;

        const scorePercent = Math.round((goodShots / totalShots) * 100);
        totalShotsVal.innerText = totalShots;
        formScoreVal.innerText = `${scorePercent}%`;

        stateVal.innerText = "RELEASE";
        stateVal.style.color = "#00E676";
        feedbackVal.innerText = "GOOD FOLLOW-THROUGH!";

        speakFeedback("Good follow through");
      } else if (wrist.y <= shoulder.y && elbowAngle < 120) {
        stateVal.innerText = "SET POINT";
        stateVal.style.color = "#2196F3";
        feedbackVal.innerText = "Keep elbow tucked in line with basket.";
      }
    }

    drawConnectors(canvasCtx, landmarks, POSE_CONNECTIONS, { color: '#00E676', lineWidth: 3 });
    drawLandmarks(canvasCtx, landmarks, { color: '#FF0055', lineWidth: 1, radius: 4 });
  }

  canvasCtx.restore();
}

const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

pose.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await pose.send({ image: videoElement });
  },
  width: 640,
  height: 480
});

camera.start();