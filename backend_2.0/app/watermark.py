from PIL import Image, ImageDraw, ImageFont

def apply_watermark(input_path: str, output_path: str, text: str, *, font_size: int = 24):
    im = Image.open(input_path).convert("RGB")
    W, H = im.size
    overlay = Image.new("RGBA", (W, H), (0,0,0,0))
    draw = ImageDraw.Draw(overlay)
    band_h = max(40, int(H * 0.06))
    band_y = H - band_h
    draw.rectangle([(0, band_y), (W, H)], fill=(0, 0, 0, 110))
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", font_size)
    except Exception:
        font = ImageFont.load_default()
    margin = 10
    draw.text((margin, band_y + (band_h - font_size)//2), text, fill=(255,255,255,230), font=font)
    out = Image.alpha_composite(im.convert("RGBA"), overlay)
    out.convert("RGB").save(output_path, format="JPEG", quality=90)
