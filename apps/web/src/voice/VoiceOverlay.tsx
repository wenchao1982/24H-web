export interface VoiceOverlayProps {
  transcript: string;
  onStop: () => void;
}

/** 语音聆听浮层（M19）：实时显示 `voice.transcript` 累积文本 + 停止。 */
export default function VoiceOverlay({ transcript, onStop }: VoiceOverlayProps) {
  return (
    <div className="voice-overlay" role="dialog" aria-label="语音">
      <div className="voice-overlay-card">
        <p className="voice-overlay-status">
          <i className="dot" data-on aria-hidden="true" />
          正在聆听…
        </p>
        <p className="voice-overlay-text" aria-live="polite">
          {transcript || "…"}
        </p>
        <button type="button" className="ghost" onClick={onStop}>
          停止
        </button>
      </div>
    </div>
  );
}
