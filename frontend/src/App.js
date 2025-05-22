// App.js
import React, { useState, useEffect, useRef } from "react";

function App() {
  // ----- State -----
  const [userId, setUserId] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Loading...");
  const [transcribedText, setTranscribedText] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [lastError, setLastError] = useState("");
  const [topicSet, setTopicSet] = useState(false);

  // For microphone selection
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  let audioContextRef = useRef(null);
  let analyserRef = useRef(null);
  let dataArrayRef = useRef(null);
  let animationIdRef = useRef(null);
  let sourceRef = useRef(null);

  // ----- On mount, call /api/init -----
  useEffect(() => {
    (async function init() {
      try {
        const r = await fetch("http://localhost:5001/api/init");
        const d = await r.json();
        setUserId(d.user_id);
        setAudioUrl("http://localhost:5001" + d.audio_path);
        setStatusMsg("Please listen, then choose your mic and speak your topic.");
      } catch (err) {
        console.error("Init error:", err);
        setLastError("Init error. See console.");
        setStatusMsg("Init failed.");
      }
    })();

    // enumerate audio devices
    navigator.mediaDevices
      .enumerateDevices()
      .then((devicesArr) => {
        const mics = devicesArr.filter((d) => d.kind === "audioinput");
        setDevices(mics);
        if (mics.length > 0) {
          setSelectedDeviceId(mics[0].deviceId);
        }
      })
      .catch((err) => console.error("Could not get media devices:", err));
  }, []);

  // ----- Play Audio (mp3) from server -----
  const playAudio = (src) => {
    if (!audioRef.current) return;
    audioRef.current.src = src;
    audioRef.current
      .play()
      .catch((e) => console.error("Audio play error:", e));
  };

  useEffect(() => {
    if (audioUrl) {
      playAudio(audioUrl);
    }
  }, [audioUrl]);

  // ----- Waveform Visualization -----
  const drawWaveform = () => {
    if (!analyserRef.current || !dataArrayRef.current) return;
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    analyser.getByteTimeDomainData(dataArray);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0f0";
    ctx.beginPath();

    let sliceWidth = width / dataArray.length;
    let x = 0;
    for (let i=0; i < dataArray.length; i++){
      let v = dataArray[i] / 128.0;
      let y = v * (height/2);
      if (i === 0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
      x += sliceWidth;
    }
    ctx.lineTo(width, height/2);
    ctx.stroke();

    animationIdRef.current = requestAnimationFrame(drawWaveform);
  };

  const stopVisualization = () => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // ----- Start Listening -----
  const startListening = async () => {
    setIsListening(true);
    setStatusMsg("Listening... speak now.");
    setLastError("");
    setAnswerText("");
    setTranscribedText("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
        },
      });
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      dataArrayRef.current = new Uint8Array(analyserRef.current.fftSize);

      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);

      drawWaveform(); // start anim
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      mediaRecorderRef.current.onstop = handleStop;
      mediaRecorderRef.current.start();
    } catch (err) {
      console.error("Mic error:", err);
      setLastError("Mic error. See console.");
      setIsListening(false);
    }
  };

  // ----- Stop Listening -----
  const stopListening = () => {
    setIsListening(false);
    setStatusMsg("Processing...");
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    stopVisualization();
  };

  // ----- Handle Stop => send to server -----
  const handleStop = async () => {
    setIsThinking(true);
    setStatusMsg("Thinking...");
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });

    const formData = new FormData();
    formData.append("user_id", userId);
    formData.append("audio", blob, "input.webm");
    formData.append("mode", topicSet ? "conversation" : "topic");

    try {
      const resp = await fetch("http://localhost:5001/api/voice", {
        method: "POST",
        body: formData
      });
      const data = await resp.json();
      setIsThinking(false);

      if (!resp.ok) {
        setLastError(data.error || "STT / server error.");
        setStatusMsg("Error, please re-try.");
        return;
      }
      // success
      setTranscribedText(data.transcribed_text || "");
      setAnswerText(data.answer || "");
      setStatusMsg("Got system response.");
      if (data.audio_path) {
        setAudioUrl("http://localhost:5001" + data.audio_path);
      }
      if (!topicSet) {
        setTopicSet(true);
      }
    } catch (err) {
      console.error("Voice error:", err);
      setLastError("Voice send error. See console.");
      setIsThinking(false);
      setStatusMsg("Error. Try again?");
    }
  };

  // ----- Stop Convo -----
  const handleStopConvo = async () => {
    if (!userId) return;
    setStatusMsg("Ending conversation...");
    try {
      const r = await fetch("http://localhost:5001/api/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId })
      });
      const d = await r.json();
      if (d.error) {
        setLastError(d.error);
      } else {
        setStatusMsg("Conversation ended.");
        if (d.audio_path) {
          setAudioUrl("http://localhost:5001" + d.audio_path);
        }
      }
    } catch (err) {
      console.error("Stop error:", err);
      setLastError("Stop convo error. See console.");
    }
  };

  // ----- Render -----
  return (
    <div style={styles.container}>
      <audio ref={audioRef} />
      <h1 style={{ color:"#0f9"}}>Deep Interactive System</h1>
      <p style={{ fontStyle:"italic" }}>{statusMsg}</p>
      {lastError && <p style={{ color:"red"}}>Error: {lastError}</p>}

      <div style={styles.card}>
        <div style={{ marginBottom:10 }}>
          <label style={{ marginRight:8 }}>Select Microphone:</label>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Mic ${d.deviceId}`}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom:10 }}>
          <canvas ref={canvasRef} width={300} height={60} style={{ background:"#222", border:"1px solid #555" }} />
        </div>

        <div style={{ marginBottom:10 }}>
          <p>Transcribed: <strong>{transcribedText}</strong></p>
          <p>Answer: <strong>{answerText}</strong></p>
        </div>

        <div style={{ display:"flex", gap:8 }}>
          {!isListening ? (
            <button style={styles.btn} onClick={startListening}>
              {topicSet ? "Speak (Conversation)" : "Speak (Topic)"}
            </button>
          ) : (
            <button style={styles.btn} onClick={stopListening}>Stop</button>
          )}
          <button style={styles.btnStop} onClick={handleStopConvo}>Stop Conversation</button>
        </div>
        <p style={{ marginTop:10 }}>Thinking: {isThinking ? "Yes" : "No"}</p>
      </div>
    </div>
  );
}

// A few inline styles for a better design
const styles = {
  container: {
    background:"#333",
    color:"#fff",
    minHeight:"100vh",
    padding:"20px",
    fontFamily:"sans-serif"
  },
  card: {
    background:"#444",
    padding:"20px",
    borderRadius:"8px",
    maxWidth:"400px"
  },
  btn: {
    background:"#27ae60",
    border:"none",
    color:"#fff",
    borderRadius:"4px",
    padding:"10px 16px",
    cursor:"pointer"
  },
  btnStop: {
    background:"#c0392b",
    border:"none",
    color:"#fff",
    borderRadius:"4px",
    padding:"10px 16px",
    cursor:"pointer"
  }
};

export default App;
