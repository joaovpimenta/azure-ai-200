"""Download pinned Kokoro assets and verify their integrity (also on cache hits)."""
import hashlib
from pathlib import Path
import urllib.request

BASE = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/'
ASSETS = {
    'kokoro-v1.0.onnx': 'beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a',
    'voices-v1.0.bin': 'bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d',
}

def download(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for name, expected in ASSETS.items():
        destination = directory / name
        if not destination.exists():
            temporary = destination.with_suffix('.download')
            with urllib.request.urlopen(BASE + name, timeout=120) as response, temporary.open('wb') as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
            temporary.replace(destination)
        with destination.open('rb') as source:
            digest = hashlib.file_digest(source, 'sha256').hexdigest()
        if digest != expected:
            raise ValueError(f'Model checksum mismatch: {name}; remove this file and retry')
        print(f'Verified {name}', flush=True)

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', default='.cache/kokoro')
    download(Path(parser.parse_args().directory))
