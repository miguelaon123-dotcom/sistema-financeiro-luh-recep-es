'use client'

import { useState, useRef, useEffect, ChangeEvent } from 'react'
import {
  UploadCloud,
  Camera,
  X,
  Check,
  RefreshCw,
  AlertCircle,
  FolderOpen,
} from 'lucide-react'

interface ImageUploadInputProps {
  defaultImageUrl?: string | null
  fileInputName?: string
  urlInputName?: string
  label?: string
}

export function ImageUploadInput({
  defaultImageUrl = null,
  fileInputName = 'image_file',
  urlInputName = 'image_url',
  label = 'Foto do Produto',
}: ImageUploadInputProps) {
  const [preview, setPreview] = useState<string | null>(defaultImageUrl || null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [manualUrl, setManualUrl] = useState<string>(defaultImageUrl || '')

  // Câmera ao vivo
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const mobileCameraInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Gerenciamento da Stream de Câmera
  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    setCameraError(null)
    setCapturedBlob(null)
    setCapturedPreview(null)

    // Parar stream anterior se existir
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Se o navegador não suportar getUserMedia direto, aciona o input nativo de câmera
        mobileCameraInputRef.current?.click()
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })

      setCameraStream(stream)
      setCameraOpen(true)

      // Anexar ao vídeo
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch((err) => {
            console.error('Erro ao dar play no vídeo:', err)
          })
        }
      }, 100)
    } catch (err: any) {
      console.warn('Câmera via getUserMedia bloqueada ou indisponível:', err)
      // Tentar abrir com câmera frontal se a traseira falhar
      if (mode === 'environment') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          })
          setCameraStream(stream)
          setCameraOpen(true)
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.srcObject = stream
              videoRef.current.play()
            }
          }, 100)
          return
        } catch {}
      }

      // Se falhou webcam web, aciona o input nativo do sistema
      if (mobileCameraInputRef.current) {
        mobileCameraInputRef.current.click()
      } else {
        setCameraError(
          'Permissão de câmera negada ou dispositivo sem câmera detectada. Use o botão "Escolher Arquivo" para enviar uma foto.'
        )
      }
    }
  }

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
      setCameraStream(null)
    }
    setCameraOpen(false)
    setCapturedBlob(null)
    setCapturedPreview(null)
    setCameraError(null)
  }

  const switchCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(nextMode)
    startCamera(nextMode)
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (blob) {
            setCapturedBlob(blob)
            setCapturedPreview(URL.createObjectURL(blob))
          }
        },
        'image/jpeg',
        0.92
      )
    }
  }

  const confirmCapturedPhoto = () => {
    if (!capturedBlob) return

    const photoFile = new File([capturedBlob], `foto-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    })

    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(photoFile)
      fileInputRef.current.files = dataTransfer.files
    }

    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview)
    }

    setPreview(capturedPreview)
    setFileName(`Foto Tirada (${(capturedBlob.size / 1024).toFixed(0)} KB)`)
    stopCamera()
  }

  // Cleanup de streams ao desmontar
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [cameraStream])

  // Handlers para arquivos
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview)
      }
      const objectUrl = URL.createObjectURL(file)
      setPreview(objectUrl)
      setFileName(file.name)
    }
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview)
    }
    setPreview(null)
    setFileName(null)
    setManualUrl('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (mobileCameraInputRef.current) {
      mobileCameraInputRef.current.value = ''
    }
  }

  const handleManualUrlChange = (val: string) => {
    setManualUrl(val)
    if (!fileName) {
      setPreview(val.trim() || null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-[#1d1d1f]">{label}</label>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-[11px] text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
        >
          {showUrlInput ? 'Ocultar link manual' : 'Colar link de imagem (URL)'}
        </button>
      </div>

      {/* Inputs nativos escondidos */}
      <input
        type="file"
        ref={fileInputRef}
        name={fileInputName}
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        type="file"
        ref={mobileCameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && fileInputRef.current) {
            const dt = new DataTransfer()
            dt.items.add(file)
            fileInputRef.current.files = dt.files
            handleFileChange(e)
          }
        }}
        className="hidden"
      />
      <input type="hidden" name={urlInputName} value={manualUrl} />

      {/* Caixa de Upload / Foto */}
      {preview ? (
        <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-[#e5e5ea] bg-[#fafafc] p-4 shadow-2xs">
          <div className="relative h-28 w-28 sm:h-32 sm:w-32 shrink-0 overflow-hidden rounded-xl border border-[#e5e5ea] bg-white shadow-2xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Prévia da foto" className="h-full w-full object-contain p-1" />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-1 right-1 rounded-full bg-black/70 p-1 text-white hover:bg-black transition-colors cursor-pointer"
              title="Remover foto"
            >
              <X size={12} />
            </button>
          </div>

          <div className="flex flex-col items-center sm:items-start text-center sm:text-left flex-1 min-w-0">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1a7f37]">
              <Check size={14} /> Foto selecionada
            </span>
            <p className="text-xs text-[#1d1d1f] font-medium mt-1 truncate max-w-xs">
              {fileName || 'Imagem cadastrada'}
            </p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button
                type="button"
                onClick={() => startCamera()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#e5e5ea] bg-white px-3 py-1.5 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all shadow-2xs cursor-pointer"
              >
                <Camera size={13} />
                <span>Tirar outra foto</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#e5e5ea] bg-white px-3 py-1.5 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all shadow-2xs cursor-pointer"
              >
                <FolderOpen size={13} />
                <span>Escolher arquivo</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file && fileInputRef.current) {
              const dt = new DataTransfer()
              dt.items.add(file)
              fileInputRef.current.files = dt.files
              const objectUrl = URL.createObjectURL(file)
              setPreview(objectUrl)
              setFileName(file.name)
            }
          }}
          className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 sm:p-8 transition-all ${
            isDragOver
              ? 'border-[#1d1d1f] bg-[#f5f5f7]'
              : 'border-[#d1d1d6] bg-white hover:border-[#1d1d1f] hover:bg-[#fafafc]'
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5f5f7] text-[#1d1d1f] mb-3 shadow-2xs">
            <UploadCloud size={24} className="stroke-[1.7]" />
          </div>

          <p className="text-sm font-semibold text-[#1d1d1f] text-center">
            Adicione uma foto do produto
          </p>
          <p className="text-xs text-[#86868b] mt-1 text-center max-w-sm">
            Tire uma foto agora com a câmera do aparelho ou escolha um arquivo dos seus documentos.
          </p>

          {/* Botões de Ação Rápida */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 mt-5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => startCamera()}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98] cursor-pointer w-full sm:w-auto"
            >
              <Camera size={15} />
              <span>Tirar Foto com a Câmera</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#e5e5ea] bg-white px-4 py-2.5 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all shadow-2xs cursor-pointer w-full sm:w-auto"
            >
              <FolderOpen size={15} />
              <span>Escolher Arquivo do Aparelho</span>
            </button>
          </div>
        </div>
      )}

      {showUrlInput && (
        <div className="pt-1 animate-in fade-in duration-150">
          <input
            type="url"
            value={manualUrl}
            onChange={(e) => handleManualUrlChange(e.target.value)}
            placeholder="Ou cole uma URL direta: https://images.unsplash.com/..."
            className="block w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
          />
        </div>
      )}

      {/* Modal da Câmera ao Vivo */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-[#1d1d1f] text-white shadow-2xl border border-white/10 flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header da Câmera */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Camera size={18} className="text-white" />
                <h3 className="text-sm font-semibold">Tirar Foto do Produto</h3>
              </div>
              <button
                type="button"
                onClick={stopCamera}
                className="rounded-xl p-1.5 text-[#86868b] hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Viewfinder da Câmera */}
            <div className="relative aspect-4/3 w-full bg-black flex items-center justify-center overflow-hidden">
              {capturedPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={capturedPreview}
                  alt="Foto capturada"
                  className="h-full w-full object-contain"
                />
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
              )}

              {/* Botão de Alternar Câmera (Frontal / Traseira) */}
              {!capturedPreview && (
                <button
                  type="button"
                  onClick={switchCamera}
                  className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur-xs p-2.5 text-white hover:bg-black/90 transition-all shadow-md cursor-pointer"
                  title="Inverter câmera"
                >
                  <RefreshCw size={16} />
                </button>
              )}
            </div>

            {/* Canvas oculto para tirar a foto */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Footer com Botões de Disparo / Confirmação */}
            <div className="p-4 bg-[#141416] flex items-center justify-between gap-3">
              {capturedPreview ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setCapturedBlob(null)
                      setCapturedPreview(null)
                    }}
                    className="px-4 py-2 text-xs font-semibold text-[#86868b] hover:text-white transition-colors cursor-pointer"
                  >
                    Tirar Outra
                  </button>
                  <button
                    type="button"
                    onClick={confirmCapturedPhoto}
                    className="flex items-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-xs font-semibold text-[#1d1d1f] hover:bg-[#e5e5ea] transition-all shadow-xs cursor-pointer"
                  >
                    <Check size={14} />
                    <span>Usar esta Foto</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2 text-xs font-semibold text-[#86868b] hover:text-white transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-xs font-bold text-[#1d1d1f] hover:bg-[#e5e5ea] active:scale-95 transition-all shadow-lg cursor-pointer"
                  >
                    <div className="h-3.5 w-3.5 rounded-full bg-[#1d1d1f] border-2 border-white" />
                    <span>Capturar Foto</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
