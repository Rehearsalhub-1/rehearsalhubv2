import { setAudioModeAsync, type RecordingOptions } from 'expo-audio';

/**
 * Studio vocal recording configuration optimized for high-fidelity takes on both iOS and Android.
 * 
 * - 48,000 Hz sample rate (native mobile hardware audio rate; prevents resampling distortion)
 * - Mono channel (1 channel): avoids phase cancellation and comb filtering from dual-mic noise suppression
 * - 256 kbps AAC bit rate: studio-grade vocal detail and transparency
 * - Android: MediaRecorder.AudioSource.VOICE_PERFORMANCE (purpose-built for live singing / karaoke)
 *   minimizes audio capture latency and acoustic coupling with the playback pathway
 * - iOS: AVAudioQuality.max (127), 16-bit linear PCM depth hint, standard MPEG4AAC container
 */
export const STUDIO_RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 48000,
  numberOfChannels: 1,
  bitRate: 256000,
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    sampleRate: 48000,
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
    audioSource: 'voice_performance',
  },
  ios: {
    extension: '.m4a',
    sampleRate: 48000,
    outputFormat: 'aac ',
    audioQuality: 127,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 256000,
  },
};

/**
 * Voice note recording configuration optimized for speech clarity and bandwidth.
 */
export const VOICE_NOTE_RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 48000,
  numberOfChannels: 1,
  bitRate: 128000,
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    sampleRate: 48000,
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
    audioSource: 'voice_recognition',
  },
  ios: {
    extension: '.m4a',
    sampleRate: 48000,
    outputFormat: 'aac ',
    audioQuality: 127,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

/**
 * Configure audio mode for recording on BOTH iOS and Android.
 * 
 * Critical aspects:
 * - `shouldRouteThroughEarpiece: false`:
 *    - On iOS: When allowsRecording is true, iOS category switches to `.playAndRecord`,
 *      which defaults to routing audio through the physical earpiece receiver.
 *      Setting this to false forces audio through speakers or connected headphones/AirPods.
 *    - On Android: Setting this to false keeps AudioManager in `MODE_NORMAL` and enables speakerphone,
 *      preventing Android from falling into `MODE_IN_COMMUNICATION` telephone call mode
 *      which degrades sample rate, causes telephone-filtered EQ, and chokes frequency range.
 * - `interruptionMode: 'duckOthers'`: Ensures background notifications duck rather than interrupting takes.
 */
export async function setRecordingAudioModeAsync(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: 'duckOthers',
    shouldRouteThroughEarpiece: false,
  });
}

/**
 * Reset audio mode after recording finishes or screen unmounts.
 */
export async function resetRecordingAudioModeAsync(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: 'duckOthers',
    shouldRouteThroughEarpiece: false,
  });
}
