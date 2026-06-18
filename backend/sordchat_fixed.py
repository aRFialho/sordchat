from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional
import json
import os
import uuid

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, Integer, LargeBinary, String, Text, create_engine, or_
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
import uvicorn


SECRET_KEY = os.getenv("SECRET_KEY", "sordchat_secret_key_super_secure_2024")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development").lower() == "production"
APP_VERSION = os.getenv("APP_VERSION") or os.getenv("RENDER_GIT_COMMIT") or "local"
APP_BUILD_TIME = os.getenv("APP_BUILD_TIME")
DEFAULT_FRONTEND_ORIGINS = [
    "https://sordchat-web.onrender.com",
]
DEFAULT_DEPARTMENTS = ["TI", "Suporte", "Comercial", "Financeiro", "Operacao", "Produto"]
USER_LEVELS = {"usuario", "coordenador", "master", "padrao"}
COORDINATOR_LEVELS = {"coordenador", "master"}
ALLOWED_UPLOAD_EXTENSIONS = {
    ".csv",
    ".doc",
    ".docx",
    ".gif",
    ".jpeg",
    ".jpg",
    ".pdf",
    ".png",
    ".txt",
    ".webp",
    ".xls",
    ".xlsx",
    ".zip",
}


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
    department = Column(String(100), nullable=True)
    phone_extension = Column(String(40), nullable=True)
    birthday = Column(String(10), nullable=True)
    role_title = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, nullable=True)

    sent_messages = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender")
    received_messages = relationship("Message", foreign_keys="Message.receiver_id", back_populates="receiver")
    uploaded_files = relationship("FileUpload", back_populates="uploader")


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=False)
    priority = Column(String(40), default="Media", nullable=False)
    status = Column(String(40), default="Aberto", nullable=False)
    department = Column(String(100), nullable=True, index=True)
    channel = Column(String(80), default="Web", nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    attachment_file_id = Column(Integer, ForeignKey("file_uploads.id"), nullable=True)
    rating_score = Column(Integer, nullable=True)
    rating_comment = Column(Text, nullable=True)
    rated_at = Column(DateTime, nullable=True)
    first_response_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)


class ChatGroup(Base):
    __tablename__ = "chat_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, index=True)
    description = Column(Text, nullable=True)
    department = Column(String(100), nullable=True, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class TaskItem(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    priority = Column(String(40), default="medium", nullable=False)
    category = Column(String(100), default="Operacao", nullable=False)
    status = Column(String(40), default="backlog", nullable=False, index=True)
    due_date = Column(String(10), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, nullable=True)


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


class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, default="", nullable=False)
    file_id = Column(Integer, ForeignKey("file_uploads.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class FileUpload(Base):
    __tablename__ = "file_uploads"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    content_type = Column(String(120), nullable=False)
    binary_data = Column(LargeBinary, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    upload_date = Column(DateTime, default=datetime.utcnow, nullable=False)

    uploader = relationship("User", back_populates="uploaded_files")


class DesktopRelease(Base):
    __tablename__ = "desktop_releases"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(80), nullable=False, index=True)
    platform = Column(String(40), default="windows", nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(120), default="application/octet-stream", nullable=False)
    file_size = Column(BigInteger, nullable=False)
    sha256 = Column(String(64), nullable=False)
    binary_data = Column(LargeBinary, nullable=True)
    storage_mode = Column(String(40), default="inline", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class DesktopReleaseChunk(Base):
    __tablename__ = "desktop_release_chunks"

    release_id = Column(Integer, ForeignKey("desktop_releases.id", ondelete="CASCADE"), primary_key=True)
    chunk_index = Column(Integer, primary_key=True)
    data = Column(LargeBinary, nullable=False)


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


def normalize_access_level(access_level: Optional[str]) -> str:
    value = (access_level or "usuario").strip().lower()
    if value == "padrao":
        return "usuario"
    return value if value in USER_LEVELS else "usuario"


def is_admin(user: User) -> bool:
    return normalize_access_level(user.access_level) == "master"


def is_coordinator(user: User) -> bool:
    return normalize_access_level(user.access_level) in COORDINATOR_LEVELS


def ensure_admin(user: User):
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador.")


def ensure_coordinator(user: User):
    if not is_coordinator(user):
        raise HTTPException(status_code=403, detail="Acesso restrito a coordenadores.")


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "access_level": normalize_access_level(user.access_level),
        "department": user.department,
        "phone_extension": user.phone_extension,
        "birthday": user.birthday,
        "role_title": user.role_title,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


def serialize_ticket(ticket: Ticket, db) -> dict:
    created_by = db.query(User).filter(User.id == ticket.created_by_id).first()
    assigned_to = db.query(User).filter(User.id == ticket.assigned_to_id).first() if ticket.assigned_to_id else None
    attachment = db.query(FileUpload).filter(FileUpload.id == ticket.attachment_file_id).first() if ticket.attachment_file_id else None
    first_response_minutes = None
    if ticket.created_at and ticket.first_response_at:
        first_response_minutes = max(0, int((ticket.first_response_at - ticket.created_at).total_seconds() // 60))

    return {
        "id": ticket.id,
        "title": ticket.title,
        "description": ticket.description,
        "priority": ticket.priority,
        "status": ticket.status,
        "department": ticket.department,
        "channel": ticket.channel,
        "created_by_id": ticket.created_by_id,
        "created_by_name": created_by.full_name if created_by else None,
        "assigned_to_id": ticket.assigned_to_id,
        "assigned_to_name": assigned_to.full_name if assigned_to else None,
        "attachment_file_id": ticket.attachment_file_id,
        "attachment_filename": attachment.filename if attachment else None,
        "attachment_content_type": attachment.content_type if attachment else None,
        "attachment_file_size": attachment.file_size if attachment else None,
        "rating_score": ticket.rating_score,
        "rating_comment": ticket.rating_comment,
        "rated_at": ticket.rated_at.isoformat() if ticket.rated_at else None,
        "first_response_at": ticket.first_response_at.isoformat() if ticket.first_response_at else None,
        "first_response_minutes": first_response_minutes,
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
        "closed_at": ticket.closed_at.isoformat() if ticket.closed_at else None,
    }


def serialize_ticket_message(message: TicketMessage, db) -> dict:
    sender = db.query(User).filter(User.id == message.sender_id).first()
    attachment = db.query(FileUpload).filter(FileUpload.id == message.file_id).first() if message.file_id else None
    return {
        "id": message.id,
        "ticket_id": message.ticket_id,
        "sender_id": message.sender_id,
        "sender_name": sender.full_name if sender else "Usuario",
        "content": message.content,
        "file_id": message.file_id,
        "attachment_filename": attachment.filename if attachment else None,
        "attachment_content_type": attachment.content_type if attachment else None,
        "attachment_file_size": attachment.file_size if attachment else None,
        "created_at": message.created_at.isoformat() if message.created_at else None,
    }


def serialize_message(message: Message, db) -> dict:
    sender = db.query(User).filter(User.id == message.sender_id).first()
    receiver = db.query(User).filter(User.id == message.receiver_id).first() if message.receiver_id else None
    return {
        "id": message.id,
        "content": message.content,
        "sender_id": message.sender_id,
        "sender_name": sender.full_name if sender else "Usuario",
        "sender_department": sender.department if sender else None,
        "receiver_id": message.receiver_id,
        "receiver_name": receiver.full_name if receiver else None,
        "receiver_department": receiver.department if receiver else None,
        "message_type": message.message_type,
        "timestamp": message.timestamp.isoformat() if message.timestamp else None,
        "file_path": message.file_path,
    }


def can_access_ticket(ticket: Ticket, user: User) -> bool:
    if is_admin(user):
        return True
    if is_coordinator(user) and user.department and ticket.department == user.department:
        return True
    return ticket.created_by_id == user.id or ticket.assigned_to_id == user.id


def ensure_ticket_access(ticket: Ticket, user: User):
    if not can_access_ticket(ticket, user):
        raise HTTPException(status_code=403, detail="Sem permissao para acessar este ticket.")


async def notify_ticket_user(user_id: Optional[int], title: str, description: str, ticket_id: int):
    if not user_id:
        return
    payload = {
        "type": "notification",
        "notification": {
            "id": f"ticket-{ticket_id}-{int(datetime.utcnow().timestamp() * 1000)}",
            "type": "Ticket",
            "title": title,
            "description": description,
            "time": "Agora",
            "unread": True,
            "ticket_id": ticket_id,
            "link": "/tickets",
        },
    }
    await manager.send_personal_message(json.dumps(payload), user_id)


def serialize_group(group: ChatGroup, db) -> dict:
    creator = db.query(User).filter(User.id == group.created_by_id).first()
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "department": group.department,
        "created_by_id": group.created_by_id,
        "created_by_name": creator.full_name if creator else None,
        "is_active": group.is_active,
        "created_at": group.created_at.isoformat() if group.created_at else None,
    }


def serialize_task(task: TaskItem, db) -> dict:
    created_by = db.query(User).filter(User.id == task.created_by_id).first()
    assigned_to = db.query(User).filter(User.id == task.assigned_to_id).first() if task.assigned_to_id else None
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "priority": task.priority,
        "category": task.category,
        "status": task.status,
        "due_date": task.due_date,
        "created_by_id": task.created_by_id,
        "created_by_name": created_by.full_name if created_by else None,
        "assigned_to_id": task.assigned_to_id,
        "assigned_to_name": assigned_to.full_name if assigned_to else None,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
    }


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
        {
            "username": "admin",
            "email": "admin@sordchat.com",
            "full_name": "Administrador Master",
            "password": "admin123",
            "access_level": "master",
            "department": "Administracao",
            "role_title": "Administrador do sistema",
            "phone_extension": "1000",
            "birthday": "01-01",
        },
        {
            "username": "coordenador",
            "email": "coord@sordchat.com",
            "full_name": "Coordenador Sistema",
            "password": "coord123",
            "access_level": "coordenador",
            "department": "TI",
            "role_title": "Coordenador de TI",
            "phone_extension": "2000",
            "birthday": "02-02",
        },
        {
            "username": "usuario",
            "email": "user@sordchat.com",
            "full_name": "Usuario Padrao",
            "password": "user123",
            "access_level": "usuario",
            "department": "TI",
            "role_title": "Analista",
            "phone_extension": "2001",
            "birthday": "03-03",
        },
    ]

    with SessionLocal() as db:
        for user_data in default_users:
            existing = db.query(User).filter(User.username == user_data["username"]).first()
            if existing:
                changed = False
                for field in ["department", "role_title", "phone_extension", "birthday"]:
                    if not getattr(existing, field, None):
                        setattr(existing, field, user_data[field])
                        changed = True
                if existing.access_level == "padrao":
                    existing.access_level = "usuario"
                    changed = True
                if changed:
                    existing.updated_at = datetime.utcnow()
                continue

            db.add(
                User(
                    username=user_data["username"],
                    email=user_data["email"],
                    full_name=user_data["full_name"],
                    hashed_password=get_password_hash(user_data["password"]),
                    access_level=user_data["access_level"],
                    department=user_data["department"],
                    role_title=user_data["role_title"],
                    phone_extension=user_data["phone_extension"],
                    birthday=user_data["birthday"],
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


def normalize_text(value: str) -> str:
    replacements = {
        "á": "a",
        "à": "a",
        "ã": "a",
        "â": "a",
        "é": "e",
        "ê": "e",
        "í": "i",
        "ó": "o",
        "ô": "o",
        "õ": "o",
        "ú": "u",
        "ç": "c",
    }
    normalized = value.lower()
    for source, target in replacements.items():
        normalized = normalized.replace(source, target)
    return normalized


def infer_priority(text: str, task_format: bool = False) -> str:
    normalized = normalize_text(text)
    if any(word in normalized for word in ["urgente", "critico", "critica", "alta", "prioridade maxima", "importante"]):
        return "high" if task_format else "Alta"
    if any(word in normalized for word in ["baixa", "sem pressa", "quando der", "normal baixa"]):
        return "low" if task_format else "Baixa"
    return "medium" if task_format else "Media"


def infer_due_date(text: str) -> Optional[str]:
    normalized = normalize_text(text)
    today = datetime.utcnow().date()
    if "amanha" in normalized:
        return (today + timedelta(days=1)).isoformat()
    if "hoje" in normalized:
        return today.isoformat()

    tokens = normalized.replace(",", " ").replace(".", " ").split()
    for token in tokens:
        parts = token.split("/")
        if len(parts) not in {2, 3}:
            continue
        try:
            day = int(parts[0])
            month = int(parts[1])
            year = int(parts[2]) if len(parts) == 3 else today.year
            return datetime(year, month, day).date().isoformat()
        except ValueError:
            continue
    return None


def infer_intent(text: str) -> str:
    normalized = normalize_text(text)
    task_words = ["tarefa", "task", "kanban", "atividade", "afazer", "a fazer", "pendencia"]
    ticket_words = ["ticket", "chamado", "solicitacao", "suporte", "problema", "incidente", "atendimento"]
    task_score = sum(1 for word in task_words if word in normalized)
    ticket_score = sum(1 for word in ticket_words if word in normalized)
    return "task" if task_score > ticket_score else "ticket"


def infer_department(text: str, users: list[User], fallback: Optional[str]) -> str:
    normalized = normalize_text(text)
    departments = {department for department in DEFAULT_DEPARTMENTS}
    departments.update(user.department for user in users if user.department)

    for department in sorted(departments, key=len, reverse=True):
        if normalize_text(department) in normalized:
            return department

    aliases = {
        "rh": "RH",
        "recursos humanos": "RH",
        "financeiro": "Financeiro",
        "financas": "Financeiro",
        "ti": "TI",
        "tecnologia": "TI",
        "suporte": "Suporte",
        "comercial": "Comercial",
        "operacao": "Operacao",
        "operacoes": "Operacao",
        "produto": "Produto",
    }
    for alias, department in aliases.items():
        if alias in normalized:
            return department

    return fallback or "Operacao"


def infer_assignee(text: str, users: list[User]) -> Optional[User]:
    normalized = normalize_text(text)
    for user in users:
        candidates = [user.username, user.email, user.full_name]
        if any(candidate and normalize_text(candidate) in normalized for candidate in candidates):
            return user
    return None


def extract_assistant_subject(text: str, intent: str) -> str:
    clean = " ".join(text.strip().split())
    prefixes = [
        "crie um ticket",
        "crie o ticket",
        "criar ticket",
        "abra um ticket",
        "abra o ticket",
        "abrir ticket",
        "registrar chamado",
        "registre chamado",
        "crie uma tarefa",
        "crie a tarefa",
        "criar tarefa",
        "adicione uma tarefa",
        "adicionar tarefa",
        "registrar",
        "registre",
    ]
    normalized = normalize_text(clean)
    subject = clean
    for prefix in prefixes:
        if normalized.startswith(prefix):
            subject = clean[len(prefix):].strip(" :-")
            break

    lowered = normalize_text(subject)
    if " sobre " in lowered:
        index = lowered.find(" sobre ")
        subject = subject[index + len(" sobre "):].strip(" :-")
    elif ":" in subject:
        subject = subject.split(":", 1)[1].strip()

    cut_markers = [" e atribua", " atribua", " ate amanha", " até amanhã", " para amanha", " para amanhã"]
    lowered = normalize_text(subject)
    for marker in cut_markers:
        index = lowered.find(normalize_text(marker))
        if index > 8:
            subject = subject[:index].strip(" .,;-")
            lowered = normalize_text(subject)

    filler = ["urgente", "alta prioridade", "prioridade alta", "por favor"]
    words = [word for word in subject.split() if normalize_text(word) not in filler]
    subject = " ".join(words).strip(" .,;-")
    if not subject:
        subject = "atendimento interno" if intent == "ticket" else "atividade operacional"
    return subject[:160]


def build_assistant_title(text: str, intent: str) -> str:
    subject = extract_assistant_subject(text, intent)
    words = subject.split()
    short_subject = " ".join(words[:9]).strip()
    if len(words) > 9:
        short_subject = f"{short_subject}..."
    prefix = "Ticket" if intent == "ticket" else "Tarefa"
    return f"{prefix}: {short_subject}".strip()[:180]


def build_assistant_scope(subject: str, intent: str, department: str, assignee: Optional[User], due_date: Optional[str]) -> str:
    owner = assignee.full_name if assignee else "responsavel definido pelo setor"
    due_text = f" Prazo identificado: {due_date}." if due_date else ""
    if intent == "ticket":
        return (
            f"Escopo: analisar {subject}, identificar causa, registrar evidencias e conduzir o atendimento ate a "
            f"resolucao ou proximo encaminhamento. Setor: {department}. Responsavel: {owner}.{due_text}"
        )
    return (
        f"Escopo: executar {subject}, organizar as etapas necessarias, registrar andamento no Kanban e concluir com "
        f"validacao do responsavel. Setor: {department}. Responsavel: {owner}.{due_text}"
    )


def plan_assistant_action(text: str, current_user: User, db) -> dict:
    users = db.query(User).filter(User.is_active == True).all()
    intent = infer_intent(text)
    assignee = infer_assignee(text, users)
    department = infer_department(text, users, current_user.department)
    due_date = infer_due_date(text)
    subject = extract_assistant_subject(text, intent)
    title = build_assistant_title(subject, intent)

    return {
        "intent": intent,
        "title": title,
        "description": build_assistant_scope(subject, intent, department, assignee, due_date),
        "subject": subject,
        "department": department,
        "assigned_to_id": assignee.id if assignee else None,
        "assigned_to_name": assignee.full_name if assignee else None,
        "ticket_priority": infer_priority(text, task_format=False),
        "task_priority": infer_priority(text, task_format=True),
        "due_date": due_date,
    }


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


@app.get("/version")
async def version_check():
    return {
        "service": "api",
        "app": "SorDChat",
        "version": APP_VERSION,
        "commit": os.getenv("RENDER_GIT_COMMIT") or APP_VERSION,
        "build_time": APP_BUILD_TIME,
    }


@app.get("/downloads/desktop/latest/meta")
async def latest_desktop_release_meta():
    with SessionLocal() as db:
        release = (
            db.query(DesktopRelease)
            .filter(DesktopRelease.platform == "windows", DesktopRelease.is_active == True)
            .order_by(DesktopRelease.created_at.desc())
            .first()
        )
        if not release:
            raise HTTPException(status_code=404, detail="Instalador desktop ainda nao publicado")

        return {
            "version": release.version,
            "platform": release.platform,
            "filename": release.filename,
            "content_type": release.content_type,
            "file_size": release.file_size,
            "sha256": release.sha256,
            "storage_mode": release.storage_mode,
            "created_at": release.created_at.isoformat() if release.created_at else None,
            "download_url": "/downloads/desktop/latest",
        }


def iter_desktop_release_chunks(release_id: int):
    with SessionLocal() as db:
        chunk_index = 0
        while True:
            chunk = (
                db.query(DesktopReleaseChunk)
                .filter(
                    DesktopReleaseChunk.release_id == release_id,
                    DesktopReleaseChunk.chunk_index == chunk_index,
                )
                .first()
            )
            if not chunk:
                break
            yield bytes(chunk.data)
            chunk_index += 1


@app.get("/downloads/desktop/latest")
async def download_latest_desktop_release():
    with SessionLocal() as db:
        release = (
            db.query(DesktopRelease)
            .filter(DesktopRelease.platform == "windows", DesktopRelease.is_active == True)
            .order_by(DesktopRelease.created_at.desc())
            .first()
        )
        if not release:
            raise HTTPException(status_code=404, detail="Instalador desktop ainda nao publicado")

        release_id = release.id
        storage_mode = release.storage_mode or "inline"
        content_type = release.content_type
        payload = bytes(release.binary_data or b"") if storage_mode == "inline" else None
        chunk_count = 0
        if storage_mode == "chunks":
            try:
                chunk_count = (
                    db.query(DesktopReleaseChunk)
                    .filter(DesktopReleaseChunk.release_id == release_id)
                    .count()
                )
            except Exception as exc:
                print(f"Erro ao consultar chunks do instalador: {exc}")
                raise HTTPException(status_code=503, detail="Armazenamento do instalador ainda nao esta pronto.")
        headers = {
            "Content-Disposition": f'attachment; filename="{release.filename}"',
            "Content-Length": str(release.file_size),
            "Cache-Control": "no-store",
            "X-SorDChat-Version": release.version,
            "X-SorDChat-Sha256": release.sha256,
        }

    if storage_mode == "chunks":
        if chunk_count == 0:
            raise HTTPException(status_code=404, detail="Instalador desktop sem dados publicados")
        return StreamingResponse(
            iter_desktop_release_chunks(release_id),
            media_type=content_type,
            headers=headers,
        )

    if not payload:
        raise HTTPException(status_code=404, detail="Instalador desktop sem arquivo publicado")

    return StreamingResponse(iter([payload]), media_type=content_type, headers=headers)


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
            "user": serialize_user(user),
        }


@app.post("/auth/logout")
async def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Logout realizado com sucesso"}


@app.get("/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)


@app.get("/users/")
async def list_users(current_user: User = Depends(get_current_user)):
    with SessionLocal() as db:
        query = db.query(User)
        if not is_admin(current_user):
            if is_coordinator(current_user) and current_user.department:
                query = query.filter(User.department == current_user.department)
            else:
                query = query.filter(User.id == current_user.id)
        users = query.order_by(User.full_name.asc()).all()
        return [serialize_user(item) for item in users]


@app.get("/birthdays/")
async def list_birthdays(current_user: User = Depends(get_current_user)):
    with SessionLocal() as db:
        users = (
            db.query(User)
            .filter(User.is_active == True, User.birthday.isnot(None), User.birthday != "")
            .order_by(User.full_name.asc())
            .all()
        )
        return [serialize_user(item) for item in users]


@app.post("/users/")
async def create_user(payload: dict, current_user: User = Depends(get_current_user)):
    if not is_admin(current_user) and not is_coordinator(current_user):
        raise HTTPException(status_code=403, detail="Sem permissao para criar usuarios.")

    required_fields = ["username", "email", "full_name", "password"]
    missing = [field for field in required_fields if not str(payload.get(field) or "").strip()]
    if missing:
        raise HTTPException(status_code=400, detail=f"Campos obrigatorios: {', '.join(missing)}")

    access_level = normalize_access_level(payload.get("access_level"))
    department = str(payload.get("department") or current_user.department or "Operacao").strip()

    if is_coordinator(current_user) and not is_admin(current_user):
        if department != current_user.department:
            raise HTTPException(status_code=403, detail="Coordenador so pode criar usuarios do proprio setor.")
        if access_level == "master":
            raise HTTPException(status_code=403, detail="Coordenador nao pode criar administradores.")
        access_level = "usuario"

    with SessionLocal() as db:
        duplicate = db.query(User).filter(or_(User.username == payload["username"], User.email == payload["email"])).first()
        if duplicate:
            raise HTTPException(status_code=400, detail="Username ou email ja esta em uso.")

        user = User(
            username=str(payload["username"]).strip(),
            email=str(payload["email"]).strip(),
            full_name=str(payload["full_name"]).strip(),
            hashed_password=get_password_hash(str(payload["password"])),
            access_level=access_level,
            department=department,
            phone_extension=str(payload.get("phone_extension") or "").strip() or None,
            birthday=str(payload.get("birthday") or "").strip() or None,
            role_title=str(payload.get("role_title") or "").strip() or None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return serialize_user(user)


@app.put("/users/{user_id}")
async def update_user(user_id: int, payload: dict, current_user: User = Depends(get_current_user)):
    with SessionLocal() as db:
        target = db.query(User).filter(User.id == user_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="Usuario nao encontrado.")

        if not is_admin(current_user):
            if not is_coordinator(current_user) or target.department != current_user.department:
                raise HTTPException(status_code=403, detail="Sem permissao para editar este usuario.")
            if target.access_level == "master":
                raise HTTPException(status_code=403, detail="Coordenador nao pode editar administradores.")

        editable_fields = ["full_name", "email", "department", "phone_extension", "birthday", "role_title"]
        for field in editable_fields:
            if field in payload:
                value = str(payload.get(field) or "").strip() or None
                setattr(target, field, value)

        if "access_level" in payload and is_admin(current_user):
            target.access_level = normalize_access_level(payload.get("access_level"))
        elif "access_level" in payload and is_coordinator(current_user):
            target.access_level = "usuario"

        if "is_active" in payload and is_admin(current_user):
            target.is_active = bool(payload.get("is_active"))

        target.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(target)
        return serialize_user(target)


@app.get("/departments/")
async def list_departments(current_user: User = Depends(get_current_user)):
    with SessionLocal() as db:
        departments = {department for department in DEFAULT_DEPARTMENTS}
        if current_user.department:
            departments.add(current_user.department)
        rows = db.query(User.department).filter(User.department.isnot(None)).distinct().all()
        for row in rows:
            if row[0]:
                departments.add(row[0])
        if is_coordinator(current_user) and not is_admin(current_user):
            return [current_user.department] if current_user.department else []
        return sorted(departments)


@app.get("/tickets/")
async def list_tickets(
    status: Optional[str] = Query(default=None),
    department: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    current_user: User = Depends(get_current_user),
):
    with SessionLocal() as db:
        query = db.query(Ticket)
        if is_admin(current_user):
            if department:
                query = query.filter(Ticket.department == department)
        elif is_coordinator(current_user) and current_user.department:
            query = query.filter(Ticket.department == current_user.department)
        else:
            query = query.filter(or_(Ticket.created_by_id == current_user.id, Ticket.assigned_to_id == current_user.id))

        if status:
            query = query.filter(Ticket.status == status)

        tickets = query.order_by(Ticket.created_at.desc()).limit(limit).all()
        return [serialize_ticket(ticket, db) for ticket in tickets]


@app.post("/tickets/")
async def create_ticket(payload: dict, current_user: User = Depends(get_current_user)):
    title = str(payload.get("title") or "").strip()
    description = str(payload.get("description") or "").strip()
    if not title or not description:
        raise HTTPException(status_code=400, detail="Titulo e descricao sao obrigatorios.")

    department = str(payload.get("department") or current_user.department or "Operacao").strip()
    if is_coordinator(current_user) and not is_admin(current_user) and department != current_user.department:
        raise HTTPException(status_code=403, detail="Coordenador so pode criar tickets do proprio setor.")

    assigned_to_id = payload.get("assigned_to_id")
    attachment_file_id = payload.get("attachment_file_id")
    with SessionLocal() as db:
        if assigned_to_id:
            assigned_user = db.query(User).filter(User.id == int(assigned_to_id), User.is_active == True).first()
            if not assigned_user:
                raise HTTPException(status_code=400, detail="Usuario responsavel nao encontrado.")
            if is_coordinator(current_user) and not is_admin(current_user) and assigned_user.department != current_user.department:
                raise HTTPException(status_code=403, detail="Responsavel precisa estar no mesmo setor.")
        if attachment_file_id:
            attachment = db.query(FileUpload).filter(FileUpload.id == int(attachment_file_id)).first()
            if not attachment:
                raise HTTPException(status_code=400, detail="Anexo nao encontrado.")

        ticket = Ticket(
            title=title,
            description=description,
            priority=str(payload.get("priority") or "Media"),
            status=str(payload.get("status") or "Aberto"),
            department=department,
            channel=str(payload.get("channel") or "Web"),
            created_by_id=current_user.id,
            assigned_to_id=int(assigned_to_id) if assigned_to_id else None,
            attachment_file_id=int(attachment_file_id) if attachment_file_id else None,
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        ticket_response = serialize_ticket(ticket, db)

        if ticket.assigned_to_id and ticket.assigned_to_id != current_user.id:
            await notify_ticket_user(
                ticket.assigned_to_id,
                "Novo ticket atribuido",
                f"{current_user.full_name} abriu: {ticket.title}",
                ticket.id,
            )

        return ticket_response


@app.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: int, current_user: User = Depends(get_current_user)):
    with SessionLocal() as db:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket nao encontrado.")
        ensure_ticket_access(ticket, current_user)
        return serialize_ticket(ticket, db)


@app.get("/tickets/{ticket_id}/messages")
async def list_ticket_messages(ticket_id: int, current_user: User = Depends(get_current_user)):
    with SessionLocal() as db:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket nao encontrado.")
        ensure_ticket_access(ticket, current_user)

        messages = (
            db.query(TicketMessage)
            .filter(TicketMessage.ticket_id == ticket_id)
            .order_by(TicketMessage.created_at.asc())
            .all()
        )
        return [serialize_ticket_message(message, db) for message in messages]


@app.post("/tickets/{ticket_id}/messages")
async def create_ticket_message(ticket_id: int, payload: dict, current_user: User = Depends(get_current_user)):
    content = str(payload.get("content") or "").strip()
    file_id = payload.get("file_id")
    if not content and not file_id:
        raise HTTPException(status_code=400, detail="Informe uma mensagem ou anexo.")

    with SessionLocal() as db:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket nao encontrado.")
        ensure_ticket_access(ticket, current_user)
        if ticket.status == "Resolvido":
            raise HTTPException(status_code=400, detail="Ticket resolvido nao recebe novas mensagens.")

        if file_id:
            attachment = db.query(FileUpload).filter(FileUpload.id == int(file_id)).first()
            if not attachment:
                raise HTTPException(status_code=400, detail="Anexo nao encontrado.")

        message = TicketMessage(
            ticket_id=ticket.id,
            sender_id=current_user.id,
            content=content,
            file_id=int(file_id) if file_id else None,
        )
        db.add(message)

        if not ticket.first_response_at and current_user.id != ticket.created_by_id:
            ticket.first_response_at = datetime.utcnow()
        if ticket.status == "Aberto" and current_user.id != ticket.created_by_id:
            ticket.status = "Em andamento"
        ticket.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(message)
        db.refresh(ticket)
        message_response = serialize_ticket_message(message, db)

        notify_user_id = ticket.created_by_id if current_user.id == ticket.assigned_to_id else ticket.assigned_to_id
        if notify_user_id and notify_user_id != current_user.id:
            await notify_ticket_user(
                notify_user_id,
                "Nova conversa no ticket",
                f"{current_user.full_name} respondeu em: {ticket.title}",
                ticket.id,
            )

        return message_response


@app.patch("/tickets/{ticket_id}/transfer")
async def transfer_ticket(ticket_id: int, payload: dict, current_user: User = Depends(get_current_user)):
    assigned_to_id = payload.get("assigned_to_id")
    if not assigned_to_id:
        raise HTTPException(status_code=400, detail="Selecione um novo responsavel.")

    note = str(payload.get("message") or "").strip()
    with SessionLocal() as db:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket nao encontrado.")
        ensure_ticket_access(ticket, current_user)

        assigned_user = db.query(User).filter(User.id == int(assigned_to_id), User.is_active == True).first()
        if not assigned_user:
            raise HTTPException(status_code=400, detail="Usuario responsavel nao encontrado.")
        if is_coordinator(current_user) and not is_admin(current_user) and assigned_user.department != current_user.department:
            raise HTTPException(status_code=403, detail="Responsavel precisa estar no mesmo setor.")

        ticket.assigned_to_id = assigned_user.id
        ticket.status = "Em andamento" if ticket.status != "Resolvido" else ticket.status
        ticket.updated_at = datetime.utcnow()
        db.add(TicketMessage(
            ticket_id=ticket.id,
            sender_id=current_user.id,
            content=note or f"Ticket repassado para {assigned_user.full_name}.",
        ))
        db.commit()
        db.refresh(ticket)
        ticket_response = serialize_ticket(ticket, db)

        if assigned_user.id != current_user.id:
            await notify_ticket_user(
                assigned_user.id,
                "Ticket repassado para voce",
                f"{current_user.full_name} repassou: {ticket.title}",
                ticket.id,
            )

        return ticket_response


@app.post("/tickets/{ticket_id}/close")
async def close_ticket(ticket_id: int, payload: dict, current_user: User = Depends(get_current_user)):
    note = str(payload.get("message") or "").strip()
    with SessionLocal() as db:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket nao encontrado.")
        ensure_ticket_access(ticket, current_user)

        ticket.status = "Resolvido"
        ticket.closed_at = ticket.closed_at or datetime.utcnow()
        ticket.updated_at = datetime.utcnow()
        db.add(TicketMessage(
            ticket_id=ticket.id,
            sender_id=current_user.id,
            content=note or "Ticket fechado.",
        ))
        db.commit()
        db.refresh(ticket)
        ticket_response = serialize_ticket(ticket, db)

        if ticket.created_by_id != current_user.id:
            await notify_ticket_user(
                ticket.created_by_id,
                "Ticket fechado",
                f"{current_user.full_name} fechou: {ticket.title}. Avalie o atendimento.",
                ticket.id,
            )

        return ticket_response


@app.post("/tickets/{ticket_id}/rating")
async def rate_ticket(ticket_id: int, payload: dict, current_user: User = Depends(get_current_user)):
    try:
        rating_score = int(payload.get("rating_score"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Informe uma avaliacao de 1 a 5.")
    if rating_score < 1 or rating_score > 5:
        raise HTTPException(status_code=400, detail="A avaliacao deve ficar entre 1 e 5.")

    with SessionLocal() as db:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket nao encontrado.")
        ensure_ticket_access(ticket, current_user)
        if ticket.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Somente o dono do ticket pode avaliar.")
        if ticket.status != "Resolvido":
            raise HTTPException(status_code=400, detail="Avalie apenas depois do fechamento.")

        ticket.rating_score = rating_score
        ticket.rating_comment = str(payload.get("rating_comment") or "").strip() or None
        ticket.rated_at = datetime.utcnow()
        ticket.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(ticket)
        return serialize_ticket(ticket, db)


@app.patch("/tickets/{ticket_id}")
async def update_ticket(ticket_id: int, payload: dict, current_user: User = Depends(get_current_user)):
    with SessionLocal() as db:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket nao encontrado.")

        can_edit = is_admin(current_user)
        if not can_edit and is_coordinator(current_user) and current_user.department:
            can_edit = ticket.department == current_user.department
        if not can_edit:
            can_edit = ticket.created_by_id == current_user.id or ticket.assigned_to_id == current_user.id
        if not can_edit:
            raise HTTPException(status_code=403, detail="Sem permissao para editar este ticket.")

        previous_assigned_to_id = ticket.assigned_to_id

        for field in ["title", "description", "priority", "status", "department", "channel"]:
            if field in payload:
                setattr(ticket, field, str(payload.get(field) or "").strip() or None)

        if "assigned_to_id" in payload:
            assigned_to_id = payload.get("assigned_to_id")
            if assigned_to_id:
                assigned_user = db.query(User).filter(User.id == int(assigned_to_id), User.is_active == True).first()
                if not assigned_user:
                    raise HTTPException(status_code=400, detail="Usuario responsavel nao encontrado.")
                if is_coordinator(current_user) and not is_admin(current_user) and assigned_user.department != current_user.department:
                    raise HTTPException(status_code=403, detail="Responsavel precisa estar no mesmo setor.")
                ticket.assigned_to_id = assigned_user.id
            else:
                ticket.assigned_to_id = None

        if "attachment_file_id" in payload:
            attachment_file_id = payload.get("attachment_file_id")
            if attachment_file_id:
                attachment = db.query(FileUpload).filter(FileUpload.id == int(attachment_file_id)).first()
                if not attachment:
                    raise HTTPException(status_code=400, detail="Anexo nao encontrado.")
                ticket.attachment_file_id = attachment.id
            else:
                ticket.attachment_file_id = None

        if ticket.status == "Resolvido":
            ticket.closed_at = ticket.closed_at or datetime.utcnow()
        else:
            ticket.closed_at = None
        ticket.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(ticket)
        ticket_response = serialize_ticket(ticket, db)

        if ticket.assigned_to_id and ticket.assigned_to_id != previous_assigned_to_id and ticket.assigned_to_id != current_user.id:
            await notify_ticket_user(
                ticket.assigned_to_id,
                "Ticket atribuido a voce",
                f"{current_user.full_name} atribuiu: {ticket.title}",
                ticket.id,
            )

        return ticket_response


@app.get("/tasks/")
async def list_tasks(
    status: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
):
    with SessionLocal() as db:
        query = db.query(TaskItem)
        if status:
            query = query.filter(TaskItem.status == status)
        if not is_admin(current_user):
            if is_coordinator(current_user) and current_user.department:
                query = query.filter(TaskItem.category == current_user.department)
            else:
                query = query.filter(or_(TaskItem.created_by_id == current_user.id, TaskItem.assigned_to_id == current_user.id))
        tasks = query.order_by(TaskItem.created_at.desc()).all()
        return [serialize_task(task, db) for task in tasks]


@app.post("/tasks/")
async def create_task(payload: dict, current_user: User = Depends(get_current_user)):
    title = str(payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Titulo da tarefa e obrigatorio.")

    category = str(payload.get("category") or current_user.department or "Operacao").strip()
    assigned_to_id = payload.get("assigned_to_id")
    if is_coordinator(current_user) and not is_admin(current_user) and category != current_user.department:
        raise HTTPException(status_code=403, detail="Coordenador so pode criar tarefas do proprio setor.")

    with SessionLocal() as db:
        assigned_user = None
        if assigned_to_id:
            assigned_user = db.query(User).filter(User.id == int(assigned_to_id), User.is_active == True).first()
            if not assigned_user:
                raise HTTPException(status_code=400, detail="Responsavel nao encontrado.")
            if is_coordinator(current_user) and not is_admin(current_user) and assigned_user.department != current_user.department:
                raise HTTPException(status_code=403, detail="Responsavel precisa estar no mesmo setor.")

        task = TaskItem(
            title=title,
            description=str(payload.get("description") or "").strip() or None,
            priority=str(payload.get("priority") or "medium").strip(),
            category=category,
            status=str(payload.get("status") or "backlog").strip(),
            due_date=str(payload.get("due_date") or "").strip() or None,
            created_by_id=current_user.id,
            assigned_to_id=assigned_user.id if assigned_user else None,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return serialize_task(task, db)


@app.patch("/tasks/{task_id}")
async def update_task(task_id: int, payload: dict, current_user: User = Depends(get_current_user)):
    with SessionLocal() as db:
        task = db.query(TaskItem).filter(TaskItem.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Tarefa nao encontrada.")

        can_edit = is_admin(current_user) or task.created_by_id == current_user.id or task.assigned_to_id == current_user.id
        if not can_edit and is_coordinator(current_user) and current_user.department:
            can_edit = task.category == current_user.department
        if not can_edit:
            raise HTTPException(status_code=403, detail="Sem permissao para editar esta tarefa.")

        for field in ["title", "description", "priority", "category", "status", "due_date"]:
            if field in payload:
                value = str(payload.get(field) or "").strip() or None
                if field in ["title", "priority", "category", "status"]:
                    value = value or getattr(task, field)
                setattr(task, field, value)

        if "assigned_to_id" in payload:
            assigned_to_id = payload.get("assigned_to_id")
            if assigned_to_id:
                assigned_user = db.query(User).filter(User.id == int(assigned_to_id), User.is_active == True).first()
                if not assigned_user:
                    raise HTTPException(status_code=400, detail="Responsavel nao encontrado.")
                task.assigned_to_id = assigned_user.id
            else:
                task.assigned_to_id = None

        task.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(task)
        return serialize_task(task, db)


@app.delete("/tasks/{task_id}")
async def delete_task(task_id: int, current_user: User = Depends(get_current_user)):
    with SessionLocal() as db:
        task = db.query(TaskItem).filter(TaskItem.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Tarefa nao encontrada.")
        if not is_admin(current_user) and task.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Sem permissao para remover esta tarefa.")
        db.delete(task)
        db.commit()
        return {"message": "Tarefa removida."}


@app.post("/assistant/requests")
async def assistant_request(payload: dict, current_user: User = Depends(get_current_user)):
    message = str(payload.get("message") or "").strip()
    execute = bool(payload.get("execute", True))
    if not message:
        raise HTTPException(status_code=400, detail="Informe uma solicitacao para o assistente.")

    with SessionLocal() as db:
        plan = plan_assistant_action(message, current_user, db)
        if is_coordinator(current_user) and not is_admin(current_user) and plan["department"] != current_user.department:
            raise HTTPException(status_code=403, detail="Coordenador so pode criar itens do proprio setor.")

        response = {
            "intent": plan["intent"],
            "plan": plan,
            "executed": False,
            "ticket": None,
            "task": None,
            "reply": "",
        }

        if not execute:
            response["reply"] = "Plano montado. Confirme para criar no SorDChat."
            return response

        if plan["intent"] == "ticket":
            ticket = Ticket(
                title=plan["title"],
                description=plan["description"],
                priority=plan["ticket_priority"],
                status="Aberto",
                department=plan["department"],
                channel="Assistente",
                created_by_id=current_user.id,
                assigned_to_id=plan["assigned_to_id"],
            )
            db.add(ticket)
            db.commit()
            db.refresh(ticket)
            response["executed"] = True
            response["ticket"] = serialize_ticket(ticket, db)
            response["reply"] = f"Criei o ticket #{ticket.id} para {plan['department']} com prioridade {plan['ticket_priority']}."
            if ticket.assigned_to_id and ticket.assigned_to_id != current_user.id:
                await notify_ticket_user(
                    ticket.assigned_to_id,
                    "Novo ticket atribuido",
                    f"{current_user.full_name} abriu via assistente: {ticket.title}",
                    ticket.id,
                )
            return response

        task = TaskItem(
            title=plan["title"],
            description=plan["description"],
            priority=plan["task_priority"],
            category=plan["department"],
            status="backlog",
            due_date=plan["due_date"],
            created_by_id=current_user.id,
            assigned_to_id=plan["assigned_to_id"],
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        response["executed"] = True
        response["task"] = serialize_task(task, db)
        response["reply"] = f"Criei a tarefa #{task.id} no Kanban em {plan['department']}."
        return response


@app.get("/admin/overview")
async def admin_overview(current_user: User = Depends(get_current_user)):
    ensure_admin(current_user)
    with SessionLocal() as db:
        users = db.query(User).order_by(User.full_name.asc()).all()
        tickets = db.query(Ticket).order_by(Ticket.created_at.desc()).limit(50).all()
        messages = db.query(Message).order_by(Message.timestamp.desc()).limit(50).all()
        departments = sorted(
            {item.department for item in users if item.department} | {department for department in DEFAULT_DEPARTMENTS}
        )

        return {
            "stats": {
                "users": len(users),
                "active_users": len([item for item in users if item.is_active]),
                "tickets": db.query(Ticket).count(),
                "open_tickets": db.query(Ticket).filter(Ticket.status != "Resolvido").count(),
                "messages": db.query(Message).count(),
                "departments": len(departments),
            },
            "departments": departments,
            "users": [serialize_user(item) for item in users],
            "tickets": [serialize_ticket(ticket, db) for ticket in tickets],
            "messages": [serialize_message(message, db) for message in messages],
        }


@app.get("/coordinator/overview")
async def coordinator_overview(current_user: User = Depends(get_current_user)):
    ensure_coordinator(current_user)
    department = current_user.department
    with SessionLocal() as db:
        users_query = db.query(User)
        tickets_query = db.query(Ticket)
        messages_query = db.query(Message)

        if not is_admin(current_user):
            users_query = users_query.filter(User.department == department)
            tickets_query = tickets_query.filter(Ticket.department == department)
            department_user_ids = [row[0] for row in db.query(User.id).filter(User.department == department).all()]
            if department_user_ids:
                messages_query = messages_query.filter(
                    or_(Message.sender_id.in_(department_user_ids), Message.receiver_id.in_(department_user_ids))
                )
            else:
                messages_query = messages_query.filter(Message.sender_id == current_user.id)

        users = users_query.order_by(User.full_name.asc()).all()
        tickets = tickets_query.order_by(Ticket.created_at.desc()).limit(50).all()
        messages = messages_query.order_by(Message.timestamp.desc()).limit(30).all()

        return {
            "department": department,
            "stats": {
                "users": len(users),
                "tickets": len(tickets),
                "open_tickets": len([ticket for ticket in tickets if ticket.status != "Resolvido"]),
                "messages": len(messages),
            },
            "users": [serialize_user(item) for item in users],
            "tickets": [serialize_ticket(ticket, db) for ticket in tickets],
            "messages": [serialize_message(message, db) for message in messages],
        }


@app.get("/groups/")
async def list_groups(current_user: User = Depends(get_current_user)):
    with SessionLocal() as db:
        query = db.query(ChatGroup).filter(ChatGroup.is_active == True)
        if not is_admin(current_user):
            if current_user.department:
                query = query.filter(ChatGroup.department == current_user.department)
            else:
                query = query.filter(ChatGroup.created_by_id == current_user.id)
        groups = query.order_by(ChatGroup.name.asc()).all()
        return [serialize_group(group, db) for group in groups]


@app.post("/groups/")
async def create_group(payload: dict, current_user: User = Depends(get_current_user)):
    ensure_coordinator(current_user)
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome do grupo e obrigatorio.")

    department = str(payload.get("department") or current_user.department or "Geral").strip()
    if is_coordinator(current_user) and not is_admin(current_user) and department != current_user.department:
        raise HTTPException(status_code=403, detail="Coordenador so pode criar grupos do proprio setor.")

    with SessionLocal() as db:
        group = ChatGroup(
            name=name,
            description=str(payload.get("description") or "").strip() or None,
            department=department,
            created_by_id=current_user.id,
        )
        db.add(group)
        db.commit()
        db.refresh(group)
        return serialize_group(group, db)


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
                            "client_id": message_data.get("client_id"),
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
    file_extension = Path(file.filename or "").suffix.lower()
    if file_extension not in ALLOWED_UPLOAD_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_UPLOAD_EXTENSIONS))
        raise HTTPException(status_code=400, detail=f"Formato nao permitido. Envie apenas: {allowed}.")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Arquivo muito grande. Limite de 10 MB.")

    upload_dir = Path(os.getenv("UPLOAD_DIR", "uploads"))
    upload_dir.mkdir(parents=True, exist_ok=True)
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = upload_dir / unique_filename
    file_path.write_bytes(content)

    with SessionLocal() as db:
        file_record = FileUpload(
            filename=file.filename or unique_filename,
            file_path=str(file_path),
            file_size=len(content),
            content_type=file.content_type or "application/octet-stream",
            binary_data=content,
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


@app.get("/files/")
async def list_files(
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    with SessionLocal() as db:
        files = db.query(FileUpload).order_by(FileUpload.upload_date.desc()).limit(limit).all()
        return [
            {
                "id": item.id,
                "filename": item.filename,
                "file_path": item.file_path,
                "file_size": item.file_size,
                "content_type": item.content_type,
                "uploaded_by": item.uploaded_by,
                "upload_date": item.upload_date.isoformat() if item.upload_date else None,
            }
            for item in files
        ]


@app.get("/files/download/{file_id}")
async def download_file(file_id: int, current_user: User = Depends(get_current_user)):
    with SessionLocal() as db:
        file_record = db.query(FileUpload).filter(FileUpload.id == file_id).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="Arquivo nao encontrado")
        file_path = file_record.file_path
        filename = file_record.filename
        content_type = file_record.content_type
        binary_data = bytes(file_record.binary_data or b"") if file_record.binary_data else None

    if not os.path.exists(file_path):
        if not binary_data:
            raise HTTPException(status_code=404, detail="Arquivo nao existe")
        return StreamingResponse(
            iter([binary_data]),
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(binary_data)),
                "Cache-Control": "no-store",
            },
        )

    return FileResponse(path=file_path, filename=filename, media_type=content_type)


if __name__ == "__main__":
    create_default_users()
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8001")))
