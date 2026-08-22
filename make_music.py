# -*- coding: utf-8 -*-
"""
菜鸡修仙传 国风 BGM 合成脚本
风格：清雅悠远的仙镇氛围（近似问道·揽仙镇）—— 古筝式拨奏 + 温暖弦乐pad + 稀疏风铃 + 空间混响。
输出：bgm.wav (44.1kHz, 16bit, 单声道, 无缝循环)
"""
import numpy as np
import wave

SR = 44100
rng = np.random.default_rng(20260822)

def freq(note):
    # note 形如 ('D',4) 或 ('F#',4)；用 A4=440
    names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
    idx = names.index(note[0])
    midi = (note[1] + 1) * 12 + idx
    return 440.0 * (2 ** ((midi - 69) / 12))

def env(n, sr, a=0.004, dec=1.4, sus=0.0):
    t = np.arange(n) / sr
    # 快速起音 + 指数衰减
    att = np.clip(t / a, 0, 1)
    dec_env = np.exp(-t * (1.0 / dec))
    return att * dec_env

def pluck(f, dur, sr=SR, bright=0.5, decay=1.4):
    n = int(dur * sr)
    t = np.arange(n) / sr
    amps = np.array([1.0, 0.5, 0.26, 0.15, 0.085])
    out = np.zeros(n)
    for k in range(1, 6):
        fh = f * k * (1 + 0.0012 * k * k)
        dk = decay / (1 + 0.35 * k)          # 高次谐波衰减更快
        out += amps[k - 1] * np.sin(2 * np.pi * fh * t) * np.exp(-t / dk)
    # 琴弦起音“拨”的瞬态
    click = rng.normal(0, 1, min(n, int(0.012 * sr)))
    out[:len(click)] += 0.35 * click * np.exp(-np.arange(len(click)) / (0.002 * sr))
    e = env(n, sr, 0.004, decay)
    out *= e
    m = np.max(np.abs(out))
    return out / (m + 1e-9) if m > 0 else out

def pad(f, dur, sr=SR, lfo=0.18):
    n = int(dur * sr)
    t = np.arange(n) / sr
    # 轻微合唱 + 基频 + 八度
    w = (0.9 * np.sin(2 * np.pi * f * t)
         + 0.35 * np.sin(2 * np.pi * f * 1.006 * t)
         + 0.30 * np.sin(2 * np.pi * f * 0.994 * t)
         + 0.18 * np.sin(2 * np.pi * f * 2 * t)
         + 0.12 * np.sin(2 * np.pi * f * 2.005 * t))
    a = np.clip(t / 0.9, 0, 1)
    r = np.clip((dur - t) / 1.0, 0, 1)
    breath = 1 + lfo * 0.5 * np.sin(2 * np.pi * t / 6.5)
    out = w * a * r * breath
    m = np.max(np.abs(out))
    return out / (m + 1e-9) if m > 0 else out

def bell(f, dur, sr=SR):
    n = int(dur * sr)
    t = np.arange(n) / sr
    # 钟/铃：非谐泛音，衰减
    w = (0.7 * np.sin(2*np.pi*f*t)
         + 0.28 * np.sin(2*np.pi*f*2.67*t + 0.1)
         + 0.12 * np.sin(2*np.pi*f*5.33*t + 0.3))
    out = w * np.exp(-t / 1.1) * np.clip(t / 0.002, 0, 1)
    m = np.max(np.abs(out))
    return out / (m + 1e-9) if m > 0 else out

def shimmer(dur, sr=SR):
    n = int(dur * sr)
    noise = rng.normal(0, 1, n)
    # 简易低通（滑动平均）
    w = int(0.0016 * sr)
    k = np.ones(w) / w
    noise = np.convolve(noise, k, mode='same')
    # 缓慢起伏
    t = np.arange(n) / sr
    noise *= (0.5 + 0.5 * np.sin(2*np.pi*t/9.5 + 0.6))
    m = np.max(np.abs(noise)) + 1e-9
    return noise / m

def add(buf, start, sample):
    n = len(sample)
    end = min(start + n, len(buf))
    if start < len(buf) and end > start:
        buf[start:end] += sample[:end - start]

def make_ir(sr=SR, dur=1.6):
    n = int(dur * sr)
    t = np.arange(n) / sr
    ir = rng.normal(0, 1, n) * np.exp(-t * 4.2)
    # 低通软化
    w = int(0.001 * sr)
    ir = np.convolve(ir, np.ones(w)/w, mode='same')
    # 早期反射几个小尖峰
    for d in [0.021, 0.057, 0.093, 0.121]:
        i = int(d * sr)
        if i < n: ir[i] += (rng.normal(0, 1) * 0.4) * np.exp(-t[i] * 3)
    m = np.max(np.abs(ir)) + 1e-9
    return ir / m

def fftconv(x, h):
    # 用 FFT 做线性卷积
    n = len(x) + len(h) - 1
    nfft = 1 << (n - 1).bit_length()
    X = np.fft.rfft(x, nfft)
    H = np.fft.rfft(h, nfft)
    y = np.fft.irfft(X * H, nfft)[:n]
    return y

# ---------- 乐谱 ----------
# D 宫五声：D E F# A B
TONES = {
    'D': ['D4','F#4','A4'],
    'Bm': ['B3','D4','F#4','A4'],
    'G': ['G3','B3','D4','G4'],
    'A': ['A3','C#4','E4','A4']
}
CHORDS = ['D','Bm','G','A'] * 2  # 8 小节
BAR = 4 * (60 / 62.0)           # 62 BPM，4/4
TOTAL = BAR * len(CHORDS) + 1.6 # 预留混响尾

buf = np.zeros(int(TOTAL * SR))

for i, ch in enumerate(CHORDS):
    t0 = i * BAR
    # 解析 tone 名字
    def parse(s):
        import re
        m = re.match(r"([A-G]#?)(\d)", s)
        return (m.group(1), int(m.group(2)))
    chord_freqs = [freq(parse(tn)) for tn in TONES[ch]]

    # 1) pad：整小节铺底
    padmix = np.zeros(int((BAR + 0.3) * SR))
    for cf in chord_freqs:
        p = pad(cf, BAR + 0.3, lfo=0.18)
        padmix += p * (0.8 if cf > 200 else 0.95)
    add(buf, int(t0 * SR), padmix * 0.16)

    # 2) 竖琴式琶音（每拍两音 = 8 分音符）
    arp_tones = [];
    # 构建琶音序列
    seq = [chord_freqs[i % len(chord_freqs)] for i in range(0, 8)]
    # 让它更有线条：根、五、三、八、三、五
    oct_f = chord_freqs[0] * 2
    seq = [chord_freqs[0], chord_freqs[2 % len(chord_freqs)], chord_freqs[1 % len(chord_freqs)], oct_f,
           chord_freqs[2 % len(chord_freqs)], chord_freqs[1 % len(chord_freqs)], oct_f, chord_freqs[0]]
    for e in range(8):
        at = t0 + e * (BAR / 8)
        p = pluck(seq[e], 1.5, bright=0.55, decay=1.3)
        add(buf, int(at * SR), p * 0.11)

    # 3) 风铃（每一小节开头一个高音钟）
    top = seq[3] * 2
    b = bell(top, 1.6)
    add(buf, int((t0 + 0.02) * SR), b * 0.055)

# 4) 加一点 guqin 长音点缀（第2遍更高，避免单调）
mels = [('D',5),('B',4),('A',4),('G',4),('F#',4),('E',4),('D',5),('A',4)]
for j, note in enumerate(mels):
    at = (j % 8) * BAR + (0.4)
    f = freq(note)
    if j >= 4: f *= 2  # 第二遍翻高八度
    p = pluck(f, 2.0, bright=0.35, decay=1.8)
    add(buf, int(at * SR), p * 0.10)

# 5) 微风/水声氛围
sh = shimmer(TOTAL, SR)
add(buf, 0, sh * 0.03)

# ---------- 混响 ----------
ir = make_ir(SR, 1.6)
wet = fftconv(buf, ir)
wet = wet / (np.max(np.abs(wet)) + 1e-9)
mix = buf * 0.66 + wet[:len(buf)] * 0.5

# ---------- 无缝循环：把“混响尾”折叠进开头（样点级连续） ----------
M = int(len(CHORDS) * BAR * SR)   # 循环主体长度
K = int(1.2 * SR)                 # 折叠/交叉长度
clip = mix[:M + K]
loop_buf = np.empty(M)
i = np.arange(K)
loop_buf[:K] = clip[:K] * (i / K) + clip[M:M + K] * (1 - i / K)
loop_buf[K:] = clip[K:M]

peak = np.max(np.abs(loop_buf)) + 1e-9
loop_buf = loop_buf / peak * 0.88

# ---------- 写 WAV ----------
out = (loop_buf * 32767).astype(np.int16)
with wave.open('bgm.wav', 'w') as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    wf.writeframes(out.tobytes())

print("bgm.wav 长度 %.2f秒, %d samples, %.2f MB" % (
    len(loop_buf)/SR, len(loop_buf), len(out.tobytes())/1e6))
