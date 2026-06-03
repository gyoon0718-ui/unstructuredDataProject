from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)

    images = relationship("ImageRecord", back_populates="owner")

class ImageRecord(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    word = Column(String, index=True)
    image_base64 = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="images")
