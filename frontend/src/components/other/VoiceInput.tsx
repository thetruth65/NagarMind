import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff, Loader2, Volume2, RotateCcw } from 'lucide-react'
import WaveSurfer from 'wavesurfer.js'

interface VoiceInputProps {
  onTranscript: (transcript: string, audioUrl: string | null) => void
  language: string
  isRecording: boolean
  isTranscribing: boolean
  partialTranscript: string
  finalTranscript: string
  confidence: number
  waveformData: number[]
  onStart: () => void
  onStop: () => void
  onReset: () => void
}

export function VoiceInput({
  onTranscript,
  language,
  isRecording,
  isTranscribing,
  partialTranscript,
  finalTranscript,
  confidence,
  waveformData,
  onStart,
  onStop,
  onReset,
}: VoiceInputProps) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!waveformRef.current) return

    // Initialize WaveSurfer
    wavesurferRef.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: isRecording ? '#ef4444' : '#3b82f6',
      progressColor: isRecording ? '#dc2626' : '#2563eb',
      barWidth: 4,
      barGap: 2,
      barRadius: 2,
      height: 60,
      normalize: true,
      fillParent: true,
    })

    return () => {
      wavesurferRef.current?.destroy()
    }
  }, [])

  // Update waveform visualization based on recording state and data
  useEffect(() => {
    // WaveSurfer automatically handles visualization, no manual canvas drawing needed
    if (waveformData.length > 0) {
      // Waveform is being updated by WaveSurfer internally
    }
  }, [waveformData, isRecording])

  // Timer for recording duration
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setRecordingTime(0)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRecording])

  // Call onTranscript when final transcript is ready
  useEffect(() => {
    if (finalTranscript) {
      onTranscript(finalTranscript, null)
    }
  }, [finalTranscript, onTranscript])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const displayTranscript = finalTranscript || partialTranscript

  return (
    <div className="space-y-4">
      {/* Recording indicator and timer */}
      {isRecording && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="w-3 h-3 bg-red-500 rounded-full"
          />
          <span className="text-sm font-medium text-red-700">Recording...</span>
          <span className="text-xs text-red-600 font-mono ml-auto">{formatTime(recordingTime)}</span>
        </motion.div>
      )}

      {/* Waveform visualization */}
      {(isRecording || displayTranscript) && (
        <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-gray-50 p-3">
          <div ref={waveformRef} className="w-full" />
        </div>
      )}

      {/* Recording controls */}
      <div className="flex gap-2">
        {!isRecording ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onStart}
            disabled={isTranscribing}
            className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white
                       font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <Mic size={18} />
            Start Recording
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onStop}
            className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 text-white font-medium
                       rounded-xl flex items-center justify-center gap-2 animate-pulse"
          >
            <MicOff size={18} />
            Stop Recording
          </motion.button>
        )}

        {displayTranscript && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onReset}
            disabled={isTranscribing}
            className="py-3 px-4 border-2 border-gray-200 text-gray-600 hover:border-gray-300
                       hover:bg-gray-50 disabled:opacity-50 font-medium rounded-xl transition-colors"
          >
            <RotateCcw size={18} />
          </motion.button>
        )}
      </div>

      {/* Transcription display */}
      {isTranscribing && finalTranscript === '' && (
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <Loader2 size={16} className="text-blue-600 animate-spin" />
          <span className="text-sm text-blue-700">Processing audio...</span>
        </div>
      )}

      {displayTranscript && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4"
        >
          <div className="flex items-start gap-2 mb-2">
            <Volume2 size={16} className="text-blue-700 mt-1 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-blue-600 mb-1">
                🎤 Transcribed from {language === 'en' ? 'English' : language}
              </p>
              {confidence > 0 && (
                <p className="text-xs text-blue-500">
                  Confidence: {(confidence * 100).toFixed(0)}%
                </p>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-800 font-body leading-relaxed">{displayTranscript}</p>
          <p className="text-xs text-gray-500 mt-2">
            {displayTranscript.length} characters
          </p>
        </motion.div>
      )}

      {/* Instructions */}
      {!isRecording && !displayTranscript && (
        <div className="text-xs text-gray-500 text-center py-3 border border-dashed border-gray-200 rounded-lg">
          Click "Start Recording" to begin voice input. Stop recording after completing your thought.
          Speaking for 3+ seconds of silence will auto-stop the recording.
        </div>
      )}
    </div>
  )
}
