// Voice utilities for speech recognition and synthesis

class VoiceUtils {
  constructor() {
    this.recognition = null;
    this.isSupported = this.checkSupport();
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.onEndCallback = null;
  }

  checkSupport() {
    if (typeof window === 'undefined') {
      return false;
    }
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  async checkMicrophonePermission() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return 'denied'; // Cannot access permissions in non-browser environment
    }
    
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
      return permissionStatus.state;
    } catch (error) {
      // Fallback for browsers that don't support permissions API
      return 'prompt'; // Default to prompt
    }
  }

  initializeRecognition(lang = 'en-US') {
    if (!this.isSupported || typeof window === 'undefined') {
      throw new Error('Speech recognition is not supported in this environment');
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = lang;

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (this.onResultCallback) {
        this.onResultCallback(transcript);
      }
    };

    this.recognition.onerror = (event) => {
      if (this.onErrorCallback) {
        // Pass the error code to the callback
        this.onErrorCallback(event.error);
      }
    };

    this.recognition.onend = () => {
      // Always trigger cleanup/end callback
      if (this.onEndCallback) {
        this.onEndCallback();
      }
    };
  }

  async startListening(onResult, onError, onEnd, lang = 'en-US') {
    if (!this.isSupported || typeof window === 'undefined') {
      throw new Error('Speech recognition is not supported in this environment');
    }

    // Stop speaking before listening to avoid echo
    this.cancelSpeech();
    
    // Ensure we have microphone permission before starting
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the stream immediately since we just needed to check access
        stream.getTracks().forEach(track => track.stop());
        
        if (!this.recognition) {
          this.initializeRecognition(lang);
        } else {
          // Update the language if different
          if (this.recognition.lang !== lang) {
            this.recognition.lang = lang;
          }
        }

        this.onResultCallback = onResult;
        this.onErrorCallback = onError;
        this.onEndCallback = onEnd;

        try {
          this.recognition.start();
          return true;
        } catch (error) {
          console.error('Error starting speech recognition:', error);
          if (onError) {
            onError('not-allowed');
          }
          return false;
        }
      } catch (error) {
        console.error('Microphone access check failed:', error);
        
        if (onError) {
          if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            onError('no-device');
          } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
             onError('not-allowed');
          } else {
             onError(error.name || 'audio-capture');
          }
        }
        return false;
      }
    } else {
      // Fallback for environments where mediaDevices is not available
      if (!this.recognition) {
        this.initializeRecognition(lang);
      } else {
        // Update the language if different
        if (this.recognition.lang !== lang) {
          this.recognition.lang = lang;
        }
      }

      this.onResultCallback = onResult;
      this.onErrorCallback = onError;
      this.onEndCallback = onEnd;

      try {
        this.recognition.start();
        return true;
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        if (onError) {
          onError('not-allowed');
        }
        return false;
      }
    }
  }

  stopListening() {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  speakText(text, lang = 'en-US', rate = 1.0, pitch = 1.0, volume = 1.0) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.error('Speech synthesis is not supported in this browser');
      return false;
    }

    if (!text) {
      console.warn('No text provided for speech synthesis');
      return false;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    utterance.lang = lang;

    window.speechSynthesis.speak(utterance);
    return true;
  }

  cancelSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  isSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return window.speechSynthesis.speaking;
    }
    return false;
  }

  // Get supported languages for speech recognition
  getSupportedRecognitionLanguages() {
    const languages = [
      { code: 'en-US', name: 'English (US)' },
      { code: 'en-GB', name: 'English (UK)' },
      { code: 'hi-IN', name: 'Hindi (India)' },
      { code: 'en-IN', name: 'English (India)' },
      { code: 'bn-IN', name: 'Bengali (India)' },
      { code: 'te-IN', name: 'Telugu (India)' },
      { code: 'ta-IN', name: 'Tamil (India)' },
      { code: 'mr-IN', name: 'Marathi (India)' },
      { code: 'gu-IN', name: 'Gujarati (India)' },
      { code: 'kn-IN', name: 'Kannada (India)' },
      { code: 'ml-IN', name: 'Malayalam (India)' },
    ];
    return languages;
  }

  // Get supported languages for speech synthesis
  getSupportedSynthesisLanguages() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const voices = window.speechSynthesis.getVoices();
      return voices.map(voice => ({
        code: voice.lang,
        name: voice.name,
        voice: voice
      }));
    }
    return [];
  }
}

// Create a singleton instance
const voiceUtils = new VoiceUtils();
export default voiceUtils;