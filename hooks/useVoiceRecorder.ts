import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { AppState } from 'react-native';

export type Recording = {
  uri: string;
  durationMs: number;
  /** AAC in an MPEG-4 container (.m4a) on iOS and Android. */
  mimeType: 'audio/mp4';
};

/** 'blocked' means the user said no and the OS won't ask again: only Settings can fix it. */
export type MicPermission = 'unknown' | 'granted' | 'denied' | 'blocked';

type Phase = 'idle' | 'starting' | 'recording' | 'stopping';

export const MAX_RECORDING_MS = 120_000;
const MIN_RECORDING_MS = 700;

// Speech doesn't need stereo or 128 kbps; smaller files upload faster from a cellar.
const OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64_000,
};

type Options = {
  /** Called once per finished recording: manual stop, time limit, or app going to background. */
  onRecorded: (recording: Recording) => void;
};

export function useVoiceRecorder({ onRecorded }: Options) {
  const recorder = useAudioRecorder(OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [phase, setPhase] = useState<Phase>('idle');
  const [permission, setPermission] = useState<MicPermission>('unknown');
  const [error, setError] = useState<string | null>(null);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    let response = await getRecordingPermissionsAsync();
    if (!response.granted && response.canAskAgain) {
      response = await requestRecordingPermissionsAsync();
    }
    setPermission(response.granted ? 'granted' : response.canAskAgain ? 'denied' : 'blocked');
    return response.granted;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setPhase('starting');
    try {
      if (!(await ensurePermission())) {
        setPhase('idle');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    } catch {
      setError("Couldn't start the microphone. Close other apps that use it and try again.");
      setPhase('idle');
    }
  }, [ensurePermission, recorder]);

  async function finish() {
    if (phase !== 'recording') return;
    setPhase('stopping');
    const durationMs = recorder.getStatus().durationMillis;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      if (!uri) {
        setError('The recording could not be saved. Please try again.');
      } else if (durationMs < MIN_RECORDING_MS) {
        setError('That was too short. Tap the button, speak, then tap again to stop.');
      } else {
        onRecorded({ uri, durationMs, mimeType: 'audio/mp4' });
      }
    } catch {
      setError('The recording could not be saved. Please try again.');
    } finally {
      setPhase('idle');
    }
  }

  function stop() {
    void finish();
  }

  // Effects read the latest phase/recorder through effect events.
  const finishFromEffect = useEffectEvent(() => {
    void finish();
  });

  // Stop at the time limit.
  const durationMs = recorderState.durationMillis;
  useEffect(() => {
    if (phase === 'recording' && durationMs >= MAX_RECORDING_MS) finishFromEffect();
  }, [phase, durationMs]);

  // A phone call or switching apps ends the recording; keep what was said so far.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') finishFromEffect();
    });
    return () => subscription.remove();
  }, []);

  return {
    /** True from tapping "record" until the file is saved. */
    active: phase !== 'idle',
    recording: phase === 'recording',
    durationMs: phase === 'recording' || phase === 'stopping' ? durationMs : 0,
    permission,
    error,
    start,
    stop,
  };
}
