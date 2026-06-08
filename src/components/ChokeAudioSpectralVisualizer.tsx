import React, { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Activity } from "lucide-react";
import { HexagramState, DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES } from "../types";

interface ChokeAudioSpectralVisualizerProps {
  chokeActive: boolean;
  chokeFreq: number; // nominally 6500Hz
  currentHexagram?: HexagramState;
}

export default function ChokeAudioSpectralVisualizer({
  chokeActive,
  chokeFreq,
  currentHexagram = HexagramState.IDLE,
}: ChokeAudioSpectralVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const subOscillatorRef = useRef<OscillatorNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isAudioContextReady, setIsAudioContextReady] = useState(false);

  // Lazy initialize organic multi-oscillator acoustic synthesizer
  const initializeAudio = async () => {
    if (audioContextRef.current) return;

    try {
      // Create audio context
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      // Create Analyser
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      // Create Gain Node for general output
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(isAudioEnabled ? 0.08 : 0, ctx.currentTime);
      gainNodeRef.current = gainNode;

      // Create Analog resonant warmth BiquadFilter (lowpass filter)
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.setValueAtTime(3.5, ctx.currentTime);
      filterRef.current = filter;

      // Create Primary warm oscillator (Triangle)
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      
      // Create Sub resonance oscillator (Sine) tuned an octave below for subsea depths
      const subOsc = ctx.createOscillator();
      subOsc.type = "sine";

      // Create LFO for subtle organic frequency vibrato
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(3.8, ctx.currentTime); // Slow warm 3.8Hz base drift rate
      lfoRef.current = lfo;

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(1.8, ctx.currentTime); // Subtle vibrato pitch offset

      // Connect LFO vibrato channel
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfoGain.connect(subOsc.frequency);

      // Base audio scaling (6.5 kHz down to a nice deep fundamental at 280 Hz)
      const targetAudioFreq = (chokeFreq / 6500) * 280;
      osc.frequency.setValueAtTime(targetAudioFreq, ctx.currentTime);
      subOsc.frequency.setValueAtTime(targetAudioFreq * 0.5, ctx.currentTime);

      oscillatorRef.current = osc;
      subOscillatorRef.current = subOsc;

      // Sub-mixer gain for warm acoustics
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.4, ctx.currentTime);

      // Connect DSP network
      osc.connect(filter);
      subOsc.connect(subGain);
      subGain.connect(filter);

      filter.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Trigger generators
      osc.start();
      subOsc.start();
      lfo.start();

      setIsAudioContextReady(true);
    } catch (err) {
      console.error("Failed to construct high-fidelity Web Audio API nodes:", err);
    }
  };

  // Toggle speaker volume controls with anti-pop envelope fading
  const toggleAudioSound = async () => {
    const nextState = !isAudioEnabled;
    setIsAudioEnabled(nextState);

    if (!audioContextRef.current) {
      await initializeAudio();
    }

    const ctx = audioContextRef.current;
    const gainNode = gainNodeRef.current;

    if (ctx && gainNode) {
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      // Linear ramp profile prevents pop transients
      gainNode.gain.setTargetAtTime(nextState ? 0.06 : 0, ctx.currentTime, 0.05);
    }
  };

  // Turn on/off oscillator generation based on active states
  useEffect(() => {
    const ctx = audioContextRef.current;
    const gainNode = gainNodeRef.current;
    
    if (ctx && gainNode) {
      if (chokeActive) {
        if (ctx.state === "suspended") {
          ctx.resume();
        }
        gainNode.gain.setTargetAtTime(isAudioEnabled ? 0.06 : 0, ctx.currentTime, 0.1);
      } else {
        gainNode.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      }
    }
  }, [chokeActive, isAudioEnabled]);

  // Real-time modulation of synthesis parameters (Filter cutoff, LFO frequencies) based on active emotional profiles
  useEffect(() => {
    const osc = oscillatorRef.current;
    const subOsc = subOscillatorRef.current;
    const filter = filterRef.current;
    const lfo = lfoRef.current;
    const ctx = audioContextRef.current;

    if (osc && ctx) {
      // Calculate and smooth target audio fundamental frequency
      const targetAudioFreq = (chokeFreq / 6500) * 280;
      osc.frequency.setTargetAtTime(targetAudioFreq, ctx.currentTime, 0.12);
      if (subOsc) {
        subOsc.frequency.setTargetAtTime(targetAudioFreq * 0.5, ctx.currentTime, 0.15);
      }

      // Map models emotional weighting parameters to voice acoustics
      const profile = DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES[currentHexagram];
      if (profile) {
        const weights = profile.weights;
        const tension = weights.TENSION || 0.0;
        const serenity = weights.SERENITY || 0.0;
        const quietude = weights.QUIETUDE || 0.0;
        const fear = weights.FEAR || 0.0;

        // Warm analog lowpass filter cutoff mapping
        // Higher tension = brighter resonance, higher quietude = muffled bass warmth
        const baseCutoff = 380;
        const targetCutoff = baseCutoff + (tension * 280) + (fear * 350) - (quietude * 180) - (serenity * 140);
        if (filter) {
          filter.frequency.setTargetAtTime(Math.max(110, targetCutoff), ctx.currentTime, 0.15);
        }

        // LFO Vibrato rate modulation
        // Tense/Scared states speed up the frequency drift, Peaceful/Quiet states make it a slow breathing drift
        const baseLfoFreq = 3.8;
        const targetLfoFreq = baseLfoFreq + (tension * 2.8) + (fear * 3.5) - (quietude * 1.8) - (serenity * 1.2);
        if (lfo) {
          lfo.frequency.setTargetAtTime(Math.max(1.0, targetLfoFreq), ctx.currentTime, 0.2);
        }
      }
    }
  }, [chokeFreq, currentHexagram]);

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let localAnalyser = analyserRef.current;
    
    const dataSize = 128;
    const timeData = new Uint8Array(dataSize);
    let wavePhase = 0;

    const render = () => {
      localAnalyser = analyserRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // Deep dark acoustic radar background
      ctx.fillStyle = "#070a12";
      ctx.fillRect(0, 0, width, height);

      // Draw acoustic grids
      ctx.strokeStyle = "rgba(6, 182, 212, 0.04)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      for (let x = 40; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Populate waveform oscillograph nodes
      if (localAnalyser && chokeActive) {
        localAnalyser.getByteTimeDomainData(timeData);
      } else {
        // Fallback sinusoidal simulation with organic jitter
        for (let i = 0; i < dataSize; i++) {
          if (chokeActive) {
            const freqFactor = (chokeFreq / 6500) * 0.22;
            timeData[i] = 128 + Math.sin(i * freqFactor + wavePhase) * 42 + (Math.random() - 0.5) * 3;
          } else {
            timeData[i] = 128 + (Math.random() - 0.5) * 2;
          }
        }
        wavePhase += 0.12;
      }

      // Draw high-contrast cyan spectrum vector lines
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = chokeActive ? "#06b6d4" : "rgba(100, 116, 139, 0.35)";
      ctx.shadowBlur = chokeActive ? 8 : 0;
      ctx.shadowColor = "#22d3ee";
      
      ctx.beginPath();
      const sliceWidth = width / dataSize;
      let x = 0;

      for (let i = 0; i < dataSize; i++) {
        const v = timeData[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Expressive indicator details
      ctx.fillStyle = chokeActive ? "#22d3ee" : "#475569";
      ctx.font = "bold 9px JetBrains Mono, monospace";
      
      const profile = DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES[currentHexagram];
      const toneLabel = profile ? Object.entries(profile.weights).reduce((a, b) => a[1] > b[1] ? a : b)[0] : "QUIETUDE";

      ctx.fillText(
        chokeActive 
          ? `MHD COAX RESONATOR ACTIVE: ${(chokeFreq / 1000).toFixed(3)} kHz [Acoustics: Organic Warmth]` 
          : "MHD COAX ACOUSTIC HARMONICS: STANDBY",
        8,
        15
      );

      ctx.fillText(
        `ACOUSTIC PROFILE: ${toneLabel} (LFO: ${lfoRef.current ? "ACTIVE" : "OFF"})`,
        8,
        height - 8
      );

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [chokeActive, chokeFreq, currentHexagram]);

  // Cleanup synthesizer context on destroy
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="space-y-1.5 font-mono text-[10px] bg-slate-950 border border-slate-900 p-3 rounded" id="choke-audio-spectral-visualizer">
      <div className="flex justify-between items-center text-[8px] text-slate-450 select-none font-medium">
        <span className="flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-cyan-500 animate-pulse" />
          HIGH-FIDELITY ORGANIC RESONANCE HARMONIZER
        </span>
        
        <button
          onClick={toggleAudioSound}
          type="button"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[8px] font-bold border transition-all cursor-pointer ${
            isAudioEnabled
              ? "bg-cyan-950/20 border-cyan-500 text-cyan-400"
              : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-350"
          }`}
          title={isAudioEnabled ? "Silence Co-driver Hum" : "Unmute Web Audio Hum"}
        >
          {isAudioEnabled ? (
            <>
              <Volume2 className="h-2.5 w-2.5 text-cyan-400 animate-bounce" />
              <span>SOUND ACTIVE</span>
            </>
          ) : (
            <>
              <VolumeX className="h-2.5 w-2.5" />
              <span>SOUND OFF</span>
            </>
          )}
        </button>
      </div>

      <div className="relative rounded overflow-hidden border border-slate-850 h-20 bg-[#070a12]">
        <canvas
          ref={canvasRef}
          width={380}
          height={80}
          className="w-full h-full block"
        />
        <div className="absolute inset-0 pointer-events-none border border-cyan-500/5 select-none" />
      </div>

      <span className="block text-[7.5px] leading-normal text-slate-500 select-none">
        This high-fidelity view captures physical microsecond electrical fluctuations synthesized directly through the web browser's sound hardware co-processor, reacting to raw analog H-Bridge load limits.
      </span>
    </div>
  );
}
