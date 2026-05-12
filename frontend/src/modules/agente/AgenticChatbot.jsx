import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { http } from '../../api/config'

// ── Iconos ─────────────────────────────────────────────────────────────────
function IconSparkles(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  )
}
function IconClose(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
function IconSend(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  )
}
function IconMic(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  )
}
function IconPlus(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}
function IconPaperclip(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
    </svg>
  )
}

export function AgenticChatbot({ context = 'global', projectId = null }) {
  const location = useLocation()

  const currentProjectId = projectId || (() => {
    const match = location.pathname.match(/\/proyecto\/(\d+)/)
    return match ? match[1] : null
  })()

  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '¡Hola! Soy tu Agente IA. ¿En qué te ayudo con tu proyecto hoy?',
    }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [attachedFile, setAttachedFile] = useState(null)

  const endOfMessagesRef = useRef(null)
  const fileInputRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isTyping, isOpen])

  // ── Voice Recognition ──────────────────────────────────────────────────────
  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'es-BO'
    recognition.interimResults = false
    recognition.continuous = false
    recognitionRef.current = recognition

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      setInput((prev) => prev + transcript)
      setIsRecording(false)
    }
    recognition.onerror = () => setIsRecording(false)
    recognition.onend = () => setIsRecording(false)

    recognition.start()
    setIsRecording(true)
  }

  const stopVoice = () => {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }

  // ── File Attach ─────────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAttachedFile(file)
    setShowAttachMenu(false)
    setInput((prev) => prev + (prev ? ' ' : '') + `[Archivo adjunto: ${file.name}]`)
  }

  // ── Send message ────────────────────────────────────────────────────────────
  const handleSend = async (e) => {
    e?.preventDefault()
    if (!input.trim()) return

    if (!currentProjectId) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: input },
        { role: 'assistant', content: 'Por favor, entra a un proyecto específico para que pueda ayudarte a gestionarlo.' }
      ])
      setInput('')
      return
    }

    const userMsg = input.trim()
    setInput('')
    setAttachedFile(null)
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setIsTyping(true)

    try {
      const res = await http.post(`/api/proyectos/${currentProjectId}/agente/`, {
        message: userMsg
      })
      const data = res.data
      setMessages((prev) => [
        ...prev,
        {
          role: data.role || 'assistant',
          content: data.content,
          actions: data.actions || [],
          data: data.data || null
        }
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err?.response?.data?.error || 'Ocurrió un error al procesar la solicitud con Gemini.'
        }
      ])
    } finally {
      setIsTyping(false)
    }
  }

  // ── Action buttons ──────────────────────────────────────────────────────────
  const handleAction = async (actionText, actionData) => {
    if (actionText === 'Descargar PDF' && actionData && actionData.url) {
      window.open(actionData.url, '_blank')
      return
    }
    if (!actionData || !actionData.accion_tipo) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: `Seleccionó la acción: ${actionText}` },
        { role: 'assistant', content: `Acción local "${actionText}" ejecutada.` }
      ])
      return
    }
    if (!currentProjectId) return

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: `Seleccionó la acción: ${actionText}` }
    ])
    setIsTyping(true)

    try {
      const res = await http.post(`/api/proyectos/${currentProjectId}/agente/ejecutar/`, {
        accion_tipo: actionData.accion_tipo,
        payload: actionData.payload || {}
      })
      const data = res.data
      if (data.data && data.data.url) {
        window.open(data.data.url, '_blank')
      }
      setMessages((prev) => [
        ...prev,
        {
          role: data.role || 'assistant',
          content: data.content,
          actions: data.actions || [],
          data: data.data || null
        }
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err?.response?.data?.error || 'Error al ejecutar la acción.'
        }
      ])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <>
      {/* ── FAB: Solo visible dentro de un proyecto ── */}
      {currentProjectId && (
        <button
          onClick={() => setIsOpen(true)}
          className={[
            'fixed bottom-24 left-20 z-[200] flex items-center justify-center gap-2 rounded-full px-5 py-3 shadow-2xl',
            'bg-gradient-to-r from-sky-500 to-indigo-600 hover:scale-105 active:scale-95',
            'text-white font-semibold text-sm tracking-wide transition-all duration-300',
            isOpen ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'
          ].join(' ')}
          title="Abrir Agente IA"
        >
          <IconSparkles className="h-5 w-5 animate-pulse" />
          <span>Agente IA</span>
        </button>
      )}

      {/* ── Overlay ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[199] bg-black/30 backdrop-blur-sm sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ── Sidebar Chat — se abre desde la IZQUIERDA ── */}
      <div className={[
        'fixed top-0 left-0 z-[200] h-screen w-full sm:w-96 flex flex-col',
        'bg-[#060d1a]/97 backdrop-blur-xl border-r border-white/10 shadow-2xl',
        'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      ].join(' ')}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30">
              <IconSparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Agente IA</h3>
              <p className="text-xs text-sky-400">Gemini 2.5 Flash conectado</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin scrollbar-thumb-sky-500/30">
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={[
                'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                msg.role === 'user'
                  ? 'bg-sky-600 text-white rounded-br-sm'
                  : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-sm'
              ].join(' ')}>
                {msg.content}
              </div>
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {msg.actions.map(act => (
                    <button
                      key={act}
                      onClick={() => handleAction(act, msg.data)}
                      className="px-3 py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-400 text-xs font-medium hover:bg-sky-500/20 transition-colors"
                    >
                      {act}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex items-start">
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
                <IconSparkles className="h-4 w-4 text-sky-400 animate-spin" />
                <span className="text-sm text-slate-400 italic">Analizando proyecto...</span>
              </div>
            </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        {/* Ejemplos */}
        {messages.length === 1 && (
          <div className="px-5 pb-3">
            <p className="text-xs text-slate-500 mb-2 font-medium">Ejemplos de comandos:</p>
            <div className="flex flex-wrap gap-2">
              {['Optimiza el presupuesto', 'Exporta cronograma a PDF', 'Rediseña el plano'].map(ex => (
                <button
                  key={ex}
                  onClick={() => setInput(ex)}
                  className="px-2.5 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Input Area ── */}
        <div className="p-4 border-t border-white/10 bg-[#060d1a]">
          {/* Archivo adjunto badge */}
          {attachedFile && (
            <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20">
              <IconPaperclip className="h-3.5 w-3.5 text-sky-400" />
              <span className="text-xs text-sky-300 truncate max-w-[200px]">{attachedFile.name}</span>
              <button
                onClick={() => { setAttachedFile(null); setInput(prev => prev.replace(/\s?\[Archivo adjunto:.*?\]/g, '')) }}
                className="ml-auto text-slate-500 hover:text-white"
              >
                <IconClose className="h-3 w-3" />
              </button>
            </div>
          )}

          <form onSubmit={handleSend}>
            <div className="flex items-end gap-2 bg-[#0a1121] border border-slate-700 rounded-2xl px-3 py-2 focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500 transition-all">

              {/* Botón + (adjuntar) */}
              <div className="relative flex-shrink-0 self-end pb-1">
                <button
                  type="button"
                  onClick={() => setShowAttachMenu(prev => !prev)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 transition-colors"
                  title="Adjuntar archivo"
                >
                  <IconPlus className="h-4 w-4" />
                </button>

                {/* Dropdown de adjuntos */}
                {showAttachMenu && (
                  <div className="absolute bottom-10 left-0 bg-[#0f1c2e] border border-slate-700 rounded-xl shadow-xl w-40 overflow-hidden z-[200]">
                    <button
                      type="button"
                      onClick={() => { fileInputRef.current.accept = 'image/*'; fileInputRef.current.click() }}
                      className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:bg-sky-500/10 hover:text-sky-400 transition-colors"
                    >
                      🖼️ Imagen
                    </button>
                    <button
                      type="button"
                      onClick={() => { fileInputRef.current.accept = '.txt,.pdf,.csv'; fileInputRef.current.click() }}
                      className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:bg-sky-500/10 hover:text-sky-400 transition-colors border-t border-slate-700"
                    >
                      📄 Documento
                    </button>
                  </div>
                )}
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
              </div>

              {/* Textarea auto-grow */}
              <textarea
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Pídele algo al Agente IA..."
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none resize-none py-1.5 leading-relaxed max-h-32 overflow-y-auto"
                style={{ height: '36px' }}
              />

              {/* Botón micrófono */}
              <button
                type="button"
                onClick={isRecording ? stopVoice : startVoice}
                className={[
                  'p-1.5 rounded-lg transition-colors flex-shrink-0 self-end mb-1',
                  isRecording
                    ? 'text-red-400 bg-red-500/20 animate-pulse'
                    : 'text-slate-500 hover:text-sky-400 hover:bg-sky-500/10'
                ].join(' ')}
                title={isRecording ? 'Detener grabación' : 'Hablar'}
              >
                <IconMic className="h-4 w-4" />
              </button>

              {/* Botón enviar */}
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="p-1.5 rounded-lg bg-sky-500 text-white disabled:opacity-40 disabled:bg-slate-700 hover:bg-sky-400 transition-colors flex-shrink-0 self-end mb-1"
              >
                <IconSend className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
