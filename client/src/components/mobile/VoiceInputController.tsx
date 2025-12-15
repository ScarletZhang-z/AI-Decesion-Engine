import { useEffect, useRef, useState } from "react";
import { MobileInputBar } from "./MobileInputBar";

type VoiceInputControllerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  onActivateChat?: () => void;
};

export function VoiceInputController({
  value,
  onChange,
  onSend,
  onActivateChat,
}: VoiceInputControllerProps) {
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const recognitionRef = useRef<any>(null);
  const voiceDraftRef = useRef("");
  const shouldCaptureRef = useRef(false);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.();
    };
  }, []);

  const getRecognition = () => {
    if (typeof window === "undefined") return null;
    if (recognitionRef.current) return recognitionRef.current;

    const RecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!RecognitionCtor) return null;

    const recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      if (!shouldCaptureRef.current) return;
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join("");
      voiceDraftRef.current = transcript;
      setVoiceTranscript(transcript.trim());
    };

    recognition.onend = () => {
      shouldCaptureRef.current = false;
      setIsListening(false);
    };

    recognition.onerror = () => {
      shouldCaptureRef.current = false;
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    return recognition;
  };

  const startVoiceCapture = () => {
    onActivateChat?.();
    const recognition = getRecognition();
    if (!recognition) {
      setVoiceTranscript("Voice input is not supported in this browser.");
      return;
    }
    if (isListening) return;

    shouldCaptureRef.current = true;
    voiceDraftRef.current = "";
    setVoiceTranscript("");
    setIsListening(true);

    try {
      recognition.start();
    } catch (error) {
      setIsListening(false);
    }
  };

  const stopVoiceCapture = (sendTranscript: boolean) => {
    const recognition = recognitionRef.current;
    shouldCaptureRef.current = false;
    if (recognition && isListening) {
      recognition.stop();
    }

    setIsListening(false);
    const transcript = voiceDraftRef.current.trim();
    voiceDraftRef.current = "";
    setVoiceTranscript("");

    if (sendTranscript && transcript) {
      onSend(transcript);
      onChange("");
      setVoiceMode(false);
      onActivateChat?.();
    }
  };

  const handleSubmit = () => {
    onSend(value);
    onChange("");
    setVoiceMode(false);
    onActivateChat?.();
  };

  const handleMicClick = () => {
    if (value.trim()) {
      handleSubmit();
      return;
    }
    setVoiceMode(true);
    onActivateChat?.();
  };

  const handleVoicePressStart = () => {
    startVoiceCapture();
  };

  const handleVoicePressEnd = () => {
    stopVoiceCapture(true);
  };

  const handleExitVoiceMode = () => {
    stopVoiceCapture(false);
    setVoiceMode(false);
  };

  return (
    <MobileInputBar
      value={value}
      onChange={onChange}
      onSubmit={handleSubmit}
      voiceMode={voiceMode}
      onMicClick={handleMicClick}
      onPressStart={handleVoicePressStart}
      onPressEnd={handleVoicePressEnd}
      listening={isListening}
      transcript={voiceTranscript}
      onExitVoiceMode={handleExitVoiceMode}
    />
  );
}
