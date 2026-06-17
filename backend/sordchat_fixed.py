from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional
import json
import os
import uuid

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
import uvicorn


SECRET_KEY = os.getenv("SECRET_KEY", "sordchat_secret_key_super_secure_2024")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development").lower() == "production"
DEFAULT_FRONTEND_ORIGINS = [
    "https://sordchat-web.onrender.com",
]


def normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url


DATABASE_URL = normalize_database_url(os.getenv("DATABASE_URL", "sqlite:///./sordchat.db"))
engine_options = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(80), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    access_level = Column(String(40), default="usuario", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    sent_messages = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender")
    received_messages = relationship("Message", foreign_keys="Message.receiver_id", back_populates="receiver")
    uploaded_files = relationship("FileUpload", back_populates="uploader")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    message_type = Column(String(40), default="text", nullable=False)
    file_path = Column(String(500), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)

    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_messages")


class FileUpload(Base):
    __tablename__ = "file_uploads"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    content_type = Column(String(120), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    upload_date = Column(DateTime, default=datetime.utcnow, nullable=False)

    uploader = relationship("User", back_populates="uploaded_files")


if DATABASE_URL.startswith("sqlite"):
    Base.metadata.create_all(bind=engine)


def get_cors_origins():
    configured = os.getenv("FRONTEND_ORIGINS", "")
    origins = list(DEFAULT_FRONTEND_ORIGINS)
    if configured:
        origins.extend(origin.strip() for origin in configured.split(",") if origin.strip())
    if not IS_PRODUCTION:
        origins.extend(["http://127.0.0.1:3000", "http://localhost:3000"])
    return sorted(set(origins))


app = FastAPI(title="SorDChat API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token invalido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalido")

    with SessionLocal() as db:
        user = db.query(User).filter(User.id == int(user_id)).first()
        if user is None:
            raise HTTPException(status_code=401, detail="Usuario nao encontrado")
        db.expunge(user)
        return user


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.user_connections: Dict[int, int] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        connection_id = id(websocket)
        self.active_connections[connection_id] = websocket
        self.user_connections[user_id] = connection_id
        await self.broadcast_user_status(user_id, True)
        await self.send_online_users(websocket)

    def disconnect(self, user_id: int):
        connection_id = self.user_connections.pop(user_id, None)
        if connection_id:
            self.active_connections.pop(connection_id, None)

    async def send_personal_message(self, message: str, user_id: int):
        connection_id = self.user_connections.get(user_id)
        websocket = self.active_connections.get(connection_id)
        if websocket:
            try:
                await websocket.send_text(message)
            except Exception:
                self.disconnect(user_id)

    async def broadcast(self, message: str, exclude_user: Optional[int] = None):
        disconnected = []
        for user_id, connection_id in list(self.user_connections.items()):
            if exclude_user and user_id == exclude_user:
                continue
            websocket = self.active_connections.get(connection_id)
            if websocket:
                try:
                    await websocket.send_text(message)
                except Exception:
                    disconnected.append(user_id)

        for user_id in disconnected:
            self.disconnect(user_id)

    async def broadcast_user_status(self, user_id: int, is_online: bool):
        with SessionLocal() as db:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return
            message = {
                "type": "user_status",
                "user_id": user_id,
                "username": user.username,
                "full_name": user.full_name,
                "is_online": is_online,
            }
        await self.broadcast(json.dumps(message), exclude_user=user_id)

    async def send_online_users(self, websocket: WebSocket):
        online_users = []
        with SessionLocal() as db:
            for user_id in self.user_connections.keys():
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    online_users.append({"id": user.id, "username": user.username, "full_name": user.full_name})

        await websocket.send_text(json.dumps({"type": "online_users", "users": online_users}))


manager = ConnectionManager()


def create_default_users():
    default_users = [
        {"username": "admin", "email": "admin@sordchat.com", "full_name": "Administrador Master", "password": "admin123", "access_level": "master"},
        {"username": "coordenador", "email": "coord@sordchat.com", "full_name": "Coordenador Sistema", "password": "coord123", "access_level": "coordenador"},
        {"username": "usuario", "email": "user@sordchat.com", "full_name": "Usuario Padrao", "password": "user123", "access_level": "usuario"},
    ]

    with SessionLocal() as db:
        if db.query(User).count() > 0:
            return
        for user_data in default_users:
            db.add(
                User(
                    username=user_data["username"],
                    email=user_data["email"],
                    full_name=user_data["full_name"],
                    hashed_password=get_password_hash(user_data["password"]),
                    access_level=user_data["access_level"],
                )
            )
        db.commit()


def split_sql_statements(sql: str) -> list[str]:
    statements = []
    current = []
    in_single_quote = False
    in_double_quote = False

    for char in sql:
        if char == "'" and not in_double_quote:
            in_single_quote = not in_single_quote
        elif char == '"' and not in_single_quote:
            in_double_quote = not in_double_quote

        if char == ";" and not in_single_quote and not in_double_quote:
            statement = "".join(current).strip()
            if statement:
                statements.append(statement)
            current = []
            continue

        current.append(char)

    statement = "".join(current).strip()
    if statement:
        statements.append(statement)
    return statements


def run_startup_migrations():
    if DATABASE_URL.startswith("sqlite"):
        return
    if os.getenv("AUTO_MIGRATE_DB", "true").lower() != "true":
        return

    migrations_dir = Path(__file__).resolve().parent / "db" / "migrations"
    if not migrations_dir.exists():
        return

    with engine.begin() as conn:
        conn.exec_driver_sql(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
              version TEXT PRIMARY KEY,
              applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )

        for migration in sorted(migrations_dir.glob("*.sql")):
            sql = migration.read_text(encoding="utf-8")
            for statement in split_sql_statements(sql):
                conn.exec_driver_sql(statement)
            conn.exec_driver_sql(
                "INSERT INTO schema_migrations (version) VALUES (%s) ON CONFLICT (version) DO NOTHING",
                (migration.stem,),
            )


@app.on_event("startup")
async def startup_event():
    run_startup_migrations()
    if DATABASE_URL.startswith("sqlite") or os.getenv("AUTO_SEED_USERS", "false").lower() == "true":
        create_default_users()


@app.get("/")
async def root():
    return {"message": "SorDChat API", "version": "1.0.0", "status": "online"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "database": "postgres" if "postgresql" in DATABASE_URL else "sqlite"}


@app.post("/auth/login")
async def login(credentials: dict):
    username = credentials.get("username")
    password = credentials.get("password")

    if not username or not password:
        raise HTTPException(status_code=400, detail="Username e password sao obrigatorios")

    with SessionLocal() as db:
        user = db.query(User).filter(User.username == username).first()
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Credenciais invalidas")
        if not user.is_active:
            raise HTTPException(status_code=401, detail="Usuario inativo")

        access_token = create_access_token(
            data={"sub": str(user.id)},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "access_level": user.access_level,
            },
        }


@app.post("/auth/logout")
async def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Logout realizado com sucesso"}


@app.get("/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "access_level": current_user.access_level,
    }


@app.websocket("/messages/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    user_data = None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=1008)
            return

        with SessionLocal() as db:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if not user:
                await websocket.close(code=1008)
                return
            user_data = {"id": user.id, "username": user.username, "full_name": user.full_name}

        await manager.connect(websocket, user_data["id"])
        await websocket.send_text(json.dumps({"type": "connection", "message": f"Conectado como {user_data['full_name']}!"}))

        with SessionLocal() as db:
            recent_messages = db.query(Message).order_by(Message.timestamp.desc()).limit(50).all()
            messages_data = []
            for msg in reversed(recent_messages):
                sender = db.query(User).filter(User.id == msg.sender_id).first()
                messages_data.append(
                    {
                        "id": msg.id,
                        "content": msg.content,
                        "sender_id": msg.sender_id,
                        "sender_name": sender.full_name if sender else "Usuario",
                        "receiver_id": msg.receiver_id,
                        "message_type": msg.message_type,
                        "timestamp": msg.timestamp.isoformat(),
                        "file_path": msg.file_path,
                    }
                )
        await websocket.send_text(json.dumps({"type": "message_history", "messages": messages_data}))

        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)

            if message_data["type"] == "chat_message":
                with SessionLocal() as db:
                    new_message = Message(
                        content=message_data["content"],
                        sender_id=user_data["id"],
                        receiver_id=message_data.get("receiver_id"),
                        message_type=message_data.get("message_type", "text"),
                        file_path=message_data.get("file_path"),
                    )
                    db.add(new_message)
                    db.commit()
                    db.refresh(new_message)
                    broadcast_message = {
                        "type": "new_message",
                        "message": {
                            "id": new_message.id,
                            "content": new_message.content,
                            "sender_id": user_data["id"],
                            "sender_name": user_data["full_name"],
                            "receiver_id": new_message.receiver_id,
                            "message_type": new_message.message_type,
                            "timestamp": new_message.timestamp.isoformat(),
                            "file_path": new_message.file_path,
                        },
                    }

                if broadcast_message["message"]["receiver_id"]:
                    await manager.send_personal_message(json.dumps(broadcast_message), broadcast_message["message"]["receiver_id"])
                    await manager.send_personal_message(json.dumps(broadcast_message), user_data["id"])
                else:
                    await manager.broadcast(json.dumps(broadcast_message))

            elif message_data["type"] == "typing":
                typing_message = {
                    "type": "typing",
                    "user_id": user_data["id"],
                    "username": user_data["username"],
                    "is_typing": message_data["is_typing"],
                }
                if message_data.get("receiver_id"):
                    await manager.send_personal_message(json.dumps(typing_message), message_data["receiver_id"])
                else:
                    await manager.broadcast(json.dumps(typing_message), exclude_user=user_data["id"])

            elif message_data["type"] == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        print(f"Erro na conexao WebSocket: {exc}")
    finally:
        if user_data:
            manager.disconnect(user_data["id"])
            await manager.broadcast_user_status(user_data["id"], False)


@app.post("/files/upload")
async def upload_file(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    allowed_types = {"image/jpeg", "image/png", "image/gif", "application/pdf", "text/plain"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Tipo de arquivo nao permitido")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Arquivo muito grande")

    upload_dir = Path(os.getenv("UPLOAD_DIR", "uploads"))
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_extension = Path(file.filename or "").suffix
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = upload_dir / unique_filename
    file_path.write_bytes(content)

    with SessionLocal() as db:
        file_record = FileUpload(
            filename=file.filename or unique_filename,
            file_path=str(file_path),
            file_size=len(content),
            content_type=file.content_type or "application/octet-stream",
            uploaded_by=current_user.id,
        )
        db.add(file_record)
        db.commit()
        db.refresh(file_record)
        return {
            "id": file_record.id,
            "filename": file_record.filename,
            "file_path": file_record.file_path,
            "file_size": file_record.file_size,
            "content_type": file_record.content_type,
        }


@app.get("/files/download/{file_id}")
async def download_file(file_id: int, current_user: User = Depends(get_current_user)):
    with SessionLocal() as db:
        file_record = db.query(FileUpload).filter(FileUpload.id == file_id).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="Arquivo nao encontrado")
        file_path = file_record.file_path
        filename = file_record.filename
        content_type = file_record.content_type

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Arquivo nao existe")

    return FileResponse(path=file_path, filename=filename, media_type=content_type)


if __name__ == "__main__":
    create_default_users()
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8001")))
