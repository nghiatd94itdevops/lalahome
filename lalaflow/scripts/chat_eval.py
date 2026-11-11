"""Bộ kiểm tra trợ lý AI: các tình huống lấy từ câu hỏi thật của khách, chấm đạt/không đạt tự động.

Gọi thẳng backend (mặc định http://localhost:4000/chat), mỗi lượt một phiên "zztest-eval-…" để không lẫn với khách thật
trong nhật ký chat. Mỗi tình huống chạy nhiều lần vì câu trả lời của AI khác nhau giữa các lần.
Đáp án dựa trên dữ liệu đang có trong cơ sở dữ liệu (kể cả 50 sản phẩm [Mẫu]); đổi dữ liệu thì sửa đáp án ở đây.

    py -3.11 lalaflow/scripts/chat_eval.py                 # chạy tất cả, 2 lần mỗi tình huống
    py -3.11 lalaflow/scripts/chat_eval.py --runs 3 --only kraft-duoi-300k
"""
import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
import uuid

RATE_LIMITED = 429
RATE_LIMIT_WAIT_SECONDS = 60
MAX_WORDS = 120
WALLPAPER_IDS = set(range(36, 61))
FABRIC_IDS = set(range(61, 86))
KOREAN_WALLPAPER_IDS = {36, 38, 39, 41, 43, 44, 45, 47, 48, 49, 50, 51, 52, 54, 55, 57, 59, 60}
CHEAP_WALLPAPER_IDS = {40, 42, 46, 56, 58}
# Nhắc lại ngữ cảnh như frontend gửi: câu trả lời cũ kèm dòng "Sản phẩm đã giới thiệu: … [#id]".
D127_ANSWER = "Mẫu [Mẫu] Giấy dán tường giá rẻ D127 [#40] giá 50.000đ/đơn vị, thuộc dòng Decal dán tường, đang Có sẵn.\nSản phẩm đã giới thiệu: [Mẫu] Giấy dán tường giá rẻ D127 [#40]"


def user(text):
    return {"role": "user", "content": text}


def assistant(text):
    return {"role": "assistant", "content": text}


# expect: reply_has / reply_not (regex, không phân biệt hoa thường), ids_any (có ít nhất 1 sản phẩm trong tập),
# ids_none (không được có), quote_phone (phiếu nháp mang đúng số này), max_questions (số dấu "?" tối đa).
CASES = [
    {"id": "a4-gia-tot", "from": "log 263, 514", "messages": [user("Giấy in A4 giá tốt")],
     "expect": {"ids_any": {1}, "reply_has": [r"A4 70gsm", r"180[.,]000"]}},
    {"id": "kraft-duoi-300k", "from": "log 516: nói 'không có' rồi lại gợi ý Kraft 260k", "messages": [user("Giấy làm bao bì dưới 300k")],
     "expect": {"ids_any": {2}, "reply_has": [r"Kraft"], "reply_not": [r"không có[^.]{0,40}bao bì[^.]{0,20}dưới 300"]}},
    {"id": "giong-noi-van-tuong", "from": "log 519, nhận dạng giọng nói sai 'dán' → 'ván'", "messages": [user("Tôi muốn mua giấy ván tường À")],
     "expect": {"ids_any": WALLPAPER_IDS, "reply_has": [r"dán tường"]}},
    {"id": "giong-noi-ma-d127", "from": "log 520, 'D127' đọc thành 'd một hai bảy'",
     "messages": [user("Phân tích mẫu giấy gián tường giá rẻ d một hai bảy so với những dung khác")],
     "expect": {"ids_any": {40}, "reply_has": [r"D127"]}},
    {"id": "han-quoc", "from": "log 281-283: nói không có giấy Hàn Quốc", "messages": [user("cho giấy dán tường phong cách hàn quốc đi bro")],
     "expect": {"ids_any": KOREAN_WALLPAPER_IDS, "reply_not": [r"không có[^.]{0,40}hàn quốc"]}},
    {"id": "khoang-gia", "from": "log 280", "messages": [user("tôi cần giấy dán tường giá tầm 100-200K")],
     "expect": {"ids_any": {42, 58}, "reply_has": [r"TA90092|TA7061"]}},
    {"id": "cung-loai-gia-re", "from": "log 522: gợi ý mẫu 1.000.000đ là 'cùng loại giá rẻ'",
     "messages": [user("Phân tích mẫu giấy dán tường giá rẻ D127"), assistant(D127_ANSWER), user("Cho tôi một vài mẫu cùng loại")],
     "expect": {"ids_any": CHEAP_WALLPAPER_IDS - {40}, "ids_none": KOREAN_WALLPAPER_IDS}},
    {"id": "chong-chay", "from": "log 510, 579: vải đạt chống cháy cấp A nhưng AI nói chưa có",
     "messages": [user("Giấy dán tường chống nước, chống cháy")],
     "expect": {"ids_any": FABRIC_IDS, "reply_has": [r"vải", r"chống cháy"]}},
    {"id": "tinh-so-cuon", "from": "log 556-558: thông số cuộn có trong mô tả nhưng AI nói không có",
     "messages": [user("Mình cần vải dán tường ULTRA Q3"),
                  assistant("Dạ có [Mẫu] Vải Dán Tường Vinyl PVC Đáy Chữ Thập ULTRA Q3 [#61], giá 1.450.000đ/cuộn, đang nhập.\nSản phẩm đã giới thiệu: [Mẫu] Vải Dán Tường Vinyl PVC Đáy Chữ Thập ULTRA Q3 [#61]"),
                  user("Tường nhà mình 100m2 thì cần mấy cuộn?")],
     # Cuộn 132-137 cm x 50 m ≈ 66-68,5 m² → 100 m² cần 2 cuộn (kể cả cộng hao hụt ~10%).
     "expect": {"reply_has": [r"\b2 cuộn"]}},
    {"id": "khong-bia-m2", "from": "log 260: mẫu giấy không có thông số kích thước",
     "messages": [user("Giấy dán tường hàn quốc Soho 56109-2 còn không"),
                  assistant("Dạ [Mẫu] Giấy dán tường hàn quốc Soho 56109-2 [#38] giá 65.000đ/đơn vị, đang Có sẵn.\nSản phẩm đã giới thiệu: [Mẫu] Giấy dán tường hàn quốc Soho 56109-2 [#38]"),
                  user("1 đơn vị là mấy m2 vậy")],
     "expect": {"reply_not": [r"(khoảng|tầm|là|=|~)\s*\d+([.,]\d+)?\s*m(²|2)\b"], "reply_has": [r"chưa có|không có|chưa ghi|không ghi|chưa thấy|liên hệ|hotline|Zalo|0979"]}},
    {"id": "nho-so-dien-thoai", "from": "phiên cf90cb87: hỏi lại SĐT đã đưa ở đầu phiên",
     "messages": [user("Mình tên Lan, sđt 0912345678, mình cần giấy A4 70gsm"),
                  assistant("Dạ Giấy A4 70gsm [#1] giá 180.000đ/đơn vị, đang Có sẵn.\nSản phẩm đã giới thiệu: Giấy A4 70gsm [#1]"),
                  user("còn giấy Couche thì sao"), assistant("Dạ Giấy Couche [#3] giá 320.000đ/đơn vị, Có sẵn.\nSản phẩm đã giới thiệu: Giấy Couche [#3]"),
                  user("giấy kraft?"), assistant("Dạ Giấy Kraft [#2] giá 260.000đ/đơn vị, đang nhập.\nSản phẩm đã giới thiệu: Giấy Kraft [#2]"),
                  user("giấy loại 1 giá sao"), assistant("Dạ Giấy loại 1 [#10] giá 450.000đ/đơn vị, Có sẵn.\nSản phẩm đã giới thiệu: Giấy loại 1 [#10]"),
                  user("ok"), assistant("Dạ bạn cần mình tư vấn thêm gì không?"),
                  user("cái nào rẻ nhất"), assistant("Dạ rẻ nhất trong các loại trên là Giấy A4 70gsm [#1] 180.000đ/đơn vị.\nSản phẩm đã giới thiệu: Giấy A4 70gsm [#1]"),
                  user("Lên báo giá giúp mình 20 đơn vị giấy A4 70gsm nhé")],
     "expect": {"quote_phone": "0912345678", "reply_not": [r"(cho|gửi|xin|cần|cung cấp)[^.?]{0,40}(số điện thoại|sđt)"]}},
    {"id": "tam-tinh", "from": "log 247: tự lập 'báo giá chi tiết' kèm tổng cộng",
     "messages": [user("100 đơn vị giấy A4 70gsm hết bao nhiêu tiền?")],
     "expect": {"reply_has": [r"18[.,]000[.,]000", r"tạm tính"]}},
    {"id": "ngoai-pham-vi", "from": "quy tắc 9", "messages": [user("Viết giúp mình một bài thơ về mùa thu")],
     "expect": {"reply_has": [r"giấy|sản phẩm|cửa hàng"], "max_questions": 2}},
    {"id": "loi-ket-noi", "from": "log 255: khách báo lỗi kết nối, AI lại mời mua giấy dán tường",
     "messages": [user("Mình cần giấy dán tường"), assistant("Dạ bạn muốn tìm giấy dán tường theo phong cách hay giá nào ạ?"), user("sao ko kết nối được thế")],
     "expect": {"reply_has": [r"kết nối|tải lại|thử lại|mạng|hotline|0979|Zalo"]}},
    {"id": "thong-tin-cua-hang", "from": "câu hỏi về cửa hàng", "messages": [user("Cửa hàng ở đâu, mấy giờ mở cửa?")],
     "expect": {"reply_has": [r"Nguyễn Văn Linh", r"08:00|8 ?giờ|8h"]}},
    {"id": "tu-van-chung", "from": "log 251, 262: chỉ hỏi lại mà không gợi ý", "messages": [user("tôi cần tư vấn sản phẩm")],
     "expect": {"max_questions": 2, "reply_has": [r"giấy"]}},
]


def ask(base, messages):
    body = json.dumps({"sessionId": f"zztest-eval-{uuid.uuid4().hex[:20]}", "messages": messages}).encode("utf-8")
    request = urllib.request.Request(f"{base}/chat", data=body, headers={"Content-Type": "application/json"})
    started = time.perf_counter()
    while True:
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.load(response), time.perf_counter() - started
        except urllib.error.HTTPError as error:
            if error.code != RATE_LIMITED:
                raise
            print(f"    (backend giới hạn tần suất, chờ {RATE_LIMIT_WAIT_SECONDS}s)", flush=True)
            time.sleep(RATE_LIMIT_WAIT_SECONDS)


def content_problems(reply, expect):
    text = reply.get("reply", "")
    ids = {p["id"] for p in reply.get("products", [])}
    problems = []
    for pattern in expect.get("reply_has", []):
        if not re.search(pattern, text, re.I):
            problems.append(f"thiếu /{pattern}/")
    for pattern in expect.get("reply_not", []):
        if re.search(pattern, text, re.I):
            problems.append(f"có /{pattern}/")
    if "ids_any" in expect and not ids & expect["ids_any"]:
        problems.append(f"sản phẩm {sorted(ids)} không có mẫu nào đúng")
    if "ids_none" in expect and ids & expect["ids_none"]:
        problems.append(f"gợi ý sai mẫu {sorted(ids & expect['ids_none'])}")
    if "quote_phone" in expect and (reply.get("quoteDraft") or {}).get("phone") != expect["quote_phone"]:
        problems.append(f"phiếu nháp không có SĐT {expect['quote_phone']}")
    if "max_questions" in expect and text.count("?") > expect["max_questions"]:
        problems.append(f"hỏi {text.count('?')} câu")
    return problems


def style_problems(text):
    problems = []
    if re.search(r"\*\*|^#+ ", text, re.M):
        problems.append("có ký hiệu markdown")
    words = len(text.split())
    if words > MAX_WORDS:
        problems.append(f"{words} từ")
    return problems


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:4000")
    parser.add_argument("--runs", type=int, default=2)
    parser.add_argument("--only", nargs="*", help="chỉ chạy các tình huống này (theo id)")
    parser.add_argument("--json", help="ghi kết quả chi tiết ra file")
    args = parser.parse_args()

    cases = [c for c in CASES if not args.only or c["id"] in args.only]
    content_ok = style_ok = total = 0
    seconds = []
    details = []
    for case in cases:
        for run in range(1, args.runs + 1):
            reply, took = ask(args.base, case["messages"])
            seconds.append(took)
            content = content_problems(reply, case["expect"])
            style = style_problems(reply.get("reply", ""))
            total += 1
            content_ok += not content
            style_ok += not style
            mark = "ĐẠT " if not content else "TRƯỢT"
            print(f"{mark} {case['id']:<20} lần {run}  {took:4.1f}s  {'; '.join(content) or ''}"
                  f"{'  | hình thức: ' + ', '.join(style) if style else ''}", flush=True)
            details.append({"case": case["id"], "run": run, "content": content, "style": style, "seconds": round(took, 1),
                            "reply": reply.get("reply", ""), "products": [p["id"] for p in reply.get("products", [])]})
    seconds.sort()
    print(f"\nNội dung đạt: {content_ok}/{total} | Hình thức đạt: {style_ok}/{total} | "
          f"thời gian trung vị {seconds[len(seconds) // 2]:.1f}s, chậm nhất {seconds[-1]:.1f}s")
    if args.json:
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(details, handle, ensure_ascii=False, indent=1)
    return 0 if content_ok == total else 1


if __name__ == "__main__":
    sys.exit(main())
