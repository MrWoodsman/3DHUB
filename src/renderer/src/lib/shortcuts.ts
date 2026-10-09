/** Every keyboard shortcut of the app, in one place. The handlers live in App and LibraryView; this list feeds the cheat sheet. */
export interface Shortcut {
  keys: string[][] // alternatives, each a combination: [['Ctrl', 'K'], ['/']]
  label: string
}
export interface ShortcutGroup {
  title: string
  items: Shortcut[]
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Ogólne',
    items: [
      { keys: [['Ctrl', '1']], label: 'Biblioteka' },
      { keys: [['Ctrl', '2']], label: 'Projekty' },
      { keys: [['Ctrl', '3']], label: 'Drukarki' },
      { keys: [['Ctrl', ',']], label: 'Ustawienia' },
      { keys: [['?'], ['F1']], label: 'Ta lista skrótów' },
      { keys: [['Esc']], label: 'Zamknij okno lub panel' }
    ]
  },
  {
    title: 'Biblioteka',
    items: [
      { keys: [['/'], ['Ctrl', 'K']], label: 'Szukaj' },
      { keys: [['←', '↑', '→', '↓']], label: 'Przesuwaj zaznaczenie po siatce' },
      { keys: [['Backspace']], label: 'Folder wyżej' },
      { keys: [['Ctrl', 'N']], label: 'Nowy folder (w Projektach: nowy projekt)' },
      { keys: [['Esc']], label: 'Zamknij panel, potem wyczyść filtry' }
    ]
  },
  {
    title: 'Zaznaczony model',
    items: [
      { keys: [['Enter']], label: 'Otwórz w programie (3MF w slicerze)' },
      { keys: [['Shift', 'Enter']], label: 'Pokaż w folderze' },
      { keys: [['F2']], label: 'Zmień nazwę' },
      { keys: [['F']], label: 'Dodaj lub usuń z ulubionych' },
      { keys: [['C']], label: 'Podgląd: kolor lub jednolity' },
      { keys: [['Delete']], label: 'Usuń do Kosza' }
    ]
  }
]
