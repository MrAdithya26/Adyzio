"""Original music bed + sound effects for the Adyzio promo reel (30 s, 120 bpm, D major).
Everything here is made in code or by Earshot: no outside recordings, no licence needed.
Run: python compose.py   -> mix.wav (48 kHz stereo, not yet loudness-normalised)
"""
import numpy as np, soundfile as sf, os
SR = 48000; DUR = 30.0; N = int(SR * DUR)
HERE = os.path.dirname(os.path.abspath(__file__))
out = np.zeros((N, 2))
music = np.zeros((N, 2))

def load(name):
    x, sr = sf.read(os.path.join(HERE, 'sfx', name + '.wav'), always_2d=True)
    if x.shape[1] == 1: x = np.repeat(x, 2, axis=1)
    if sr != SR:
        idx = np.arange(0, len(x), sr / SR); x = x[idx.astype(int)]
    return x

def place(buf, x, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i < 0: x = x[-i:]; i = 0
    n = min(len(x), N - i)
    if n <= 0: return
    l, r = gain * np.sqrt((1 - pan) / 2) * np.sqrt(2), gain * np.sqrt((1 + pan) / 2) * np.sqrt(2)
    buf[i:i + n, 0] += x[:n, 0] * l; buf[i:i + n, 1] += x[:n, 1] * r

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)

def lowpass(x, cut):
    a = np.exp(-2 * np.pi * cut / SR); y = np.zeros_like(x); s = 0.0
    for i in range(len(x)):  # short notes only, fine in plain python
        s = (1 - a) * x[i] + a * s; y[i] = s
    return y

def pluck(m, dur=0.45, bright=4, decay=7.0):
    t = np.arange(int(SR * dur)) / SR; f = hz(m)
    w = sum(np.sin(2 * np.pi * f * k * t) / k ** 1.3 for k in range(1, bright + 1))
    env = np.exp(-decay * t) * np.minimum(1, t / 0.004)
    s = w * env * 0.35
    return np.stack([s, s], 1)

def pad(ms, dur, attack=0.6):
    t = np.arange(int(SR * dur)) / SR; L = np.zeros_like(t); R = np.zeros_like(t)
    for m in ms:
        f = hz(m)
        for d, side in ((-0.12, 0), (0.12, 1)):
            ff = f * 2 ** (d / 12)
            w = sum(np.sin(2 * np.pi * ff * k * t) / k ** 2 for k in range(1, 6))
            (L if side == 0 else R)[:] += w
    env = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / 0.4).clip(0, 1)
    return np.stack([L * env, R * env], 1) * 0.06

# Chords (MIDI): D, A, Bm, G  in a comfortable mid register
CH = {'D': [62, 66, 69], 'A': [61, 64, 69], 'Bm': [62, 66, 71], 'G': [62, 67, 71]}
ROOT = {'D': 38, 'A': 45, 'Bm': 47, 'G': 43}
PROG = ['D', 'A', 'Bm', 'G']
BEAT = 0.5; BAR = 2.0; GROOVE0 = 3.5; GROOVE1 = 25.47

kick, snare, hat = load('kick'), load('snare'), load('hat')
hat = hat[:int(0.12 * SR)] * np.linspace(1, 0, int(0.12 * SR))[:, None]

# --- Hook 0 - 3.5 s: pad + gentle arpeggio, no drums (the question hangs) ---
place(music, pad(CH['Bm'], 2.0), 0.0, 1.0); place(music, pad(CH['G'], 1.6), 2.0, 1.0)
for i, m in enumerate([71, 74, 78, 74, 71, 74, 79, 74, 71, 74, 79, 83, 79, 74]):
    t = i * 0.25
    if t < 3.4: place(music, pluck(m, 0.35, 3, 9), t, 0.55, pan=0.3 if i % 2 else -0.3)

# --- Groove 3.5 - 25.47 s ---
t = GROOVE0; beat = 0
while t < GROOVE1 - 0.01:
    bar = int((t - GROOVE0) // BAR); ch = PROG[bar % 4]; inbar = beat % 4
    place(music, kick, t, 0.9)
    if inbar in (1, 3): place(music, snare, t, 0.55)
    place(music, hat, t + BEAT / 2, 0.35, pan=0.25); place(music, hat, t, 0.18, pan=0.25)
    # bass: root on the beat and the off-beat
    place(music, pluck(ROOT[ch], 0.42, 3, 6), t, 0.9); place(music, pluck(ROOT[ch] + 12, 0.25, 3, 10), t + BEAT / 2, 0.45)
    # off-beat chord stabs
    for m in CH[ch]: place(music, pluck(m + 12, 0.22, 5, 14), t + BEAT / 2, 0.30, pan=-0.2)
    if inbar == 0: place(music, pad(CH[ch], BAR), t, 0.7)
    t += BEAT; beat += 1

# --- Outro 25.47 - 30 s: drums out, one open D chord rings to the end ---
place(music, pad(CH['D'] + [74], 4.5, attack=0.08), GROOVE1, 1.3)
for i, m in enumerate([74, 78, 81, 86]): place(music, pluck(m, 1.4, 4, 2.5), GROOVE1 + 0.9 + i * 0.12, 0.45)

# ducking: music sits lower while the viewer reads the Telugu lines
duck = np.ones(N)
for a, b in [(4.2, 7.6), (8.2, 10.5), (13.4, 15.5), (20.0, 22.5)]:
    i, j = int(a * SR), int(b * SR); duck[i:j] = 0.72
k = int(0.15 * SR); duck = np.convolve(duck, np.ones(k) / k, mode='same')
music *= duck[:, None]
# silence before the logo hit: pull everything to zero 3.38-3.50 s
i, j = int(3.38 * SR), int(3.5 * SR); music[i:j] *= np.linspace(1, 0, j - i)[:, None] * 0.0 + np.linspace(1, 0.0, j - i)[:, None]
out += music

# --- Sound effects placed on the picture events (frames / 30) ---
FX = [('riser', 3.45 - 2.17, 0.45, 0), ('logo', 3.5 - 0.28, 0.9, 0), ('check', 170 / 30, 0.35, 0.2),
      ('whoosh', 8.0 - 0.05, 0.45, -0.3), ('tap', 360 / 30, 0.8, 0), ('whoosh', 400 / 30 - 0.05, 0.4, 0.3),
      ('check', 428 / 30, 0.3, 0.2), ('whoosh', 19.5 - 0.05, 0.45, -0.3), ('tap', 734 / 30, 0.8, 0),
      ('end', 764 / 30 - 0.28, 0.8, 0)]
for name, t0, g, p in FX: place(out, load(name), t0, g, p)

# fade the last 0.25 s so the file ends clean, soft-clip safety
f = int(0.25 * SR); out[-f:] *= np.linspace(1, 0, f)[:, None]
out = np.tanh(out * 0.9)
sf.write(os.path.join(HERE, 'mix.wav'), out.astype(np.float32), SR)
print('mix.wav written', out.shape, 'peak', float(np.abs(out).max()))
