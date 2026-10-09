# 3D HUB - plan projektu

Desktopowa aplikacja (Electron) do zarządzania biblioteką modeli 3D i monitorowania drukarek Bambu Lab.

## Stack
- **Electron** + **electron-vite** (main / preload / renderer, HMR)
- **React 19** + **TypeScript** + **Tailwind CSS 4**
- **three.js** via **@react-three/fiber** + **drei** (podgląd 3D)
- **zustand** (stan UI)
- electron-builder (pakowanie `.exe`)
- Vite przypięty do 7 (wymaga tego electron-vite 5); @vitejs/plugin-react 5.

## Struktura
```
src/
  main/       proces główny: okno, IPC, dostęp do dysku, (docelowo) MQTT
  preload/    contextBridge -> window.hub (bezpieczne API dla renderera)
  shared/     typy wspólne (ModelFile, HubApi)
  renderer/   React UI
    src/views/        LibraryView, PrintersView
    src/components/   Sidebar, ModelViewer
    src/store.ts      zustand
```
Zasada: renderer NIE ma dostępu do Node/fs. Wszystko przez IPC w preload (`window.hub`).

## Zrobione (podstawka)
- [x] Szkielet Electron + React + TS + Tailwind
- [x] Wybór folderu biblioteki (zapamiętany w `userData/config.json`)
- [x] Rekursywny skan `.stl` / `.obj` / `.3mf`
- [x] Lista modeli + podgląd 3D (orbit, grid, auto-fit)
- [x] Wymiary modelu (bounding box) w mm
- [x] Zakładka Drukarki (placeholder)

- [x] Drukarki: dodawanie Bambu Lab (model, IP, serial, kod dostępu), MQTT/TLS 8883, status na żywo (stan, postęp, warstwy, czas, temperatury). Kod zaszyfrowany przez safeStorage, zapis w userData/printers.json
- [x] 3MF z Bambu Studio: plate'y z miniaturami, drukarka z projektu, czas i waga po slicingu
- [x] Podgląd 3D: stół z siatką, kolorowe osie X/Y/Z, gizmo w rogu, parsowanie STL/OBJ w workerze

- [x] Miniatury 3MF: wybór źródła (z pliku / generowane) przy pierwszym starcie i w ustawieniach, fallback na generowanie
- [x] Podgląd 3MF w kolorach filamentów (parser w workerze) + przełącznik Kolor / Jednolity
- [x] Plakietki plate / czas / waga na kafelkach (indeks w .3dhub/index.json) i filtry biblioteki (czas, waga, plate, tylko pocięte)

## TODO - Biblioteka
- [ ] Miniatury (render offscreen -> cache PNG)
- [ ] (opcjonalnie) przejście z data.json na SQLite przy dużych bibliotekach
- [ ] Wyszukiwanie / filtrowanie po tagach
- [ ] Czas druku / zużycie filamentu: parsowanie metadanych z `.3mf` (gcode z Bambu Studio) lub ręcznie
- [ ] Watcher folderu (chokidar) zamiast ręcznego odświeżania
- [ ] Wsparcie `.step`, `.gcode.3mf`
- [ ] Wirtualizacja listy przy tysiącach modeli

## TODO - Drukarki (Bambu Lab)
- [ ] Klient MQTT w main procesie (`mqtt`): TLS, port 8883, user `bblp`, hasło = access code
- [ ] Subskrypcja `device/<SERIAL>/report`, publish `device/<SERIAL>/request`
- [ ] Status: temperatury, postęp, warstwa, ETA, stan AMS
- [ ] Konfiguracja drukarek (IP, serial, access code) - trzymać w keychain (`safeStorage`)
- [ ] Podgląd kamery (RTSP/JPEG stream)
- [ ] Wysyłanie plików (FTPS, port 990) - opcjonalnie

## TODO - ogólne
- [ ] Ikona + `electron-builder.yml` (instalator NSIS)
- [ ] Ustawienia, motyw jasny/ciemny
- [ ] Testy (vitest)

## Komendy
- `npm run dev` - tryb deweloperski
- `npm run typecheck`
- `npm run build` / `npm run dist`