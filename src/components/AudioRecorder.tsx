"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Trash2 } from "lucide-react";

interface AudioRecorderProps {
  onRecorded: (blob: Blob | null, durationSec: number) => void;
  disabled?: boolean;
}

export function AudioRecorder({ onRecorded, disabled }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        const elapsedSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
        onRecorded(blob, elapsedSec);
      };
      mr.start();
      setIsRecording(true);
      setDuration(0);
      intervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 200);
    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      alert("Não foi possível acessar o microfone. Verifica permissões.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }

  function discardRecording() {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setDuration(0);
    onRecorded(null, 0);
  }

  return (
    <div className="space-y-2">
      {!audioBlob ? (
        <div className="flex items-center gap-2">
          {!isRecording ? (
            <Button
              type="button"
              onClick={startRecording}
              disabled={disabled}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Mic className="h-4 w-4" />
              Gravar áudio
            </Button>
          ) : (
            <Button
              type="button"
              onClick={stopRecording}
              variant="destructive"
              size="sm"
              className="gap-2 animate-pulse"
            >
              <Square className="h-4 w-4" />
              Parar ({duration}s)
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {audioUrl && <audio src={audioUrl} controls className="flex-1 h-8" />}
          <Button
            type="button"
            onClick={discardRecording}
            variant="ghost"
            size="sm"
            className="gap-1"
            aria-label="Descartar gravação"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
