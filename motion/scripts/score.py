"""Original score and SFX for the showreel, synthesised here (no third-party audio), timed to CUE-SHEET.md.
python scripts/score.py  ->  public/audio/sipat-score.wav (48 kHz, 16-bit stereo, 29.8 s)

100 BPM in D major. Calm before the storm (soft piano over a warm pad), a plain pulse during it, silence for the
refusal, an exhale after, and a IV-V-I cadence that lands on the wordmark.
"""
from pathlib import Path
import wave

import numpy as np

SR = 48000
DUR = 1788 / 60
N = int(SR * DUR)
BEAT = 0.6
rng = np.random.default_rng(11)
OUT = Path(__file__).resolve().parent.parent / "public" / "audio" / "sipat-score.wav"


def at(frame: float) -> float:
    return frame / 60


def hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(d: float) -> np.ndarray:
    return np.arange(int(SR * d)) / SR


class Bus:
    def __init__(self) -> None:
        self.x = np.zeros((N, 2))

    def add(self, sig: np.ndarray, start: float, gain: float = 1.0, pan: float = 0.0) -> None:
        if sig.ndim == 1:
            a = (pan + 1) * np.pi / 4
            sig = np.stack([sig * np.cos(a), sig * np.sin(a)], axis=1) * np.sqrt(2)
        i = int(start * SR)
        if i >= N:
            return
        n = min(len(sig), N - i)
        self.x[i:i + n] += sig[:n] * gain


def smooth(x: np.ndarray, k: int) -> np.ndarray:
    return np.convolve(x, np.ones(k) / k, mode="same")


# ---- instruments -------------------------------------------------------------------------------------------

def piano(m: float, vel: float = 0.3, dur: float = 3.5) -> np.ndarray:
    """Soft felt-piano-like additive tone: slightly inharmonic partials, brighter ones die first."""
    f, t = hz(m), tt(dur)
    out = np.zeros_like(t)
    for n in range(1, 9):
        fn = f * n * np.sqrt(1 + 0.0003 * n * n)
        if fn > 12000:
            break
        out += np.sin(2 * np.pi * fn * t + n) * np.exp(-t * (0.9 + 1.1 * n) * (f / 440) ** 0.35) / n ** 1.7
    return vel * out * np.minimum(1, t / 0.006)


def mallet(m: float, vel: float = 0.1) -> np.ndarray:
    """Muted marimba-ish pulse: fundamental plus the 3.9x partial, short decay."""
    f, t = hz(m), tt(0.7)
    return vel * (np.sin(2 * np.pi * f * t) * np.exp(-t * 7) + 0.25 * np.sin(2 * np.pi * 3.9 * f * t) * np.exp(-t * 22)) * np.minimum(1, t / 0.003)


def pad(notes: list[float], start: float, end: float, gain: float = 0.05, attack: float = 0.9, release: float = 1.6, bright: float = 1.0) -> np.ndarray:
    """Warm pad: three detuned voices per note spread across the stereo field, slow swell."""
    hold = end - start
    t = tt(hold + release)
    env = np.minimum(1, t / attack) * np.where(t < hold, 1.0, np.exp(-(t - hold) / (release / 4)))
    out = np.zeros((len(t), 2))
    for m in notes:
        for cents, side in ((-6, 0), (6, 1), (0, None)):
            f = hz(m) * 2 ** (cents / 1200)
            ph = 2 * np.pi * f * t + rng.uniform(0, 6.28)
            v = np.sin(ph) + 0.22 * bright * np.sin(2 * ph) + 0.06 * bright * np.sin(3 * ph)
            v *= 1 + 0.04 * np.sin(2 * np.pi * 0.23 * t + rng.uniform(0, 6.28))
            if side is None:
                out += v[:, None] * 0.6
            else:
                out[:, side] += v
    return out * env[:, None] * gain / max(1, len(notes))


def ping(f: float, dur: float, decay: float, vel: float, partial: float = 2.76) -> np.ndarray:
    t = tt(dur)
    return vel * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * partial * t) * np.exp(-t * decay)) * np.exp(-t * decay) * np.minimum(1, t / 0.002)


def tick(f: float = 1700, vel: float = 0.12) -> np.ndarray:
    t = tt(0.08)
    click = rng.normal(0, 1, len(t)) * np.exp(-t * 400) * 0.25
    return vel * (np.sin(2 * np.pi * f * t) * np.exp(-t * 70) + click)


def noise(dur: float, lp: int, hp: int) -> np.ndarray:
    x = rng.normal(0, 1, int(SR * dur))
    x = smooth(x, lp)
    return x - smooth(x, hp)


def reverb(x: np.ndarray, seconds: float = 2.6, wet: float = 0.3) -> np.ndarray:
    """Convolution with a dark, exponentially decaying stereo noise tail."""
    t = tt(seconds)
    ir = np.stack([smooth(rng.normal(0, 1, len(t)), 6), smooth(rng.normal(0, 1, len(t)), 6)], axis=1) * np.exp(-t / (seconds / 6.9))[:, None]
    ir /= np.sqrt((ir ** 2).sum(axis=0))
    size = 1 << int(np.ceil(np.log2(len(x) + len(ir))))
    tail = np.stack([np.fft.irfft(np.fft.rfft(x[:, c], size) * np.fft.rfft(ir[:, c], size), size)[:len(x)] for c in (0, 1)], axis=1)
    return x + wet * tail


music, sfx, room = Bus(), Bus(), Bus()

# ---- 1 Signal lost: rain bed, four glass ticks, the airplane settling -------------------------------------
rain_t = tt(2.8)
rain = noise(2.8, 12, 300) * 0.05
for drop in rng.uniform(0, 2.6, 70):  # sparse droplets give the bed its texture
    i = int(drop * SR)
    d = ping(rng.uniform(2500, 5200), 0.03, 160, 0.01, partial=1.5)
    rain[i:i + len(d)] += d[:len(rain) - i]
rain *= np.minimum(1, rain_t / 0.25) * np.clip((2.6 - rain_t) / 0.6, 0, 1)
room.add(np.stack([rain, np.roll(rain, 1500)], axis=1), 0.0)
for i, frame in enumerate((24, 40, 56, 72)):  # tallest bar first; descending glass
    sfx.add(ping(hz((88, 84, 81, 77)[i]), 0.6, 9, 0.06), at(frame), pan=0.3)
sfx.add(tick(950, 0.07), 1.85, pan=0.35)

# ---- 2 Bago: D major, pad + felt piano (enters with the daylight on beat 4) -------------------------------
D, Bm, G, A = [50, 57, 61, 66], [47, 54, 57, 62], [43, 50, 54, 59], [45, 52, 57, 61]
music.add(pad(D, 2.40, 4.80, 0.06, attack=1.5), 2.40)  # eases in under the daylight
music.add(pad(Bm, 4.80, 7.20, 0.07), 4.80)
music.add(pad(G, 7.20, 8.40, 0.07), 7.20)
music.add(pad([45, 52, 57, 62], 8.40, 9.00, 0.04, attack=0.3, release=0.5), 8.40)  # thins to Asus4
for i, m in enumerate((62, 66, 69, 76)):  # one soft roll for the household (cards 40 ms apart)
    music.add(piano(m, 0.085), 2.60 + i * 0.07, pan=-0.2 + 0.13 * i)
for s, m in ((4.8, 78), (5.4, 76), (6.0, 74), (6.6, 69), (7.2, 71)):  # a small falling line
    music.add(piano(m, 0.11), s, pan=0.1)
sfx.add(tick(1450, 0.11), 7.80)  # the tap on Signal No. 3

# ---- 3-5 Habang: one soft impact on beat 15, then a plain pulse under a darker pad ------------------------
t = tt(1.8)
thump = np.sin(2 * np.pi * np.cumsum(44 + 36 * np.exp(-t * 9)) / SR) * np.exp(-t * 2.8)
thump += smooth(rng.normal(0, 1, len(t)), 40) * np.exp(-t * 14) * 0.6
sfx.add(thump * 0.26, 9.00)
storm = [(9.0, Bm), (11.4, G), (13.8, D), (16.2, A), (18.6, Bm), (21.0, G)]
for s, chord in storm:
    music.add(pad(chord, s, min(s + 2.4, 22.6), 0.045, attack=0.4, release=0.8, bright=0.5), s)
    for k in range(8):  # eighth notes, accent on the beat, gone by 22.9 s
        when = s + k * BEAT / 2
        if when >= 22.6:
            break
        fade = np.clip((22.9 - when) / 0.6, 0, 1)
        music.add(mallet(chord[0] + 12 + (7 if k % 2 else 0), 0.085 if k % 2 else 0.11) * fade, when, pan=-0.25 if k % 2 else 0.25)  # root, fifth
for frame in (792, 828, 864):  # three checklist ticks on beats 22-24
    sfx.add(tick(1900, 0.11), at(frame), pan=0.25)
t = tt(0.16)
sfx.add(np.sin(2 * np.pi * np.cumsum(660 + 330 * t / 0.16) / SR) * np.sin(np.pi * t / 0.16) * 0.035, at(980))  # lift
for i, m in enumerate((81, 88)):  # the vetted summary: a warm two-note chime (in A)
    t = tt(2.4)
    fc = hz(m)
    bell = np.sin(2 * np.pi * fc * t + 1.6 * np.exp(-t * 3) * np.sin(2 * np.pi * 2 * fc * t)) * np.exp(-t * 1.9)
    sfx.add(bell * 0.1, at(1044) + i * 0.06, pan=-0.15 + 0.3 * i)
for i in range(14):  # the AI answer streaming: one faint sparkle per word
    m = (93, 95, 98, 100, 102)[rng.integers(0, 5)]
    sfx.add(ping(hz(m), 0.3, 26, 0.012, partial=2.0), at(1074 + 5 * i), pan=rng.uniform(-0.5, 0.5))
sfx.add(tick(1600, 0.08), at(1168), pan=0.1)  # tap on "Saan galing ito?"
paper = noise(0.32, 3, 30) * np.sin(np.pi * tt(0.32) / 0.32) * 0.02
sfx.add(paper, at(1176), pan=0.4)

# ---- 6 Wala ito sa gabay: silence, then one plain low note on beat 39 -------------------------------------
music.add(piano(50, 0.15, 4.0), at(1404))

# ---- 7-8 Pagkatapos: the exhale, then IV - V - I landing on the wordmark -----------------------------------
music.add(pad([43, 50, 55, 59, 62], 24.60, 26.40, 0.06, attack=1.4, release=1.4), 24.60)
music.add(pad([40, 47, 55, 59, 62], 26.40, 27.33, 0.05, attack=0.6, release=1.0), 26.40)
sfx.add(tick(1200, 0.07), at(1504), pan=0.2)  # tap on Pagkatapos
for s, m in ((25.43, 71), (26.03, 74)):
    music.add(piano(m, 0.1), s)
music.add(pad(G, 27.33, 28.00, 0.06, attack=0.4, release=0.7), 27.33)
music.add(pad(A, 28.00, 28.57, 0.06, attack=0.3, release=0.6), 28.00)
for i, m in enumerate((55, 62, 71)):
    music.add(piano(m, 0.1), 27.33 + i * 0.05)
for i, m in enumerate((57, 64, 73)):
    music.add(piano(m, 0.1), 28.00 + i * 0.05)
music.add(pad([50, 57, 64, 66, 69], 28.57, 29.8, 0.065, attack=0.15, release=1.2), 28.57)
for i, m in enumerate((38, 50, 57, 64, 66, 69)):  # the resolved chord on the wordmark
    music.add(piano(m, 0.12 if m > 40 else 0.1, 2.0), 28.57 + i * 0.035, pan=-0.3 + 0.12 * i)

# ---- camera punch-ins: a faint air swell under each zoom (effects.tsx PUNCHES) --------------------------------
for frame, dur in ((440, 26), (768, 22), (1144, 22), (1414, 30)):
    d = dur / 60 + 0.25
    t = tt(d)
    air = noise(d, 20, 600) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2 * 0.05
    sfx.add(np.stack([air, np.roll(air, 800)], axis=1), at(frame) - 0.1)

# ---- mix ----------------------------------------------------------------------------------------------------
mix = reverb(music.x, 2.8, 0.38) + reverb(sfx.x, 1.6, 0.18) + room.x
# The refusal beat is true silence: the storm's tail is closed off before it and the low note starts after it.
full = np.arange(N) / SR
gate = np.where(full < 22.45, 1.0, np.where(full < 22.88, np.cos((full - 22.45) / 0.43 * np.pi / 2) ** 2, np.where(full < 23.395, 0.0, 1.0)))
mix *= gate[:, None]
end = tt(0.5)
mix[-len(end):] *= np.cos(end / 0.5 * np.pi / 2)[:, None] ** 2  # silence by 29.8 s
mix = np.tanh(mix * 1.4) / 1.4  # gentle safety saturation
mix *= 10 ** (-1 / 20) / np.abs(mix).max()  # peak -1 dBFS

OUT.parent.mkdir(parents=True, exist_ok=True)
pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
with wave.open(str(OUT), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
rms = 20 * np.log10(np.sqrt((mix ** 2).mean()) + 1e-9)
print(f"{OUT} {len(mix) / SR:.3f}s rms {rms:.1f} dBFS")
