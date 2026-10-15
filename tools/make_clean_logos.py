import numpy as np
from PIL import Image

orig = Image.open('assets/media/img/BopAgencia.png').convert('RGB')
w, h = orig.size
arr = np.array(orig, dtype=np.float32)

r = arr[:, :, 0]
g = arr[:, :, 1]
b = arr[:, :, 2]
min_rgb = np.minimum(r, np.minimum(g, b))
max_rgb = np.maximum(r, np.maximum(g, b))
sat = max_rgb - min_rgb

y_grid, x_grid = np.mgrid[0:h, 0:w]

# Emblem region (y < 820):
emblem_mask = np.zeros((h, w), dtype=np.float32)
is_sphere = (sat > 15) & (r > 120) & (y_grid < 820)
emblem_mask[is_sphere] = 255.0

is_connector = (max_rgb < 190) & (sat < 30) & (y_grid < 820)
emblem_mask[is_connector] = 255.0

edge_emblem = (~is_sphere) & (~is_connector) & (min_rgb < 252) & (y_grid < 820)
emblem_mask[edge_emblem] = np.clip((255.0 - min_rgb[edge_emblem]) * 8.0, 0, 255.0)

# Text region (y >= 820):
text_mask = np.zeros((h, w), dtype=np.float32)
is_text_region = (y_grid >= 820)
text_mask[is_text_region] = np.clip((255.0 - min_rgb[is_text_region]) * 2.2, 0, 255.0)

final_alpha = np.where(is_text_region, text_mask, emblem_mask)

# Build Light image:
light_arr = np.zeros((h, w, 4), dtype=np.uint8)
light_arr[:820, :, :3] = np.array(orig)[:820, :, :]
light_arr[820:, :, 0] = 30
light_arr[820:, :, 1] = 41
light_arr[820:, :, 2] = 59
light_arr[:, :, 3] = np.clip(final_alpha, 0, 255).astype(np.uint8)

# Build Dark image:
dark_arr = np.zeros((h, w, 4), dtype=np.uint8)
dark_arr[:820, :, :3] = np.array(orig)[:820, :, :]
dark_arr[820:, :, 0] = 255
dark_arr[820:, :, 1] = 255
dark_arr[820:, :, 2] = 255
dark_arr[:, :, 3] = np.clip(final_alpha, 0, 255).astype(np.uint8)

light_img = Image.fromarray(light_arr, 'RGBA').resize((400, 400), Image.Resampling.LANCZOS)
dark_img = Image.fromarray(dark_arr, 'RGBA').resize((400, 400), Image.Resampling.LANCZOS)

light_img.save('assets/media/img/optimized/bopagencia.webp', 'WEBP', quality=95)
dark_img.save('assets/media/img/optimized/bopagencia-dark.webp', 'WEBP', quality=95)

# Verification composites:
bg_dark = Image.new('RGBA', (400, 400), (9, 10, 15, 255))
comp_dark = Image.alpha_composite(bg_dark, dark_img)
comp_dark.save('scratch_dark_clean.png')

bg_light = Image.new('RGBA', (400, 400), (255, 255, 255, 255))
comp_light = Image.alpha_composite(bg_light, light_img)
comp_light.save('scratch_light_clean.png')
print('Finished clean generation!')
