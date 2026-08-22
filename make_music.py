# -*- coding: utf-8 -*-
"""
菜鸡修仙传 国风 BGM v3 · 天墉城 / 仙城市集
意境：繁华鲜活、温暖市井，往来熙攘又带着仙气。
乐器：明快拨弦主奏(琵琶/古筝音色) + 笛子点缀 + 沙锤 + 民族鼓/木鱼(板眼) + 风铃。
结构：热闹主段(起) → 安静街巷(中段对比) → 村熟收束(闹市高峰)，循环无缝。
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

def env(n, sr, a=0.02, dec=1.2):
    t = np.arange(n) / sr
    return np.clip(t / a, 0, 1) * np.exp(-t / dec)

# ---------- 拨弦（琵琶/古筝） ----------
def pluck(f, dur, bright=0.6, decay=1.0, vol=1.0, sr=SR):
    n = int(dur * sr)
    t = np.arange(n) / sr
    amps = np.array([1.0, 0.6, 0.32, 0.18, 0.10])
    out = np.zeros(n)
    for k in range(1, 6):
        fh = f * k * (1 + 0.0007 * k * k)
        dk = decay / (1 + 0.32 * k)
        out += amps[k-1] * np.sin(2*np.pi*fh*t) * np.exp(-t / dk)
    click = rng.normal(0, 1, min(n, int(0.008 * sr)))
    out[:len(click)] += 0.2 * click * np.exp(-np.arange(len(click)) / (0.0012 * sr))
    out *= env(n, sr, 0.003, decay)
    m = np.max(np.abs(out)) + 1e-9
    return out / m * vol

# ---------- 笛子 ----------
def flute(f, dur, vol=1.0, vibrato=0.005, sr=SR):
    n = int(dur * sr)
    t = np.arange(n) / sr
    vr = np.clip((t - 0.2) / 0.5, 0, 1) * vibrato
    f_inst = f * (1 + vr * np.sin(2 * np.pi * 5.4 * t))
    ph = np.cumsum(2 * np.pi * f_inst / sr)
    tone = np.sin(ph) + 0.2 * np.sin(2 * ph) + 0.05 * np.sin(3 * ph)
    air = highpass(rng.normal(0, 1, n)) * 0.4
    e = np.clip(t / 0.05, 0, 1) * np.clip((dur - t) / 0.4, 0, 1)
    out = tone * e + air * e * 0.05
    breath = highpass(rng.normal(0, 1, n)) * np.exp(-t / 0.015)
    out += breath * 0.08
    m = np.max(np.abs(out)) + 1e-9
    return out / m * vol

# ---------- 沙锤 ----------
def shaker(dur, vol=1.0, sr=SR):
    n = int(dur * sr)
    t = np.arange(n) / sr
    noise = highpass(rng.normal(0, 1, n))
    e = np.exp(-t / 0.05) * np.clip(t / 0.002, 0, 1)
    g = np.zeros(n)
    for off in [0.0, 0.02]:
        i0 = int(off * sr)
        if i0 < n:
            seg_n = min(n - i0, int(0.045 * sr))
            g[i0:i0+seg_n] += np.exp(-np.arange(seg_n) / (0.016 * sr))
    out = noise * e * (0.55 + 0.45 * g)
    m = np.max(np.abs(out)) + 1e-9
    return out / m * vol

# ---------- 民族低鼓 ----------
def bigdrum(f=92, dur=0.7, vol=1.0, sr=SR):
    n = int(dur * sr)
    t = np.arange(n) / sr
    f_inst = f * (0.6 + 0.4 * np.exp(-t / 0.1))
    ph = np.cumsum(2 * np.pi * f_inst / sr)
    body = np.sin(ph) * np.exp(-t / 0.4)
    click = highpass(rng.normal(0, 1, n)) * np.exp(-t / 0.006)
    out = 0.8 * body + 0.15 * click
    m = np.max(np.abs(out)) + 1e-9
    return out / m * vol

# ---------- 木鱼 / 板 (轻快) ----------
def woodblock(f=1120, dur=0.1, vol=1.0, sr=SR):
    n = int(dur * sr)
    t = np.arange(n) / sr
    body = (np.sin(2*np.pi*f*t) * np.exp(-t/0.028)
            + 0.5 * np.sin(2*np.pi*f*2.6*t) * np.exp(-t/0.02))
    click = highpass(rng.normal(0, 1, n)) * np.exp(-t / 0.003)
    out = body * 0.8 + click * 0.2
    m = np.max(np.abs(out)) + 1e-9
    return out / m * vol

# ---------- 风铃/小钟 ----------
def bell(f=1580, dur=0.7, vol=1.0, sr=SR):
    n = int(dur * sr)
    t = np.arange(n) / sr
    w = (0.7*np.sin(2*np.pi*f*t) + 0.28*np.sin(2*np.pi*f*2.7*t+0.1)
         + 0.12*np.sin(2*np.pi*f*5.2*t+0.3))
    out = w * np.exp(-t/0.5) * np.clip(t/0.001, 0, 1)
    m = np.max(np.abs(out)) + 1e-9
    return out / m * vol

# ---------- 温暖铺底 ----------
def pad(f, dur, vol=1.0, sr=SR):
    n = int(dur * sr)
    t = np.arange(n) / sr
    w = (0.9*np.sin(2*np.pi*f*t) + 0.3*np.sin(2*np.pi*f*1.004*t)
         + 0.2*np.sin(2*np.pi*f*0.996*t) + 0.12*np.sin(2*np.pi*f*2*t))
    a = np.clip(t / 1.0, 0, 1) * np.clip((dur - t) / 0.8, 0, 1)
    out = w * a * (1 + 0.18*np.sin(2*np.pi*t/5.0))
    m = np.max(np.abs(out)) + 1e-9
    return out / m * vol

def add(buf, start, sample):
    n = len(sample)
    end = min(start + n, len(buf))
    if start < len(buf) and end > start:
        buf[start:end] += sample[:end-start]

def make_ir(sr=SR, dur=1.5):
    n = int(dur * sr)
    t = np.arange(n) / sr
    ir = rng.normal(0, 1, n) * np.exp(-t * 5.5)
    ir = lowpass(ir, 0.001, sr)
    for d in [0.02, 0.055, 0.09, 0.125]:
        i = int(d * sr)
        if i < n: ir[i] += rng.normal(0, 1) * 0.35 * np.exp(-t[i]*3)
    m = np.max(np.abs(ir)) + 1e-9
    return ir / m

def fftconv(x, h):
    n = len(x) + len(h) - 1
    nfft = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(h, nfft), nfft)[:n]

# ---------- 乐谱 ----------
BPM = 100
BAR = 4 * (60 / BPM)      # 2.4s
BARS = 16
TOTAL = BAR * BARS + 1.6
buf = np.zeros(int(TOTAL * SR))

CHORD = {
    'D':  [146.83, 293.66, 369.99, 587.33],
    'G':  [196.00, 293.66, 392.00, 493.88],
    'A':  [220.00, 277.18, 329.63, 440.00],
    'Bm': [246.94, 293.66, 369.99, 493.88],
}
PROG = ['D','G','A','D','G','A','D','A','Bm','G','A','D','D','G','A','D']
# Per-bar energy: 热闹 → 安静街巷 → 闹市收束
ENER = [0.75,0.8,0.82,0.78, 0.8,0.86,0.88,0.78, 0.5,0.54,0.5,0.56, 0.78,0.88,0.98,0.84]

# 拨弦主旋律：8分音跑动(热闹) + 安静段舒情
MELODY = [
    # 段落A (bar0-7)：明快 run
    (0,0.0,587.33,0.5),(0,0.5,739.99,0.5),(0,1.0,880,0.5),(0,1.5,987.77,0.5),(0,2.0,880,0.5),(0,2.5,739.99,0.5),(0,3.0,659.25,0.5),(0,3.5,587.33,0.5),
    (1,0.0,987.77,0.5),(1,0.5,880,0.5),(1,1.0,739.99,0.5),(1,1.5,659.25,0.5),(1,2.0,739.99,0.5),(1,2.5,880,0.5),(1,3.0,987.77,0.5),(1,3.5,880,0.5),
    (2,0.0,659.25,0.5),(2,0.5,739.99,0.5),(2,1.0,880,0.5),(2,1.5,987.77,0.5),(2,2.0,1174.66,0.5),(2,2.5,987.77,0.5),(2,3.0,880,0.5),(2,3.5,739.99,0.5),
    (3,0.0,659.25,0.5),(3,0.5,739.99,0.5),(3,1.0,880,0.5),(3,1.5,987.77,0.5),(3,2.0,880,0.5),(3,2.5,739.99,0.5),(3,3.0,659.25,0.5),(3,3.5,587.33,0.5),
    (4,0.0,587.33,0.5),(4,0.5,739.99,0.5),(4,1.0,880,0.5),(4,1.5,987.77,0.5),(4,2.0,880,0.5),(4,2.5,739.99,0.5),(4,3.0,659.25,0.5),(4,3.5,587.33,0.5),
    (5,0.0,987.77,0.5),(5,0.5,1174.66,0.5),(5,1.0,987.77,0.5),(5,1.5,880,0.5),(5,2.0,739.99,0.5),(5,2.5,880,0.5),(5,3.0,987.77,0.5),(5,3.5,1174.66,0.5),
    (6,0.0,987.77,0.5),(6,0.5,880,0.5),(6,1.0,739.99,0.5),(6,1.5,659.25,0.5),(6,2.0,739.99,0.5),(6,2.5,880,0.5),(6,3.0,987.77,0.5),(6,3.5,880,0.5),
    (7,0.0,659.25,0.5),(7,0.5,739.99,0.5),(7,1.0,880,0.5),(7,1.5,987.77,0.5),(7,2.0,880,0.5),(7,2.5,739.99,0.5),(7,3.0,659.25,0.5),(7,3.5,587.33,0.5),
    # 段落B (bar8-11)：安静街巷，慢板、笛子舒情
    (8,0.0,587.33,2.0),(8,2.0,493.88,2.0),
    (9,0.0,440.0,2.0),(9,2.0,369.99,2.0),
    (10,0.0,440.0,2.0),(10,2.0,493.88,2.0),
    (11,0.0,587.33,4.0),
    # 段落C (bar12-15)：热闹收束
    (12,0.0,587.33,0.5),(12,0.5,739.99,0.5),(12,1.0,880,0.5),(12,1.5,987.77,0.5),(12,2.0,880,0.5),(12,2.5,739.99,0.5),(12,3.0,659.25,0.5),(12,3.5,587.33,0.5),
    (13,0.0,987.77,0.5),(13,0.5,880,0.5),(13,1.0,739.99,0.5),(13,1.5,659.25,0.5),(13,2.0,739.99,0.5),(13,2.5,880,0.5),(13,3.0,987.77,0.5),(13,3.5,880,0.5),
    (14,0.0,659.25,0.5),(14,0.5,739.99,0.5),(14,1.0,880,0.5),(14,1.5,987.77,0.5),(14,2.0,1174.66,0.5),(14,2.5,987.77,0.5),(14,3.0,880,0.5),(14,3.5,739.99,0.5),
    (15,0.0,659.25,0.5),(15,0.5,739.99,0.5),(15,1.0,880,0.5),(15,1.5,987.77,0.5),(15,2.0,880,0.5),(15,2.5,739.99,0.5),(15,3.0,659.25,0.5),(15,3.5,587.33,0.5),
]

for i, ch in enumerate(PROG):
    t0 = i * BAR
    e = ENER[i]
    tones = CHORD[ch]
    # 温暖铺底(安静段更明显)
    if e < 0.6:
        add(buf, int(t0*SR), pad(tones[0], BAR+0.4, vol=0.05))
        add(buf, int(t0*SR), pad(tones[1]*1.5, BAR+0.4, vol=0.025))

    # 拨弦琶音/装饰（主旋律之外的和声点）
    step = BAR/4
    arp = tones[:4]
    for e2, f in enumerate(arp):
        at = t0 + e2 * step
        if e > 0.6 and e2 % 2 == 1:
            add(buf, int(at*SR), pluck(f, 0.6, bright=0.5, decay=0.8, vol=0.10*e))

    # 主旋律（8分音用 pluck，慢板用 pluck 长音）
    # （主旋律在下方单独统一处理，这里只处理节奏声部）

    # 沙锤：热闹段 8分音；安静段仅重拍
    if e > 0.6:
        for k in range(8):
            add(buf, int((t0 + k*BAR/8)*SR), shaker(0.1, vol=0.055*e))
    else:
        for k in [1, 3]:
            add(buf, int((t0 + (2*k+1)*BAR/8)*SR), shaker(0.1, vol=0.02))

    # 民族鼓 + 木鱼板眼：热闹段 1&3 低鼓，2&4 木鱼
    if e > 0.6:
        for b in [0, 2]:
            add(buf, int((t0 + b*BAR/4)*SR), bigdrum(92, 0.7, vol=0.14*e))
        for b in [1, 3]:
            add(buf, int((t0 + b*BAR/4)*SR), woodblock(1120, 0.1, vol=0.06*e))
    elif e > 0.5:
        add(buf, int(t0*SR), bigdrum(80, 0.7, vol=0.05))
        add(buf, int((t0+2*BAR/4)*SR), woodblock(1120, 0.1, vol=0.03))

    # 风铃：闹市高峰段(bar14-15) 敲小钟，加仙气
    if i in (14, 15):
        add(buf, int(t0*SR), bell(1580, 0.7, vol=0.06))

# 主旋律统一渲染（拨弦主奏，能量越高越亮越快）
for (bar, beat, f, dur) in MELODY:
    at = bar * BAR + beat
    e = ENER[bar]
    bright = 0.55 + 0.2*e
    dec = 1.4 if e <= 0.6 else 0.85
    vol = 0.05 if e <= 0.6 else 0.18 + 0.14*e
    add(buf, int(at*SR), pluck(f, dur if dur <= 2 else 2.0, bright=bright, decay=dec, vol=vol))

# 笛子：安静段主奏(bar8-11) + 热闹段做高音点缀
flute_mel = [
    (8,0.0,880,2.0),(8,2.0,880,2.0),
    (9,0.0,659.25,2.0),(9,2.0,659.25,2.0),
    (10,0.0,739.99,2.0),(10,2.0,739.99,2.0),
    (11,0.0,880,3.0),(11,3.0,987.77,1.0),
    (5,2.0,1174.66,1.0),(13,2.0,1174.66,1.0),
]
for (bar, beat, f, dur) in flute_mel:
    at = bar * BAR + beat
    e = ENER[bar]
    add(buf, int(at*SR), flute(f, dur, vol=0.10 if e <= 0.6 else 0.16))

# 混响 + 无缝循环
ir = make_ir(SR, 1.5)
wet = fftconv(buf, ir)
wet = wet / (np.max(np.abs(wet)) + 1e-9)
mix = buf * 0.72 + wet[:len(buf)] * 0.38

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
