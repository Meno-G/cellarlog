// Hands exports to the user. A CSV downloads as a file in the browser, and opens the
// phone's share menu as text. A report becomes a PDF (phone: expo-print + expo-sharing;
// browser: the print dialog). Not pure: it uses the platform.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

import { AppError } from './errors';
import { strings } from './i18n';

/** A byte order mark, so Excel reads the file as UTF-8 (Georgian letters, degree signs). */
const BOM = '﻿';

/** Prints an HTML page through a hidden frame (the browser's own print dialog: "Save as PDF"). */
function printInFrame(html: string): void {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    throw new Error('No print frame');
  }
  doc.open();
  doc.write(html);
  doc.close();
  win.onafterprint = () => frame.remove();
  // Gives the page a moment to lay out; the frame removes itself after printing (or after a minute).
  setTimeout(() => {
    win.focus();
    win.print();
  }, 300);
  setTimeout(() => frame.remove(), 60_000);
}

/**
 * A printable report. On the phone it becomes a PDF file and opens the share
 * menu; in the browser it opens the print dialog (choose "Save as PDF").
 */
export async function sharePdf(html: string, title: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      printInFrame(html);
      return;
    }
    // A4 in points.
    const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
    }
  } catch (error) {
    throw new AppError('server', strings().messages.exportFailed, { cause: error });
  }
}

export async function shareCsv(filename: string, csv: string, title: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      const blob = new Blob([BOM, csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return;
    }
    // Closing the share menu without choosing is not an error.
    await Share.share({ title, message: csv });
  } catch (error) {
    throw new AppError('server', strings().messages.exportFailed, { cause: error });
  }
}
