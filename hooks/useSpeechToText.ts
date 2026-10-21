import { requireOptionalNativeModule } from 'expo';
import type {
  ExpoSpeechRecognitionErrorCode,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { strings } from '@/lib/i18n';

/** Messages in the current language. */
const m = () => strings().messages;

// Loaded optionally: the native module only exists in EnoLog's own build,
// not in Expo Go, and importing 'expo-speech-recognition' directly would crash there.
type SpeechModule = (typeof import('expo-speech-recognition'))['ExpoSpeechRecognitionModule'];
const speech = requireOptionalNativeModule<SpeechModule>('ExpoSpeechRecognition');

export const SPEECH_AVAILABLE = speech !== null;
export const MAX_LISTEN_MS = 120_000;

/** 'blocked' means the user said no and the OS won't ask again: only Settings can fix it. */
export type MicPermission = 'unknown' | 'granted' | 'denied' | 'blocked';

export type SpeechError = {
  message: string;
  /** Downloading English for offline recognition would fix this. */
  offerOfflineDownload: boolean;
};

type Phase = 'idle' | 'starting' | 'listening' | 'stopping';

const ON_DEVICE_SERVICE = 'com.google.android.as';
const PREFERRED_LANG = 'en-US';

// Primes the recognizer with words it would otherwise mishear.
const WINE_TERMS = [
  'SO2', 'free SO2', 'total SO2', 'pH', 'Brix', 'TA', 'VA', 'g/hL', 'mg/L', 'g/L',
  'hectoliter', 'bentonite', 'tartaric acid', 'tannin', 'yeast', 'nutrient', 'racked',
  'malolactic', 'pump over', 'punch down', 'barrique', 'Saperavi', 'Rkatsiteli',
];

function errorFor(code: ExpoSpeechRecognitionErrorCode, offlineReady: boolean, english = true): SpeechError | null {
  switch (code) {
    case 'aborted':
      return null;
    case 'no-speech':
    case 'speech-timeout':
      return { message: m().didntCatch, offerOfflineDownload: false };
    case 'not-allowed':
      return { message: m().micNeeded, offerOfflineDownload: false };
    case 'network':
      return {
        message: offlineReady
          ? m().speechLostConnection
          : m().speechNeedsInternet,
        offerOfflineDownload: !offlineReady,
      };
    case 'language-not-supported':
      if (!english) return { message: m().speechLanguageUnavailable, offerOfflineDownload: false };
      return {
        message: m().englishNotInstalled,
        offerOfflineDownload: true,
      };
    case 'busy':
      return { message: m().micBusy, offerOfflineDownload: false };
    case 'audio-capture':
      return {
        message: m().micUnavailable,
        offerOfflineDownload: false,
      };
    case 'service-not-allowed':
      return {
        message:
          m().speechUnavailable,
        offerOfflineDownload: false,
      };
    default:
      return { message: m().speechFailed, offerOfflineDownload: false };
  }
}

type Options = {
  /** Called with the full transcript when listening ends with something recognised. */
  onFinished: (transcript: string) => void;
  /** Extra words to prime recognition with, e.g. the user's tank names. */
  vocabulary: readonly string[];
  /** Recognition language (default English). Anything else uses online recognition only. */
  language?: string;
};

/**
 * Live speech-to-text with the phone's own recognizer. Prefers on-device
 * English (works offline); otherwise Google's online recognition.
 */
export function useSpeechToText({ onFinished, vocabulary, language = PREFERRED_LANG }: Options) {
  const english = language.toLowerCase().startsWith('en');
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<SpeechError | null>(null);
  const [permission, setPermission] = useState<MicPermission>('unknown');
  /** On-device locale to use, or null when only online recognition is available. */
  const [offlineLang, setOfflineLang] = useState<string | null>(null);
  const [offlineChecked, setOfflineChecked] = useState(false);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Android delivers continuous recognition in segments: finished segments + the one in progress.
  const finals = useRef<string[]>([]);
  const partial = useRef('');
  const startedAt = useRef(0);

  const fullText = () => [...finals.current, partial.current].join(' ').replace(/\s+/g, ' ').trim();

  async function checkOffline() {
    if (!speech) return;
    // The offline English model and its download only concern English.
    if (!english) {
      setOfflineLang(null);
      setOfflineChecked(true);
      return;
    }
    let lang: string | null = null;
    try {
      if (Platform.OS === 'android' && speech.supportsOnDeviceRecognition()) {
        const { installedLocales } = await speech.getSupportedLocales({
          androidRecognitionServicePackage: ON_DEVICE_SERVICE,
        });
        lang =
          installedLocales.find((locale) => locale.toLowerCase() === PREFERRED_LANG.toLowerCase()) ??
          installedLocales.find((locale) => locale.toLowerCase().startsWith('en')) ??
          null;
      } else if (Platform.OS === 'ios' && speech.supportsOnDeviceRecognition()) {
        lang = PREFERRED_LANG;
      }
    } catch {
      lang = null;
    }
    setOfflineLang(lang);
    setOfflineChecked(true);
  }

  const checkOfflineOnMount = useEffectEvent(() => {
    void checkOffline();
  });
  useEffect(() => {
    checkOfflineOnMount();
  }, []);

  // ---- Native events --------------------------------------------------------
  const onStart = useEffectEvent(() => {
    startedAt.current = Date.now();
    setElapsedMs(0);
    setPhase('listening');
  });
  const onResult = useEffectEvent((event: ExpoSpeechRecognitionResultEvent) => {
    const text = event.results[0]?.transcript?.trim() ?? '';
    if (event.isFinal) {
      if (text !== '') finals.current.push(text);
      partial.current = '';
    } else {
      partial.current = text;
    }
    setTranscript(fullText());
  });
  const onError = useEffectEvent((event: { error: ExpoSpeechRecognitionErrorCode }) => {
    // After words were recognised, these just mean the recognizer stopped: "no speech"
    // when the user paused at the end, and "client" (ERROR_CLIENT) which Android's
    // on-device recognizer reports when it ends a session. "end" still delivers the text.
    const endedNormally =
      event.error === 'no-speech' || event.error === 'speech-timeout' || event.error === 'client';
    if (endedNormally && fullText() !== '') return;
    if (event.error === 'not-allowed') setPermission('blocked');
    setError(errorFor(event.error, offlineLang !== null, english));
  });
  const onEnd = useEffectEvent(() => {
    const text = fullText();
    setPhase('idle');
    if (text !== '') onFinished(text);
  });

  useEffect(() => {
    if (!speech) return;
    const subscriptions = [
      speech.addListener('start', () => onStart()),
      speech.addListener('result', (event) => onResult(event)),
      speech.addListener('error', (event) => onError(event)),
      speech.addListener('end', () => onEnd()),
    ];
    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      speech.abort();
    };
  }, []);

  // ---- Controls -------------------------------------------------------------
  async function start() {
    if (!speech) return;
    setError(null);
    setTranscript('');
    finals.current = [];
    partial.current = '';
    setPhase('starting');
    try {
      const response = await speech.requestPermissionsAsync();
      if (!response.granted) {
        setPermission(response.canAskAgain ? 'denied' : 'blocked');
        setPhase('idle');
        return;
      }
      setPermission('granted');
      speech.start({
        lang: offlineLang ?? language,
        interimResults: true,
        continuous: true,
        maxAlternatives: 1,
        requiresOnDeviceRecognition: offlineLang !== null,
        addsPunctuation: offlineLang !== null,
        contextualStrings: english ? [...vocabulary, ...WINE_TERMS] : [...vocabulary],
      });
    } catch {
      setError({ message: m().speechCouldNotStart, offerOfflineDownload: false });
      setPhase('idle');
    }
  }

  function stop() {
    if (!speech || phase !== 'listening') return;
    setPhase('stopping');
    speech.stop(); // "end" follows once the last words are recognised
  }

  async function downloadOffline() {
    if (!speech) return;
    setDownloadNote(m().downloadStarting);
    try {
      const result = await speech.androidTriggerOfflineModelDownload({ locale: PREFERRED_LANG });
      if (result.status === 'download_success') {
        setDownloadNote(m().downloadReady);
        setError(null);
        await checkOffline();
      } else if (result.status === 'download_scheduled') {
        setDownloadNote(m().downloadScheduled);
      } else {
        setDownloadNote(m().downloadFollow);
      }
    } catch {
      setDownloadNote("Couldn't download English. Try again when you have Wi-Fi.");
    }
  }

  // ---- Limits ---------------------------------------------------------------
  const tick = useEffectEvent(() => {
    const elapsed = Date.now() - startedAt.current;
    setElapsedMs(elapsed);
    if (elapsed >= MAX_LISTEN_MS) stop();
  });
  useEffect(() => {
    if (phase !== 'listening') return;
    const timer = setInterval(() => tick(), 250);
    return () => clearInterval(timer);
  }, [phase]);

  // A phone call or switching apps ends listening; keep what was said so far.
  const onBackground = useEffectEvent(() => stop());
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') onBackground();
    });
    return () => subscription.remove();
  }, []);

  return {
    available: SPEECH_AVAILABLE,
    /** From tapping the button until the transcript is delivered. */
    active: phase !== 'idle',
    listening: phase === 'listening',
    transcript,
    elapsedMs: phase === 'listening' || phase === 'stopping' ? elapsedMs : 0,
    permission,
    error,
    /** Whether English works without internet. null until checked. */
    offlineReady: offlineChecked ? offlineLang !== null : null,
    downloadNote,
    start,
    stop,
    downloadOffline,
  };
}
