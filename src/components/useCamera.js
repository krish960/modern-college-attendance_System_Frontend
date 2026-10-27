/*
 * useCamera.js
 * What it is: camera and barcode helpers shared by the ID card screens.
 * Exports: useCamera (hook that opens the camera and reads barcodes / QR codes), beep (short sound for success or failure),
 * primeAudio (unlocks sound after a click).
 * Used in: FormModal (card code box), RegisterCardsModal and ScanPanel.
 */
import { useEffect, useRef, useState } from "react";

// Holds the barcode reader once it is created, so it is loaded only one time.
let decoderPromise;
/**
 * ZXing (WebAssembly, bundled with the app, so it works offline and in every browser) reads the Code 128 barcode printed
 * on college ID cards, other common 1D barcodes and QR codes, in any rotation.
 */
async function makeDecoder() {
  // Create the reader only once. It loads the ZXing code and its WebAssembly file when first needed.
  if (!decoderPromise) {
    decoderPromise = (async () => {
      const [{ readBarcodes, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
        import("zxing-wasm/reader"),
        import("zxing-wasm/reader/zxing_reader.wasm?url"),
      ]);
      // Start the WebAssembly module (locateFile tells it where the .wasm file is).
      await prepareZXingModule({
        overrides: { locateFile: (path, prefix) => (path.endsWith(".wasm") ? wasmUrl : prefix + path) },
        fireImmediately: true,
      });
      // A hidden canvas: each video frame is drawn on it so its pixels can be read.
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      // Barcode types we accept.
      const FORMATS = ["Code128", "Code39", "Code93", "EAN13", "EAN8", "ITF", "Codabar", "UPCA", "QRCode"];
      // pass 0: the quick normal frame. pass 1: the strong one, for a faded or dim card: full camera
      // resolution, grey and with more contrast. pass 2: the middle of the picture, enlarged, for a card held far away. They take turns, so a good card is still read at once.
      // The function that reads one frame of the video and returns the code text (or "" if none was found).
      return async (video, pass = 0) => {
        const w = video.videoWidth;
        const h = video.videoHeight;
        // The video has no picture yet.
        if (!w || !h) return "";
        if (pass === 2) {
          // the middle of the picture, enlarged: a card held a little too far away
          const cw = Math.round(w * 0.55), ch = Math.round(h * 0.55);
          canvas.width = Math.min(1600, cw * 2);
          canvas.height = Math.round((canvas.width * ch) / cw);
          ctx.filter = "grayscale(1) contrast(2) brightness(1.1)";
          ctx.drawImage(video, Math.round((w - cw) / 2), Math.round((h - ch) / 2), cw, ch, 0, 0, canvas.width, canvas.height);
        } else {
          // Pass 0 and 1: the whole frame, made smaller (960 px normal, 1600 px strong). Pass 1 also makes it grey with more contrast.
          const scale = Math.min(1, (pass ? 1600 : 960) / w);
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          ctx.filter = pass ? "grayscale(1) contrast(1.6) brightness(1.1)" : "none";
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        // Read the pixels of the canvas and look for a barcode. The options help with turned, small or faint codes.
        ctx.filter = "none";
        const found = await readBarcodes(ctx.getImageData(0, 0, canvas.width, canvas.height), {
          formats: FORMATS,
          tryHarder: true,
          tryRotate: true,
          tryDownscale: true,
          maxNumberOfSymbols: 1,
        });
        return found[0]?.text || "";
      };
    })();
  }
  return decoderPromise;
}

// One shared sound context (browsers allow only a limited number).
let audio;
/** Called from the Start scanning click: browsers only allow sound that was unlocked by a tap. */
export function primeAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  } catch { /* sound is optional */ }
}

// Plays a short beep: high tone for success, low tone for a problem. Sound is optional, so errors are ignored.
export function beep(ok) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)(); // one context, so the beep starts at once
    if (audio.state === "suspended") audio.resume();
    const osc = audio.createOscillator();
    osc.frequency.value = ok ? 880 : 220;
    osc.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.12);
  } catch {
    /* sound is optional */
  }
}


/**
 * Opens the camera while `active` and calls onCode(text) for each code read (the same code is not repeated within 3 s).
 * Attach the returned videoRef to a <video playsInline muted>. `error` explains why the camera is not available.
 */
// Hook state: videoRef (attach to a <video>), error (text if the camera cannot start), last (the last code read, to avoid repeats).
export function useCamera(active, onCode) {
  const videoRef = useRef(null);
  const [error, setError] = useState("");
  const last = useRef({ text: "", at: 0 });
  // trackRef = the camera video track (used for torch and zoom).
  const trackRef = useRef(null);
  // what this camera can do: a torch (phone flash) and zoom. Both are optional and only offered when the camera supports them.
  const [caps, setCaps] = useState({ torch: false, zoom: null });
  const [torchOn, setTorchOn] = useState(false);
  const [zoom, setZoomState] = useState(1);
  // cb always holds the newest onCode function, so the camera loop need not restart when it changes.
  const cb = useRef(onCode);
  cb.current = onCode;

  // Start the camera when `active` becomes true and stop it when it becomes false or the component closes.
  useEffect(() => {
    if (!active) return undefined;
    let stopped = false;
    let timer;
    let stream;
    setError("");
    (async () => {
      // Some browsers only allow the camera on https or localhost.
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser cannot open the camera here (it needs https or localhost). You can still type or use a barcode scanner below.");
        return;
      }
      try {
        // Ask for the back camera (if there is one) in high quality.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
          audio: false,
        });
        // Try continuous auto-focus, then find out if the camera has a torch and zoom (both optional).
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        try { await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }); } catch { /* not every camera can */ }
        try {
          const c = track.getCapabilities?.() || {};
          setCaps({ torch: Boolean(c.torch), zoom: c.zoom && c.zoom.max > c.zoom.min ? { min: c.zoom.min, max: c.zoom.max, step: c.zoom.step || 0.1 } : null });
          if (c.zoom) setZoomState(Math.min(c.zoom.max, Math.max(c.zoom.min, 1)));
        } catch { /* controls stay hidden */ }
        // The user closed the camera while it was still starting: release it at once.
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        // Scan loop: read a frame, and if a code is found call onCode. The same code is ignored for 3 seconds.
        // frame % 3 makes the three reading passes (normal, strong, zoomed middle) take turns.
        const decode = await makeDecoder();
        let frame = 0;
        const tick = async () => {
          if (stopped) return;
          try {
            const text = await decode(video, frame++ % 3);
            const now = Date.now();
            if (text && (text !== last.current.text || now - last.current.at > 3000)) {
              last.current = { text, at: now };
              cb.current(text);
            }
          } catch {
            /* a frame that cannot be read is simply skipped */
          }
          timer = setTimeout(tick, 30); // the next frame straight away (a decode takes about 20-60 ms)
        };
        tick();
      } catch (err) {
        setError(
          err?.name === "NotAllowedError"
            ? "Camera permission was refused. Allow the camera for this site, or type the code below."
            : "The camera could not be started. You can still type the code below."
        );
      }
    })();
    // Cleanup: stop the loop, switch the camera off and reset torch and zoom.
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
      setTorchOn(false);
      setCaps({ torch: false, zoom: null });
    };
  }, [active]);

  // Switch the phone light on or off (only works if the camera has a torch).
  const toggleTorch = async () => {
    try {
      await trackRef.current?.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(!torchOn);
    } catch { /* the light could not be switched */ }
  };
  // Change the camera zoom (only works if the camera supports zoom).
  const changeZoom = async (value) => {
    setZoomState(value);
    try { await trackRef.current?.applyConstraints({ advanced: [{ zoom: value }] }); } catch { /* ignored */ }
  };

  // What the screen can use: the video ref, the error text and the torch / zoom controls.
  return { videoRef, error, caps, torchOn, toggleTorch, zoom, changeZoom };
}
