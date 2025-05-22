# stt_service.py

import os
import subprocess
import logging
import openai

def transcribe_audio(audio_path: str) -> dict:
    try:
        openai.api_key = os.getenv("OPENAI_API_KEY")
        if not openai.api_key:
            return {"error": "OPENAI_API_KEY not set", "text": ""}

        wav_path = audio_path.replace(".webm", ".wav")
        cmd = [
            "ffmpeg", "-y",
            "-i", audio_path,
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            wav_path
        ]
        subprocess.run(cmd, capture_output=True, check=True)

        with open(wav_path, "rb") as f:
            resp = openai.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                language="en"
            )
        # IMPORTANT: use resp.text
        text_out = resp.text
        
        return {"text": text_out}

    except Exception as e:
        logging.error(f"STT error: {e}")
        return {"error": str(e), "text": ""}
    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)