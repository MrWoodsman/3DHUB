# 3D HUB - plan projektu

Desktopowa aplikacja (Electron) do zarządzania biblioteką modeli 3D i monitorowania drukarek Bambu Lab.
Opis, uruchomienie i skróty klawiszowe: [README.md](README.md).

## Stack
- **Electron** + **electron-vite** (main / preload / renderer, HMR)
- **React 19** + **TypeScript** + **Tailwind CSS 4**
- **three.js** przez **@react-three/fiber** + **drei** (podgląd 3D)
- **zustand** (stan UI), **mqtt** (drukarki), **fflate** (odczyt plików 3MF)
- electron-builder (pakowanie `.exe`, jeszcze nie skonfigurowane)
- Vite przypięty do 7 (wymaga tego electron-vite 5), `@vitejs/plugin-react` 5

## Struktura
```
src/
  main/       proces główny: okno, IPC, dysk, .3dhub, 3MF (threemf.ts), drukarki MQTT (printers.ts)
  preload/    contextBridge -> window.hub (bezpieczne API dla renderera)
  shared/     typy wspólne (types.ts, printers.ts)
  renderer/   React UI
    src/views/        LibraryView, ProjectsView, PrintersView
    src/components/   karty, panel szczegółów, viewer 3D, modale, widżet drukarki
    src/lib/          wczytywanie modeli (worker), parser 3MF z kolorami, miniatury, skróty, drag&drop
    src/store.ts      zustand
```
Zasada: renderer NIE ma dostępu do Node/fs. Wszystko przez IPC w preload (`window.hub`).

## Dane na dysku
- `<biblioteka>/.3dhub/` (ukryty folder, skaner go pomija): `thumbs/` (miniatury), `data.json` (tagi, notatki, ulubione), `projects.json`, `index.json` (czas/waga/plate z 3MF)
- `userData/config.json` (ścieżka biblioteki, źródło miniatur 3MF), `userData/printers.json` (drukarki, kod dostępu zaszyfrowany przez `safeStorage`)

## Zrobione

### Biblioteka
- [x] Wybór folderu biblioteki, rekursywny skan `.stl` / `.obj` / `.3mf`
- [x] Widok folderów (kafelki jako stos kart, breadcrumbs) i płaski; wyszukiwanie po nazwie i tagach
- [x] Miniatury w ukrytym oknie Electrona (UI się nie zacina), pasek postępu, cache w `.3dhub/thumbs`
- [x] 3MF: miniatury z pliku lub generowane (wybór przy pierwszym starcie i w ustawieniach), odrzucanie białych teł
- [x] Tagi, notatki, ulubione; filtry (tag, ulubione, czas druku, waga, liczba plate, tylko pocięte); sortowanie
- [x] 3MF z Bambu Studio: plate'y z miniaturami, drukarka z projektu, czas i waga po slicingu, plakietki na kafelkach
- [x] Foldery: tworzenie, zmiana nazwy, usuwanie do Kosza, przeciąganie plików i folderów (przenosi tagi, miniatury, projekty)
- [x] Zmiana nazwy i usuwanie plików, import przeciągnięciem z Eksploratora, "Otwórz w programie", "Pokaż w folderze"
- [x] Panel szczegółów o regulowanej szerokości, kwadratowy podgląd 3D

### Podgląd 3D
- [x] Orbit, stół z siatką dopasowaną do modelu, kolorowe osie X/Y/Z i gizmo w rogu, wymiary w mm
- [x] Parsowanie STL/OBJ/3MF w workerze, spinner i płynne pojawianie się modelu
- [x] 3MF w kolorach filamentów (kolor obiektu i malowanie pędzlem `paint_color`), przełącznik Kolor / Jednolity

### Projekty
- [x] Projekt = części (np. obudowa, uchwyt) z wersjami plików, aktualna wersja, notatki, "aktualny zestaw"

### Drukarki (Bambu Lab, LAN/MQTT)
- [x] Dodawanie drukarki (model, IP, serial, kod dostępu), połączenie MQTT/TLS, status na żywo
- [x] Postęp, warstwy, czas do końca, temperatury, wentylatory, AMS, ostrzeżenia HMS
- [x] Sterowanie: wstrzymaj / wznów / przerwij, światło, prędkość druku
- [x] Kamera P1/A1 (strumień JPEG), powiadomienia o końcu i błędzie druku
- [x] Ulubiona drukarka w pasku bocznym ze skrótem najważniejszych informacji

### Aplikacja
- [x] Własny pasek tytułu, ustawienia (folder, widok, rozmiar kafelków, miniatury, dane)
- [x] Skróty klawiszowe (`?` / `F1` pokazuje listę), potwierdzenia usuwania w oknach, powiadomienia (toast)

## Do zrobienia

### Biblioteka
- [ ] Zaznaczanie wielu plików (masowe tagi, przenoszenie, usuwanie)
- [ ] Watcher folderu (chokidar) zamiast ręcznego odświeżania
- [ ] Wirtualizacja siatki przy tysiącach modeli
- [ ] Wykrywanie duplikatów
- [ ] Wsparcie `.step`, `.gcode.3mf`
- [ ] Podgląd tylko wybranego plate (dziś widać wszystkie naraz)
- [ ] (opcjonalnie) SQLite zamiast plików JSON przy dużych bibliotekach

### Filamenty (zakładka z projektu w Figmie)
- [ ] Magazyn szpul: materiał, marka, kolor, waga początkowa i pozostała
- [ ] Dopasowanie do slotów AMS i zużycia z 3MF (gramy per filament)
- [ ] Filtr biblioteki "to, co mogę wydrukować z posiadanych szpul"

### Drukarki
- [ ] Kamera X1 / H2D (RTSP) - dziś tylko P1/A1
- [ ] Wysyłanie plików na drukarkę (FTPS, port 990)
- [ ] Historia wydruków
- [ ] Sprawdzić komendy i kamerę na więcej modeli i wersji firmware (status działa na P1S)

### Ogólne
- [ ] Ikona aplikacji + `electron-builder.yml` (instalator NSIS)
- [ ] Motyw jasny
- [ ] Testy (vitest), w tym parser 3MF i dekodowanie `paint_color`

## Komendy
- `npm run dev` - tryb deweloperski
- `npm run typecheck`
- `npm run build` / `npm run dist`
