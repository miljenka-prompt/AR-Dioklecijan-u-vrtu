const $ = (id) => document.getElementById(id);
const video = $('storyVideo');
const state = {mode: 'screen', language: 'hr', xrSupported: false, session: null, stream: null, renderer: null, portal: null, hitSource: null, reticle: null, xrReady: false, placed: false, scale: 1, x: 0, y: 0, starting: false, requestId: 0, closeup: false, frameHandle: null};
const quote = {
  hr: '„Kad biste samo mogli vidjeti povrće koje smo vlastitim rukama uzgojili u Saloni, zacijelo nikad ne biste pomislili da bi trebalo pokušati ponovno preuzeti vlast.”',
  la: '„Utinam Salonae possetis visere olera nostris manibus instituta, profecto numquam istud temptandum iudicaretis.”',
};
const scenes = [
  {label: 'I · CAR', heading: 'PRIJE ABDIKACIJE', text: 'Purpur, straža i ceremonija. Kronovizor najprije otvara prizor Dioklecijana u carskoj ulozi.', note: 'Autorska vizualizacija carske uloge; nije rekonstrukcija određene dvorane.'},
  {label: 'II · ABDICATIO', heading: 'ODRICANJE OD VLASTI', text: 'Car ostavlja vlast. Iza purpura ostaje čovjek — a priča se seli u vrt.', note: 'Prijelaz povezuje dva dijela izvornog videa.'},
  {label: 'III · VRT', heading: 'SMISAO POVIJESNOG CITATA', text: '', note: 'Epitome de Caesaribus 39.6 · smisaoni prijevod cijelog citata.'},
];
let lastChapter = -1;
let threePromise;
const timeText = (n) => `0:${String(Math.floor(Number.isFinite(n) ? n : 0)).padStart(2, '0')}`;
const sceneIndex = (time) => time < 2.96 ? 0 : time < 5.17 ? 1 : 2;
const icon = (button, name) => button.querySelector('use').setAttribute('href', `#i-${name}`);

function status(message) {
  $('status').textContent = message;
}
function arPrompt(message) {
  $('arPrompt').textContent = message;
  $('arPrompt').hidden = !message;
}
function updateReading(force = false) {
  const index = sceneIndex(video.currentTime);
  if (index === lastChapter && !force) return;
  lastChapter = index;
  updateCloseup();
  const scene = scenes[index];
  $('sceneLabel').textContent = scene.label;
  $('readingLabel').textContent = index === 2 && state.language === 'la' ? 'POVIJESNI CITAT · LATINSKI' : scene.heading;
  $('reading').textContent = index === 2 ? quote[state.language] : scene.text;
  $('reading').lang = index === 2 ? state.language : 'hr';
  $('readingNote').textContent = index === 2 && state.language === 'la' ? 'Epitome de Caesaribus 39.6 · tekst antičkog izvora.' : scene.note;
  $('arQuote').textContent = index === 2 ? quote[state.language] : index === 0 ? 'Dioklecijan · prije abdikacije' : 'Abdicatio · odricanje od vlasti';
  $('arQuote').lang = index === 2 ? state.language : 'hr';
  document.querySelectorAll('.chapter').forEach((button, i) => {
    button.classList.toggle('active', i === index);
    if (i === index) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
}
function updatePlayback() {
  const paused = video.paused || video.ended;
  for (const id of ['playButton', 'arPlay']) {
    icon($(id), paused ? 'play' : 'pause');
    $(id).setAttribute('aria-label', paused ? (video.ended ? 'Ponovi cijelu priču' : 'Pokreni priču') : 'Pauziraj priču');
  }
  $('bigPlay').hidden = !paused;
  $('bigPlay').querySelector('span').textContent = video.ended ? 'Ponovi priču' : video.currentTime > 0 ? 'Nastavi priču' : 'Otvori vrijeme';
  $('bigPlay').setAttribute('aria-label', video.ended ? 'Ponovi cijelu priču' : 'Pokreni priču');
}
function updateTime() {
  const duration = Number.isFinite(video.duration) ? video.duration : 15.958333;
  $('seek').max = duration;
  $('seek').value = video.currentTime;
  $('seek').setAttribute('aria-valuetext', `${timeText(video.currentTime)} od ${timeText(duration)}`);
  $('time').textContent = `${timeText(video.currentTime)} / ${timeText(duration)}`;
  updateReading();
}
async function play(fromStart = false) {
  if (fromStart || video.ended) video.currentTime = 0;
  try {
    await video.play();
    status('');
  } catch (error) {
    const message = error.name === 'NotAllowedError' ? 'Dodirnite tipku za reprodukciju da biste pokrenuli snimku.' : 'Snimka se trenutačno ne može pokrenuti. Pokušajte ponovno.';
    status(message);
    if (state.mode !== 'screen') arPrompt(message);
  }
  updatePlayback();
}
function togglePlay() {
  if (video.paused || video.ended) void play();
  else video.pause();
}
function updateCloseup() {
  const active = state.closeup && sceneIndex(video.currentTime) === 2;
  document.body.classList.toggle('closeup-active', active);
  for (const id of ['closeupButton', 'arCloseup']) {
    const button = $(id);
    (button.querySelector('span') || button).textContent = state.closeup ? 'Cijeli prizor' : 'Krupni plan govora';
    button.setAttribute('aria-pressed', String(state.closeup));
  }
  if (state.videoTexture && state.aperture) {
    // The same source frames and audio remain in use; only the visible crop changes.
    state.videoTexture.repeat.set(active ? 448 / 1280 : 1, active ? 560 / 720 : 1);
    state.videoTexture.offset.set(active ? 470 / 1280 : 0, active ? 160 / 720 : 0);
    state.aperture.scale.set(active ? .64 : 1, active ? 1.422222 : 1, 1);
  }
}
function toggleCloseup() {
  state.closeup = !state.closeup;
  if (state.closeup && (video.currentTime < 5.75 || video.ended)) video.currentTime = 5.75;
  updateTime(); updateCloseup();
  if (state.closeup) void play();
}
['closeupButton', 'arCloseup'].forEach((id) => $(id).addEventListener('click', toggleCloseup));
function sound() {
  video.muted = !video.muted;
  for (const id of ['soundButton', 'arSound']) {
    icon($(id), video.muted ? 'mute' : 'sound');
    $(id).setAttribute('aria-pressed', String(!video.muted));
    $(id).setAttribute('aria-label', video.muted ? 'Uključi latinski glas' : 'Isključi glas');
  }
}

['playButton', 'bigPlay', 'arPlay'].forEach((id) => $(id).addEventListener('click', togglePlay));
['replay', 'arReplay'].forEach((id) => $(id).addEventListener('click', () => void play(true)));
['soundButton', 'arSound'].forEach((id) => $(id).addEventListener('click', sound));
$('seek').addEventListener('input', (event) => { video.currentTime = Number(event.target.value); updateTime(); });
document.querySelectorAll('[data-time]').forEach((button) => button.addEventListener('click', () => { video.currentTime = Number(button.dataset.time); updateTime(); void play(); }));
['Hr', 'La'].forEach((suffix) => $('lang' + suffix).addEventListener('click', () => {
  state.language = suffix.toLowerCase();
  $('langHr').setAttribute('aria-pressed', String(state.language === 'hr'));
  $('langLa').setAttribute('aria-pressed', String(state.language === 'la'));
  updateReading(true);
}));
video.addEventListener('timeupdate', updateTime);
video.addEventListener('loadedmetadata', updateTime);
video.addEventListener('seeked', updateTime);
['play', 'pause', 'ended'].forEach((event) => video.addEventListener(event, updatePlayback));
video.addEventListener('waiting', () => { $('loadingIndicator').hidden = false; });
['playing', 'canplay', 'pause', 'error'].forEach((event) => video.addEventListener(event, () => { $('loadingIndicator').hidden = true; }));
video.addEventListener('error', () => { $('mediaError').hidden = false; status('Snimka se nije učitala. Možete je ponovno učitati ili otvoriti zasebno.'); });
$('retryVideo').addEventListener('click', () => { $('mediaError').hidden = true; video.load(); void play(true); });

$('aboutButton').addEventListener('click', () => { $('aboutPanel').scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'}); });
$('fullscreenButton').addEventListener('click', async () => {
  if (document.body.classList.contains('expanded')) {
    document.body.classList.remove('expanded');
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    $('fullscreenButton').setAttribute('aria-label', 'Proširi prizor');
  } else {
    document.body.classList.add('expanded');
    $('fullscreenButton').setAttribute('aria-label', 'Vrati uobičajeni prikaz');
    if ($('experience').requestFullscreen) await $('experience').requestFullscreen().catch(() => {});
  }
});
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) { document.body.classList.remove('expanded'); $('fullscreenButton').setAttribute('aria-label', 'Proširi prizor'); } });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { document.body.classList.remove('expanded'); if (state.mode !== 'screen') void exitAR(); } });

function getThree() {
  if (!threePromise) threePromise = import('./vendor/three.module.min.js');
  return threePromise;
}
async function probeAR() {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || cameraPolicyBlocked()) {
    $('supportHint').textContent = 'Video radi ovdje. Za kameru otvorite poveznicu u pregledniku koji dopušta pristup kameri.';
    $('cameraHelp').hidden = false;
    return;
  }
  try {
    state.xrSupported = !!navigator.xr && await navigator.xr.isSessionSupported('immersive-ar');
  } catch { state.xrSupported = false; }
  $('enterXR').hidden = !state.xrSupported;
  $('supportHint').textContent = state.xrSupported ? '„Otvori kameru” prikazuje prozor preko kamere. „Postavi u prostoru” veže ga uz odabrano mjesto na podu.' : 'Prozor preko kamere prati zaslon. Možete ga pomicati i povećavati.';
  if (state.xrSupported) void getThree().catch(() => {});
}
function cameraPolicyBlocked() {
  const policy = document.permissionsPolicy || document.featurePolicy;
  return !!policy?.allowsFeature && !policy.allowsFeature('camera');
}

function setMode(mode) {
  state.mode = mode;
  document.body.classList.toggle('ar-active', mode !== 'screen');
  document.body.classList.toggle('xr-active', mode === 'xr');
  document.body.classList.toggle('camera-active', mode === 'camera');
  $('arHUD').hidden = mode === 'screen';
  $('cameraModeHint').hidden = mode !== 'camera';
  $('arModeLabel').textContent = mode === 'xr' ? 'Postavljanje prozora u prostor' : 'Prozor preko kamere';
  $('cameraFeed').hidden = mode !== 'camera';
  if (mode !== 'screen') {
    document.body.classList.remove('expanded');
    video.pause();
    video.currentTime = 0;
    state.scale = 1;
    $('portalScale').value = 1;
    updateReading(true);
  }
}
function resetCameraPortal() {
  state.x = 0; state.y = 0; state.scale = 1;
  $('portalScale').value = 1;
  applyScale();
}
function applyScale() {
  document.documentElement.style.setProperty('--portal-x', state.x + 'px');
  document.documentElement.style.setProperty('--portal-y', state.y + 'px');
  document.documentElement.style.setProperty('--portal-scale', state.scale);
  if (state.portal) state.portal.scale.setScalar(state.scale);
}
$('portalScale').addEventListener('input', (event) => { state.scale = Number(event.target.value); applyScale(); });
async function startCamera(requestId) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || cameraPolicyBlocked()) throw new Error('camera-unavailable');
  // Show the video and close control before playback; hidden camera videos can stall on mobile.
  setMode('camera');
  document.body.classList.add('camera-loading');
  arPrompt('Dopustite pristup kameri kada vas preglednik pita.');
  const stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}, width: {ideal: 1280}, height: {ideal: 720}}, audio: false});
  if (requestId !== state.requestId) { stream.getTracks().forEach((track) => track.stop()); return; }
  state.stream = stream;
  const feed = $('cameraFeed');
  feed.muted = true; feed.playsInline = true; feed.srcObject = stream;
  let timer;
  try {
    await Promise.race([feed.play(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('camera-preview-timeout')), 8000); })]);
  } finally { clearTimeout(timer); }
  if (requestId !== state.requestId) return;
  document.body.classList.remove('camera-loading');
  resetCameraPortal();
  $('placeButton').disabled = false;
  $('placeButton').textContent = 'Vrati prozor';
  $('scaleControl').hidden = false;
  arPrompt('');
  await play(true);
}

function makePortal(THREE) {
  const group = new THREE.Group();
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  // A mathematical opacity mask defines the chronovisor aperture. No generated scenery.
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = 512; maskCanvas.height = 288;
  const ctx = maskCanvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 288);
  ctx.shadowColor = '#fff'; ctx.shadowBlur = 9; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.roundRect(14, 10, 484, 268, [38, 38, 12, 12]); ctx.fill();
  const mask = new THREE.CanvasTexture(maskCanvas);
  const material = new THREE.MeshBasicMaterial({map: texture, alphaMap: mask, transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false});
  const aperture = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.125), material);
  aperture.position.y = .9;
  group.add(aperture);
  group.visible = false;
  return {group, texture, mask, aperture};
}

async function startXR(sessionPromise, requestId) {
  let session;
  try { session = await sessionPromise; }
  catch (error) { throw error; }
  if (requestId !== state.requestId) { await session.end().catch(() => {}); return; }
  state.session = session;
  session.addEventListener('end', cleanXR, {once: true});
  try {
    const THREE = await getThree();
    if (state.session !== session) return;
    const renderer = new THREE.WebGLRenderer({alpha: true, antialias: true, powerPreference: 'high-performance'});
    state.renderer = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    $('xrCanvas').replaceChildren(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, .02, 30);
    state.scene = scene; state.camera = camera;
    const portal = makePortal(THREE);
    state.portal = portal.group; state.videoTexture = portal.texture; state.maskTexture = portal.mask; state.aperture = portal.aperture;
    scene.add(portal.group);
    const reticle = new THREE.Mesh(new THREE.RingGeometry(.1, .13, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: 0xe4d1a1, side: THREE.DoubleSide, toneMapped: false}));
    reticle.matrixAutoUpdate = false; reticle.visible = false;
    state.reticle = reticle; scene.add(reticle);
    state.placed = false; state.xrReady = false; state.THREE = THREE;
    setMode('xr');
    $('scaleControl').hidden = true;
    $('placeButton').textContent = 'Tražim pod…'; $('placeButton').disabled = true;
    arPrompt('Usmjerite kameru prema podu i polako pomaknite mobitel.');
    await renderer.xr.setSession(session);
    if (state.session !== session) return;
    const viewerSpace = await session.requestReferenceSpace('viewer');
    const hitSource = await session.requestHitTestSource({space: viewerSpace});
    if (state.session !== session) { hitSource.cancel(); return; }
    state.hitSource = hitSource;
    session.addEventListener('select', () => {
      if (state.session !== session) return;
      if (!state.placed) placePortal();
      else if (!session.domOverlayState) togglePlay();
    });
    $('overlay').addEventListener('beforexrselect', preventXRUISelect);
    renderer.setAnimationLoop((_, frame) => {
      if (frame && state.session === session) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const pose = frame.getViewerPose(referenceSpace);
        if (pose) state.viewerMatrix = new THREE.Matrix4().fromArray(pose.transform.matrix);
        if (!state.placed) {
          const hits = frame.getHitTestResults(hitSource);
          const hitPose = hits.length ? hits[0].getPose(referenceSpace) : null;
          // Keep the aperture upright and only offer placement on a nearly horizontal surface.
          if (hitPose && hitPose.transform.matrix[5] > .75) {
            reticle.matrix.fromArray(hitPose.transform.matrix);
            reticle.visible = true;
            if (!state.xrReady) { arPrompt('Pod je pronađen. Dodirnite „Postavi prozor”.'); $('placeButton').textContent = 'Postavi prozor'; }
            state.xrReady = true; $('placeButton').disabled = false;
          } else {
            reticle.visible = false;
            if (state.xrReady) { arPrompt('Usmjerite kameru prema podu.'); $('placeButton').textContent = 'Tražim pod…'; }
            state.xrReady = false; $('placeButton').disabled = true;
          }
        }
      }
      renderer.render(scene, camera);
    });
  } catch (error) {
    if (state.session === session) await session.end().catch(() => cleanXR());
    throw error;
  }
}
function preventXRUISelect(event) {
  if (event.target.closest('button, input, a, label')) event.preventDefault();
}
function placePortal() {
  if (state.mode !== 'xr' || !state.xrReady || !state.reticle?.visible || !state.viewerMatrix) return;
  const THREE = state.THREE;
  const position = new THREE.Vector3().setFromMatrixPosition(state.reticle.matrix);
  const viewer = new THREE.Vector3().setFromMatrixPosition(state.viewerMatrix);
  state.portal.position.copy(position);
  state.portal.rotation.set(0, Math.atan2(viewer.x - position.x, viewer.z - position.z), 0);
  state.portal.visible = true;
  state.reticle.visible = false;
  state.placed = true;
  $('arModeLabel').textContent = 'Prozor postavljen u prostoru';
  $('placeButton').textContent = 'Premjesti';
  $('placeButton').disabled = false;
  $('scaleControl').hidden = false;
  arPrompt('');
  void play(true);
}
$('placeButton').addEventListener('click', () => {
  if (state.mode === 'camera') { resetCameraPortal(); arPrompt(''); return; }
  if (!state.placed) placePortal();
  else {
    state.placed = false; state.xrReady = false; state.portal.visible = false;
    $('arModeLabel').textContent = 'Postavljanje prozora u prostor';
    video.pause(); $('placeButton').disabled = true; $('placeButton').textContent = 'Tražim pod…';
    $('scaleControl').hidden = true;
    arPrompt('Odaberite novo mjesto na podu.');
  }
});
function cleanXR() {
  state.hitSource?.cancel(); state.hitSource = null;
  state.renderer?.setAnimationLoop(null);
  if (state.scene) state.scene.traverse((object) => { object.geometry?.dispose(); if (object.material) object.material.dispose(); });
  state.videoTexture?.dispose(); state.maskTexture?.dispose(); state.renderer?.dispose();
  state.renderer = null; state.portal = null; state.scene = null; state.camera = null;
  state.reticle = null; state.session = null; state.viewerMatrix = null;
  state.videoTexture = null; state.maskTexture = null; state.aperture = null;
  $('xrCanvas').replaceChildren();
  $('overlay').removeEventListener('beforexrselect', preventXRUISelect);
  video.pause(); setMode('screen'); updatePlayback();
  $('enterAR').focus();
}
async function exitAR() {
  state.requestId++;
  state.starting = false;
  $('enterAR').disabled = false; $('enterXR').disabled = false;
  document.body.classList.remove('camera-loading');
  status('');
  video.pause();
  if (state.session) { await state.session.end().catch(() => cleanXR()); return; }
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null; $('cameraFeed').srcObject = null;
  setMode('screen'); updatePlayback(); $('enterAR').focus();
}
$('exitAR').addEventListener('click', () => void exitAR());
async function enterMode(mode) {
  if (state.starting) return;
  const requestId = ++state.requestId;
  state.starting = true; $('enterAR').disabled = true; $('enterXR').disabled = true;
  $('cameraHelp').hidden = true;
  status(mode === 'xr' ? 'Otvaram prikaz u prostoru…' : 'Otvaram kameru…');
  try {
    if (mode === 'xr') {
      // Request directly inside the user's click, before any asynchronous module work.
      const sessionPromise = navigator.xr.requestSession('immersive-ar', {requiredFeatures: ['hit-test', 'dom-overlay'], domOverlay: {root: $('overlay')}});
      await startXR(sessionPromise, requestId);
    } else await startCamera(requestId);
    if (requestId !== state.requestId) return;
    status('');
  } catch (error) {
    if (requestId !== state.requestId) return;
    await exitAR();
    if (mode === 'xr') {
      status('Postavljanje u prostoru nije se pokrenulo. Dodirnite „Otvori kameru” za prozor preko kamere.');
    } else {
      const denied = error.name === 'NotAllowedError' || error.name === 'SecurityError';
      const busy = error.name === 'NotReadableError';
      status(denied ? 'Preglednik nije dopustio kameru. Provjerite dopuštenje za ovu stranicu i pokušajte ponovno.' : busy ? 'Kameru trenutačno koristi druga aplikacija. Zatvorite je i pokušajte ponovno.' : 'Kamera se nije pokrenula u ovom pregledniku. Otvorite demo izravno u Chromeu ili Safariju.');
      $('cameraHelp').hidden = false;
    }
  } finally {
    if (requestId === state.requestId) { state.starting = false; $('enterAR').disabled = false; $('enterXR').disabled = false; }
  }
}
$('enterAR').addEventListener('click', () => void enterMode('camera'));
$('enterXR').addEventListener('click', () => void enterMode('xr'));
const directURL = new URL('.', window.location.href).href;
$('openBrowser').href = directURL;
$('copyLink').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(directURL); $('copyLink').textContent = 'Poveznica kopirana'; }
  catch { $('manualLink').value = directURL; $('manualLink').hidden = false; $('manualLink').focus(); $('manualLink').select(); }
});

// Camera-overlay fallback: pan and pinch are screen-relative, never presented as world tracking.
const pointers = new Map();
let gesture = null;
function gestureStart() {
  const points = [...pointers.values()];
  if (points.length === 1) gesture = {x: points[0].x, y: points[0].y, portalX: state.x, portalY: state.y};
  else if (points.length >= 2) gesture = {distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), scale: state.scale};
  else gesture = null;
}
$('viewer').addEventListener('pointerdown', (event) => {
  if (state.mode !== 'camera') return;
  $('viewer').setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, {x: event.clientX, y: event.clientY}); gestureStart();
});
$('viewer').addEventListener('pointermove', (event) => {
  if (state.mode !== 'camera' || !pointers.has(event.pointerId) || !gesture) return;
  pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
  const points = [...pointers.values()];
  if (points.length === 1 && gesture.x !== undefined) {
    state.x = Math.max(-window.innerWidth * .35, Math.min(window.innerWidth * .35, gesture.portalX + points[0].x - gesture.x));
    state.y = Math.max(-window.innerHeight * .2, Math.min(window.innerHeight * .2, gesture.portalY + points[0].y - gesture.y));
  } else if (points.length >= 2 && gesture.distance > 0) {
    state.scale = Math.min(1.8, Math.max(.5, gesture.scale * Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) / gesture.distance));
    $('portalScale').value = state.scale;
  }
  applyScale();
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((name) => $('viewer').addEventListener(name, (event) => { pointers.delete(event.pointerId); gestureStart(); }));

window.addEventListener('pagehide', () => { void exitAR(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && !state.session && !state.starting) {
    video.pause();
    if (state.mode === 'camera') void exitAR();
  }
});
updateTime(); updateReading(true); updatePlayback(); void probeAR();
