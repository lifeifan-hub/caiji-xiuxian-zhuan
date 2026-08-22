# -*- coding: utf-8 -*-
"""
菜鸡修仙传 国风 BGM v2
意境：仙界宁静悠远，源远流长。主奏：笛子 + 古筝；辅助：沙锤 + 鼓。
结构起伏：静(起) → 渐渐激荡(峰) → 复归平缓(收)，循环无缝。
输出：bgm.wav (22.05kHz, 16bit, 单声道)
"""
import numpy as np
import wave

SR = 22050
rng = np.random.default_rng(20260822)

def lowpass(x, k, sr=SR):
    w = max(1, int(k * sr))
    return np.convolve(x, np.ones(w) / w, mode='same')

def highpass(x, sr=SR):
    return x - lowpass(x, 0.0018, sr)

def env(n, sr, a=0.02, dec=1.4):
    t = np.arange(n) / sr
    return np.clip(t / a, 0, 1) * np.exp(-t / dec)

# ---------- 笛子 ----------
def flute(f, dur, vol=1.0, vibrato=0.004, sr=SR):
    n = int(dur * sr)
    t = np.arange(n) / sr
    vr = np.clip((t - 0.35) / 0.6, 0, 1) * vibrato
    f_inst = f * (1 + vr * np.sin(2 * np.pi * 5.2 * t))
    ph = np.cumsum(2 * np.pi * f_inst / sr)
    tone = np.sin(ph) + 0.22 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    air = highpass(rng.normal(0, 1, n)) * 0.5
    a = np.clip(t / 0.06, 0, 1)
    r = np.clip((dur - t) / 0.5, 0, 1)
    e = a * r
    out = tone * e + air * e * 0.05
    breath = highpass(rng.normal(0, 1, n)) * np.exp(-t / 0.018)
    out += breath * 0.07
    m = np.max(np.abs(out)) + 1e-9
    return out / m * vol

# ---------- 古筝 ----------
def guzheng(f, dur, bright=0.45, decay=1.7, vol=1.0, sr=SR):
    n = int(dur * sr)
    t = np.arange(n) / sr
    amps = np.array([1.0, 0.48, 0.26, 0.14, 0.08])
    out = np.zeros(n)
    for k in range(1, 6):
        fh = f * k * (1 + 0.0008 * k * k)
        dk = decay / (1 + 0.3 * k)
        out += amps[k-1] * np.sin(2*np.pi*fh*t) * np.exp(-t / dk)
    click = rng.normal(0, 1, min(n, int(0.010 * sr)))
    out[:len(click)] += 0.18 * click * np.exp(-np.arange(len(click)) / (0.0016 * sr))
    out *= env(n, sr, 0.004, decay)
    m = np.max(np.abs(out)) + 1e-9
    return out / m * vol

# ---------- 沙锤 ----------
def shaker(dur, vol=1.0, sr=SR):
    n = int(dur * sr)
    t = np.arange(n) / sr
    noise = highpass(rng.normal(0, 1, n)) * (0.6 + 0.4 * np.exp(-t / 0.05))
    e = np.exp(-t / 0.055) * np.clip(t / 0.002, 0, 1)
    g = np.zeros(n)
    for off in [0.0, 0.022]:
        i0 = int(off * sr)
        if i0 < n:
            seg_n = min(n - i0, int(0.05 * sr))
            g[i0:i0+seg_n] += np.exp(-np.arange(seg_n) / (0.018 * sr))
    out = noise * e * (0.6 + 0.4 * g)
    m = np.max(np.abs(out)) + 1e-9
    return out / m * vol

# ---------- 鼓 ----------
def drum(f=150, dur=0.9, vol=1.0, sr=SR):
    n = int(dur * sr)
    t = np.arange(n) / sr
    f_inst = f * (0.55 + 0.45 * np.exp(-t / 0.12))
    ph = np.cumsum(2 * np.pi * f_inst / sr)
    body = np.sin(ph) * np.exp(-t / 0.45)
    click = highpass(rng.normal(0, 1, n)) * np.exp(-t / 0.006)
    out = 0.85 * body + 0.12 * click
    m = np.max(np.abs(out)) + 1e-9
    return out / m * vol

# ---------- 氛围铺底 ----------
def pad(f, dur, vol=1.0, lfo=0.2, sr=SR):
    n = int(dur * sr)
    t = np.arange(n) / sr
    w = (0.9*np.sin(2*np.pi*f*t) + 0.3*np.sin(2*np.pi*f*1.004*t)
         + 0.22*np.sin(2*np.pi*f*0.996*t) + 0.14*np.sin(2*np.pi*f*2*t))
    a = np.clip(t / 1.4, 0, 1)
    r = np.clip((dur - t) / 1.2, 0, 1)
    breath = 1 + lfo * np.sin(2*np.pi*t/7.5)
    out = w * a * r * breath
    m = np.max(np.abs(out)) + 1e-9
    return out / m * vol

def add(buf, start, sample):
    n = len(sample)
    end = min(start + n, len(buf))
    if start < len(buf) and end > start:
        buf[start:end] += sample[:end-start]

def make_ir(sr=SR, dur=1.7):
    n = int(dur * sr)
    t = np.arange(n) / sr
    ir = rng.normal(0, 1, n) * np.exp(-t * 3.8)
    ir = lowpass(ir, 0.001, sr)
    for d in [0.018, 0.052, 0.088, 0.12]:
        i = int(d * sr)
        if i < n: ir[i] += rng.normal(0, 1) * 0.35 * np.exp(-t[i]*3)
    m = np.max(np.abs(ir)) + 1e-9
    return ir / m

def fftconv(x, h):
    n = len(x) + len(h) - 1
    nfft = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(h, nfft), nfft)[:n]

# ---------- 乐谱 ----------
BAR = 4 * (60 / 58.0)
BARS = 12
TOTAL = BAR * BARS + 1.8
buf = np.zeros(int(TOTAL * SR))

CHORD = {
    'D':  [146.83, 220.00, 293.66, 369.99],
    'G':  [196.00, 293.66, 392.00, 493.88],
    'A':  [220.00, 277.18, 329.63, 440.00],
    'Bm': [246.94, 293.66, 369.99, 493.88],
}
PROG = ['D','G','A','Bm','G','A','D','A','Bm','G','A','D']
INTEN = [0.55, 0.6, 0.68, 0.6, 0.72, 0.9, 1.0, 0.82, 0.68, 0.6, 0.66, 0.55]

MELODY = [
    (0, 0.0, 440.00, 2.0), (0, 2.0, 493.88, 2.0),
    (1, 0.0, 587.33, 3.0), (1, 3.0, 493.88, 1.0),
    (2, 0.0, 440.00, 1.5), (2, 1.5, 369.99, 1.5), (2, 3.0, 440.00, 1.0),
    (3, 0.0, 329.63, 2.0), (3, 2.0, 369.99, 2.0),
    (4, 0.0, 493.88, 1.0), (4, 1.0, 587.33, 1.0), (4, 2.0, 659.25, 2.0),
    (5, 0.0, 739.99, 1.0), (5, 1.0, 659.25, 1.0), (5, 2.0, 587.33, 2.0),
    (6, 0.0, 659.25, 0.5), (6, 0.5, 739.99, 0.5), (6, 1.0, 880.00, 1.5), (6, 2.5, 739.99, 1.5),
    (7, 0.0, 659.25, 1.0), (7, 1.0, 587.33, 1.0), (7, 2.0, 493.88, 2.0),
    (8, 0.0, 587.33, 2.0), (8, 2.0, 493.88, 2.0),
    (9, 0.0, 440.00, 3.0), (9, 3.0, 369.99, 1.0),
    (10, 0.0, 440.00, 1.5), (10, 1.5, 369.99, 1.5), (10, 3.0, 440.00, 1.0),
    (11, 0.0, 493.88, 2.0), (11, 2.0, 587.33, 2.0),
]

for i, ch in enumerate(PROG):
    t0 = i * BAR
    inten = INTEN[i]
    tones = CHORD[ch]

    root, fifth = tones[0], tones[1]
    add(buf, int(t0*SR), pad(root, BAR+0.4, vol=0.08*inten))
    add(buf, int(t0*SR), pad(fifth, BAR+0.4, vol=0.05*inten))

    step = BAR/8 if inten > 0.7 else BAR/4
    arp_seq = [tones[0], tones[2 % len(tones)], tones[1], tones[3 % len(tones)]]
    seqlen = int(round(BAR/step))
    patt = [arp_seq[j % len(arp_seq)] for j in range(seqlen)]
    for e, f in enumerate(patt):
        at = t0 + e * step
        b = guzheng(f * (2 if e % 2 == 1 else 1), 1.4, bright=0.4+0.25*inten, decay=1.5, vol=0.10*inten)
        add(buf, int(at*SR), b)

    if inten > 0.68:
        for e in range(8):
            at = t0 + e * (BAR/8)
            add(buf, int(at*SR), shaker(0.12, vol=0.04*inten))
    elif i % 2 == 0:
        for e in [2, 6]:
            at = t0 + e * (BAR/8)
            add(buf, int(at*SR), shaker(0.12, vol=0.02))

    if inten > 0.8:
        for b0 in [0, 2]:
            add(buf, int((t0+b0*BAR/4)*SR), drum(150, 0.8, vol=0.11*inten))
    elif inten > 0.68 and i % 2 == 1:
        add(buf, int(t0*SR), drum(120, 0.7, vol=0.06))

for (bar, beat, f, dur) in MELODY:
    at = bar * BAR + beat
    inten = INTEN[bar]
    fp = flute(f, dur, vol=0.5 + 0.25*inten, vibrato=0.004 + 0.002*inten)
    add(buf, int(at*SR), fp)

ir = make_ir(SR, 1.7)
wet = fftconv(buf, ir)
wet = wet / (np.max(np.abs(wet)) + 1e-9)
mix = buf * 0.64 + wet[:len(buf)] * 0.5

M = int(BARS * BAR * SR)
K = int(1.4 * SR)
clip = mix[:M + K]
loop_buf = np.empty(M)
i = np.arange(K)
loop_buf[:K] = clip[:K] * (i / K) + clip[M:M + K] * (1 - i / K)
loop_buf[K:] = clip[K:M]
loop_buf /= (np.max(np.abs(loop_buf)) + 1e-9)
loop_buf *= 0.85

out = (loop_buf * 32767).astype(np.int16)
with wave.open('bgm.wav', 'w') as wf:
    wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR)
    wf.writeframes(out.tobytes())
print("bgm.wav  %.2f 秒  %.2f MB" % (len(loop_buf)/SR, len(out.tobytes())/1e6))
