// English texts. This file is the source of truth: ka.ts must have the same
// shape (TypeScript checks it), so a missing translation is a type error.
// Pure: no React, no network.

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

export const en = {
  common: {
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    tryAgain: 'Try again',
    remove: 'Remove',
    saveChanges: 'Save changes',
    loading: 'Loading',
    fixFields: 'Please fix the highlighted fields.',
    noteOptional: 'Note (optional)',
    tank: 'Tank',
  },

  language: {
    switchLabel: 'Language',
    english: 'English',
    georgian: 'Georgian',
  },

  titles: {
    tanks: 'Tanks',
    newTank: 'New tank',
    tank: 'Tank',
    editTank: 'Edit tank',
    addEntry: 'Add entry',
    editEntry: 'Edit entry',
  },

  setup: {
    title: 'Setup needed',
    text: "The app's .env file is missing or incomplete. Copy .env.example to .env, fill it in, then restart with: npx expo start --clear",
  },

  auth: {
    tagline: 'CELLAR NOTES, SPOKEN',
    createTitle: 'Create your account',
    welcome: 'Welcome back',
    accountCreated: 'Account created. Open the confirmation link we emailed you, then sign in.',
    email: 'Email',
    emailPlaceholder: 'you@winery.com',
    password: 'Password',
    passwordHint: 'At least 6 characters',
    createAccount: 'Create account',
    signIn: 'Sign in',
    haveAccount: 'I already have an account',
    newAccount: 'Create an account',
  },

  home: {
    tankCount: (n: number) => plural(n, 'tank', 'tanks'),
    waitingToUpload: (n: number) => `${plural(n, 'change', 'changes')} waiting to upload`,
    signOut: 'Sign out',
    signOutTitle: 'Sign out?',
    signedInAs: (email: string) => `You are signed in as ${email}.`,
    signOutWaiting: (n: number) =>
      `${n === 1 ? '1 change is' : `${n} changes are`} saved on this phone but not uploaded yet. ` +
      'They stay on this phone and upload the next time you sign in with this account.',
    loadingTanks: 'Loading tanks…',
    yourCellar: 'Your cellar',
    findTank: 'Find a tank',
    findPlaceholder: 'Name, grape or vintage',
    noMatchTitle: 'No matching tanks',
    noMatchText: (query: string) => `Nothing matches “${query}”. Try part of the name, the grape or the vintage.`,
    showAll: 'Show all tanks',
    noTanksTitle: 'No tanks yet',
    noTanksText: 'Add your first tank to start logging additions, temperatures and tastings.',
    newTank: 'New tank',
  },

  tankCard: {
    noWine: 'No wine set',
    noEntries: 'No entries yet',
    last: (type: string, when: string) => `Last: ${type.toLowerCase()} · ${when}`,
    notUploaded: 'not uploaded yet',
    couldntDelete: (error: string) => `Couldn't delete: ${error}`,
    couldntUpload: (error: string) => `Couldn't upload: ${error}`,
    savedWaiting: 'Saved on this phone · waiting to upload',
  },

  tank: {
    offline: "You're offline. New entries are saved on this phone and upload later.",
    timeline: 'Timeline',
    tapToEdit: 'Tap to edit or delete',
    loadingTimeline: 'Loading timeline…',
    noEntries: 'No entries yet. Tap “Add entry” to log the first one.',
    addEntry: 'Add entry',
    couldntDeleteTank: (error: string) => `Couldn't delete this tank: ${error}`,
    couldntUploadTank: (error: string) => `This tank couldn't upload: ${error} Fix it with Edit, then try again.`,
    deleteLocalTank: 'Delete this tank',
    tankWaiting: "Saved on this phone · this tank uploads when you're back online.",
    discardTankTitle: (name: string) => `Delete ${name}?`,
    discardTankText: (waiting: number) =>
      'This tank was never uploaded, so it will be gone for good' +
      (waiting > 0 ? `, together with its ${plural(waiting, 'entry', 'entries')}.` : '.'),
    noWine: 'No wine set',
    entryEdited: 'Edited on this phone. The change uploads automatically when you are online.',
    entrySaved: 'Saved on this phone. It uploads automatically when you are online.',
    couldntDeleteEntry: (error: string) => `Couldn't delete: ${error}`,
    keepEntry: 'Keep entry',
    couldntUploadEdit: (error: string) => `Couldn't upload this edit: ${error}`,
    undoEdit: 'Undo edit',
    couldntUploadEntry: (error: string) => `Couldn't upload: ${error}`,
    deleteEntryTitle: 'Delete this entry?',
    neverUploaded: 'It was never uploaded, so it will be gone for good.',
    cantUndo: "This can't be undone.",
  },

  latest: {
    title: 'Latest values',
    hint: 'Tap a value to see how it changed.',
    a11yHint: 'Shows every reading of this value',
  },

  history: {
    title: 'History',
    titleFor: (tank: string) => `History · ${tank}`,
    loading: 'Loading readings…',
    loadFailed: 'Could not load the readings.',
    latest: 'Latest',
    change: 'Change',
    since: (when: string) => `since ${when}`,
    lowest: 'Lowest',
    highest: 'Highest',
    skipped: (n: number) =>
      `${plural(n, 'reading', 'readings')} in another unit or written as text ${n === 1 ? "isn't" : "aren't"} included. They are still on the timeline.`,
    allReadings: 'All readings',
    noReadingsTitle: 'No readings yet',
    noReadingsText: (name: string) =>
      `Readings of ${name} on this tank will show here, from the Analysis tab or a spoken note.`,
    chartLabel: (count: number, name: string, from: string, to: string, low: string, high: string, latest: string) =>
      `Chart of the last ${count} ${name} readings, from ${from} to ${to}. Lowest ${low}, highest ${high}, latest ${latest}.`,
  },

  tankForm: {
    name: 'Tank name',
    namePlaceholder: 'Tank 12',
    volume: 'Volume (liters)',
    variety: 'Wine / grape variety (optional)',
    varietyPlaceholder: 'Saperavi',
    vintage: 'Vintage (optional)',
    create: 'Create tank',
    offlineNew: "You're offline. The tank is saved on this phone and uploads when you're back online.",
    offlineEdit: "You're offline. Your changes are saved on this phone and upload when you're back online.",
  },

  editTank: {
    dangerTitle: 'Delete this tank',
    dangerText: (name: string) => `Deletes ${name} and all of its entries. You'll be asked to confirm twice.`,
    deleteButton: 'Delete tank',
    confirmTitle: (name: string) => `Delete ${name}?`,
    noEntries: "It has no entries. This can't be undone.",
    withEntries: (count: string | null) =>
      `This also deletes ${count ? `its ${count}` : 'all of its entries'}: additions, lab analyses, tastings and notes. This can't be undone.`,
    deleteEllipsis: 'Delete…',
    sureTitle: 'Are you sure?',
    willBeDeleted: (name: string) => `${name} will be deleted.`,
    willBeDeletedWith: (name: string, count: string | null) =>
      `${name} and ${count ?? 'all its entries'} will be deleted for good.`,
    entryCount: (n: number) => plural(n, 'entry', 'entries'),
    entryCountAtLeast: (n: number) => `at least ${plural(n, 'entry', 'entries')}`,
    entryCountMany: (n: number) => `${n}+ entries`,
  },

  newEntry: {
    tabNote: 'Speak / note',
    tabAnalysis: 'Analysis',
    createTankFirst: 'Create a tank first',
    createTankFirstText: 'Entries belong to a tank. Add one, then come back.',
    newTankButton: '+ New tank',
    checkAndSave: 'Check and save',
    saveEntry: 'Save entry',
    backToNote: 'Back to note',
    offlineReview: "You're offline. Saving keeps the entry on this phone; it uploads when you're back online.",
    offlineRecord: "You're offline. Record or type as usual; entries are saved on this phone and upload later.",
    offlineAnalysis: "You're offline. Saving keeps the analysis on this phone; it uploads when you're back online.",
    reviewNote: 'Review note',
    forTank: (name: string) => `For ${name}`,
    voiceNeedsBuild:
      "Voice notes need the CellarLog app build. Expo Go doesn't include speech recognition. You can type your note below.",
    micBlocked: 'Microphone access is turned off for CellarLog. Turn it on in Settings, or type your note below.',
    openSettings: 'Open settings',
    micDenied: 'CellarLog needs the microphone to hear your notes. Tap the button and choose Allow, or type below.',
    downloadText:
      'Voice uses the internet right now. Download English once (on Wi-Fi) to speak notes in the cellar without signal.',
    downloadEnglish: 'Download English for offline',
    fillInYourself: 'Fill in yourself',
    whatIHeard: 'what I heard',
    orTypeIt: 'or type it',
    note: 'Note',
    listening: 'Listening…',
    example: 'Tank 12, added 20 g/hl SO2, temp 22°C',
    /** Shown above the record button: voice notes are recognised in English only. */
    speakLanguage: '',
    saveAnalysis: 'Save analysis',
  },

  record: {
    listening: (elapsed: string, max: string) => `Listening… tap to stop · ${elapsed} / ${max}`,
    pleaseWait: 'Please wait…',
    tapAndSpeak: 'Tap and speak',
    stop: 'Stop listening',
    start: 'Start speaking',
  },

  review: {
    unmatchedTank: (name: string) =>
      `The note mentions "${name}", but you have no tank with that name. Choose the tank below.`,
    entryType: 'Entry type',
    values: 'Values',
    noValues: 'No values. Add one if needed.',
    valueN: (n: number) => `Value ${n}`,
    addValue: 'Add value',
    youSaid: 'YOU SAID',
  },

  valueRow: {
    removeLabel: (title: string, name: string) => `Remove ${title.toLowerCase()}${name ? `, ${name}` : ''}`,
    name: 'Name',
    value: 'Value',
    unit: 'Unit',
  },

  analysis: {
    fields: {
      freeSo2: 'Free SO2',
      totalSo2: 'Total SO2',
      temperature: 'Temperature',
      ph: 'pH',
      ta: 'Titratable acidity',
      va: 'Volatile acidity',
      alcohol: 'Alcohol',
      brix: 'Brix',
      residualSugar: 'Residual sugar',
      density: 'Density',
      volume: 'Volume',
    },
    unitIn: (label: string, unit: string) => `${label}, in ${unit}`,
    unitChoice: (label: string) => `${label} unit`,
    addedField: (n: number) => `Added field ${n}`,
    addField: 'Add field',
    addFieldHint: 'Adds a field where you type the name, value and unit',
  },

  editEntry: {
    offline: "You're offline. Your changes are saved on this phone and upload when you're back online.",
    loadFailed: 'Could not load the entry.',
  },

  entryCard: {
    a11yHint: 'Shows options for this entry',
    couldntDelete: (error: string) => `Couldn't delete: ${error}`,
    couldntUploadEdit: (error: string) => `Couldn't upload this edit: ${error}`,
    couldntUpload: (error: string) => `Couldn't upload: ${error}`,
    editedWaiting: 'Edited on this phone · waiting to upload',
    savedWaiting: 'Saved on this phone · waiting to upload',
  },

  sync: {
    uploading: (n: number) => `Uploading ${plural(n, 'change', 'changes')}…`,
    savedOffline: (n: number) => `${plural(n, 'change', 'changes')} saved on this phone. They upload when you're back online.`,
    waiting: (n: number) => `${plural(n, 'change', 'changes')} waiting to upload.`,
    failed: (n: number) =>
      `${plural(n, 'change', 'changes')} couldn't upload. Tap the marked tank or entry to fix, retry or delete it.`,
    uploadNow: 'Upload now',
    paused: 'Upload paused: no connection. It continues when you are back online.',
  },

  cached: {
    showingSaved: (error: string, when: string) => `${error} Showing what was saved on this phone (${when}).`,
  },

  offline: {
    default: "You're offline. Loading and saving need internet.",
  },

  entryTypes: {
    addition: 'Addition',
    temperature: 'Temperature',
    lab_analysis: 'Lab analysis',
    tasting: 'Tasting',
    transfer: 'Transfer',
    note: 'Note',
  },

  time: {
    justNow: 'just now',
    minutesAgo: (n: number) => `${n} min ago`,
    hoursAgo: (n: number) => `${n} h ago`,
    yesterday: 'yesterday',
    daysAgo: (n: number) => `${n} days ago`,
    today: (clock: string) => `Today ${clock}`,
    yesterdayAt: (clock: string) => `Yesterday ${clock}`,
    /** null: use the phone's own month names. */
    months: null as readonly string[] | null,
  },

  /** Names of standard values as stored (from the parser and the Analysis tab), for display. */
  items: {} as Readonly<Record<string, string>>,
  /** Units as stored, for display. */
  units: {} as Readonly<Record<string, string>>,

  /** Messages from lib/ (errors and validation). */
  messages: {
    network: 'No internet connection. Check your signal and try again.',
    somethingWrong: 'Something went wrong. Please try again.',
    notFound: 'That item no longer exists.',
    noAccess: "You don't have access to that.",
    sessionExpired: 'Your session has expired. Please sign in again.',
    outOfRange: 'Some values are out of range. Please check the form.',
    storageFull: 'Could not save on this phone. The phone storage may be full.',
    couldNotSave: 'Could not save.',
    couldNotUpload: 'Could not upload.',
    // Auth
    invalidEmail: 'Enter a valid email address.',
    passwordTooShort: (n: number) => `Password must be at least ${n} characters.`,
    wrongPassword: 'Wrong email or password.',
    confirmEmail: 'Confirm your email first: open the link we sent you.',
    accountExists: 'An account with this email already exists. Sign in instead.',
    accountExistsUsePassword: 'An account with this email already exists. Sign in with its password instead.',
    weakPassword: 'That password is too weak. Try a longer one.',
    tooManyAttempts: 'Too many attempts. Wait a minute and try again.',
    signupDisabled: 'Sign-up with email is turned off for this project.',
    authUnreachable: 'Could not reach the sign-in service. Please try again.',
    signInFailed: 'Could not sign in. Please try again.',
    signUpFailed: 'Could not create the account. Please try again.',
    signOutFailed: 'Could not sign out. Please try again.',
    sessionRestoreFailed: 'Could not restore your session.',
    // Tanks
    tankGone: 'That tank no longer exists.',
    tankGonePickAnother: 'That tank no longer exists. Pick another tank.',
    duplicateTank: (name: string) => `You already have a tank called "${name}".`,
    loadTanksFailed: 'Could not load your tanks.',
    loadTankFailed: 'Could not load this tank.',
    saveTankFailed: 'Could not save the tank.',
    deleteTankFailed: 'Could not delete the tank.',
    saveChangesFailed: 'Could not save your changes.',
    tankNameRequired: 'Give the tank a name, e.g. "Tank 12".',
    tankNameTooLong: (n: number) => `Keep the name under ${n} characters.`,
    volumeRequired: 'Enter the volume in liters.',
    volumeNumbersOnly: 'Use numbers only, e.g. 5000.',
    volumePositive: 'Volume must be more than 0 L.',
    volumeTooLarge: 'That volume is too large.',
    varietyTooLong: (n: number) => `Keep the variety under ${n} characters.`,
    vintageRange: (min: number, max: number) => `Enter a year between ${min} and ${max}, or leave it empty.`,
    // Entries
    entryGone: 'That entry no longer exists.',
    entryAlreadyDeleted: 'That entry was already deleted.',
    entryDeletedMeanwhile: 'That entry was deleted in the meantime.',
    loadTimelineFailed: 'Could not load the timeline.',
    loadEntriesFailed: 'Could not load your entries.',
    loadEntryFailed: 'Could not load the entry.',
    saveEntryFailed: 'Could not save the entry.',
    deleteEntryFailed: 'Could not delete the entry.',
    chooseTank: 'Choose the tank this entry belongs to.',
    chooseTankAnalysis: 'Choose the tank this analysis belongs to.',
    fillNameAndValueRow: 'Fill in both name and value, or remove this row.',
    fillNameAndValueField: 'Fill in both name and value, or remove this field.',
    rowTooLong: 'This row is too long.',
    fieldTooLong: 'This field is too long.',
    noteTooLong: (n: number) => `Keep the note under ${n} characters.`,
    addValueOrNote: 'Add at least one value or a note.',
    fillOneValue: 'Fill in at least one value.',
    typeNumber: (example: string) => `Type a number, like ${example}.`,
    between: (min: string, max: string) => `Should be between ${min} and ${max}.`,
    noteFirst: 'Say or type a note first.',
    // Speech
    didntCatch: "Didn't catch that. Tap the button and speak again.",
    micNeeded: 'Microphone access is needed to record notes.',
    speechLostConnection: 'Speech recognition lost its connection. Try again.',
    speechNeedsInternet: 'Voice needs internet until English is downloaded for offline use.',
    englishNotInstalled: 'English speech recognition is not installed on this phone.',
    micBusy: 'The microphone is busy. Try again in a moment.',
    micUnavailable: "Couldn't use the microphone. Close other apps that use it and try again.",
    speechUnavailable:
      "Speech recognition isn't available. Check that Google's “Speech Recognition & Synthesis” app is installed and enabled.",
    speechFailed: 'Speech recognition failed. Please try again.',
    speechCouldNotStart: 'Speech recognition could not start. Please try again.',
    downloadStarting: 'Starting download…',
    downloadReady: 'English is ready: voice now works offline.',
    downloadScheduled: 'Download scheduled. It finishes on Wi-Fi; voice works online until then.',
    downloadFollow: 'Follow the download dialog, then try recording again.',
  },
};

/** The shape every language must have. */
export type Strings = typeof en;
