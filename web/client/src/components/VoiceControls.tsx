type VoiceApi = {
  status: string;
  micMuted: boolean;
  speakerMuted: boolean;
  speakingRemote: boolean;
  toggleMic: () => void;
  toggleSpeaker: () => void;
};

export function VoiceControls({
  voice,
  peerReady,
}: {
  voice: VoiceApi;
  peerReady: boolean;
}) {
  if (!peerReady) {
    return (
      <section className="panel voice-panel">
        <h2>Vocal</h2>
        <p className="muted">Le chat vocal s’active dès que l’adversaire rejoint.</p>
      </section>
    );
  }

  const statusLabel =
    voice.status === "connected"
      ? "Connecté"
      : voice.status === "connecting"
        ? "Connexion…"
        : voice.status === "error"
          ? "Micro refusé / erreur"
          : "Inactif";

  return (
    <section className={`panel voice-panel ${voice.speakingRemote ? "speaking" : ""}`}>
      <h2>Vocal</h2>
      <p className="muted">{statusLabel}</p>
      <div className="actions">
        <button type="button" className="btn" onClick={voice.toggleMic}>
          {voice.micMuted ? "Micro coupé" : "Couper le micro"}
        </button>
        <button type="button" className="btn" onClick={voice.toggleSpeaker}>
          {voice.speakerMuted ? "Son coupé" : "Couper le son"}
        </button>
      </div>
    </section>
  );
}
