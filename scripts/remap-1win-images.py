from PIL import Image
from pathlib import Path

SRC = Path("/tmp/1win-v3")
CARD_DIR = Path("/workspace/assets-src/images/games")
PHOTO_DIR = Path("/workspace/assets-src/images")
CARD_DIR.mkdir(parents=True, exist_ok=True)


def make_card(src: Path, dest: Path, size=(640, 400)) -> None:
    im = Image.open(src).convert("RGB")
    tw, th = size
    w, h = im.size
    scale = max(tw / w, th / h)
    im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    w, h = im.size
    im = im.crop(((w - tw) // 2, (h - th) // 2, (w - tw) // 2 + tw, (h - th) // 2 + th))
    im.save(dest, "PNG", optimize=True)
    print("CARD", dest.name, "<-", src.name)


def make_photo(src: Path, dest: Path, max_w: int = 1200) -> None:
    im = Image.open(src).convert("RGB")
    w, h = im.size
    if w > max_w:
        im = im.resize((max_w, int(h * max_w / w)), Image.Resampling.LANCZOS)
    im.save(dest, "PNG", optimize=True)
    print("PHOTO", dest.name, "<-", src.name)


cards = {
    "aviator": "aviator-cover.webp",
    "lucky-jet": "01-lucky-jet.webp",
    "mines": "mines-cover.webp",
    "plinko": "plinko-cover.webp",
    "balloon": "balloon-cover.webp",
    "penalty": "penalty-ss.png",
    "jetx": "jet-tile.png",
    "poker": "ui-poker.webp",
    "roulette": "1win-game-1.webp",
    "blackjack": "ui-bj-live.webp",
    "slots": "slots-2.webp",
    "football": "ui-football.webp",
}

for name, src in cards.items():
    path = SRC / src
    assert path.exists(), path
    make_card(path, CARD_DIR / f"{name}.png")

photos = {
    "hero-1win-home.png": "ui-casino.webp",
    "hero-1win-casino.png": "ui-casino2.webp",
    "hero-1win-app.png": "ui-app.webp",
    "hero-1win-login.png": "ui-register.webp",
    "img-bonus-code.png": "ui-bonus.webp",
    "img-aviator.png": "ui-aviator.webp",
    "img-argentina.png": "ui-games.webp",
    "img-legal.png": "ui-legal.webp",
    "img-rg.png": "ui-specs.webp",
    "img-about.png": "ui-about.webp",
    "img-privacy.png": "ui-payments.webp",
    "img-terms.png": "ui-start.webp",
    "art-home-payments.png": "ui-deposit.webp",
    "art-home-sports.png": "ui-sports.webp",
    "art-home-support.png": "ui-support.webp",
    "art-casino-live.png": "ui-live.webp",
    "art-casino-slots.png": "ui-slots.webp",
    "art-casino-table.png": "ui-live2.webp",
    "art-app-android.png": "ui-mobile.webp",
    "art-app-ios.png": "ui-screen2.webp",
    "art-app-security.png": "ui-screen1.webp",
    "art-login-reset.png": "ui-screen3.webp",
    "art-login-2fa.png": "ui-screen4.webp",
    "art-login-devices.png": "ui-screen5.webp",
    "art-bonus-wager.png": "ui-bet.webp",
    "art-bonus-welcome.png": "ui-lucky.webp",
    "art-bonus-cashback.png": "ui-withdraw.webp",
    "art-aviator-cashout.png": "aviator-ss.png",
    "art-aviator-demo.png": "aviator-play.webp",
    "art-aviator-stats.png": "luckyjet-ss.png",
    "art-ar-payments.png": "ui-plinko.webp",
    "art-ar-football.png": "ui-football.webp",
    "art-ar-mobile.png": "ui-jetx.webp",
    "art-legal-licence.png": "ui-poker2.webp",
    "art-legal-tax.png": "ui-penalty.webp",
    "art-legal-kyc.png": "ui-mines.webp",
}

vals = list(photos.values())
assert len(vals) == len(set(vals)), "duplicate photo sources"

for dest, src in photos.items():
    path = SRC / src
    assert path.exists(), path
    make_photo(path, PHOTO_DIR / dest)

print("ALL_OK")
