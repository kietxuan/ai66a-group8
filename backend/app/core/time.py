from datetime import datetime
from zoneinfo import ZoneInfo

BUSINESS_TZ = ZoneInfo("Asia/Ho_Chi_Minh")

def local_now():
    return datetime.now(BUSINESS_TZ)

def business_today():
    return local_now().date()
