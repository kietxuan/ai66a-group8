# Gợi ý giờ trống

## Cách dùng

Mở Chat và gửi ví dụ:

- “Gợi ý 90 phút trống ngày mai từ 08:00 đến 18:00.”
- “Tìm giúp mình 2 tiếng rảnh ngày mai từ 8h sáng đến 12h trưa.”
- “Hôm nay trong khoảng 14:00–20:00 có lúc nào rảnh 45 phút không?”

Nếu chỉ nói “Gợi ý giờ trống”, trợ lý hỏi ngày, thời lượng và hai mốc giờ. Có thể trả lời lần lượt trong vòng 10 phút không tương tác. Không mặc định giờ làm việc/ngày/thời lượng. Sau kết quả, câu như “Vẫn khung đó nhưng cần 30 phút” dùng lại tiêu chí trong RAM, đọc lại lịch chứ không dùng slot cũ. Model có thể hiểu sai: xem lại ngày/giờ/thời lượng trên thẻ, diễn đạt rõ nếu cần; không bảo đảm hiểu mọi câu.

Sau cập nhật source, từ root PowerShell:

```powershell
.\scripts\dev.ps1 -StartLocalDatabase -Build
```

Chờ Uvicorn running, mở http://127.0.0.1:8000, đăng nhập rồi chọn Trợ lý. Giữ terminal chạy. Nếu bản dist mới đã build thì lần mở sau không cần `-Build`. Không cần migration/dependency/key/model mới; backend phải restart để nhận schema/prompt mới.

## Quy tắc

- Một ngày hôm nay/tương lai, trong cùng ngày, HH:MM, tối đa 23:59. Không qua đêm/đa ngày/recurring. Thời lượng nguyên 1–1439 phút, không dài hơn khung tìm.
- Chỉ task pending có đủ hai giờ chặn. Task cả ngày/completed không chặn, đúng conflict policy đã chốt. Không suy luận giờ ngủ/đi lại/working hours.
- Tối đa ba khung sớm nhất, mỗi khung vừa đúng thời lượng, không chồng nhau. Một khoảng trống dài có thể cho nhiều lựa chọn liên tiếp. Nếu còn slot khác sẽ ghi rõ; không phải danh sách mọi khoảng rảnh trong ngày.
- Hôm nay bỏ phần đã qua, làm tròn lên phút nếu đang giữa phút. Không còn khoảng đủ dài thì báo không có, không bịa slot.
- Backend tính từ PostgreSQL, không đưa lịch toàn bộ vào model hoặc để model quyết định giờ thật sự trống. Không đổi task/updated_at, không giữ chỗ, không tự tạo/dời/hoàn thành task.
- Muốn đặt lịch: gửi yêu cầu mới đầy đủ, ví dụ “Thêm Ôn toán ngày mai từ 10:00 đến 11:30”. Hệ thống kiểm tra conflict lại; kết quả gợi ý trước đó không cấp quyền bỏ kiểm tra.
- Ngữ cảnh/tiêu chí trong RAM theo user, TTL 10 phút; không history database/localStorage. Logout/restart/expiry không thực hiện bản nháp cũ. Không hỗ trợ “đặt khung đầu tiên” tự động trong đợt này.

## Kiểm tra thủ công

Dùng dữ liệu test của chính bạn, chọn **ngày mai**. Không xóa/sửa task thật chỉ để thử.

1. Trong Todo tạo “Bận thử nghiệm” 09:00–10:00 ngày mai. Qua Chat hỏi “Gợi ý 60 phút trống ngày mai từ 08:00 đến 12:00”. Mong đợi 08–09, 10–11, 11–12; không có 09–10. Todo/Calendar không tự thêm việc mới.
2. Tạo task cả ngày cùng ngày và task 08–09, đánh dấu task 08–09 đã hoàn thành. Hỏi lại: vẫn có 08–09. Task completed/cả ngày vẫn hiện trên Calendar nhưng không chặn slot.
3. Khi có nhiều giờ rảnh, hỏi khung dài hơn: chỉ tối đa ba lựa chọn, có nhãn còn lựa chọn nếu thực sự còn. Rút ngắn khung để kiểm tra exact fit, ví dụ cần 60 phút trong 11–12.
4. Hỏi “Gợi ý giờ trống”. Trả lời ngày mai → 90 phút → từ 08:00 đến 18:00. Trợ lý giữ tiêu chí đã nêu, không tạo một task cả ngày. Reload giữa clarification có thể phục hồi câu hỏi còn TTL; Bắt đầu yêu cầu khác phải hủy draft.
5. Sau kết quả, nói “Vẫn khung tìm kiếm vừa rồi, nhưng cần 30 phút”. Thẻ phải ghi đúng thời lượng mới và ngày/khung cũ; mọi slot tính lại. Nếu model hiểu thiếu, yêu cầu hỏi rõ, không tự ghi task.
6. Tạo task chặn toàn bộ một khung, hỏi thời lượng vừa khung đó: báo không có. Hoàn thành task chặn rồi hỏi lại: slot xuất hiện. Đổi/sửa bằng UI phải được tính ở lần hỏi mới, không cache slot.
7. Hỏi hôm nay với khung đã qua hoặc khung đang diễn ra: không slot quá khứ; khi cần, thẻ ghi mốc bắt đầu thực tế. Giờ trưa 12:00 không phải 00:00; các thẻ dùng giờ Việt Nam.
8. Ngày quá khứ, giờ kết thúc trước/bằng bắt đầu, thời lượng dài hơn khung: hỏi điều chỉnh, không báo tìm thành công/không tạo task. “Buổi sáng” chưa có hai mốc rõ ràng phải hỏi giờ.
9. Hỏi gợi ý trong lúc một yêu cầu xóa/conflict đang chờ: phải xác nhận/hủy flow cũ trước. Không dùng câu hỏi giờ rảnh làm xác nhận xóa.
10. Sau khi thấy slot, tạo một việc khác trùng slot đó bằng Todo, rồi yêu cầu Chat thêm việc mới vào slot cũ. Phải có conflict, không tin slot cũ là reservation.
11. Đăng nhập tài khoản test thứ hai: lịch tài khoản đầu không ảnh hưởng/lộ trong gợi ý. Logout/đăng nhập lại không còn criteria/memory của user cũ.
12. Kiểm tra sáng/tối, mobile: thẻ ngày/giờ đủ đọc, danh sách và ô nhập cuộn được, không tràn ngang, không nút đặt lịch giả. Thử thêm bàn phím Android/iOS thật nếu có thiết bị.

## Kiểm thử kỹ thuật

`backend/tests/test_availability.py` kiểm tra thuật toán (có 250 bộ so với minute-grid độc lập), read-only, owner/status/all-day, boundary/merge, missing/follow-up, TTL/confirmation, thời gian VN và conflict sau gợi ý. Provider strict schema và UI render/không tự gửi/không refresh được kiểm tra riêng. Tests dùng PostgreSQL `_test`, không Groq thật.

Smoke model thật có chủ đích, chỉ parse, tiêu quota, không DB và không tự retry:

```powershell
.\backend\.venv\Scripts\python.exe -X utf8 scripts/nlu_eval.py --live --suite availability --limit 7 --interval-seconds 25 --report .local/nlu-availability-new.json
```

Report phải chưa tồn tại để giữ evidence. Không coi parser smoke là bằng chứng mọi tình huống hoặc reservation/execution đã chạy; checks thực tế, lỗi và gate tại [PROGRESS](PROGRESS.md).
