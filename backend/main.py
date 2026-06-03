import sys
import os
import io
import base64
import torch
import torchvision
import cv2
import numpy as np
from PIL import Image
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

import db_models, schemas, auth
from database import engine, SessionLocal

db_models.Base.metadata.create_all(bind=engine)

ONEDM_PATH = r"c:\unstructureddata\One_DM"
if ONEDM_PATH not in sys.path:
    sys.path.append(ONEDM_PATH)

from parse_config import cfg, cfg_from_file, assert_and_infer_cfg
from models.unet import UNetModel
from diffusers import AutoencoderKL
from models.diffusion import Diffusion
from test_korean import KoreanContentData

app = FastAPI(title="OneDM Generation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# Global variables
unet = None
vae = None
diffusion = None
load_content = None
current_checkpoint_path = None

def get_latest_checkpoint(saved_dir):
    env_path = os.environ.get('ONEDM_CHECKPOINT_PATH')
    if env_path and os.path.exists(env_path):
        return env_path
        
    korean64_dir = os.path.join(saved_dir, 'Korean64')
    if not os.path.exists(korean64_dir):
        return None
        
    log_dirs = [os.path.join(korean64_dir, d) for d in os.listdir(korean64_dir) if os.path.isdir(os.path.join(korean64_dir, d))]
    if not log_dirs:
        return None
        
    log_dirs.sort(key=lambda x: os.path.getmtime(x), reverse=True)
    
    for log_dir in log_dirs:
        model_dir = os.path.join(log_dir, 'model')
        if not os.path.exists(model_dir):
            continue
            
        ckpts = [f for f in os.listdir(model_dir) if f.endswith('-ckpt.pt')]
        if not ckpts:
            continue
            
        def get_epoch(filename):
            try:
                return int(filename.split('-')[0])
            except ValueError:
                return -1
                
        best_ckpt = max(ckpts, key=get_epoch)
        return os.path.join(model_dir, best_ckpt)
        
    return None

@app.on_event("startup")
async def startup_event():
    global unet, vae, diffusion, load_content, current_checkpoint_path
    print("Loading OneDM models...")
    
    cfg_file = os.path.join(ONEDM_PATH, 'configs', 'Korean64.yml')
    cwd = os.getcwd()
    os.chdir(ONEDM_PATH)
    
    try:
        cfg_from_file(cfg_file)
        assert_and_infer_cfg()
        
        load_content = KoreanContentData(os.path.join(ONEDM_PATH, 'data', 'korean_unifont.pickle'))
        diffusion = Diffusion(device=device)
        
        unet = UNetModel(
            in_channels=cfg.MODEL.IN_CHANNELS, model_channels=cfg.MODEL.EMB_DIM,
            out_channels=cfg.MODEL.OUT_CHANNELS, num_res_blocks=cfg.MODEL.NUM_RES_BLOCKS,
            attention_resolutions=(1, 1), channel_mult=(1, 1),
            num_heads=cfg.MODEL.NUM_HEADS, context_dim=cfg.MODEL.EMB_DIM
        ).to(device)
        
        saved_dir = os.path.join(ONEDM_PATH, 'Saved')
        checkpoint_path = get_latest_checkpoint(saved_dir)
        
        if checkpoint_path and os.path.exists(checkpoint_path):
            ckpt = torch.load(checkpoint_path, map_location='cpu')
            if isinstance(ckpt, dict) and 'model_state_dict' in ckpt:
                unet.load_state_dict(ckpt['model_state_dict'])
            else:
                unet.load_state_dict(ckpt)
            current_checkpoint_path = checkpoint_path
            print(f"Loaded checkpoint: {checkpoint_path}")
        else:
            print("WARNING: No checkpoint found!")
            
        unet.eval()
        
        vae = AutoencoderKL.from_pretrained('runwayml/stable-diffusion-v1-5', subfolder='vae').to(device)
        vae.requires_grad_(False)
        print("Models loaded successfully.")
    finally:
        os.chdir(cwd)

@app.post("/api/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(auth.get_db)):
    db_user = db.query(db_models.User).filter(db_models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = auth.get_password_hash(user.password)
    new_user = db_models.User(username=user.username, password_hash=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(auth.get_db)):
    user = db.query(db_models.User).filter(db_models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/gallery", response_model=list[schemas.ImageRecordResponse])
def get_gallery(current_user: db_models.User = Depends(auth.get_current_user), db: Session = Depends(auth.get_db)):
    images = db.query(db_models.ImageRecord).filter(db_models.ImageRecord.user_id == current_user.id).order_by(db_models.ImageRecord.created_at.desc()).all()
    return images

@app.post("/api/generate")
async def generate_image(
    word: str = Form(...), 
    style_image: UploadFile = File(...),
    current_user: db_models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    global unet, vae, diffusion, load_content, current_checkpoint_path
    
    # Check if a new checkpoint is available and reload if necessary
    saved_dir = os.path.join(ONEDM_PATH, 'Saved')
    latest_ckpt = get_latest_checkpoint(saved_dir)
    if latest_ckpt and latest_ckpt != current_checkpoint_path:
        print(f"New checkpoint detected: {latest_ckpt}. Reloading model weights...")
        ckpt = torch.load(latest_ckpt, map_location='cpu')
        if isinstance(ckpt, dict) and 'model_state_dict' in ckpt:
            unet.load_state_dict(ckpt['model_state_dict'])
        else:
            unet.load_state_dict(ckpt)
        current_checkpoint_path = latest_ckpt
        print("Model reloaded successfully.")
        
    image_bytes = await style_image.read()
    
    img_array = np.frombuffer(image_bytes, np.uint8)
    img_gray = cv2.imdecode(img_array, cv2.IMREAD_GRAYSCALE)
    
    if img_gray is None:
        return JSONResponse(status_code=400, content={"message": "Invalid image format"})
        
    # Auto-Crop: 문단(여러 줄) 이미지가 들어오면 높이가 64px로 압축되어 획을 인식할 수 없게 됩니다.
    # 따라서 첫 번째 줄의 텍스트만 자동으로 크롭하여 디테일을 살립니다.
    _, img_bw = cv2.threshold(img_gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    row_sums = np.sum(img_bw, axis=1)
    text_rows = np.where(row_sums > 255 * 3)[0]
    
    if len(text_rows) > 0:
        start_y = text_rows[0]
        end_y = text_rows[0]
        gap_threshold = max(15, img_gray.shape[0] * 0.015)
        for y in text_rows:
            if y - end_y > gap_threshold:
                break
            end_y = y
            
        if end_y - start_y > 10:
            pad_y = int((end_y - start_y) * 0.3)
            start_y = max(0, start_y - pad_y)
            end_y = min(img_gray.shape[0], end_y + pad_y)
            
            img_gray_cropped = img_gray[start_y:end_y, :]
            img_bw_cropped = img_bw[start_y:end_y, :]
            
            col_sums = np.sum(img_bw_cropped, axis=0)
            text_cols = np.where(col_sums > 255)[0]
            if len(text_cols) > 0:
                start_x = text_cols[0]
                end_x = text_cols[-1]
                pad_x = int((end_y - start_y) * 0.3)
                start_x = max(0, start_x - pad_x)
                end_x = min(img_gray.shape[1], end_x + pad_x)
                img_gray = img_gray_cropped[:, start_x:end_x]
            else:
                img_gray = img_gray_cropped

    # Add Binarization to clean up user's phone photos (remove shadow/background)
    _, img_gray = cv2.threshold(img_gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
    img_laplace = cv2.Laplacian(img_gray, cv2.CV_8U, ksize=3)
    
    h, w = img_gray.shape
    new_h = 64
    new_w = int(w * (new_h / h))
    new_w = ((new_w + 63) // 64) * 64
    if new_w == 0: new_w = 64
    
    img_gray = cv2.resize(img_gray, (new_w, new_h))
    img_laplace = cv2.resize(img_laplace, (new_w, new_h))
    
    s_arr = np.zeros([2, new_h, new_w], dtype=np.float32)
    l_arr = np.zeros([2, new_h, new_w], dtype=np.float32)
    
    s_arr[0, :, :] = img_gray / 255.0
    s_arr[1, :, :] = img_gray / 255.0
    l_arr[0, :, :] = img_laplace / 255.0
    l_arr[1, :, :] = img_laplace / 255.0
    
    style_input = torch.from_numpy(s_arr).unsqueeze(0).to(device) # [1, 2, H, W]
    laplace_input = torch.from_numpy(l_arr).unsqueeze(0).to(device) # [1, 2, H, W]
    
    lines = [line.strip() for line in word.split('\n') if line.strip()]
    if not lines:
        return JSONResponse(status_code=400, content={"message": "No valid text provided"})
        
    line_images = []
    MAX_WIDTH = 800
    space_width = 24
    with torch.no_grad():
        for line in lines:
            words_in_line = [w for w in line.split(' ') if w]
            current_line_words = []
            current_line_width = 0
            
            for w in words_in_line:
                text_ref = load_content.get_content(w).to(device) # [1, L]
                x = torch.randn((1, 4, new_h // 8, (len(w) * 64) // 8)).to(device)
                images = diffusion.ddim_sample(unet, vae, 1, x, style_input, laplace_input, text_ref, 50, 0.0)
                img_tensor = images[0]
                out_img = torchvision.transforms.ToPILImage()(img_tensor).convert('L')
                
                # 여백(배경) 자르기: 단어 사이의 불규칙한 간격 및 테두리 제거
                img_arr_tmp = np.array(out_img)
                dark_pixels = np.where(img_arr_tmp < 225)
                if len(dark_pixels[1]) > 0:
                    min_x = int(np.min(dark_pixels[1]))
                    max_x = int(np.max(dark_pixels[1]))
                    min_x = max(0, min_x - 8)
                    max_x = min(out_img.width, max_x + 8)
                    out_img = out_img.crop((min_x, 0, max_x, out_img.height))
                
                word_width = out_img.width
                if current_line_words and current_line_width + space_width + word_width > MAX_WIDTH:
                    line_img = Image.new('L', (current_line_width, new_h), color=255)
                    x_off = 0
                    for im in current_line_words:
                        line_img.paste(im, (x_off, 0))
                        x_off += im.width + space_width
                    line_images.append(line_img)
                    
                    current_line_words = [out_img]
                    current_line_width = word_width
                else:
                    current_line_words.append(out_img)
                    if current_line_width == 0:
                        current_line_width = word_width
                    else:
                        current_line_width += space_width + word_width
                        
            if current_line_words:
                line_img = Image.new('L', (current_line_width, new_h), color=255)
                x_off = 0
                for im in current_line_words:
                    line_img.paste(im, (x_off, 0))
                    x_off += im.width + space_width
                line_images.append(line_img)
            
    # Combine line images vertically
    line_spacing = 15
    total_width = max(im.width for im in line_images)
    total_height = sum(im.height for im in line_images) + line_spacing * (len(line_images) - 1)
    
    combined_img = Image.new('L', (total_width, total_height), color=255)
    y_offset = 0
    for im in line_images:
        x_offset = (total_width - im.width) // 2
        combined_img.paste(im, (x_offset, y_offset))
        y_offset += im.height + line_spacing
    
    # Convert grayscale to RGBA with transparent background
    gray_arr = np.array(combined_img, dtype=np.float32)
    
    # Soft threshold: remove background noise while preserving anti-aliased edges
    # Pixels lighter than 215 are treated as pure background (fully transparent)
    # Pixels darker than 50 are treated as pure ink (fully opaque)
    # Values in between get smooth alpha transition for natural anti-aliasing
    alpha = np.clip((255.0 - gray_arr - 40.0) * (255.0 / 165.0), 0, 255).astype(np.uint8)
    
    # Create RGBA image: black ink on transparent background
    rgba_img = Image.new('RGBA', combined_img.size, (0, 0, 0, 0))
    rgba_arr = np.array(rgba_img)
    rgba_arr[:, :, 0] = 0    # R = black
    rgba_arr[:, :, 1] = 0    # G = black
    rgba_arr[:, :, 2] = 0    # B = black
    rgba_arr[:, :, 3] = alpha # A = ink opacity
    rgba_img = Image.fromarray(rgba_arr, 'RGBA')
    
    buffered = io.BytesIO()
    rgba_img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    
    db_image = db_models.ImageRecord(
        word=word,
        image_base64=img_str,
        user_id=current_user.id
    )
    db.add(db_image)
    db.commit()
    
    return {"image_base64": img_str, "word": word}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
