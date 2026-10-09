# 3D HUB

Aplikacja desktopowa (Electron) do porządkowania biblioteki modeli 3D i podglądu drukarek Bambu Lab w jednym miejscu.

Wskazujesz folder z modelami, a aplikacja pokazuje je jako kafelki z miniaturami i podglądem 3D. Do tego dochodzą tagi, projekty złożone z kilku części i status drukarek na żywo przez sieć lokalną.

## Co potrafi

**Biblioteka**
- Skanuje wskazany folder pod kątem plików `.stl`, `.obj` i `.3mf`.
- Pokazuje foldery z dysku jako stosy kart z miniaturami albo wszystkie modele naraz. Foldery można tworzyć, zmieniać im nazwy i usuwać do Kosza, a pliki przeciągać między nimi.
- Pliki wrzucone z Eksploratora są kopiowane do biblioteki.
- Tagi, notatki i ulubione, wyszukiwarka, sortowanie i filtry po czasie druku, wadze i liczbie plate.
- Podgląd 3D z siatką, osiami X/Y/Z i wymiarami modelu w mm.

**Pliki 3MF z Bambu Studio**
- Lista plate'ów z miniaturami, drukarka z projektu, a po slicingu także czas druku, waga i filamenty.
- Podgląd w kolorach filamentów (łącznie z kolorami malowanymi pędzlem) i przełącznik na jednolity.
- Miniatury można brać z pliku albo generować w aplikacji.

**Projekty**
- Projekt składa się z części (np. obudowa, uchwyt), a każda część ma wersje plików i jedną aktualną.

**Drukarki Bambu Lab**
- Połączenie przez LAN (MQTT po TLS): stan, postęp, warstwy, czas do końca, temperatury, wentylatory, AMS i ostrzeżenia.
- Wstrzymanie, wznowienie i przerwanie druku, światło i prędkość. Kamera dla P1/A1 i powiadomienie Windows po zakończeniu druku.
- Ulubiona drukarka ze skrótem informacji w pasku bocznym.

## Wymagania

- Windows (aplikacja jest pisana i testowana na Windows 11)
- Node.js 20.19 lub nowszy

## Uruchomienie

```bash
npm install
npm run dev
```

Inne komendy:

```bash
npm run typecheck   # sprawdzenie typów
npm run build       # produkcyjny build do katalogu out/
npm run dist        # build + pakowanie przez electron-builder (konfiguracja instalatora jeszcze nie jest gotowa)
```

## Dodanie drukarki

Drukarka i komputer muszą być w tej samej sieci. W zakładce **Drukarki** wybierz **Dodaj drukarkę** i podaj model, adres IP, numer seryjny oraz kod dostępu, które znajdziesz w ustawieniach drukarki. Kod jest zapisywany zaszyfrowany (`safeStorage`) w profilu użytkownika, a nie w folderze biblioteki. Nowsze wersje firmware mogą wymagać włączonego trybu LAN.

## Skróty klawiszowe

Pełną listę pokazuje klawisz `?` albo `F1`.

| Skrót | Działanie |
| --- | --- |
| `Ctrl+1` / `2` / `3` | Biblioteka / Projekty / Drukarki |
| `Ctrl+,` | Ustawienia |
| `/` lub `Ctrl+K` | Szukaj |
| strzałki | Przesuwanie zaznaczenia po siatce |
| `Backspace` | Folder wyżej |
| `Ctrl+N` | Nowy folder (w Projektach: nowy projekt) |
| `Enter` / `Shift+Enter` | Otwórz w programie / pokaż w folderze |
| `F2`, `F`, `C`, `Delete` | Zmień nazwę, ulubione, kolor lub jednolity, usuń do Kosza |

## Gdzie są dane

- W folderze biblioteki powstaje ukryty folder `.3dhub/` z miniaturami, tagami, notatkami, projektami i indeksem 3MF. Skaner go pomija, a przy przenoszeniu biblioteki dane jadą razem z nią.
- Ustawienia aplikacji i lista drukarek leżą w profilu użytkownika (`%APPDATA%`).
- Pliki z biblioteki usuwane przez aplikację trafiają do Kosza Windows, więc można je przywrócić.

## Struktura projektu

```
src/
  main/       proces główny: okno, IPC, dysk, odczyt 3MF, drukarki MQTT
  preload/    most contextBridge (window.hub)
  shared/     typy współdzielone
  renderer/   interfejs React (widoki, komponenty, store, parsery)
```

Renderer nie ma dostępu do Node ani do plików, wszystko przechodzi przez IPC w preload. Szczegóły, listę zrobionych rzeczy i plan dalszych prac znajdziesz w [PLAN.md](PLAN.md).

## Stack

Electron, electron-vite, React 19, TypeScript, Tailwind CSS 4, three.js (react-three-fiber), zustand, mqtt, fflate.

## Status

Projekt jest w trakcie rozwoju i nie ma jeszcze instalatora ani testów automatycznych. Status drukarki sprawdzono na P1S. Sterowanie i kamerę napisano według protokołu LAN Bambu Lab i nie zweryfikowano na wszystkich modelach.
