from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    Query,
)
from fastapi import status
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
import asyncio
import json
from jose import jwt

from app.db.session import SessionLocal, get_db
from app.models.notification import Notification
from app.models.user import User
from app.core.config import settings
from app.api.deps import get_current_user
from app.api.rbac import require_roles
from app.api import rbac

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        # user_id -> set(WebSocket)
        self.active: Dict[int, set] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        conns = self.active.get(user_id)
        if not conns:
            self.active[user_id] = {websocket}
        else:
            conns.add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        conns = self.active.get(user_id)
        if not conns:
            return
        try:
            conns.remove(websocket)
        except Exception:
            pass
        if not conns:
            self.active.pop(user_id, None)

    async def send_to_user(self, user_id: int, payload: Dict[str, Any]):
        conns = list(self.active.get(user_id, []))
        for ws in conns:
            try:
                await ws.send_json(payload)
            except Exception:
                try:
                    await ws.close()
                except Exception:
                    pass
                self.disconnect(user_id, ws)

    async def broadcast(self, payload: Dict[str, Any]):
        for uid in list(self.active.keys()):
            await self.send_to_user(uid, payload)


manager = ConnectionManager()


def create_notification(
    db: Session,
    user_id: Optional[int],
    ntype: str,
    message: str,
    payload: Optional[Dict] = None,
):
    try:
        n = Notification(
            user_id=user_id,
            type=ntype,
            message=message,
            payload=json.dumps(payload) if payload else None,
        )
        db.add(n)
        db.commit()
        db.refresh(n)
    except Exception:
        db.rollback()
        raise

    # push via websocket if connected — safe from sync thread context
    try:
        loop = asyncio.get_event_loop()
        push_payload = {
            "id": n.id,
            "type": n.type,
            "message": n.message,
            "payload": payload,
            "created_at": n.created_at.isoformat(),
        }
        if user_id:
            asyncio.run_coroutine_threadsafe(
                manager.send_to_user(user_id, push_payload), loop
            )
        else:
            asyncio.run_coroutine_threadsafe(manager.broadcast(push_payload), loop)
    except Exception:
        # WebSocket push is best-effort; DB record already saved
        pass

    return n


def notify_roles(
    db: Session, roles: list, ntype: str, message: str, payload: Optional[Dict] = None
):
    # Normalize requested role names to canonical values so callers can pass
    # legacy aliases (e.g. 'SALES_ADMIN') or canonical names and both will work.
    roles_norm = [rbac._normalize_role(r) for r in (roles or [])]
    users = db.query(User).filter(User.role.in_(roles_norm)).all()
    created = []
    for u in users:
        try:
            created.append(create_notification(db, u.id, ntype, message, payload))
        except Exception:
            pass
    return created


@router.get("", response_model=list)
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    unread_only: bool = Query(False),
):
    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        q = q.filter(Notification.is_read == False)
    rows = q.order_by(Notification.id.desc()).limit(200).all()
    out = []
    for r in rows:
        try:
            payload = json.loads(r.payload) if r.payload else None
        except Exception:
            payload = None
        out.append(
            {
                "id": r.id,
                "type": r.type,
                "message": r.message,
                "payload": payload,
                "is_read": r.is_read,
                "created_at": r.created_at,
            }
        )
    return out


@router.patch("/{id}/read")
def mark_read(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = db.query(Notification).filter(Notification.id == id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Not found")
    if n.user_id != current_user.id and current_user.role.upper() not in (
        "ADMIN",
        "ADMIN_OPS",
        "OWNER",
    ):
        raise HTTPException(status_code=403, detail="Not allowed")
    n.is_read = True
    db.add(n)
    db.commit()
    return {"ok": True}


@router.post("/send")
def send_notification(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("ADMIN", "ADMIN_OPS", "OWNER")),
):
    # payload: { user_id?: int, roles?: [..], type: str, message: str, payload?: {} }
    user_id = payload.get("user_id")
    roles = payload.get("roles")
    ntype = payload.get("type") or "GENERAL"
    message = payload.get("message") or ""
    pl = payload.get("payload")
    if roles:
        notify_roles(db, roles, ntype, message, pl)
        return {"ok": True, "sent_to_roles": roles}
    if user_id:
        create_notification(db, user_id, ntype, message, pl)
        return {"ok": True, "user_id": user_id}
    # broadcast
    create_notification(db, None, ntype, message, pl)
    return {"ok": True, "broadcast": True}


@router.websocket("/ws")
async def websocket_notifications(
    websocket: WebSocket, token: Optional[str] = Query(None)
):
    # token is expected as query param
    if not token:
        await websocket.close(code=1008)
        return
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        sub = payload.get("sub")
        user_id = int(sub)
    except Exception:
        await websocket.close(code=1008)
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
    except Exception:
        user = None
    finally:
        db.close()

    if not user:
        await websocket.close(code=1008)
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            # Keep connection open; receive pings from client
            data = await websocket.receive_text()
            # ignore client messages; optional: handle client-side requests
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception:
        manager.disconnect(user_id, websocket)
