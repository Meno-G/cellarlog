// Build variants on top of app.json (https://docs.expo.dev/tutorial/eas/multiple-app-variants/).
// eas.json sets APP_VARIANT per build profile. The preview build gets its own
// package id, so it installs next to the development build instead of replacing it.
import type { ConfigContext, ExpoConfig } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

// The development build keeps the original id: it is already installed on the phone.
const getUniqueIdentifier = () => (IS_PREVIEW ? 'com.cellarlog.app.preview' : 'com.cellarlog.app');

const getAppName = () => (IS_DEV ? 'CellarLog Dev' : 'CellarLog');

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: getAppName(),
  slug: config.slug ?? 'cellarlog',
  // Separate link scheme, so the two installed apps don't answer each other's links.
  scheme: IS_PREVIEW ? 'cellarlog-preview' : (config.scheme ?? 'cellarlog'),
  ios: { ...config.ios, bundleIdentifier: getUniqueIdentifier() },
  android: { ...config.android, package: getUniqueIdentifier() },
});
