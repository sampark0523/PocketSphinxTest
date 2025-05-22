from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from pocketsphinx import AudioFile
import os
import uuid
import ffmpeg

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route("/api/voice", methods=["POST"])
def handle_voice():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file uploaded"}), 400

    file = request.files["audio"]
    webm_path = os.path.join(UPLOAD_FOLDER, f"{uuid.uuid4()}.webm")
    wav_path = webm_path.replace(".webm", ".wav")
    file.save(webm_path)

    try:
        # Convert webm to wav using ffmpeg
        ffmpeg.input(webm_path).output(wav_path, ar=16000, ac=1).run(overwrite_output=True)

        # Run PocketSphinx
        config = {
            "audio_file": wav_path,
            "hmm": "/usr/local/share/pocketsphinx/model/en-us/en-us",  # Update if needed
            "dict": "/usr/local/share/pocketsphinx/model/en-us/cmudict-en-us.dict",
            "lm": False,
            "keyphrase": "a b c d e f g h i j k l m n o p q r s t u v w x y z",
            "kws_threshold": 1e-20
        }

        decoder = AudioFile(**config)
        result = ""
        for phrase in decoder:
            result += str(phrase)

        print(f"[PocketSphinx Output] {result.strip()}")

        return jsonify({
            "transcribed_text": result.strip(),
            "answer": "✓" if result else "No letter detected"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(webm_path): os.remove(webm_path)
        if os.path.exists(wav_path): os.remove(wav_path)

@app.route("/api/init")
def init():
    return jsonify({
        "user_id": str(uuid.uuid4()),
        "audio_path": "/demo.mp3"  # optional, for playback
    })

@app.route("/demo.mp3")
def demo_audio():
    return send_from_directory(".", "demo.mp3")

@app.route("/api/stop", methods=["POST"])
def stop_convo():
    return jsonify({ "audio_path": "/demo.mp3" })

if __name__ == "__main__":
    app.run(port=5001, debug=True)