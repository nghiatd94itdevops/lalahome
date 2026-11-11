"""Text to speech with an Azure neural voice (REST API, no SDK).

Request format from https://learn.microsoft.com/azure/ai-services/speech-service/rest-text-to-speech: POST SSML to
https://<region>.tts.speech.microsoft.com/cognitiveservices/v1 with the resource key in Ocp-Apim-Subscription-Key.
Only the text being read leaves this server; the visitor's voice is still recognised locally.
"""

import urllib.error
import urllib.request
from xml.sax.saxutils import escape, quoteattr

OUTPUT_FORMAT = "riff-24khz-16bit-mono-pcm"
USER_AGENT = "lalahome-speech-service"
TIMEOUT_SECONDS = 10


class AzureTtsError(Exception):
    pass


def endpoint_for(region: str) -> str:
    return f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"


def build_ssml(text: str, voice: str, speed: float) -> str:
    # Same 0.5-2.0 speed as the Piper path, expressed as Azure's relative rate ("+0%", "-10%").
    rate = f"{round((speed - 1) * 100):+d}%"
    return (
        f"<speak version='1.0' xml:lang='vi-VN'><voice name={quoteattr(voice)}>"
        f"<prosody rate={quoteattr(rate)}>{escape(text)}</prosody></voice></speak>"
    )


def synthesize_azure_wav(text: str, speed: float, *, key: str, endpoint: str, voice: str) -> bytes:
    request = urllib.request.Request(
        endpoint,
        data=build_ssml(text, voice, speed).encode("utf-8"),
        method="POST",
        headers={
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": OUTPUT_FORMAT,
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            audio = response.read()
    except urllib.error.HTTPError as error:
        # 401 wrong key or region, 429 quota or rate exceeded (Azure's own table); the key never goes in the message.
        raise AzureTtsError(f"Azure TTS answered {error.code} for voice {voice}, {len(text)} chars") from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise AzureTtsError(f"Azure TTS unreachable at {endpoint}: {error}") from error
    if not audio.startswith(b"RIFF"):
        raise AzureTtsError(f"Azure TTS returned {len(audio)} bytes that are not a WAV file for voice {voice}")
    return audio
