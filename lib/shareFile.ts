// Hands a CSV to the user. In the browser it downloads as a file; on the phone it
// opens the share menu (Gmail, Drive, a messenger...) with the CSV as text, which
// needs no native module. Not pure: it uses the platform.
import { Platform, Share } from 'react-native';

import { AppError } from './errors';
import { strings } from './i18n';

/** A byte order mark, so Excel reads the file as UTF-8 (Georgian letters, degree signs). */
const BOM = '﻿';

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
