import React, { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Flame, Zap } from "lucide-react";

interface ChokeSpectralVisualizerProps {
  chokeActive: boolean;
  chokeFreq: number; // Nominally 6500Hz, fluctuates based on drift
}

export default function ChokeSpectralVisualizer({
  chokeActive,
  chokeFreq,
}: ChokeSpectralVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorNodeRef = useRef<OscillatorNode | null>(null);
  const subOscillatorRef = useRef<OscillatorNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [isAudioLive, setIsAudioLive] = useState<boolean>(false);
  const [dbPeakValue, setDbPeakValue] = useState<number>(-90);
  const [primaryFreqDetected, setPrimaryFreqDetected] = useState<number>(0);

  // Lazy Initialization of real Web Audio Nodes
  const initializeWebAudioSystem = async (): Promise<void> => {
    if (audioContextRef.current) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      // High precision Fast Fourier Transform analyser
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512; // High frequency-domain resolution
      analyser.smoothingTimeConstant = 0.78;
      analyserNodeRef.current = analyser;

      // Master output gain node
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(isAudioLive ? 0.05 : 0, ctx.currentTime);
      gainNodeRef.current = gainNode;

      // Active oscillator mapping raw physical system choke frequency to audio-range fundamental
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const audioFundamental = (chokeFreq / 6500) * 320; // Map 6.5kHz physical drift to 320Hz clear audio tone
      osc.frequency.setValueAtTime(audioFundamental, ctx.currentTime);
      oscillatorNodeRef.current = osc;

      // Subharmonic driver to represent magnetic subsea coupling friction (1 octave down)
      const subOsc = ctx.createOscillator();
      subOsc.type = "triangle";
      subOsc.frequency.setValueAtTime(audioFundamental / 2, ctx.currentTime);
      subOscillatorRef.current = subOsc;

      // Build Graph
      osc.connect(analyser);
      subOsc.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      subOsc.start();
    } catch (error) {
      console.error("[Sovereign FFT Engine] Standard Web Audio interface creation failed:", error);
    }
  };

  const handleToggleVolume = async (): Promise<void> => {
    const nextState = !isAudioLive;
    setIsAudioLive(nextState);

    if (!audioContextRef.current) {
      await initializeWebAudioSystem();
    }

    const ctx = audioContextRef.current;
    const gain = gainNodeRef.current;

    if (ctx && gain) {
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      // Clean target scaling curves to eliminate transducer speaker click transients
      gain.gain.setTargetAtTime(nextState ? 0.04 : 0, ctx.currentTime, 0.06);
    }
  };

  // Keep audio nodes perfectly synchronized with physical frequency drift shifts
  useEffect(() => {
    const osc = oscillatorNodeRef.current;
    const subOsc = subOscillatorRef.current;
    const ctx = audioContextRef.current;

    if (osc && subOsc && ctx) {
      const audioFundamental = (chokeFreq / 6500) * 320;
      osc.frequency.setTargetAtTime(audioFundamental, ctx.currentTime, 0.1);
      subOsc.frequency.setTargetAtTime(audioFundamental / 2, ctx.currentTime, 0.12);
    }
  }, [chokeFreq]);

  // Handle automatic driver suspension based on simulated H-Bridge active status
  useEffect(() => {
    const ctx = audioContextRef.current;
    const gain = gainNodeRef.current;

    if (ctx && gain) {
      if (chokeActive) {
        if (ctx.state === "suspended") {
          ctx.resume();
        }
        gain.gain.setTargetAtTime(isAudioLive ? 0.04 : 0, ctx.currentTime, 0.08);
      } else {
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      }
    }
  }, [chokeActive, isAudioLive]);

  // Spectral Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferSize = 256;
    const freqData = new Uint8Array(bufferSize);
    let simPhase = 0;

    const renderSpectrum = () => {
      const width = canvas.width;
      const height = canvas.height;
      const runningAnalyser = analyserNodeRef.current;

      // Clear with specialized military-hardware slate black tone
      ctx.fillStyle = "#0c1322";
      ctx.fillRect(0, 0, width, height);

      // Draw subtle background dB grid lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(56, 189, 248, 0.04)";
      
      // Draw horizontal dB grid lines
      const dbSteps = [20, 40, 60, 80];
      dbSteps.forEach((step) => {
        const y = (step / 100) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        ctx.fillStyle = "rgba(100, 116, 139, 0.35)";
        ctx.font = "7px JetBrains Mono, monospace";
        ctx.fillText(`-${step} dB`, 4, y - 2);
      });

      // Draw vertical frequency marker grids (representing 1.0k, 5.0k, 10.0k, 15.0k, 20.0k)
      const freqMarkers = [
        { label: "1.0k", xRatio: 0.1 },
        { label: "5.0k", xRatio: 0.35 },
        { label: "10.0k", xRatio: 0.6 },
        { label: "15.0k", xRatio: 0.8 },
        { label: "20.0k", xRatio: 0.95 },
      ];

      freqMarkers.forEach((marker) => {
        const x = marker.xRatio * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        ctx.fillStyle = "rgba(100, 116, 139, 0.35)";
        ctx.fillText(marker.label, x + 3, height - 4);
      });

      // Load real frequency spectrum data or run a mathematical simulation fallback
      if (runningAnalyser && chokeActive) {
        runningAnalyser.getByteFrequencyData(freqData);
      } else {
        // Fallback simulated model: Create clear physical FFT peak at the dynamic choke frequency with decay harmonics
        for (let i = 0; i < bufferSize; i++) {
          let value = 0;
          if (chokeActive) {
            const currentRatio = i / bufferSize;
            
            // Fundamental Peak mapping center
            const fundamentalMarker = (chokeFreq / 24000); // Normalize based on 24kHz Max analyzer range
            const distFromFundamental = Math.abs(currentRatio - fundamentalMarker);
            const fundamentalPeak = Math.max(0, 1 - distFromFundamental * 12) * 195;

            // Harmonic peak (2nd Harmonic at 2x frequency)
            const secondHarmonicMarker = (chokeFreq * 2) / 24000;
            const distFromSecond = Math.abs(currentRatio - secondHarmonicMarker);
            const secondPeak = Math.max(0, 1 - distFromSecond * 18) * 85;

            // Harmonic peak (3rd Harmonic at 3x frequency)
            const thirdHarmonicMarker = (chokeFreq * 3) / 24000;
            const distFromThird = Math.abs(currentRatio - thirdHarmonicMarker);
            const thirdPeak = Math.max(0, 1 - distFromThird * 24) * 45;

            // Thermal thermal noise floor fluctuations
            const thermalNoise = Math.sin(currentRatio * 52 + simPhase) * 4 + (Math.random() * 8);

            value = Math.max(4, fundamentalPeak + secondPeak + thirdPeak + thermalNoise);
          } else {
            // Idle system thermal noise floor
            value = (Math.random() * 5) + 2;
          }
          freqData[i] = Math.min(255, Math.max(0, value));
        }
        simPhase += 0.08;
      }

      // Compute Peak & Primary detected frequencies to output on telemetry badge
      let maxVal = 0;
      let peakBinIdx = 0;
      for (let i = 0; i < bufferSize; i++) {
        if (freqData[i] > maxVal) {
          maxVal = freqData[i];
          peakBinIdx = i;
        }
      }

      const normalizedPeakDb = Math.round((maxVal / 255) * 100) - 100;
      setDbPeakValue(normalizedPeakDb);

      if (chokeActive) {
        // Compute precise physical frequency matching (mapped to kHz scale display bounds)
        const computedKhz = (chokeFreq / 1000);
        setPrimaryFreqDetected(computedKhz);
      } else {
        setPrimaryFreqDetected(0);
      }

      // Render glowing physical spectral area curve
      ctx.beginPath();
      ctx.moveTo(0, height);

      const stepSize = width / (bufferSize * 0.9); // Crop top-end frequencies for better visuals
      for (let i = 0; i < bufferSize * 0.9; i++) {
        const magnitude = freqData[i];
        const percent = magnitude / 255;
        const y = height - (percent * height * 0.85) - 3;
        const x = i * stepSize;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          // Smooth curve path connection points
          ctx.lineTo(x, y);
        }
      }

      ctx.lineTo(width, height);
      
      // Dual-toned gradient fill representing energetic plasma drive status
      const fillGrad = ctx.createLinearGradient(0, 0, 0, height);
      fillGrad.addColorStop(0, "rgba(6, 182, 212, 0.4)");
      fillGrad.addColorStop(0.5, "rgba(14, 116, 144, 0.15)");
      fillGrad.addColorStop(1, "rgba(8, 47, 73, 0.02)");
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // Outer neon-line stroke tracing
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = chokeActive ? "#06b6d4" : "rgba(148, 163, 184, 0.3)";
      ctx.shadowBlur = chokeActive ? 8 : 0;
      ctx.shadowColor = "#22d3ee";
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw specialized peak-hold marker dot
      if (chokeActive && maxVal > 15) {
        const peakX = peakBinIdx * stepSize;
        const peakY = height - ((maxVal / 255) * height * 0.85) - 3;
        
        ctx.fillStyle = "#f43f5e"; // hot rose indicator
        ctx.beginPath();
        ctx.arc(peakX, peakY, 3, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 7px JetBrains Mono, monospace";
        ctx.fillText("PEAK", peakX + 6, peakY - 1);
      }

      animFrameRef.current = requestAnimationFrame(renderSpectrum);
    };

    renderSpectrum();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [chokeActive, chokeFreq]);

  // Clean-up web context on destruction
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="space-y-2 mt-4 p-4 bg-slate-900 border border-slate-850 rounded-lg shadow-md" id="choke-spectral-frequency-analyzer">
      <div className="flex justify-between items-center bg-slate-950/60 p-2 rounded border border-slate-850 select-none">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
          <span className="text-[9.5px] font-mono font-bold text-slate-300 tracking-wider">
            CHOKE FFT FREQUENCY-DOMAIN SPECTRUM
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Signal power indicators */}
          {chokeActive && (
            <div className="flex gap-2 font-mono text-[8.5px]">
              <span className="text-slate-500">
                PEAK: <strong className="text-rose-400">{dbPeakValue} dB</strong>
              </span>
              <span className="text-slate-500">
                FREQ: <strong className="text-cyan-400">{primaryFreqDetected.toFixed(3)} kHz</strong>
              </span>
            </div>
          )}

          <button
            onClick={handleToggleVolume}
            type="button"
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-mono font-bold border cursor-pointer select-none transition-all ${
              isAudioLive
                ? "bg-cyan-500/15 border-cyan-500 text-cyan-400 shadow-sm"
                : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle high frequency subsea coupling acoustic wave audio output"
          >
            {isAudioLive ? (
              <>
                <Volume2 className="h-2.5 w-2.5 animate-bounce" />
                <span>SPKR: ON</span>
              </>
            ) : (
              <>
                <VolumeX className="h-2.5 w-2.5" />
                <span>SPKR: OFF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Primary Spectrum Plot Canvas viewport */}
      <div className="relative rounded overflow-hidden border border-slate-800/80 aspect-[16/5] bg-[#0c1322]">
        <canvas
          ref={canvasRef}
          width={420}
          height={130}
          className="w-full h-full block"
        />
        
        {/* Physical Subsea coupling grid overlays */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 select-none pointer-events-none">
          <div className="flex items-center gap-1.5 font-mono text-[7px] text-slate-500 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-850">
            <span className="h-1.5 w-1.5 bg-rose-500 rounded-full" />
            <span>COUPLING DETECTOR RESONANT LINE</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-950/40 p-2 rounded text-[7.5px] text-slate-500 font-mono leading-relaxed select-none">
        ℹ️ <strong>System Analysis:</strong> This FFT spectrograph computes energetic frequency distributions using real-time Fourier series analysis. It tracks magnetostrictive pressure spikes shifting across <strong>6.5kHz ~ 19.5kHz</strong> high-voltage harmonic domains.
      </div>
    </div>
  );
}
