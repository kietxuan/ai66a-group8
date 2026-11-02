FROM python:3.11-slim

# Biến môi trường giúp Python không tạo .pyc và print log ngay lập tức
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Cài đặt dependencies hệ thống nếu cần (VD: libpq-dev cho psycopg2)
RUN apt-get update \
    && apt-get -y install libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements và cài đặt
COPY requirements.txt /app/
# Nếu bạn đã bỏ comment các thư viện trong requirements.txt, hãy chạy lệnh dưới:
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ source code
COPY . /app/

# Giăng bệ phóng Entrypoint (Mỗi lần boot container đều phải đi qua đây)
ENTRYPOINT ["sh", "/app/entrypoint.sh"]

# Khởi chạy server FastAPI bằng Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
