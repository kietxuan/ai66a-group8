from contextlib import contextmanager
from dataclasses import dataclass, field
from threading import RLock
from time import monotonic
from uuid import uuid4

from app.core.errors import AppError


@dataclass
class Flow:
    id: str = field(default_factory=lambda: uuid4().hex)
    touched: float = field(default_factory=monotonic)
    draft: dict = field(default_factory=dict)
    choices: list[int] = field(default_factory=list)
    pending: dict | None = None
    question: str = ""
    missing: list[str] = field(default_factory=list)


@dataclass
class Memory:
    touched: float
    turns: list[dict] = field(default_factory=list)
    task_ids: list[int] = field(default_factory=list)
    last_task_id: int | None = None
    last_availability: dict | None = None


class ContextStore:
    """Ephemeral user-scoped drafts. Ref-counted user locks avoid replay races.

    One process only. Never store passwords, tokens or full conversation history.
    """
    def __init__(self, ttl=600, clock=monotonic):
        self.ttl,self.clock=ttl,clock
        self.flows={}
        self.memories={}
        self.locks={}
        self.mutex=RLock()

    @contextmanager
    def guard(self,user_id):
        with self.mutex:
            entry=self.locks.setdefault(user_id,[RLock(),0])
            entry[1]+=1
        try:
            with entry[0]:
                yield
        finally:
            with self.mutex:
                entry[1]-=1
                if entry[1]==0:
                    self.locks.pop(user_id,None)

    def new(self,user_id):
        with self.mutex:
            # Opportunistic cleanup prevents abandoned RAM flows accumulating.
            for uid,flow in list(self.flows.items()):
                if self.clock()-flow.touched>=self.ttl and uid not in self.locks:
                    self.flows.pop(uid,None)
            for uid, memory in list(self.memories.items()):
                if self.clock()-memory.touched>=self.ttl:
                    self.memories.pop(uid,None)
            flow=Flow(touched=self.clock())
            self.flows[user_id]=flow
            return flow

    def get(self,user_id,context_id):
        with self.mutex:
            flow=self.flows.get(user_id)
            if flow and self.clock()-flow.touched>=self.ttl:
                self.flows.pop(user_id,None)
                flow=None
            if not flow or flow.id!=context_id:
                raise AppError(409,"CONTEXT_EXPIRED","Ngữ cảnh đã hết hạn. Hãy gửi lại yêu cầu.")
            return flow

    def peek(self,user_id):
        with self.mutex:
            flow=self.flows.get(user_id)
            if flow and self.clock()-flow.touched<self.ttl:
                return flow
            self.flows.pop(user_id,None)
            return None

    def touch(self,flow):
        flow.touched=self.clock()

    def memory(self, user_id):
        with self.mutex:
            memory = self.memories.get(user_id)
            if memory and self.clock()-memory.touched < self.ttl:
                return memory
            self.memories.pop(user_id, None)
            return None

    def remember(self, user_id, message, answer):
        import re
        with self.mutex:
            memory = self.memory(user_id) or Memory(touched=self.clock())
            # Bounded, selective context. Never retain full responses/history or credentials.
            def safe(text):
                text = re.sub(r"(?:gsk_|sk-)[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_.-]{20,}", "[đã ẩn]", text or "")
                return text[:400]
            if message:
                memory.turns.append({"role":"user", "text":safe(message)})
            memory.turns.append({"role":"assistant", "text":safe(answer.get("message")), "action":answer.get("action"), "type":answer["type"]})
            memory.turns = memory.turns[-6:]
            if answer["type"] == "availability":
                # Criteria only, never stale free slots or authority to book one.
                memory.last_availability = dict(answer["criteria"])
                memory.task_ids, memory.last_task_id = [], None
            elif answer["type"] == "result" and answer.get("action") != "cancel":
                memory.last_availability = None
            if answer.get("action") == "get_tasks":
                memory.task_ids = [t["id"] for t in answer.get("tasks", [])][:12]
                memory.last_task_id = memory.task_ids[0] if len(memory.task_ids)==1 else None
            if answer.get("choices"):
                memory.task_ids = [t["id"] for t in answer["choices"]][:12]
                memory.last_task_id = memory.task_ids[0] if len(memory.task_ids)==1 else None
            if answer.get("task"):
                memory.last_task_id = answer["task"]["id"]
                memory.task_ids = [memory.last_task_id]
            if answer.get("action") == "delete_task" and answer.get("mutated"):
                memory.task_ids, memory.last_task_id = [], None
            memory.touched=self.clock()
            self.memories[user_id]=memory

    def clear(self,user_id, forget=False):
        with self.mutex:
            self.flows.pop(user_id,None)
            if forget:
                self.memories.pop(user_id,None)


store=ContextStore()
