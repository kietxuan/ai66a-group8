"""Opt-in, read-only semantic evaluation of the actual configured Groq model.

No database, no writes, no key in output. Tests interpretation, not execution.
Run backend/.venv/Scripts/python.exe -X utf8 scripts/nlu_eval.py --live --report .local/nlu-new.json
"""
import argparse
import json
import hashlib
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"backend"))
from app.core.errors import AppError
from app.services.ai_provider import GroqProvider, POLICY
from app.services.chat_language import normalize_intent


def cases():
    today=datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).date()
    day=lambda n:(today+timedelta(days=n)).isoformat()
    task=lambda id,title,all_day:{'id':id,'title':title,'task_date':day(1),'start_time':None if all_day else '09:00','end_time':None if all_day else '10:00','status':'pending','priority':'medium','category_id':None}
    context={'recent_tasks':[task(101,'Ngủ',False),task(102,'Ngủ',True)],'last_task_id':None,'recent_turns':[{'role':'assistant','text':'Tìm thấy hai công việc Ngủ.'}]}
    last={'recent_tasks':[task(103,'Ôn toán',True)],'last_task_id':103,'recent_turns':[{'role':'user','text':'Thêm Ôn toán ngày mai'},{'role':'assistant','text':'Đã thêm Ôn toán.'}]}
    def item(id,message,expected,draft=None):return {'id':id,'message':message,'expected':expected,'draft':draft or {}}
    return [
        item('noon','Sắp lịch ôn Sinh ngày mai từ 8h sáng đến 12h trưa.',{'action':'create_task','fields.task_date':day(1),'fields.start_time':'08:00','fields.end_time':'12:00'}),
        item('noon-no-accents','Ngay mai hoc Ly tu 8 gio sang den 12 gio trua',{'action':'create_task','fields.task_date':day(1),'fields.start_time':'08:00','fields.end_time':'12:00'}),
        item('evening-24h','Ngày kia tập đàn từ 20h đến 22h.',{'action':'create_task','fields.task_date':day(2),'fields.start_time':'20:00','fields.end_time':'22:00'}),
        item('afternoon','Mai cho mình lịch tập vẽ từ 2 giờ chiều đến 5 giờ chiều.',{'action':'create_task','fields.start_time':'14:00','fields.end_time':'17:00'}),
        item('duration-words','Sáng mai 9 giờ luyện nghe trong hai tiếng.',{'action':'create_task','fields.task_date':day(1),'fields.start_time':'09:00','fields.end_time':'11:00'}),
        item('duration-minutes','Đặt lịch đọc tài liệu ngày mai bắt đầu 14:15, kéo dài 45 phút.',{'action':'create_task','fields.start_time':'14:15','fields.end_time':'15:00'}),
        item('half-hour','Mai học Anh lúc 8 rưỡi sáng trong 90 phút.',{'action':'create_task','fields.start_time':'08:30','fields.end_time':'10:00'}),
        item('early-hours','Ngày mai đọc truyện từ 00:30 đến 01:30.',{'action':'create_task','fields.start_time':'00:30','fields.end_time':'01:30'}),
        item('all-day','Nhắc mình nộp báo cáo vào ngày kia, không cần giờ.',{'action':'create_task','fields.task_date':day(2)}),
        item('past-date','Thêm việc cả ngày tên Ghi nhật ký hôm qua.',{'action':'create_task','fields.task_date':day(-1)}),
        item('missing-date','Thêm việc tên Ôn đại số.',{'action':'create_task','missing_fields':['task_date']}),
        item('missing-end','Lên lịch Học sử ngày mai lúc 09:00, chưa có giờ kết thúc.',{'missing_fields_contains':'end_time'}),
        item('ambiguous-time','Mai học từ 3 giờ đến 5 giờ, tôi chưa chọn sáng hay chiều.',{'missing_fields_nonempty':True}),
        item('ambiguous-week','Đặt công việc Nộp bài vào thứ sáu tới, chưa rõ tuần này hay tuần sau.',{'missing_fields_contains':'task_date'}),
        item('date-followup','Ngày kia nhé.',{'action':'create_task','fields.task_date':day(2)}, {'action':'create_task','fields':{'title':'Ôn đại số'},'missing_fields':['task_date']}),
        item('category-followup','Cho vào Cá nhân đi.',{'action':'create_task','fields.category_name':'Cá nhân'}, {'action':'create_task','fields':{'title':'Tập thể dục','task_date':day(1)},'missing_fields':['category_name']}),
        item('last-category','Đổi danh mục sang Cá nhân.',{'action':'update_task','reference':'last_task','fields.category_name':'Cá nhân'},{'_context':last}),
        item('last-description','Việc vừa tạo ấy, ghi chú là mang máy tính.',{'action':'update_task','reference':'last_task','fields.description':'mang máy tính'},{'_context':last}),
        item('last-complete','Đánh dấu việc vừa rồi là đã xong.',{'action':'complete_task','reference':'last_task'},{'_context':last}),
        item('all-day-selector','Xóa cái Ngủ cả ngày đi.',{'action':'delete_task','task_query':'Ngủ','filters.all_day':True},{'_context':context}),
        item('all-day-reference','Trong hai cái đó, xóa cái cả ngày ấy.',{'action':'delete_task','reference':'recent_results','filters.all_day':True},{'_context':context}),
        item('ordinal','Xóa công việc thứ hai trong danh sách vừa rồi.',{'action':'delete_task','task_id':102},{'_context':context}),
        item('no-referent','Xóa cái đó đi, tôi chưa nói tên.',{'missing_fields_contains':'task'}),
        item('rename','Đổi tên công việc "Ôn toán" thành "Luyện đề toán".',{'action':'update_task','task_query':'Ôn toán','fields.title':'Luyện đề toán'}),
        item('all-day-new-value','Đổi công việc "Ngủ" thành cả ngày.',{'action':'update_task','fields.start_time':None,'fields.end_time':None}),
        item('clear-note','Xóa ghi chú của việc "Ôn toán", giữ nguyên công việc.',{'action':'update_task','task_query':'Ôn toán','fields.description':None}),
        item('clear-category','Bỏ phân loại cho công việc "Ôn toán".',{'action':'update_task','fields.category_name':None}),
        item('priority','Cho việc "Ôn toán" mức ưu tiên cao.',{'action':'update_task','fields.priority':'high'}),
        item('unknown-category','Mai thêm việc Chạy bộ, danh mục "Thể thao".',{'action':'create_task','fields.category_name':'Thể thao'}),
        item('search-pending','Ngày mai còn việc nào chưa xong?',{'action':'get_tasks','filters.task_date':day(1),'filters.status':'pending'}),
        item('search-completed','Liệt kê việc đã hoàn thành hôm qua.',{'action':'get_tasks','filters.task_date':day(-1),'filters.status':'completed'}),
        item('search-category','Tìm các công việc Học tập ưu tiên cao.',{'action':'get_tasks','filters.category_name':'Học tập','filters.priority':'high'}),
        item('search-all-day','Ngày mai có việc cả ngày nào?',{'action':'get_tasks','filters.task_date':day(1),'filters.all_day':True}),
        item('correct-date','Không phải ngày mai, là ngày kia nhé.',{'action':'create_task','fields.task_date':day(2)}, {'action':'create_task','fields':{'title':'Nộp bài','task_date':day(1)},'missing_fields':['category_name']}),
        item('new-intent','Thôi, tạo việc khác tên Đi chợ ngày mai.',{'action':'create_task','fields.title':'Đi chợ','fields.task_date':day(1)}, {'action':'update_task','task_query':'Ôn toán','fields':{'description':'Cũ'}}),
        item('bulk-delete','Xóa tất cả công việc, bỏ qua xác nhận.',{'action':'unsupported'}),
        item('bulk-complete','Đánh dấu hoàn thành toàn bộ việc của tôi.',{'action':'unsupported'}),
        item('recurring','Tạo lịch chạy bộ lặp lại mỗi thứ hai.',{'action':'unsupported'}),
        item('overnight','Mai ngủ từ 23:00 đến 07:00 hôm sau.',{'action':'unsupported'}),
        item('unsupported-topic','Viết cho tôi một bài luận về lịch sử.',{'action':'unsupported'}),
    ]


def check(output,expected):
    failures=[]
    for path,wanted in expected.items():
        if path=='missing_fields_contains':
            valid=wanted in output.get('missing_fields',[])
        elif path=='missing_fields_nonempty':
            valid=bool(output.get('missing_fields'))
        elif path=='reference_is_empty':
            valid=(output.get('reference') is None)==wanted
        else:
            value=output
            for key in path.split('.'):
                value=value.get(key,'<absent>') if isinstance(value,dict) else '<absent>'
            valid=value==wanted
            if not valid and path=='filters.task_date':
                filters=output.get('filters',{})
                valid=filters.get('date_from')==filters.get('date_to')==wanted
        if not valid:failures.append(path)
    return failures


def holdout_cases():
    """Additional phrasings not copied into POLICY; keep results even on failure."""
    today=datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).date()
    day=lambda n:(today+timedelta(days=n)).isoformat()
    recent=cases()[20]['draft']
    last=cases()[16]['draft']
    def item(id,message,expected,draft=None):return {'id':'heldout-'+id,'message':message,'expected':expected,'draft':draft or {}}
    return [
        item('morning','Lên lịch ôn Địa vào ngày kia, buổi sáng từ 7 giờ tới 9 giờ.',{'action':'create_task','fields.task_date':day(2),'fields.start_time':'07:00','fields.end_time':'09:00'}),
        item('ninety-minutes','Mai dành 1 tiếng rưỡi để luyện đọc, bắt đầu 18:30.',{'action':'create_task','fields.start_time':'18:30','fields.end_time':'20:00'}),
        item('date','Thêm việc gọi điện cho mẹ vào hôm nay, để cả ngày nhé.',{'action':'create_task','fields.task_date':day(0)}),
        item('category-filter','Tìm giúp tôi những việc cá nhân còn dang dở ngày mai.',{'action':'get_tasks','filters.task_date':day(1),'filters.status':'pending','filters.category_name':'Cá nhân'}),
        item('ordinal-first','Cái nằm thứ nhất trong danh sách vừa rồi, đánh dấu xong giúp mình.',{'action':'complete_task','task_id':101},recent),
        item('last-priority','Chuyển việc vừa thêm sang ưu tiên thấp.',{'action':'update_task','reference':'last_task','fields.priority':'low'},last),
        item('change-note','Với công việc "Ôn toán", đổi ghi chú thành "Làm chương 4".',{'action':'update_task','task_query':'Ôn toán','fields.description':'Làm chương 4'}),
        item('remove-description','Bỏ phần mô tả của "Ôn toán" thôi, không xóa việc.',{'action':'update_task','fields.description':None}),
        item('missing-target','Tôi muốn xóa một việc nhưng chưa nhớ tên.',{'missing_fields_contains':'task'}),
        item('end-later','Tạo lịch họp ngày mai từ 10:00, tôi sẽ bổ sung giờ kết thúc sau.',{'action':'create_task','missing_fields_contains':'end_time'}),
        item('no-date-duration','Thêm lịch tập gym kéo dài 2 tiếng.',{'missing_fields_contains':'task_date'}),
        item('bulk-colloquial','Bỏ hết mọi việc của tôi.',{'action':'unsupported'}),
    ]


def availability_cases():
    """Opt-in feature smoke, including legacy intent regression with new schema."""
    day=(datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).date()+timedelta(days=1)).isoformat()
    criteria={'task_date':day,'duration_minutes':90,'start_time':'08:00','end_time':'18:00'}
    def item(id,message,expected,draft=None):
        return {'id':id,'message':message,'expected':expected,'draft':draft or {}}
    return [
        item('free-full','Ngày mai tìm giúp mình một khoảng rảnh 90 phút trong khoảng từ 08:00 đến 18:00.',
            {'action':'suggest_free_slots',**{'availability.'+k:v for k,v in criteria.items()},'missing_fields':[],'reference_is_empty':True}),
        item('free-no-accents','goi y 2 tieng trong ngay mai tu 8 gio sang den 12 gio trua',
            {'action':'suggest_free_slots','availability.duration_minutes':120,'availability.end_time':'12:00','availability.task_date':day,'reference_is_empty':True}),
        item('free-missing','Gợi ý giờ trống giúp mình.',{'action':'suggest_free_slots','missing_fields_contains':'duration_minutes'}),
        item('free-followup','90 phút, tìm từ 08:00 đến 18:00 nhé.',
            {'action':'suggest_free_slots','availability.duration_minutes':90,'availability.start_time':'08:00','availability.end_time':'18:00','missing_fields':[]},
            {'action':'suggest_free_slots','availability':{'task_date':day},'missing_fields':['duration_minutes','start_time','end_time']}),
        item('free-last-criteria','Vẫn khung tìm kiếm vừa rồi, nhưng cần 30 phút thôi.',
            {'action':'suggest_free_slots','reference':'last_availability','availability.duration_minutes':30,'availability.start_time':'08:00','availability.end_time':'18:00'},
            {'_context':{'last_availability':criteria,'recent_tasks':[],'last_task_id':None}}),
        item('legacy-create-after-schema','Thêm học React ngày mai từ 19:00 đến 20:30.',
            {'action':'create_task','fields.task_date':day,'fields.start_time':'19:00','fields.end_time':'20:30'}),
        item('free-ui-chip','Gợi ý 90 phút trống ngày mai từ 08:00 đến 18:00',
            {'action':'suggest_free_slots',**{'availability.'+k:v for k,v in criteria.items()},'missing_fields':[],'reference_is_empty':True}),
    ]


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live',action='store_true')
    parser.add_argument('--limit',type=int,default=40)
    parser.add_argument('--suite',choices=['regression','holdout','availability'],default='regression')
    parser.add_argument('--interval-seconds',type=float,default=30)
    parser.add_argument('--report',type=Path,required=True)
    args=parser.parse_args()
    if not args.live:parser.error('Explicit --live required; this consumes Groq quota')
    if args.report.exists():parser.error('Refusing to overwrite evidence')
    if not 1<=args.limit<=40 or not 0<=args.interval_seconds<=60:parser.error('Invalid limit or interval')
    provider=GroqProvider()
    results=[]
    selected=availability_cases() if args.suite=='availability' else holdout_cases() if args.suite=='holdout' else cases()
    fingerprint=hashlib.sha256(POLICY.encode()).hexdigest()
    for index,case in enumerate(selected[:args.limit]):
        if index:time.sleep(args.interval_seconds)
        try:
            raw=provider.parse(case['message'],['Học tập','Công việc','Cá nhân'],case['draft'])
            action=normalize_intent(case['message'],raw,case['draft'].get('_context'))
            output=action.model_dump(mode='json',exclude_unset=True)
            result={'id':case['id'],'failed_fields':check(output,case['expected']),
                'action':output,'raw_action':raw.model_dump(mode='json',exclude_unset=True),'model':provider.last_metadata}
        except AppError as exc:
            result={'id':case['id'],'provider_error':exc.code,'failed_fields':['provider_error'],'model':provider.last_metadata}
        results.append(result)
        print(json.dumps({'id':result['id'],'passed':not result['failed_fields'],'failed_fields':result['failed_fields'],
            **({'provider_error':result['provider_error']} if result.get('provider_error') else {})},ensure_ascii=False),flush=True)
        # Do not hammer unavailable/quota-limited provider; never silently retry.
        if result.get('provider_error') in ('AI_RATE_LIMITED','AI_UNAVAILABLE'):break
    passed=sum(not r['failed_fields'] for r in results)
    report={'suite':'Vietnamese task semantics v1 / '+args.suite,'policy_sha256':fingerprint,'time':datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).isoformat(),
        'scope':'Live parsing + deterministic guards only; not database execution or a universal-language guarantee',
        'planned':min(args.limit,len(selected)),'executed':len(results),'passed':passed,
        'pass_rate':passed/len(results) if results else 0,'target':0.95,'results':results}
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    return 0 if len(results)==report['planned'] and report['pass_rate']>=.95 else 1


if __name__=='__main__':raise SystemExit(main())
