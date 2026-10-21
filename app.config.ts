// Build variants on top of app.json (https://docs.expo.dev/tutorial/eas/multiple-app-variants/).
// eas.json sets APP_VARIANT per build profile. Each variant has its own package id,
// so the store app, the preview build and the development build install side by side.
import type { ConfigContext, ExpoConfig } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

// com.enolog.app belongs to the Play Store app (production) and can never change once it is uploaded.
// The development and preview ids kept their old names, because they are installed on the phone and signed with their own keys.
const getUniqueIdentifier = () =>
  IS_DEV ? 'com.cellarlog.app.dev' : IS_PREVIEW ? 'com.cellarlog.app.preview' : 'com.enolog.app';

const getAppName = () => (IS_DEV ? 'EnoLog Dev' : 'EnoLog');

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: getAppName(),
  slug: config.slug ?? 'cellarlog',
  // Separate link scheme, so the two installed apps don't answer each other's links.
  scheme: IS_DEV ? 'cellarlog-dev' : IS_PREVIEW ? 'cellarlog-preview' : (config.scheme ?? 'cellarlog'),
  ios: { ...config.ios, bundleIdentifier: getUniqueIdentifier() },
  android: { ...config.android, package: getUniqueIdentifier() },
});
