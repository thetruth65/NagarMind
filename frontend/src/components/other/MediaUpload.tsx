import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Video, Upload, Play, X, Loader2, Plus } from 'lucide-react'
import { uploadAPI } from '@/lib/api'
import toast from 'react-hot-toast'

interface MediaFile {
  url: string
  type: 'photo' | 'video'
  duration?: number
}

interface MediaUploadProps {
  onMediaSelect: (media: MediaFile[]) => void
  maxPhotos?: number
  maxVideos?: number
  maxVideoDuration?: number
}

type TabType = 'photo-gallery' | 'photo-capture' | 'video-gallery' | 'video-record'

export function MediaUpload({
  onMediaSelect,
  maxPhotos = 5,
  maxVideos = 2,
  maxVideoDuration = 30,
}: MediaUploadProps) {
  const [media, setMedia] = useState<MediaFile[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('photo-gallery')
  const [uploading, setUploading] = useState(false)
  const [isRecordingVideo, setIsRecordingVideo] = useState(false)
  const [videoTime, setVideoTime] = useState(0)
  const [cameraActive, setCameraActive] = useState(false)

  const fileInputPhotoRef = useRef<HTMLInputElement>(null)
  const fileInputVideoRef = useRef<HTMLInputElement>(null)
  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const videoTimerRef = useRef<NodeJS.Timeout | null>(null)

  const uploadMedia = async (file: File, type: 'photo' | 'video') => {
    try {
      const mimeType = file.type
      const { data: presign } = await uploadAPI.presign(file.name, mimeType, 'complaints')

      if (presign.upload_url) {
        await fetch(presign.upload_url, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': mimeType },
        })
        return presign.public_url
      } else {
        // Dev mode: use blob URL
        return URL.createObjectURL(file)
      }
    } catch (err) {
      console.error('Upload error:', err)
      throw err
    }
  }

  const handlePhotoGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    const photoCount = media.filter(m => m.type === 'photo').length
    const remaining = maxPhotos - photoCount
    const toUpload = Array.from(files).slice(0, remaining)

    if (toUpload.length === 0) {
      toast.error(`Maximum ${maxPhotos} photos allowed`)
      return
    }

    setUploading(true)
    try {
      for (const file of toUpload) {
        const url = await uploadMedia(file, 'photo')
        setMedia(m => [...m, { url, type: 'photo' }])
      }
      toast.success(`${toUpload.length} photo(s) added`)
    } catch {
      toast.error('Failed to upload photos')
    } finally {
      setUploading(false)
    }
  }

  const handlePhotoCaptureClick = async () => {
    if (cameraActive) {
      // Capture photo
      if (cameraVideoRef.current && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        if (ctx) {
          ctx.drawImage(cameraVideoRef.current, 0, 0)
          canvasRef.current.toBlob(async (blob) => {
            if (blob) {
              try {
                setUploading(true)
                const url = await uploadMedia(
                  new File([blob], 'photo.jpg', { type: 'image/jpeg' }),
                  'photo'
                )
                setMedia(m => [...m, { url, type: 'photo' }])
                setCameraActive(false)
                toast.success('Photo captured!')
              } catch {
                toast.error('Failed to save photo')
              } finally {
                setUploading(false)
              }
            }
          }, 'image/jpeg')
        }
      }
    } else {
      // Start camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream
          streamRef.current = stream
          setCameraActive(true)
        }
      } catch {
        toast.error('Camera access denied')
      }
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }
    setCameraActive(false)
  }

  const handleVideoGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    const videoCount = media.filter(m => m.type === 'video').length
    const remaining = maxVideos - videoCount
    const toUpload = Array.from(files).slice(0, remaining)

    if (toUpload.length === 0) {
      toast.error(`Maximum ${maxVideos} videos allowed`)
      return
    }

    setUploading(true)
    try {
      for (const file of toUpload) {
        const url = await uploadMedia(file, 'video')
        // Extract video duration (basic - would need more robust solution)
        setMedia(m => [...m, { url, type: 'video', duration: maxVideoDuration }])
      }
      toast.success(`${toUpload.length} video(s) added`)
    } catch {
      toast.error('Failed to upload videos')
    } finally {
      setUploading(false)
    }
  }

  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      })
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream
        streamRef.current = stream
      }

      const mr = new MediaRecorder(stream)
      const chunks: BlobPart[] = []

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks, { type: 'video/webm' })

        try {
          setUploading(true)
          const url = await uploadMedia(
            new File([blob], 'video.webm', { type: 'video/webm' }),
            'video'
          )
          setMedia(m => [...m, { url, type: 'video', duration: videoTime }])
          toast.success('Video recorded successfully!')
          setVideoTime(0)
          setCameraActive(false)
        } catch {
          toast.error('Failed to save video')
        } finally {
          setUploading(false)
        }
      }

      mediaRecorderRef.current = mr
      mr.start()
      setIsRecordingVideo(true)

      // Timer
      let time = 0
      videoTimerRef.current = setInterval(() => {
        time++
        setVideoTime(time)
        if (time >= maxVideoDuration) {
          mr.stop()
          setIsRecordingVideo(false)
          if (videoTimerRef.current) clearInterval(videoTimerRef.current)
        }
      }, 1000)
    } catch {
      toast.error('Camera/audio access denied')
    }
  }

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecordingVideo) {
      mediaRecorderRef.current.stop()
      setIsRecordingVideo(false)
      if (videoTimerRef.current) clearInterval(videoTimerRef.current)
      setVideoTime(0)
    }
  }

  const removeMedia = (index: number) => {
    const newMedia = media.filter((_, i) => i !== index)
    setMedia(newMedia)
    onMediaSelect(newMedia)
  }

  // Auto-call onMediaSelect when media changes
  useEffect(() => {
    onMediaSelect(media)
  }, [media])

  const photoCount = media.filter(m => m.type === 'photo').length
  const videoCount = media.filter(m => m.type === 'video').length

  const tabs = [
    { id: 'photo-gallery' as const, label: '📸 Photo Gallery', icon: Upload },
    { id: 'photo-capture' as const, label: '📷 Capture Photo', icon: Camera },
    { id: 'video-gallery' as const, label: '🎥 Video Gallery', icon: Upload },
    { id: 'video-record' as const, label: '🎬 Record Video', icon: Video },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Tab buttons */}
      <div className="grid grid-cols-2 gap-2">
        {tabs.map(tab => (
          <motion.button
            key={tab.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (cameraActive) stopCamera()
              setActiveTab(tab.id)
            }}
            className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors
              ${activeTab === tab.id
                ? 'bg-primary-700 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {tab.label}
          </motion.button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-3"
        >
          {/* Photo Gallery */}
          {activeTab === 'photo-gallery' && (
            <>
              <input
                ref={fileInputPhotoRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoGalleryUpload}
              />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputPhotoRef.current?.click()}
                disabled={uploading || photoCount >= maxPhotos}
                className="w-full py-4 border-2 border-dashed border-primary-300 rounded-xl
                           flex items-center justify-center gap-2 text-primary-700
                           hover:bg-primary-50 disabled:opacity-50 transition-colors"
              >
                {uploading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={20} />
                    Add Photos from Gallery (Max {maxPhotos})
                  </>
                )}
              </motion.button>
              <p className="text-xs text-gray-500">
                {photoCount}/{maxPhotos} photos added
              </p>
            </>
          )}

          {/* Photo Capture */}
          {activeTab === 'photo-capture' && (
            <>
              {cameraActive ? (
                <>
                  <video
                    ref={cameraVideoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-xl bg-black"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handlePhotoCaptureClick}
                      disabled={uploading}
                      className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white
                                font-medium rounded-xl flex items-center justify-center gap-2"
                    >
                      {uploading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                        </>
                      ) : (
                        <>
                          <Camera size={18} />
                          Capture
                        </>
                      )}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={stopCamera}
                      className="flex-1 py-3 border-2 border-gray-300 text-gray-700
                                font-medium rounded-xl"
                    >
                      Cancel
                    </motion.button>
                  </div>
                </>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePhotoCaptureClick}
                  disabled={uploading}
                  className="w-full py-4 border-2 border-dashed border-primary-300
                            rounded-xl flex items-center justify-center gap-2 text-primary-700
                            hover:bg-primary-50 disabled:opacity-50"
                >
                  <Camera size={20} />
                  Open Camera
                </motion.button>
              )}
            </>
          )}

          {/* Video Gallery */}
          {activeTab === 'video-gallery' && (
            <>
              <input
                ref={fileInputVideoRef}
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={handleVideoGalleryUpload}
              />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputVideoRef.current?.click()}
                disabled={uploading || videoCount >= maxVideos}
                className="w-full py-4 border-2 border-dashed border-primary-300 rounded-xl
                           flex items-center justify-center gap-2 text-primary-700
                           hover:bg-primary-50 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Video size={20} />
                    Add Videos from Gallery (Max {maxVideos})
                  </>
                )}
              </motion.button>
              <p className="text-xs text-gray-500">
                Max 30 seconds per video • {videoCount}/{maxVideos} videos added
              </p>
            </>
          )}

          {/* Video Record */}
          {activeTab === 'video-record' && (
            <>
              {cameraActive ? (
                <>
                  <video
                    ref={cameraVideoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-xl bg-black"
                  />
                  {isRecordingVideo && (
                    <motion.div
                      animate={{ backgroundColor: ['#fef3c7', '#fce7f3'] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-100 rounded-lg"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="w-2 h-2 bg-red-500 rounded-full"
                      />
                      <span className="text-sm font-medium text-amber-900">
                        Recording: {videoTime}/{maxVideoDuration}s
                      </span>
                    </motion.div>
                  )}
                  <div className="flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={isRecordingVideo ? stopVideoRecording : startVideoRecording}
                      disabled={uploading}
                      className={`flex-1 py-3 text-white font-medium rounded-xl
                                flex items-center justify-center gap-2
                                ${isRecordingVideo ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'}`}
                    >
                      {uploading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                        </>
                      ) : isRecordingVideo ? (
                        <>
                          <span className="w-4 h-4 bg-white rounded-sm" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Video size={18} />
                          Start Recording
                        </>
                      )}
                    </motion.button>
                    {!isRecordingVideo && (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          stopCamera()
                          setCameraActive(false)
                        }}
                        className="flex-1 py-3 border-2 border-gray-300 text-gray-700
                                  font-medium rounded-xl"
                      >
                        Done
                      </motion.button>
                    )}
                  </div>
                </>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setActiveTab('video-record')
                    setCameraActive(true)
                    // Trigger camera open after state update
                    setTimeout(startVideoRecording, 100)
                  }}
                  disabled={uploading}
                  className="w-full py-4 border-2 border-dashed border-primary-300 rounded-xl
                            flex items-center justify-center gap-2 text-primary-700
                            hover:bg-primary-50 disabled:opacity-50"
                >
                  <Video size={20} />
                  Open Camera to Record
                </motion.button>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Media gallery */}
      {media.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="text-sm font-medium text-gray-700 mb-2">
            {photoCount} photo(s) • {videoCount} video(s)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {media.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative aspect-square rounded-lg overflow-hidden bg-gray-100"
              >
                {item.type === 'photo' ? (
                  <img src={item.url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <video src={item.url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play size={24} className="text-white" />
                    </div>
                    {item.duration && (
                      <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                        {item.duration}s
                      </div>
                    )}
                  </>
                )}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => removeMedia(i)}
                  className="absolute top-0.5 right-0.5 w-6 h-6 bg-red-500 hover:bg-red-600
                             rounded-full flex items-center justify-center transition-colors"
                >
                  <X size={14} className="text-white" />
                </motion.button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
