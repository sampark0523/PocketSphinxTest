# tts_service.py

import os
import openai
import logging
from pathlib import Path

def generate_tts(text: str, output_path: Path, speed: float=1.0, voice: str="alloy"):
    """
    Calls openai.audio.speech.create(...) for TTS. Streams to file.
    """
    openai.api_key = os.getenv("OPENAI_API_KEY")
    if not openai.api_key:
        logging.error("No OPENAI_API_KEY. TTS cannot proceed.")
        Path(output_path).touch()
        return str(output_path)

    try:
        logging.info(f"TTS: text='{text[:50]}...', voice={voice}, speed={speed}")
        response = openai.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=text,
            speed=speed,
            response_format="mp3"
        )
        # The new docs mention `.stream_to_file(...)` method:
        response.stream_to_file(str(output_path))

        return str(output_path)

    except Exception as e:
        logging.error(f"TTS error: {e}")
        # fallback: create empty file
        Path(output_path).touch()
        return str(output_path)
