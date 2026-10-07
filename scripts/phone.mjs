// npm run phone: connect the Android phone to Metro over the USB cable and open
// the CellarLog development build. Run it after `npx expo start --clear`.
//
// Why the cable: this network isolates devices, so the phone can't reach the PC
// over Wi-Fi. `adb reverse` makes the phone's 127.0.0.1:8081 lead to Metro on
// this PC instead. The forward resets whenever the cable or adb restarts.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PACKAGE = 'com.cellarlog.app'; // the development build (see app.config.ts)
const SCHEME = 'cellarlog';
const PORT = 8081;
const AUTH_WAIT_S = 60;

const exe = process.platform === 'win32' ? 'adb.exe' : 'adb';

function findAdb() {
  const candidates = [
    process.env.ANDROID_HOME && join(process.env.ANDROID_HOME, 'platform-tools', exe),
    process.env.ANDROID_SDK_ROOT && join(process.env.ANDROID_SDK_ROOT, 'platform-tools', exe),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', exe),
    // Some terminals (e.g. the one built into the Claude app) don't pass LOCALAPPDATA on.
    join(homedir(), 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', exe),
    process.env.HOME && join(process.env.HOME, 'Library', 'Android', 'sdk', 'platform-tools', exe),
    process.env.HOME && join(process.env.HOME, 'Android', 'Sdk', 'platform-tools', exe),
  ].filter(Boolean);
  const found = candidates.find((path) => existsSync(path));
  if (found) return found;
  const onPath = spawnSync(exe, ['version'], { encoding: 'utf8' });
  if (onPath.status === 0) return exe;
  return null;
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function adb(adbPath, args) {
  return execFileSync(adbPath, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** [{ serial, state }] for every attached device ("device", "unauthorized", "offline"). */
function devices(adbPath) {
  return adb(adbPath, ['devices'])
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state)
    .map(([serial, state]) => ({ serial, state }));
}

async function metroIsUp() {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/status`, { signal: AbortSignal.timeout(3000) });
    return (await response.text()).includes('packager-status:running');
  } catch {
    return false;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  // 1. Metro
  if (!(await metroIsUp())) {
    fail(`Metro isn't running on port ${PORT}. Start it in another terminal first:\n    npx expo start --clear`);
  }
  console.log('✔ Metro is running');

  // 2. adb
  const adbPath = findAdb();
  if (!adbPath) {
    fail(
      "adb (Android platform-tools) wasn't found. Install it from\n" +
        '    https://developer.android.com/tools/releases/platform-tools\n' +
        '  into %LOCALAPPDATA%\\Android\\Sdk\\platform-tools, or set ANDROID_HOME.',
    );
  }

  // 3. The phone, plugged in and allowing USB debugging
  let phone = null;
  for (let waited = 0; ; waited++) {
    const list = devices(adbPath);
    const wanted = process.env.ANDROID_SERIAL;
    phone = list.find((d) => d.state === 'device' && (!wanted || d.serial === wanted)) ?? null;
    if (phone) break;
    if (waited === 0) {
      if (list.some((d) => d.state === 'unauthorized')) {
        console.log('… On the phone: unlock it and tap "Allow" on "Allow USB debugging?" (tick "Always allow").');
      } else {
        console.log('… No phone found. Plug it in with a data cable and unlock it.');
      }
    }
    if (waited >= AUTH_WAIT_S) {
      fail(
        'The phone is still not available to adb. Check:\n' +
          '  - USB debugging is on (Settings → Developer options)\n' +
          '  - Samsung Auto Blocker is off (Settings → Security and privacy)\n' +
          '  - the cable carries data, then unplug and plug it back in',
      );
    }
    await sleep(1000);
  }
  console.log(`✔ Phone connected (${phone.serial})`);
  const onPhone = ['-s', phone.serial];

  // 4. The development build must be installed
  const installed = adb(adbPath, [...onPhone, 'shell', 'pm', 'list', 'packages', PACKAGE]);
  if (!installed.split(/\r?\n/).some((line) => line.trim() === `package:${PACKAGE}`)) {
    fail(
      `The CellarLog development build (${PACKAGE}) isn't installed on the phone.\n` +
        '  Build it with: npx eas-cli@latest build --profile development --platform android',
    );
  }

  // 5. Cable forward + (re)open the app on Metro
  adb(adbPath, [...onPhone, 'reverse', `tcp:${PORT}`, `tcp:${PORT}`]);
  console.log(`✔ Phone's port ${PORT} now leads to Metro on this PC`);
  adb(adbPath, [...onPhone, 'shell', 'am', 'force-stop', PACKAGE]);
  const url = encodeURIComponent(`http://127.0.0.1:${PORT}`);
  adb(adbPath, [
    ...onPhone,
    'shell',
    'am',
    'start',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    `exp+${SCHEME}://expo-development-client/?url=${url}`,
    PACKAGE,
  ]);
  console.log('✔ CellarLog opened. The first load builds the app in Metro (about a minute).\n');
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
