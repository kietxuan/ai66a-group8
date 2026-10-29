from pydantic import ValidationError
from sqlalchemy import select

from app.core.config import get_settings
from app.core.errors import AppError
from app.crud.tasks import categories,list_tasks,own_task
from app.models import Task
from app.schemas.chat import Action
from app.schemas.availability import AvailabilityCriteria, AvailabilityRequest
from app.schemas.tasks import StatusPayload,TaskFilters,TaskPayload
from app.services.chat_context import store
from app.services.task_service import EDITABLE,execute,preview,serialize,timestamp
from app.services.chat_language import folded, normalize_intent, task_words
from app.services import availability_service

LABELS={"title":"tiêu đề","task_date":"ngày","start_time":"giờ bắt đầu","end_time":"giờ kết thúc","duration_minutes":"thời lượng",
        "priority":"mức ưu tiên","category_name":"danh mục","task":"công việc","changes":"thông tin cần thay đổi"}


def labels(values):
    return ", ".join(LABELS.get(v,v) for v in values)


def response(kind,message,**kwargs):
    return {"type":kind,"message":message,"mutated":False,**kwargs}


def result(action,task=None,tasks=None,mutated=False,message=None):
    return response("result",message or ("Đã cập nhật công việc của bạn." if mutated else "Đã kiểm tra yêu cầu của bạn."),
                    action=action,task=task,tasks=tasks or [],mutated=mutated)


def clarification(flow,message,missing=None,choices=None):
    title=flow.draft.get("fields",{}).get("title")
    subject=f"“{title}”" if title else "công việc này"
    if flow.draft.get("action")=="suggest_free_slots":
        pass  # Availability supplies its own date/window-specific question.
    elif missing==["task_date"]:
        message=f"Bạn muốn xếp {subject} vào ngày nào?"
    elif missing and set(missing).issubset({"start_time","end_time"}):
        message=f"Bạn muốn {subject} bắt đầu và kết thúc lúc mấy giờ? Ví dụ: 08:00–12:00."
    flow.question, flow.missing = message, missing or []
    store.touch(flow)
    return response("clarification",message,context_id=flow.id,missing_fields=missing or [],choices=choices or [])


def resolve_category(db,uid,name):
    if name is None:
        return None
    return next((c.id for c in categories(db,uid) if folded(c.name)==folded(name)),False)


def merge_draft(old,parsed):
    fresh=parsed.model_dump(mode="json",exclude_unset=True)
    if not old or (parsed.action not in (old.get("action"),"clarify")):
        return Action.model_validate(fresh)
    # Changing the target during clarification must not reuse a previously
    # resolved ID or edits meant for another task. Ask again if now incomplete.
    query=fresh.get("task_query")
    changed_query=bool(query and query.strip().casefold()!=str(old.get("task_query") or "").strip().casefold())
    changed_id=fresh.get("task_id") is not None and fresh["task_id"]!=old.get("task_id")
    changed_filters=bool(old.get("task_id") and fresh.get("filters") and fresh["filters"]!=old.get("filters",{}))
    if parsed.action in ("update_task","delete_task","complete_task") and (changed_query or changed_id or changed_filters):
        return Action.model_validate(fresh)
    base={**old,**fresh}
    if old.get("action")=="suggest_free_slots" and parsed.action in ("suggest_free_slots","clarify"):
        # An authenticated, live draft is stronger than an AI memory hint.
        # Do not throw away its known criteria if the model tags a continuation
        # as last_availability, especially when no completed search exists yet.
        base["reference"]=None
    for key in ("fields","filters","availability"):
        base[key]={**old.get(key,{}),**fresh.get(key,{})}
    if fresh.get("filters",{}).get("task_date"):
        base["filters"].pop("date_from",None)
        base["filters"].pop("date_to",None)
    elif fresh.get("filters",{}).get("date_from") or fresh.get("filters",{}).get("date_to"):
        base["filters"].pop("task_date",None)
    if parsed.action=="clarify" and old.get("action") not in (None,"clarify","unsupported"):
        base["action"]=old["action"]
    # A fresh non-clarification output resolves previous missing fields unless
    # parser explicitly says they are still missing. Backend revalidates below.
    base["missing_fields"]=parsed.missing_fields
    return Action.model_validate(base)


def handle(db,uid,payload,provider):
    with store.guard(uid):
        if payload.context_id:
            flow=store.get(uid,payload.context_id)
        else:
            existing=store.peek(uid)
            if existing and existing.pending:
                raise AppError(400,"BUSINESS_RULE_ERROR","Hãy xác nhận hoặc hủy yêu cầu đang chờ trước.")
            flow=store.new(uid)
        if flow.pending:
            raise AppError(400,"BUSINESS_RULE_ERROR","Yêu cầu này đang chờ xác nhận hoặc hủy.")
        if payload.selected_task_id is not None:
            if payload.selected_task_id not in flow.choices:
                raise AppError(422,"VALIDATION_ERROR","Lựa chọn không thuộc danh sách đã cung cấp")
            draft={**flow.draft,"task_id":payload.selected_task_id}
            action=Action.model_validate(draft)
        else:
            names=[c.name for c in categories(db,uid)]
            memory = store.memory(uid)
            recent = []
            if memory and memory.task_ids:
                recent = [serialize(t) for t in db.scalars(select(Task).where(Task.user_id==uid, Task.id.in_(memory.task_ids))).all()]
                recent.sort(key=lambda t: memory.task_ids.index(t["id"]))
            context = {"recent_turns": memory.turns if memory else [],
                "recent_tasks": [{k:t[k] for k in ("id","title","task_date","start_time","end_time","category_id","status","priority")} for t in recent],
                "last_task_id": memory.last_task_id if memory and any(t["id"]==memory.last_task_id for t in recent) else None,
                "last_question":flow.question,"missing_fields":flow.missing,
                "last_availability":memory.last_availability if memory else None}
            # End DB read transaction BEFORE waiting for Groq.
            db.rollback()
            try:
                parsed=Action.model_validate(provider.parse(payload.message,names,{**flow.draft,"_context":context}))
                action=normalize_intent(payload.message,merge_draft(flow.draft,parsed),context)
            except ValidationError:
                raise AppError(502,"AI_INVALID_OUTPUT","Trợ lý trả dữ liệu chưa hợp lệ; chưa thay đổi công việc.") from None
        flow.draft=action.model_dump(mode="json",exclude_unset=True)
        flow.choices=[]
        answer = dispatch(db,uid,flow,action)
        store.remember(uid, payload.message, answer)
        return answer


def dispatch(db,uid,flow,action):
    if action.action=="suggest_free_slots":
        return suggest_availability(db,uid,flow,action)
    if action.action=="unsupported":
        store.clear(uid)
        return result("unsupported",message="Mình hỗ trợ tạo, tìm, sửa, hoàn thành, xóa một công việc và gợi ý giờ trống. Bạn hãy diễn đạt lại trong phạm vi này.")
    if action.missing_fields or action.action=="clarify":
        return clarification(flow,"Bạn bổ sung giúp mình: "+labels(action.missing_fields or ["thông tin công việc"])+"?",action.missing_fields)
    fields=action.fields.model_dump(exclude_unset=True)
    if "category_name" in fields:
        name=fields.pop("category_name")
        category=resolve_category(db,uid,name)
        if category is False:
            return clarification(flow,"Danh mục chưa có. Hãy chọn Học tập, Công việc, Cá nhân hoặc không phân loại.",["category_name"])
        fields["category_id"]=category
    if action.action=="get_tasks":
        filters=action.filters.model_dump(exclude={"category_name"})
        if action.filters.category_name is not None:
            category=resolve_category(db,uid,action.filters.category_name)
            if category is False:
                return clarification(flow,"Bạn muốn tìm trong danh mục nào?",["category_name"])
            filters["category_id"]=category
        tasks=[serialize(t) for t in list_tasks(db,uid,TaskFilters(**filters))]
        if action.reference:
            memory = store.memory(uid)
            ids = ([memory.last_task_id] if action.reference=="last_task" else memory.task_ids) if memory else []
            if not ids:
                return clarification(flow,"Mình không còn biết bạn đang nhắc đến công việc nào. Bạn cho tên hoặc ngày nhé.",["task"])
            tasks = [t for t in tasks if t["id"] in ids]
        store.clear(uid)
        return result("get_tasks",tasks=tasks,message=f"Tìm thấy {len(tasks)} công việc phù hợp.")
    target=None
    if action.action!="create_task":
        if action.task_id is not None:
            # ID is only a hint; all resolution is scoped.
            try:
                target=own_task(db,uid,action.task_id)
            except AppError:
                return clarification(flow,"Không tìm thấy công việc. Bạn cho mình tên hoặc chọn lại?",["task"])
            if action.reference:
                memory=store.memory(uid)
                allowed=([memory.last_task_id] if action.reference=="last_task" else memory.task_ids) if memory else []
                if target.id not in allowed:
                    return clarification(flow,"Công việc được nhắc đến không còn trong ngữ cảnh. Bạn cho tên hoặc chọn lại nhé.",["task"])
            filters=action.filters.model_dump(exclude={"category_name"})
            if action.filters.category_name:
                category=resolve_category(db,uid,action.filters.category_name)
                if category is False:
                    return clarification(flow,"Bạn muốn tìm trong danh mục nào?",["category_name"])
                filters["category_id"]=category
            if target.id not in {t.id for t in list_tasks(db,uid,TaskFilters(**filters))}:
                return clarification(flow,"Công việc đó không khớp các đặc điểm bạn nêu. Bạn chọn lại nhé.",["task"])
        elif (action.task_query and action.task_query.strip()) or action.reference or any(v is not None for v in action.filters.model_dump(exclude_unset=True).values()):
            filters=action.filters.model_dump(exclude={"category_name"})
            if action.filters.category_name:
                cat=resolve_category(db,uid,action.filters.category_name)
                if cat is False:
                    return clarification(flow,"Bạn muốn tìm công việc trong danh mục nào?",["category_name"])
                filters["category_id"]=cat
            # Resolve a semantic reference only inside freshly read recent results.
            # No expired reference may silently fall back to the entire database.
            if action.task_query:
                filters["search"]=action.task_query
            candidates=list_tasks(db,uid,TaskFilters(**filters))
            if not candidates and action.task_query:
                candidates=[t for t in list_tasks(db,uid,TaskFilters(**{k:v for k,v in filters.items() if k!="search"}))
                    if folded(action.task_query) in folded(t.title)]
            if action.reference:
                memory = store.memory(uid)
                ids = ([memory.last_task_id] if action.reference=="last_task" else memory.task_ids) if memory else []
                candidates = [t for t in candidates if t.id in ids]
            if action.task_query:
                exact = [t for t in candidates if folded(t.title)==folded(action.task_query)]
                candidates = exact or [t for t in candidates if folded(action.task_query) in folded(t.title)]
            if len(candidates)==1:
                target=candidates[0]
            elif len(candidates)>1:
                flow.choices=[t.id for t in candidates]
                return clarification(flow,"Có nhiều công việc phù hợp. Bạn chọn công việc muốn thao tác nhé.",["task"],[preview(t) for t in candidates])
        if target is None:
            return clarification(flow,"Bạn muốn thao tác công việc nào? Cho mình tên hoặc ngày cụ thể.",["task"])
        # Resolve once; follow-up keeps the exact selected current-user task.
        flow.draft["task_id"]=target.id
    if action.action=="create_task":
        missing=[k for k in ("title","task_date") if not fields.get(k)]
        if missing:
            return clarification(flow,"Bạn bổ sung giúp mình: "+labels(missing)+"?",missing)
        data=fields
    elif action.action=="update_task":
        if not fields:
            return clarification(flow,"Bạn muốn thay đổi thông tin nào?",["changes"])
        data={key:getattr(target,key) for key in EDITABLE}|fields
    else:
        data=None
    try:
        validated=TaskPayload(**data) if data is not None else None
    except ValidationError as exc:
        missing=[]
        for err in exc.errors():
            missing.extend([str(err["loc"][0])] if err["loc"] else ["start_time","end_time"])
        return clarification(flow,"Thông tin chưa đủ hoặc ngày/giờ không hợp lệ. Bạn kiểm tra lại nhé.",list(dict.fromkeys(missing)))
    # Dry-run is a real read-only checkpoint; no task_service.execute path.
    if not get_settings().chat_execution_enabled:
        store.clear(uid)
        return response("draft","Đã hiểu yêu cầu, chưa thực hiện (chế độ kiểm tra).",action=action.model_dump(mode="json",exclude_unset=True))
    pending={"action":action.action,"task_id":target.id if target else None,
             "expected_version":timestamp(target.updated_at) if target else None,
             "payload":validated.model_dump(mode="json") if validated else None,
             "preview":(serialize(target) | (validated.model_dump(mode="json",exclude={"allow_conflict","expected_version"}) if validated else {})) if target else validated.model_dump(mode="json",exclude={"allow_conflict","expected_version"}),
             "approved_conflicts":None, "previous_task":serialize(target) if target else None}
    category_id=pending['preview'].get('category_id')
    pending['category_label']=next((c.name for c in categories(db,uid) if c.id==category_id),None) if category_id else None
    if action.action=="delete_task":
        flow.pending=pending
        store.touch(flow)
        return response("confirmation",f"Bạn muốn xóa {task_words(pending['preview'])}, đúng không?",context_id=flow.id,action=action.action,task_preview=pending["preview"])
    return execute_pending(db,uid,flow,pending)


def suggest_availability(db,uid,flow,action):
    values=action.availability.model_dump(exclude_unset=True)
    required=("task_date","duration_minutes","start_time","end_time")
    if action.reference=="last_availability":
        memory=store.memory(uid)
        # Resolve only backend-owned criteria, never fabricated/stale slots from AI.
        flow.draft["reference"]=None
        if not memory or not memory.last_availability:
            flow.draft["availability"]={}
            return clarification(flow,"Mình không còn tiêu chí tìm giờ trống trước đó. Bạn cho lại ngày, thời lượng và hai mốc giờ nhé.",list(required))
        values={**memory.last_availability,**values}
        flow.draft["availability"]=AvailabilityRequest(**values).model_dump(mode="json",exclude_unset=True)
    missing=list(dict.fromkeys([*[key for key in required if values.get(key) is None],
        *[key for key in action.missing_fields if key in required]]))
    if missing:
        return clarification(flow,"Để tìm giờ trống, bạn cho mình: "+labels(missing)+
            ". Ví dụ: ngày mai, cần 90 phút, trong khoảng 08:00–18:00.",missing)
    criteria=AvailabilityCriteria(**values)
    now=availability_service.now_in_vietnam()
    if criteria.task_date < now.date():
        return clarification(flow,"Ngày bạn chọn đã qua. Bạn muốn tìm giờ trống hôm nay hay ngày nào sắp tới?",["task_date"])
    window=availability_service.minutes(criteria.end_time)-availability_service.minutes(criteria.start_time)
    if window<=0:
        return clarification(flow,"Khung tìm kiếm cần kết thúc sau khi bắt đầu trong cùng một ngày; chưa hỗ trợ qua đêm. Bạn chọn lại hai mốc giờ nhé.",["start_time","end_time"])
    if criteria.duration_minutes>window:
        return clarification(flow,"Thời lượng bạn cần dài hơn cả khung tìm kiếm. Bạn muốn giảm thời lượng hay mở rộng khung giờ?",["duration_minutes","start_time","end_time"])
    data=availability_service.suggest(db,uid,criteria,now)
    day=criteria.task_date.strftime("%d/%m/%Y")
    count=len(data['slots'])
    message=(f"Có {count} khung giờ gợi ý, mỗi khung {criteria.duration_minutes} phút, ngày {day}."
        if count else f"Chưa có khoảng trống đủ {criteria.duration_minutes} phút ngày {day} trong khung bạn chọn. Bạn có thể thử thời lượng ngắn hơn hoặc khung giờ khác.")
    message+=" Đây chỉ là gợi ý, chưa tạo công việc hay giữ chỗ."
    store.clear(uid)
    return response("availability",message,action="suggest_free_slots",**data)


def execute_pending(db,uid,flow,pending):
    action=pending["action"]
    service_action="status" if action=="complete_task" else action
    payload=StatusPayload(status="completed") if action=="complete_task" else TaskPayload(**pending["payload"]) if pending["payload"] else None
    try:
        task,changed=execute(db,uid,service_action,payload,pending["task_id"],pending["expected_version"],pending["approved_conflicts"])
    except AppError as exc:
        if exc.code=="TASK_CONFLICT":
            pending["approved_conflicts"]=exc.details["versions"]
            flow.pending=pending
            store.touch(flow)
            blockers=exc.details["conflicting_tasks"]
            pending["blockers"]=blockers
            names=", ".join(f"“{t['title']}” ({t['start_time']}–{t['end_time']})" for t in blockers[:3])
            return response("conflict",f"{task_words(pending['preview'])} đang trùng với {names}. Bạn muốn giữ cả hai lịch hay hủy yêu cầu này?",context_id=flow.id,
                action=action,task_preview=pending["preview"],previous_task=pending.get("previous_task"),conflicting_tasks=blockers)
        if exc.code in ("TASK_CHANGED","NOT_FOUND"):
            store.clear(uid)
            if exc.code=="NOT_FOUND":
                raise AppError(409,"TASK_CHANGED","Công việc không còn tồn tại. Hãy gửi lại yêu cầu.") from None
        raise
    store.clear(uid)
    verbs={"create_task":"Đã thêm", "update_task":"Đã sửa", "complete_task":"Đã đánh dấu hoàn thành", "delete_task":"Đã xóa"}
    message=(f"{verbs[action]} {task_words(task or pending['preview'])}." if changed else
        f"{task_words(task or pending['preview'])} đã ở trạng thái này; không có thay đổi mới.")
    if task and task.get("category_id"):
        category=pending.get('category_label')
        if category:
            message=message.rstrip(".")+f", danh mục {category}."
    if changed and action=="update_task" and pending.get("previous_task"):
        changed_fields=[key for key in EDITABLE if pending["previous_task"].get(key)!=task.get(key)]
        field_labels={**LABELS,"description":"ghi chú","category_id":"danh mục"}
        message+=" Thông tin đã đổi: "+", ".join(field_labels.get(key,key) for key in changed_fields)+"."
    return result(action,task=task,mutated=changed,message=message)


def confirm(db,uid,payload):
    with store.guard(uid):
        flow=store.get(uid,payload.context_id)
        if payload.decision=="cancel":
            store.clear(uid,forget=flow.pending is None)
            answer=result("cancel",message="Đã hủy yêu cầu, công việc được giữ nguyên.")
        else:
            if flow.pending is None:
                raise AppError(400,"BUSINESS_RULE_ERROR","Ngữ cảnh này không có hành động cần xác nhận")
            answer=execute_pending(db,uid,flow,flow.pending)
        store.remember(uid, "", answer)
        return answer


def recover(uid, db=None):
    """Read-only recovery of a live flow; never recreate an expired action."""
    with store.guard(uid):
        flow=store.peek(uid)
        if not flow:
            return None
        if flow.pending:
            pending=flow.pending
            kind="confirmation" if pending["action"]=="delete_task" else "conflict"
            return response(kind,"Yêu cầu trước vẫn đang chờ. Kiểm tra lại trước khi xác nhận hoặc hủy.",
                context_id=flow.id,action=pending["action"],task_preview=pending["preview"],
                previous_task=pending.get("previous_task"),
                **({"conflicting_tasks":pending.get("blockers", [])} if kind=="conflict" else {}))
        choices=[]
        if db is not None and flow.choices:
            tasks=db.scalars(select(Task).where(Task.user_id==uid,Task.id.in_(flow.choices))).all()
            tasks.sort(key=lambda t:flow.choices.index(t.id))
            choices=[preview(task) for task in tasks]
        return response("clarification",flow.question or "Bạn có thể tiếp tục yêu cầu đang dở.",
            context_id=flow.id,missing_fields=flow.missing,choices=choices)
