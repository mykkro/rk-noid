// Tiny i18n layer: English + Czech dictionaries, t()/tn() lookups, DOM binding
// via data-i18n* attributes and a language switcher widget.
//
//   data-i18n="key"             -> element.textContent
//   data-i18n-html="key"        -> element.innerHTML (trusted dictionary markup only)
//   data-i18n-title="key"       -> title attribute
//   data-i18n-placeholder="key" -> placeholder attribute

export const LANGS = { en: 'EN', cs: 'CZ' };

const STRINGS = {
  en: {
    // ---------------------------------------------------------------- game page
    'lang.switch': 'Language',
    'hud.score': 'Score',
    'hud.hi': 'Hi',
    'hud.lives': 'Lives',
    'hud.level': 'Level',
    'hud.camera': 'Camera',
    'help.move': '<kbd>Mouse</kbd>/<kbd>←→</kbd> move',
    'help.fire': '<kbd>Click</kbd>/<kbd>Space</kbd> launch · fire',
    'help.orbit': '<kbd>Right-drag</kbd> orbit',
    'help.zoom': '<kbd>Wheel</kbd> zoom',
    'help.camera': '<kbd>V</kbd> camera',
    'help.ortho': '<kbd>O</kbd> ortho/persp',
    'help.reset': '<kbd>R</kbd> reset view',
    'help.mute': '<kbd>M</kbd> mute',
    'help.pause': '<kbd>P</kbd> pause',
    'help.hide': '<kbd>H</kbd> hide help',
    'pause.title': 'Paused',
    'pause.resume': 'Resume',
    'pause.quit': 'Quit to menu',
    'menu.play': '▶ Play',
    'menu.hiscore': 'Hi-score',
    'menu.levels': 'Levels',
    'menu.openFile': 'Open level file…',
    'menu.editor': 'Level editor',
    'menu.howto': 'How to play',
    'menu.intro': 'Bounce the ball with your bat and smash every brick. Bricks sit in <b>stacks</b>: when the bottom one breaks, the rest drop down.',
    'menu.brick.plain': '<b>Plain</b> one hit',
    'menu.brick.hard': '<b>Hard</b> 2–3 hits',
    'menu.brick.steel': '<b>Steel</b> can\'t be destroyed',
    'menu.brick.armored': '<b>Armored</b> lasers only',
    'menu.brick.explosive': '<b>Explosive</b> blows up its neighbours',
    'menu.brick.bonus': '<b>Bonus</b> drops a capsule',
    'menu.brick.critter': '<b>Critter nest</b> releases a critter that crawls toward you. If it touches your bat it\'s <b>game over</b>. Dodge it: the ball just bounces off it, only lasers can kill it.',
    'menu.capsules': 'Capsules',
    'menu.controls': 'Controls',
    'menu.keys': '<kbd>Mouse</kbd> or <kbd>←</kbd><kbd>→</kbd> move · <kbd>Click</kbd>/<kbd>Space</kbd> launch &amp; fire · <kbd>Right-drag</kbd> orbit · <kbd>Wheel</kbd> zoom · <kbd>V</kbd> camera preset · <kbd>O</kbd> ortho/persp · <kbd>P</kbd> pause',
    'menu.credits': 'Inspired by <i>Arkanoid</i> (Taito, 1986) and <i>Ballbreaker</i> (CRL, ZX Spectrum, 1987). Pure WebGL2, no libraries.',
    'menu.loadNotice': 'Could not load <code>levels/</code> ({msg}). Browsers block <code>fetch</code> from <code>file://</code> pages, so run a local web server (see README). You can still open a level JSON file with the button below.',
    'err.webgl': 'Could not start WebGL2: {msg}',
    'err.loadLevel': 'Could not load level: {msg}',
    'err.invalidJson': 'Invalid JSON: {msg}',

    'bonus.laser': 'Laser',
    'bonus.expand': 'Expand',
    'bonus.slow': 'Slow',
    'bonus.multi': 'Multi-ball',
    'bonus.catch': 'Catch',
    'bonus.life': 'Extra life',
    'bonus.mega': 'Mega ball',

    'cam.iso': 'Isometric',
    'cam.iso45': 'True iso 45°',
    'cam.arcade': 'Arcade',
    'cam.chase': 'Low chase',
    'cam.top': 'Top-down',
    'cam.persp': ' · persp',

    'toast.critter': 'Critter released!',
    'toast.camera': 'Camera: {name}',
    'toast.ortho': 'Orthographic',
    'toast.persp': 'Perspective',
    'toast.soundOff': 'Sound off',
    'toast.soundOn': 'Sound on',

    'msg.level': 'Level {n}',
    'msg.launch': 'Click or press Space to launch',
    'msg.critterAttack': 'Critter attack!',
    'msg.ballLost': 'Ball lost',
    'msg.livesLeft': '{n} life left|{n} lives left',
    'msg.clear': 'Level clear!',
    'msg.bonus': 'Bonus +{n}',
    'msg.over': 'Game over',
    'msg.toMenu': 'Click to return to the menu',
    'msg.testDone': 'Test complete',
    'msg.win': 'You win!',
    'msg.final': 'Final score {n}',
    'msg.return': 'Click to return',
    'reason.noLives': 'No lives left',
    'reason.eaten': 'A critter ate your bat!',

    // ---------------------------------------------------------------- level validation
    'v.notObject': 'Level is not a JSON object',
    'v.cols': '"cols" must be 3..31 (got {v})',
    'v.rows': '"rows" must be 1..30 (got {v})',
    'v.layers': '"layers" must be a non-empty array',
    'v.keyLen': 'Legend key "{key}" must be a single character - ignored',
    'v.unknownType': 'Legend "{key}": unknown type "{type}", using "normal"',
    'v.unknownDrop': 'Legend "{key}": unknown drop "{drop}"',
    'v.layerNotArray': 'Layer {l} is not an array of strings',
    'v.layerRows': 'Layer {l} has {n} rows, expected {rows}',
    'v.rowLen': 'Layer {l} row {r} has {n} chars, expected {cols}',
    'v.unknownBrick': 'Unknown brick "{ch}" at layer {l}, row {r}, col {c}',
    'v.floating': '{n} brick(s) have nothing below them and will drop down',
    'v.noBricks': 'Level has no destructible bricks - it would be cleared instantly',
    'v.shielded': 'Armored brick at row {r}, col {c} is shielded by steel at row {r2} - lasers can never reach it',
    'v.noLaser': 'Armored bricks but no guaranteed laser drop (a pity laser will appear when only armored bricks remain)',
    'v.onSteel': 'Brick stacked on steel at row {r}, col {c} can never be cleared',

    // ---------------------------------------------------------------- editor
    'ed.pageTitle': 'rk/noid level editor',
    'ed.title': 'Level editor',
    'ed.backToGame': 'Back to the game',
    'ed.new': 'New',
    'ed.open': 'Open…',
    'ed.bundled': 'Bundled levels…',
    'ed.bundledTip': 'Load a bundled level',
    'ed.download': 'Download JSON',
    'ed.copy': 'Copy JSON',
    'ed.undo': '↶ Undo',
    'ed.redo': '↷ Redo',
    'ed.test': '▶ Test play',
    'ed.level': 'Level',
    'ed.name': 'Name',
    'ed.nameCs': 'Name (Czech)',
    'ed.author': 'Author',
    'ed.description': 'Description',
    'ed.descriptionCs': 'Description (Czech)',
    'ed.cols': 'Columns',
    'ed.rows': 'Rows',
    'ed.settings': 'Settings',
    'ed.ballSpeed': 'Ball speed',
    'ed.ballSpeedMax': 'Max speed',
    'ed.bonusChance': 'Bonus chance',
    'ed.critterSpeed': 'Critter speed',
    'ed.depth': 'Field depth',
    'ed.depthTip': '0 = automatic',
    'ed.backGap': 'Back gap',
    'ed.floorColor': 'Floor tint',
    'ed.wallColor': 'Wall tint',
    'ed.critterMode': 'Critter touches bat',
    'ed.cm.gameover': 'Game over',
    'ed.cm.life': 'Lose a life',
    'ed.check': 'Check',
    'ed.rawJson': 'Raw JSON',
    'ed.applyJson': 'Apply JSON',
    'ed.stackMode': 'Stack mode',
    'ed.stackModeTip': 'Click pushes a brick on top of the stack, right-click removes the top brick',
    'ed.layerMode': 'Layer mode',
    'ed.layerModeTip': 'Edit one horizontal layer at a time',
    'ed.addLayer': '+ layer',
    'ed.addLayerTip': 'Add layer',
    'ed.delLayer': '− layer',
    'ed.delLayerTip': 'Remove current layer',
    'ed.paint': 'Paint',
    'ed.erase': 'Erase',
    'ed.rect': 'Rect',
    'ed.rectTip': 'Fill a rectangle: drag across cells',
    'ed.pick': 'Pick',
    'ed.pickTip': 'Alt+click also picks',
    'ed.mirror': 'Mirror ⇆',
    'ed.mirrorTip': 'Mirror left half onto right half',
    'ed.clear': 'Clear',
    'ed.gridHint': 'Back wall ↑ · player side ↓ &nbsp;|&nbsp; Left-click: paint · Right-click: erase · Alt-click: pick ·',
    'ed.brickType': 'Brick type',
    'ed.char': 'Char',
    'ed.type': 'Type',
    'ed.colour': 'Colour',
    'ed.hits': 'Hits',
    'ed.drop': 'Drop',
    'ed.texture': 'Texture',
    'ed.releasesCritter': 'Releases a critter',
    'ed.newType': '+ New brick type',
    'ed.reset': 'Reset to default',
    'ed.deleteType': 'Delete type',
    'ed.previewHint': 'Drag to orbit · wheel to zoom · <kbd>V</kbd> camera preset',
    'ed.layerGround': 'L0 ground',
    'ed.layerN': 'L{n}',
    'ed.dropNone': 'none',
    'ed.dropRandom': 'random bonus',
    'type.normal': 'normal',
    'type.hard': 'hard',
    'type.steel': 'steel (indestructible)',
    'type.armored': 'armored (laser only)',
    'type.explosive': 'explosive',
    'abbr.hard': 'hard',
    'abbr.steel': 'steel',
    'abbr.armored': 'armor',
    'abbr.explosive': 'boom',
    'tex.default': '(type default)',
    'tex.brick': 'brick',
    'tex.hard': 'hard',
    'tex.bonus': 'bonus ?',
    'tex.critterBrick': 'critter eyes',
    'tex.explosive': 'explosive',
    'tex.armored': 'armored',
    'tex.steel': 'steel',
    'ed.desc.hits': '{n} hit|{n} hits',
    'ed.desc.drops': 'drops {drop}',
    'ed.desc.critter': 'releases a critter',
    'ed.desc.overridden': '(overridden)',
    'ed.desc.custom': '(custom)',
    'ed.badChar': 'Pick a single character other than . _ space " \\',
    'ed.charUsed': '"{key}" is already used',
    'ed.noFreeChars': 'No free characters left',
    'ed.resetDone': '"{key}" reset to default',
    'ed.confirmDelete': '"{key}" is used in the level. Delete it and remove those bricks?',
    'ed.confirmClear': 'Remove all bricks?',
    'ed.confirmNew': 'Start a new empty level? (Undo can bring the old one back.)',
    'ed.cellInfo': 'row {r}, col {c}, stack {s}',
    'ed.stats': 'Bricks: {n} ({req} to clear)<br>Bonus bricks: {d} · Critter nests: {c}<br>Tallest stack: {h} · Field depth: {depth}',
    'ed.looksGood': 'Looks good',
    'ed.loaded': 'Loaded {name}',
    'ed.copied': 'JSON copied',
    'ed.noClipboard': 'Clipboard not available',
    'ed.fixFirst': 'Fix these first:',
    'ed.fetchFail': 'Could not fetch {f}: {msg}',
  },

  cs: {
    'lang.switch': 'Jazyk',
    'hud.score': 'Skóre',
    'hud.hi': 'Rekord',
    'hud.lives': 'Životy',
    'hud.level': 'Úroveň',
    'hud.camera': 'Kamera',
    'help.move': '<kbd>Myš</kbd>/<kbd>←→</kbd> pohyb',
    'help.fire': '<kbd>Klik</kbd>/<kbd>Mezerník</kbd> odpal · střelba',
    'help.orbit': '<kbd>Pravé tlačítko + tah</kbd> otáčení',
    'help.zoom': '<kbd>Kolečko</kbd> přiblížení',
    'help.camera': '<kbd>V</kbd> kamera',
    'help.ortho': '<kbd>O</kbd> orto/persp',
    'help.reset': '<kbd>R</kbd> výchozí pohled',
    'help.mute': '<kbd>M</kbd> zvuk',
    'help.pause': '<kbd>P</kbd> pauza',
    'help.hide': '<kbd>H</kbd> skrýt nápovědu',
    'pause.title': 'Pauza',
    'pause.resume': 'Pokračovat',
    'pause.quit': 'Zpět do menu',
    'menu.play': '▶ Hrát',
    'menu.hiscore': 'Rekord',
    'menu.levels': 'Úrovně',
    'menu.openFile': 'Otevřít soubor úrovně…',
    'menu.editor': 'Editor úrovní',
    'menu.howto': 'Jak hrát',
    'menu.intro': 'Odrážej míček pálkou a rozbij všechny cihly. Cihly jsou naskládané do <b>stohů</b>: když rozbiješ spodní, ostatní spadnou dolů.',
    'menu.brick.plain': '<b>Obyčejná</b> jeden zásah',
    'menu.brick.hard': '<b>Tvrdá</b> 2–3 zásahy',
    'menu.brick.steel': '<b>Ocelová</b> nezničitelná',
    'menu.brick.armored': '<b>Pancéřovaná</b> jen laserem',
    'menu.brick.explosive': '<b>Výbušná</b> zničí sousední cihly',
    'menu.brick.bonus': '<b>Bonusová</b> pustí kapsli',
    'menu.brick.critter': '<b>Hnízdo potvůrek</b> vypustí potvůrku, která leze k tobě. Když se dotkne pálky, je <b>konec hry</b>. Uhni jí: míček se od ní jen odrazí, zabít ji jde jen laserem.',
    'menu.capsules': 'Kapsle',
    'menu.controls': 'Ovládání',
    'menu.keys': '<kbd>Myš</kbd> nebo <kbd>←</kbd><kbd>→</kbd> pohyb · <kbd>Klik</kbd>/<kbd>Mezerník</kbd> odpal a střelba · <kbd>Pravé tlačítko + tah</kbd> otáčení · <kbd>Kolečko</kbd> přiblížení · <kbd>V</kbd> předvolba kamery · <kbd>O</kbd> orto/persp · <kbd>P</kbd> pauza',
    'menu.credits': 'Inspirováno hrami <i>Arkanoid</i> (Taito, 1986) a <i>Ballbreaker</i> (CRL, ZX Spectrum, 1987). Čisté WebGL2, žádné knihovny.',
    'menu.loadNotice': 'Nepodařilo se načíst <code>levels/</code> ({msg}). Prohlížeče blokují <code>fetch</code> ze stránek <code>file://</code>, spusť proto lokální webový server (viz README). Soubor úrovně JSON můžeš i tak otevřít tlačítkem níže.',
    'err.webgl': 'WebGL2 nelze spustit: {msg}',
    'err.loadLevel': 'Úroveň nelze načíst: {msg}',
    'err.invalidJson': 'Neplatný JSON: {msg}',

    'bonus.laser': 'Laser',
    'bonus.expand': 'Prodloužení',
    'bonus.slow': 'Zpomalení',
    'bonus.multi': 'Více míčků',
    'bonus.catch': 'Chytání',
    'bonus.life': 'Život navíc',
    'bonus.mega': 'Mega míček',

    'cam.iso': 'Izometrická',
    'cam.iso45': 'Pravá izometrie 45°',
    'cam.arcade': 'Arkádová',
    'cam.chase': 'Nízký pohled',
    'cam.top': 'Shora',
    'cam.persp': ' · persp.',

    'toast.critter': 'Potvůrka vypuštěna!',
    'toast.camera': 'Kamera: {name}',
    'toast.ortho': 'Ortografická projekce',
    'toast.persp': 'Perspektiva',
    'toast.soundOff': 'Zvuk vypnut',
    'toast.soundOn': 'Zvuk zapnut',

    'msg.level': 'Úroveň {n}',
    'msg.launch': 'Klikni nebo stiskni mezerník pro odpal',
    'msg.critterAttack': 'Útok potvůrky!',
    'msg.ballLost': 'Míček ztracen',
    'msg.livesLeft': 'Zbývá {n} život|Zbývají {n} životy|Zbývá {n} životů',
    'msg.clear': 'Úroveň dokončena!',
    'msg.bonus': 'Bonus +{n}',
    'msg.over': 'Konec hry',
    'msg.toMenu': 'Klikni pro návrat do menu',
    'msg.testDone': 'Test dokončen',
    'msg.win': 'Vítězství!',
    'msg.final': 'Konečné skóre {n}',
    'msg.return': 'Klikni pro návrat',
    'reason.noLives': 'Došly životy',
    'reason.eaten': 'Potvůrka ti sežrala pálku!',

    'v.notObject': 'Úroveň není JSON objekt',
    'v.cols': '"cols" musí být 3..31 (je {v})',
    'v.rows': '"rows" musí být 1..30 (je {v})',
    'v.layers': '"layers" musí být neprázdné pole',
    'v.keyLen': 'Klíč legendy "{key}" musí být jeden znak – ignorováno',
    'v.unknownType': 'Legenda "{key}": neznámý typ "{type}", použit "normal"',
    'v.unknownDrop': 'Legenda "{key}": neznámý bonus "{drop}"',
    'v.layerNotArray': 'Vrstva {l} není pole řetězců',
    'v.layerRows': 'Vrstva {l} má {n} řádků, očekáváno {rows}',
    'v.rowLen': 'Vrstva {l}, řádek {r} má {n} znaků, očekáváno {cols}',
    'v.unknownBrick': 'Neznámá cihla "{ch}" ve vrstvě {l}, řádek {r}, sloupec {c}',
    'v.floating': 'Cihly bez podpory, které spadnou dolů: {n}',
    'v.noBricks': 'Úroveň nemá žádné zničitelné cihly – byla by hned dokončená',
    'v.shielded': 'Pancéřovaná cihla na řádku {r}, sloupci {c} je krytá ocelí na řádku {r2} – laser ji nikdy nezasáhne',
    'v.noLaser': 'Pancéřované cihly bez zaručeného laseru (záložní laser se objeví, až zbudou jen pancéřované cihly)',
    'v.onSteel': 'Cihla položená na oceli na řádku {r}, sloupci {c} nikdy nepůjde rozbít',

    'ed.pageTitle': 'rk/noid – editor úrovní',
    'ed.title': 'Editor úrovní',
    'ed.backToGame': 'Zpět do hry',
    'ed.new': 'Nová',
    'ed.open': 'Otevřít…',
    'ed.bundled': 'Vestavěné úrovně…',
    'ed.bundledTip': 'Načíst vestavěnou úroveň',
    'ed.download': 'Stáhnout JSON',
    'ed.copy': 'Kopírovat JSON',
    'ed.undo': '↶ Zpět',
    'ed.redo': '↷ Znovu',
    'ed.test': '▶ Vyzkoušet',
    'ed.level': 'Úroveň',
    'ed.name': 'Název',
    'ed.nameCs': 'Název (česky)',
    'ed.author': 'Autor',
    'ed.description': 'Popis',
    'ed.descriptionCs': 'Popis (česky)',
    'ed.cols': 'Sloupce',
    'ed.rows': 'Řádky',
    'ed.settings': 'Nastavení',
    'ed.ballSpeed': 'Rychlost míčku',
    'ed.ballSpeedMax': 'Max. rychlost',
    'ed.bonusChance': 'Šance na bonus',
    'ed.critterSpeed': 'Rychlost potvůrek',
    'ed.depth': 'Hloubka hřiště',
    'ed.depthTip': '0 = automaticky',
    'ed.backGap': 'Mezera vzadu',
    'ed.floorColor': 'Barva podlahy',
    'ed.wallColor': 'Barva stěn',
    'ed.critterMode': 'Potvůrka se dotkne pálky',
    'ed.cm.gameover': 'Konec hry',
    'ed.cm.life': 'Ztráta života',
    'ed.check': 'Kontrola',
    'ed.rawJson': 'Surový JSON',
    'ed.applyJson': 'Použít JSON',
    'ed.stackMode': 'Režim stohů',
    'ed.stackModeTip': 'Klik přidá cihlu navrch stohu, pravý klik odebere horní cihlu',
    'ed.layerMode': 'Režim vrstev',
    'ed.layerModeTip': 'Úpravy po jednotlivých vodorovných vrstvách',
    'ed.addLayer': '+ vrstva',
    'ed.addLayerTip': 'Přidat vrstvu',
    'ed.delLayer': '− vrstva',
    'ed.delLayerTip': 'Odebrat aktuální vrstvu',
    'ed.paint': 'Kreslit',
    'ed.erase': 'Mazat',
    'ed.rect': 'Obdélník',
    'ed.rectTip': 'Vyplnit obdélník: táhni přes buňky',
    'ed.pick': 'Kapátko',
    'ed.pickTip': 'Vybírat lze i pomocí Alt+klik',
    'ed.mirror': 'Zrcadlit ⇆',
    'ed.mirrorTip': 'Zrcadlově zkopírovat levou polovinu doprava',
    'ed.clear': 'Vymazat',
    'ed.gridHint': 'Zadní stěna ↑ · strana hráče ↓ &nbsp;|&nbsp; Levý klik: kreslit · Pravý klik: mazat · Alt+klik: kapátko ·',
    'ed.brickType': 'Typ cihly',
    'ed.char': 'Znak',
    'ed.type': 'Typ',
    'ed.colour': 'Barva',
    'ed.hits': 'Zásahy',
    'ed.drop': 'Bonus',
    'ed.texture': 'Textura',
    'ed.releasesCritter': 'Vypustí potvůrku',
    'ed.newType': '+ Nový typ cihly',
    'ed.reset': 'Obnovit výchozí',
    'ed.deleteType': 'Smazat typ',
    'ed.previewHint': 'Tahem otáčej · kolečkem přibliž · <kbd>V</kbd> předvolba kamery',
    'ed.layerGround': 'V0 zem',
    'ed.layerN': 'V{n}',
    'ed.dropNone': 'žádný',
    'ed.dropRandom': 'náhodný bonus',
    'type.normal': 'obyčejná',
    'type.hard': 'tvrdá',
    'type.steel': 'ocelová (nezničitelná)',
    'type.armored': 'pancéřovaná (jen laser)',
    'type.explosive': 'výbušná',
    'abbr.hard': 'tvrdá',
    'abbr.steel': 'ocel',
    'abbr.armored': 'pancíř',
    'abbr.explosive': 'bum',
    'tex.default': '(podle typu)',
    'tex.brick': 'cihla',
    'tex.hard': 'tvrdá',
    'tex.bonus': 'bonus ?',
    'tex.critterBrick': 'oči potvůrky',
    'tex.explosive': 'výbušná',
    'tex.armored': 'pancéřovaná',
    'tex.steel': 'ocelová',
    'ed.desc.hits': '{n} zásah|{n} zásahy|{n} zásahů',
    'ed.desc.drops': 'pustí {drop}',
    'ed.desc.critter': 'vypustí potvůrku',
    'ed.desc.overridden': '(upraveno)',
    'ed.desc.custom': '(vlastní)',
    'ed.badChar': 'Zvol jeden znak kromě . _ mezery " \\',
    'ed.charUsed': '"{key}" už je použit',
    'ed.noFreeChars': 'Žádné volné znaky',
    'ed.resetDone': '"{key}" obnoven na výchozí',
    'ed.confirmDelete': '"{key}" je v úrovni použit. Smazat ho i s těmito cihlami?',
    'ed.confirmClear': 'Odstranit všechny cihly?',
    'ed.confirmNew': 'Začít novou prázdnou úroveň? (Tlačítkem Zpět se dá ta stará vrátit.)',
    'ed.cellInfo': 'řádek {r}, sloupec {c}, stoh {s}',
    'ed.stats': 'Cihly: {n} (k rozbití {req})<br>Bonusové cihly: {d} · Hnízda potvůrek: {c}<br>Nejvyšší stoh: {h} · Hloubka hřiště: {depth}',
    'ed.looksGood': 'Vypadá dobře',
    'ed.loaded': 'Načteno: {name}',
    'ed.copied': 'JSON zkopírován',
    'ed.noClipboard': 'Schránka není dostupná',
    'ed.fixFirst': 'Nejdřív oprav:',
    'ed.fetchFail': 'Nelze stáhnout {f}: {msg}',
  },
};

const STORAGE_KEY = 'rknoid.lang';
const listeners = new Set();

function detect() {
  try {
    const forced = new URLSearchParams(location.search).get('lang');
    if (forced && STRINGS[forced]) return forced;
  } catch { /* no location (tests) */ }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && STRINGS[saved]) return saved;
  } catch { /* storage blocked */ }
  const prefs = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
  return prefs.some((l) => /^(cs|sk)\b/i.test(l || '')) ? 'cs' : 'en';
}

export let lang = detect();

function fill(s, params) {
  return params ? s.replace(/\{(\w+)\}/g, (m, k) => (params[k] ?? m)) : s;
}

/** Translate a key; {name} placeholders are filled from params. */
export function t(key, params) {
  const s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return fill(s, params);
}

// Plural forms are separated by "|": en = one|other, cs = one|few (2-4)|many.
function pluralIndex(n) {
  if (lang === 'cs') return n === 1 ? 0 : n >= 2 && n <= 4 ? 1 : 2;
  return n === 1 ? 0 : 1;
}

/** Translate a key with plural forms, choosing the form for count n. */
export function tn(key, n, params = {}) {
  const forms = (STRINGS[lang][key] ?? STRINGS.en[key] ?? key).split('|');
  return fill(forms[Math.min(pluralIndex(n), forms.length - 1)], { n, ...params });
}

/** Level name/description in the current language (from the level's optional "i18n" block). */
export function localized(level, field) {
  return level?.i18n?.[lang]?.[field] || level?.[field] || '';
}

export function setLang(l) {
  if (!STRINGS[l] || l === lang) return;
  lang = l;
  try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  applyI18n();
  for (const fn of listeners) fn(l);
}

export function onLangChange(fn) {
  listeners.add(fn);
}

/** Fill every data-i18n* element under root with the current language. */
export function applyI18n(root = document) {
  document.documentElement.lang = lang;
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of root.querySelectorAll('.lang-switch button')) el.classList.toggle('on', el.dataset.lang === lang);
}

/** Render an EN | CZ segmented switch into every element matching selector. */
export function mountLangSwitch(selector = '.lang-switch') {
  for (const box of document.querySelectorAll(selector)) {
    box.innerHTML = '';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', t('lang.switch'));
    for (const [code, label] of Object.entries(LANGS)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.lang = code;
      b.textContent = label;
      b.className = code === lang ? 'on' : '';
      b.onclick = (e) => { e.stopPropagation(); setLang(code); };
      box.appendChild(b);
    }
  }
}
