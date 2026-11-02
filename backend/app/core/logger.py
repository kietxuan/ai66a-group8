import logging
import sys

def setup_logging():
    log_formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(filename)s:%(lineno)d - %(message)s"
    )
    
    logger = logging.getLogger("app_logger")
    logger.setLevel(logging.INFO)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(log_formatter)
    logger.addHandler(console_handler)

    # Lưu lại các thay đổi
    file_handler = logging.FileHandler("app.log", encoding="utf-8")
    file_handler.setFormatter(log_formatter)
    logger.addHandler(file_handler)
    
    return logger

# Khởi tạo instance dùng chung cho toàn dự án
logger = setup_logging()
