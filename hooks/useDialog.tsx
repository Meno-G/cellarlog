import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { radius, spacing, useTheme } from '@/theme';

export type DialogButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

/** Same arguments as Alert.alert: title, message, buttons. */
export type ShowDialog = (title: string, message: string | undefined, buttons: DialogButton[]) => void;

type Request = { title: string; message: string | undefined; buttons: DialogButton[] };

const DialogContext = createContext<ShowDialog | null>(null);

/**
 * Confirmations and small menus. On the phone this is Android's own dialog
 * (Alert.alert); in the browser, where Alert does nothing, it draws its own.
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);

  const show = useCallback<ShowDialog>((title, message, buttons) => {
    if (Platform.OS !== 'web') {
      Alert.alert(title, message, buttons, { cancelable: true });
      return;
    }
    setRequest({ title, message, buttons });
  }, []);

  return (
    <DialogContext.Provider value={show}>
      {children}
      {request ? <WebDialog request={request} onClose={() => setRequest(null)} /> : null}
    </DialogContext.Provider>
  );
}

export function useDialog(): ShowDialog {
  const show = useContext(DialogContext);
  if (!show) throw new Error('useDialog must be used inside <DialogProvider>');
  return show;
}

function WebDialog({ request, onClose }: { request: Request; onClose: () => void }) {
  const { colors } = useTheme();
  const cancel = request.buttons.find((button) => button.style === 'cancel');

  function choose(button: DialogButton) {
    onClose();
    // After closing, so a button that opens the next dialog (e.g. "Are you sure?") shows it.
    button.onPress?.();
  }

  // Tapping outside or pressing Escape counts as Cancel.
  const dismiss = () => (cancel ? choose(cancel) : onClose());

  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismiss}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel={cancel?.text}
      >
        {/* Stop taps on the card from closing it. */}
        <Pressable
          onPress={() => undefined}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="alert"
        >
          <AppText variant="title">{request.title}</AppText>
          {request.message ? <AppText>{request.message}</AppText> : null}
          <View style={styles.buttons}>
            {request.buttons.map((button) => (
              <Button
                key={button.text}
                title={button.text}
                variant={
                  button.style === 'destructive' ? 'danger' : button.style === 'cancel' ? 'secondary' : 'primary'
                }
                onPress={() => choose(button)}
              />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  card: {
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  buttons: { gap: spacing.sm, marginTop: spacing.xs },
});
