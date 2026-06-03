from pydantic import BaseModel
from typing import List
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str

    class Config:
        from_attributes = True

class ImageRecordResponse(BaseModel):
    id: int
    word: str
    image_base64: str
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
