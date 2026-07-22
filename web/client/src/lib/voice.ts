import { useCallback, useEffect, useRef, useState } from "react";
import { clearLastRtc, sendRtcSignal, useGameStore } from "./store";

const ICE: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

type VoiceStatus = "idle" | "connecting" | "connected" | "error";

export function useVoiceChat(peerId: string | null, enabled: boolean) {
  const playerId = useGameStore((s) => s.playerId);
  const lastRtc = useGameStore((s) => s.lastRtc);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [micMuted, setMicMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [speakingRemote, setSpeakingRemote] = useState(false);
  const makingOffer = useRef(false);
  const polite = useRef(false);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    setStatus("idle");
    setSpeakingRemote(false);
  }, []);

  const ensurePc = useCallback(async () => {
    if (!peerId || !playerId) return null;
    if (pcRef.current) return pcRef.current;

    polite.current = playerId > peerId;
    const pc = new RTCPeerConnection(ICE);
    pcRef.current = pc;

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        sendRtcSignal(peerId, { kind: "ice", candidate: ev.candidate.toJSON() });
      }
    };

    pc.ontrack = (ev) => {
      if (!remoteAudioRef.current) {
        remoteAudioRef.current = new Audio();
        remoteAudioRef.current.autoplay = true;
      }
      remoteAudioRef.current.srcObject = ev.streams[0];
      remoteAudioRef.current.muted = speakerMuted;
      setStatus("connected");
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("connected");
      if (pc.connectionState === "failed") setStatus("error");
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
        track.enabled = !micMuted;
      }
    } catch {
      setStatus("error");
      return null;
    }

    return pc;
  }, [peerId, playerId, micMuted, speakerMuted]);

  const start = useCallback(async () => {
    if (!peerId || !playerId) return;
    setStatus("connecting");
    const pc = await ensurePc();
    if (!pc) return;

    // Perfect negotiation: the impolite peer (lexicographically smaller id) offers first
    if (!polite.current) {
      try {
        makingOffer.current = true;
        await pc.setLocalDescription(await pc.createOffer());
        sendRtcSignal(peerId, { kind: "sdp", sdp: pc.localDescription });
      } finally {
        makingOffer.current = false;
      }
    }
  }, [ensurePc, peerId, playerId]);

  useEffect(() => {
    if (!enabled || !peerId) {
      cleanup();
      return;
    }
    void start();
    return () => cleanup();
  }, [enabled, peerId, start, cleanup]);

  useEffect(() => {
    if (!lastRtc || !peerId || lastRtc.from !== peerId) return;
    const payload = lastRtc.payload as {
      kind?: string;
      sdp?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    };
    clearLastRtc();

    void (async () => {
      const pc = await ensurePc();
      if (!pc || !payload.kind) return;

      if (payload.kind === "sdp" && payload.sdp) {
        const readyForOffer =
          !makingOffer.current &&
          (pc.signalingState === "stable" || pc.signalingState === "have-local-offer");
        const offerCollision = payload.sdp.type === "offer" && !readyForOffer;
        if (offerCollision && !polite.current) return;

        await pc.setRemoteDescription(payload.sdp);
        if (payload.sdp.type === "offer") {
          await pc.setLocalDescription(await pc.createAnswer());
          sendRtcSignal(peerId, { kind: "sdp", sdp: pc.localDescription });
        }
      } else if (payload.kind === "ice" && payload.candidate) {
        try {
          await pc.addIceCandidate(payload.candidate);
        } catch {
          // ignore early candidates
        }
      }
    })();
  }, [lastRtc, peerId, ensurePc]);

  useEffect(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    for (const track of stream.getAudioTracks()) {
      track.enabled = !micMuted;
    }
  }, [micMuted]);

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = speakerMuted;
    }
  }, [speakerMuted]);

  // Simple remote speaking indicator via Web Audio when connected
  useEffect(() => {
    if (status !== "connected" || !remoteAudioRef.current?.srcObject) return;
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(
      remoteAudioRef.current.srcObject as MediaStream,
    );
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setSpeakingRemote(avg > 18);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      void ctx.close();
    };
  }, [status]);

  return {
    status,
    micMuted,
    speakerMuted,
    speakingRemote,
    toggleMic: () => setMicMuted((v) => !v),
    toggleSpeaker: () => setSpeakerMuted((v) => !v),
  };
}
