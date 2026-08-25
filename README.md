# Home Lab Launcher

A little always-on-top desktop widget that docks in the corner of your screen and gives you one-click buttons to everything you actually use — your home lab dashboard, self-hosted apps, random local scripts, whatever. Not just for home labs either — it's really just a way to organize your desktop into something you can collapse to a pill and get out of the way when you don't need it.

![Main widget](screenshots/main-widget.png)

## What it does

- Docks top-right, sizes itself to fit whatever you add — no scrolling.
- Drag it wherever you want. Collapse it to a small pill, expand it back.
- Group your stuff into categories (Media, Downloads, Infra, whatever makes sense to you).
- Tiles can be a URL (opens in your browser) or a local file/shortcut/script (`.lnk`, `.bat`, `.sh`, whatever your OS runs).
- **Pull tiles straight out of a Caddyfile** if you're running Caddy as a reverse proxy — it reads the site blocks, guesses icons for common self-hosted apps, and gives you an editable checklist before adding anything.
- Everything's editable through a real settings window — no config files to hand-edit unless you want to.
- Click a tile, it opens the thing and auto-collapses back to the pill.
- Survives crashes without locking you out of your own screen (see below).

![Onboarding](screenshots/onboarding.png)

Name it whatever you want on first launch. It's your desktop.

## Settings

Add/edit/reorder categories and apps, pick from a built-in icon set, pick a color, toggle "launch at login," import from a Caddyfile. No JSON editing required.

![Settings](screenshots/settings.png)

## Getting started

There's no packaged installer yet — this runs from source for now:

```
git clone <this repo>
cd home-lab-launcher
npm install
npm start
```

Needs [Node.js](https://nodejs.org/). First launch asks you to name your setup, then you're in. Add apps by hand through Settings, or import from a Caddyfile if you've got one.

## Closing it without losing it

The pin button in the header just drops always-on-top — the window stays open, it just stops floating above everything else. The tray icon has Show/Hide and the actual Quit. There's also a panic hotkey, `Ctrl+Alt+Shift+D`, that un-pins and hides it from anywhere — and the same thing kicks in automatically if the window ever stops responding (renderer crash, GPU hang, whatever). Point is: an always-on-top widget with no way back is a bad time, so there's always a way back.

## Notes

- Windows and Linux autostart both work (`Launch at login` in Settings). macOS should work too but hasn't been tested much.
- Icons are simple flat SVG glyphs, not real app logos — pick whichever one reads closest.
- Your config lives outside the app folder (OS user-data dir), so updating the app later won't wipe your setup.
- No packaged installer/GitHub Actions build yet — that's next.
