from PIL import Image, ImageFilter
import numpy as np
import os

im = Image.open('assets/media/img/bob2.jpg').convert('RGB')
crop = im.crop((360, 0, 1010, 768)) # 650 x 768
w, h = crop.size
arr = np.array(crop, dtype=np.float32)
bg = np.array([250.0, 250.0, 250.0])
diff = np.linalg.norm(arr - bg, axis=2)

mask = (diff > 18).astype(np.float32)

# Helmet interior fill:
for y in range(30, 245):
    row_diff = diff[y, :]
    helmet_pts = np.where((row_diff > 25) & (np.arange(w) > 160) & (np.arange(w) < 460))[0]
    if len(helmet_pts) > 0:
        mask[y, helmet_pts[0]:helmet_pts[-1]+1] = 1.0

# Smooth mask:
mask_img = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=0.7))
smooth_mask = np.array(mask_img, dtype=np.float32) / 255.0

result = np.zeros((h, w, 4), dtype=np.uint8)
result[:, :, :3] = np.clip(arr, 0, 255).astype(np.uint8)
result[:, :, 3] = np.clip(smooth_mask * 255.0, 0, 255).astype(np.uint8)

res_img = Image.fromarray(result, 'RGBA')
# Resize for web (560 x 662):
res_resized = res_img.resize((560, 662), Image.Resampling.LANCZOS)
out_path = 'assets/media/img/optimized/bob2-intro.webp'
res_resized.save(out_path, 'WEBP', quality=85, method=6)

orig_size = os.path.getsize('assets/media/img/bob2.jpg')
webp_size = os.path.getsize(out_path)
print(f"Original bob2.jpg size: {orig_size:,} bytes")
print(f"Optimized bob2-intro.webp size: {webp_size:,} bytes")
print(f"Dimensions: {res_resized.size}")
print(f"Weight reduction: {((orig_size - webp_size) / orig_size) * 100:.1f}%")
