import asyncio
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from redis.asyncio import Redis

from app.core.config import settings
from app.core.logger import logger
from app.schemas.otp_schema import OTPErrors


async def verify_action_token(email: str, reason: str, token: str, redis: Redis) -> None:
    """Hàm kiểm tra OTP đã được xác thực hay chưa"""
    token_key = f"verified-token:{reason}:{email}"
    saved_token = await redis.get(token_key)

    if not saved_token:
        raise OTPErrors.OTP_EXPIRED.throw()

    saved_str = saved_token.decode("utf-8") if isinstance(saved_token, bytes) else str(saved_token)
    if saved_str != token:
        raise OTPErrors.OTP_EXPIRED.throw()

    await redis.delete(token_key)


def _get_otp_html_content(otp: str, reason: str = "verify-email") -> tuple[str, str]:
    """Trả về (Tiêu đề email, Nội dung HTML email) cho xác minh tài khoản hoặc quên mật khẩu"""
    if reason in ("change-password", "reset-password", "forgot-password"):
        subject = "Mã OTP Đặt lại mật khẩu - Planify Pro"
        title = "Yêu cầu đặt lại mật khẩu"
        description = (
            "Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>Planify Pro</strong> của bạn. "
            "Vui lòng nhập mã OTP 6 chữ số bên dưới để xác nhận và thiết lập mật khẩu mới:"
        )
    else:
        subject = "Mã OTP Xác thực đăng ký tài khoản - Planify Pro"
        title = "Xác thực tài khoản của bạn"
        description = (
            "Cảm ơn bạn đã đăng ký sử dụng <strong>Planify Pro</strong>. "
            "Vui lòng sử dụng mã OTP 6 chữ số bên dưới để hoàn tất việc xác thực email đăng ký tài khoản:"
        )

    html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        body {{
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #334155;
            line-height: 1.6;
        }}
        .wrapper {{
            width: 100%;
            table-layout: fixed;
            background-color: #f8fafc;
            padding: 40px 0;
        }}
        .container {{
            max-width: 540px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
            border: 1px solid #e2e8f0;
        }}
        .header {{
            background: linear-gradient(135deg, #4f46e5 0%, #2563eb 100%);
            padding: 28px 20px;
            text-align: center;
        }}
        .header h1 {{
            color: #ffffff;
            margin: 0;
            font-size: 22px;
            font-weight: 800;
            letter-spacing: 0.5px;
        }}
        .content {{
            padding: 36px 30px;
        }}
        .greeting {{
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 14px;
            color: #0f172a;
        }}
        .text {{
            font-size: 15px;
            color: #475569;
            margin-bottom: 26px;
        }}
        .otp-container {{
            background-color: #eff6ff;
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            margin-bottom: 26px;
            border: 1.5px dashed #93c5fd;
        }}
        .otp-code {{
            font-family: "Courier New", Courier, monospace;
            font-size: 36px;
            font-weight: 800;
            letter-spacing: 8px;
            color: #1d4ed8;
            margin: 0;
            display: inline-block;
        }}
        .meta-info {{
            font-size: 13px;
            color: #64748b;
            text-align: center;
            margin-bottom: 20px;
        }}
        .warning {{
            font-size: 13px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 18px;
            margin-top: 18px;
        }}
        .footer {{
            background-color: #f8fafc;
            padding: 18px;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
        }}
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <h1>✨ Planify Pro</h1>
            </div>
            <div class="content">
                <div class="greeting">Xin chào,</div>
                <div class="text">
                    {description}
                </div>
                <div class="otp-container">
                    <div class="otp-code">{otp}</div>
                </div>
                <div class="meta-info">
                    Mã xác thực này có hiệu lực trong vòng <strong>5 phút</strong>.
                </div>
                <div class="warning">
                    Nếu bạn không yêu cầu thực hiện hành động này, vui lòng bỏ qua email này.
                </div>
            </div>
            <div class="footer">
                &copy; 2026 Planify Pro. All rights reserved.
            </div>
        </div>
    </div>
</body>
</html>
"""
    return subject, html


def _get_reminder_html_content(
    user_name: str,
    task_title: str,
    time_display: str,
    note: str = "",
    location: str = "",
    minutes_before: int = 15
) -> tuple[str, str]:
    """Trả về (Tiêu đề email, Nội dung HTML email) cho thông báo nhắc lịch hẹn / công việc"""
    subject = f"⏰ Nhắc lịch: {task_title} ({time_display}) - Planify Pro"
    note_block = f'<p style="margin:8px 0 0;color:#475569;font-size:14px;"><strong>📝 Ghi chú:</strong> {note}</p>' if note else ""
    loc_block = f'<p style="margin:8px 0 0;color:#475569;font-size:14px;"><strong>📍 Địa điểm:</strong> {location}</p>' if location else ""

    html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#334155;">
    <div style="width:100%;background-color:#f8fafc;padding:36px 0;">
        <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(15,23,42,0.06);">
            <div style="background:linear-gradient(135deg,#4f46e5 0%,#2563eb 100%);padding:24px 20px;text-align:center;">
                <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:800;">⏰ Nhắc Lịch Hẹn & Công Việc</h1>
            </div>
            <div style="padding:32px 28px;">
                <p style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 12px;">Xin chào {user_name or 'bạn'},</p>
                <p style="font-size:15px;color:#475569;margin:0 0 20px;">
                    Bạn có một lịch hẹn / công việc sắp diễn ra (nhắc trước <strong>{minutes_before} phút</strong>):
                </p>
                <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:8px;padding:18px 20px;margin-bottom:24px;">
                    <div style="font-size:18px;font-weight:800;color:#1e3a8a;margin-bottom:6px;">📌 {task_title}</div>
                    <div style="font-size:14px;font-weight:600;color:#2563eb;">🕒 Thời gian: {time_display}</div>
                    {loc_block}
                    {note_block}
                </div>
                <p style="font-size:13px;color:#64748b;margin:0;">
                    Bạn có thể mở <strong>Planify Pro</strong> để xem chi tiết hoặc điều chỉnh cài đặt thông báo bất cứ lúc nào.
                </p>
            </div>
            <div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;">
                &copy; 2026 Planify Pro — Hệ thống quản lý Công việc & Lịch trình thông minh.
            </div>
        </div>
    </div>
</body>
</html>
"""
    return subject, html


def _send_email_sync(to_email: str, subject: str, html_content: str, debug_tag: str = "") -> bool:
    """Hàm gửi email đồng bộ chạy trong thread pool qua Gmail SMTP"""
    sender_email = (settings.ADMIN_EMAIL or "").strip()
    raw_password = (settings.ADMIN_PASSWORD or "").strip()
    # Gmail App Password thường có dạng 'xxxx xxxx xxxx xxxx' -> loại bỏ khoảng trắng để đăng nhập SMTP chuẩn xác
    sender_password = raw_password.replace(" ", "")

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"Planify Pro <{sender_email}>"
    message["To"] = to_email

    part = MIMEText(html_content, "html", "utf-8")
    message.attach(part)

    try:
        if not sender_email or not sender_password or raw_password in ["YOUR_SECRET_PASSWORD", "MAT_KHAU_ADMIN"]:
            logger.info(f"📧 [DEV EMAIL] Gửi tới {to_email} | Tiêu đề: {subject} | Nội dung: {debug_tag}")
            return False

        server = smtplib.SMTP("smtp.gmail.com", 587, timeout=8.0)
        server.starttls()
        server.login(sender_email, sender_password)
        server.send_message(message)
        server.quit()
        logger.info(f"✅ Đã gửi email '{subject}' tới {to_email} thành công.")
        return True
    except Exception as e:
        logger.warning(f"⚠️ Không thể gửi SMTP thực tế ({e}). 📧 [DEV FALLBACK] {to_email}: {debug_tag}")
        return False


async def send_email(email: str, otp: str, reason: str = "verify-email") -> bool:
    """Hàm gửi mã OTP cho người dùng bất đồng bộ"""
    subject, html_content = _get_otp_html_content(otp, reason=reason)
    return await asyncio.to_thread(_send_email_sync, email, subject, html_content, f"OTP={otp}")


async def send_reminder_email(
    to_email: str,
    user_name: str,
    task_title: str,
    time_display: str,
    note: str = "",
    location: str = "",
    minutes_before: int = 15
) -> bool:
    """Hàm gửi email thông báo nhắc lịch hẹn / công việc khi tới giờ"""
    subject, html_content = _get_reminder_html_content(
        user_name=user_name,
        task_title=task_title,
        time_display=time_display,
        note=note,
        location=location,
        minutes_before=minutes_before
    )
    return await asyncio.to_thread(
        _send_email_sync,
        to_email,
        subject,
        html_content,
        f"REMINDER={task_title} @ {time_display}"
    )
