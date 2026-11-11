"""Checks the Azure voice client against a fake Azure endpoint on localhost (no Azure key or network needed).

    python azure_tts_checks.py
"""
import http.server
import sys
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.azure_tts import OUTPUT_FORMAT, AzureTtsError, build_ssml, synthesize_azure_wav  # noqa: E402

FAKE_KEY = "fake-key-for-checks"
FAKE_WAV = b"RIFF" + b"\x00" * 40
results: list[tuple[str, bool, str]] = []


def check(name: str, passed: bool, detail: str = "") -> None:
    results.append((name, passed, detail))
    print(f"{'PASS' if passed else 'FAIL'} {name}{f' ({detail})' if detail else ''}")


class FakeAzure(http.server.BaseHTTPRequestHandler):
    # The path picks the answer, so one server covers every case.
    last_request: dict = {}

    def do_POST(self):
        body = self.rfile.read(int(self.headers["Content-Length"]))
        # Header names are case-insensitive (urllib sends "X-microsoft-outputformat"), so compare them lowercased.
        FakeAzure.last_request = {"headers": {k.lower(): v for k, v in self.headers.items()}, "body": body.decode("utf-8")}
        status = {"/ok": 200, "/unauthorized": 401, "/quota": 429, "/not-wav": 200}[self.path]
        payload = FAKE_WAV if self.path == "/ok" else b"<html>nope</html>"
        self.send_response(status)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):
        pass


def main() -> int:
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), FakeAzure)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    call = {"key": FAKE_KEY, "voice": "vi-VN-HoaiMyNeural"}

    ssml = build_ssml('Giá <200k> & "rẻ"', "vi-VN-HoaiMyNeural", 1.0)
    check("A1 text is XML-escaped inside SSML", "Giá &lt;200k&gt; &amp; \"rẻ\"" in ssml, ssml)
    check("A2 speed 1.0 is rate +0%", "rate='+0%'" in ssml or 'rate="+0%"' in ssml, ssml)
    check("A3 speed 0.9 is rate -10%", "-10%" in build_ssml("x", "v", 0.9))

    audio = synthesize_azure_wav("Chào bạn", 1.0, endpoint=f"{base}/ok", **call)
    sent = FakeAzure.last_request
    check("A4 returns the WAV from Azure", audio == FAKE_WAV)
    check("A5 sends the key header", sent["headers"].get("ocp-apim-subscription-key") == FAKE_KEY)
    check("A6 sends SSML content type", sent["headers"].get("content-type") == "application/ssml+xml")
    check("A7 asks for a RIFF WAV", sent["headers"].get("x-microsoft-outputformat") == OUTPUT_FORMAT)
    check("A8 sends a User-Agent", bool(sent["headers"].get("user-agent")))
    check("A9 body names the voice and the text", "vi-VN-HoaiMyNeural" in sent["body"] and "Chào bạn" in sent["body"])

    for name, path in [("401 wrong key", "/unauthorized"), ("429 quota used up", "/quota"), ("non-WAV answer", "/not-wav")]:
        try:
            synthesize_azure_wav("Chào bạn", 1.0, endpoint=f"{base}{path}", **call)
            check(f"A10 {name} raises AzureTtsError", False, "no error")
        except AzureTtsError as error:
            check(f"A10 {name} raises AzureTtsError", FAKE_KEY not in str(error), str(error))

    server.shutdown()
    try:
        synthesize_azure_wav("Chào bạn", 1.0, endpoint="http://127.0.0.1:9/unreachable", **call)
        check("A11 unreachable endpoint raises AzureTtsError", False, "no error")
    except AzureTtsError as error:
        check("A11 unreachable endpoint raises AzureTtsError", True, str(error))

    failed = [name for name, passed, _ in results if not passed]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
