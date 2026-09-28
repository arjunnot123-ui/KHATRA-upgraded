// Free, no-API-key voice layer using the browser's built-in Web Speech API.

export function speak(text, lang = 'en-IN') {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = lang
  utter.rate = 0.98
  utter.pitch = 1
  window.speechSynthesis.speak(utter)
}

export function stopSpeaking() {
  if (window.speechSynthesis) window.speechSynthesis.cancel()
}

export function isSpeechRecognitionSupported() {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
}

export function createRecognizer(lang = 'en-IN') {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) return null
  const rec = new SR()
  rec.lang = lang
  rec.interimResults = false
  rec.maxAlternatives = 1
  return rec
}
