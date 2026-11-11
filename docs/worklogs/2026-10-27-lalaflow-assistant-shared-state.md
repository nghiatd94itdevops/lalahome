# 2026-10-27: Tách trạng thái hội thoại trợ lý ra hook dùng chung (1/2, refactor)

## Goal
Chuẩn bị cho trang chat full màn hình `/tro-ly`. Khung chat nổi và trang full phải dùng **cùng một** cuộc trò chuyện (tin nhắn, mic, đọc to, tâm trạng Mimi). Vì vậy trạng thái được nhấc từ `ChatAssistant` lên `Site`.

**Không làm:** không đổi hành vi hay giao diện. Trang mới và nút ⤢ nằm ở PR 2/2.

## Success criteria
- **R1.** `mimi-test.mjs` (18 kiểm tra) và `mobile-regress.mjs` (29 kiểm tra) vẫn qua hết sau refactor.

## Changes
- **`components/useAssistantChat.js` (mới):**
  - `useAssistantChat({ active })` chứa:
    - lưu và đọc `sessionStorage`;
    - `send`, `restart`;
    - bật/tắt đọc to;
    - mic qua `useVoiceInput`;
    - `useMimiMood`.
  - `useMimiMood` chuyển nguyên vẹn sang đây, chỉ đổi tên tham số `open` thành `active`.
  - Khi `active = false` thì huỷ mic và dừng đọc, giống effect cũ khi đóng panel.
- **`components/ChatAssistant.jsx`:**
  - chỉ còn phần hiển thị, nhận `assistant` qua props;
  - tách thành các component export: `ChatThread`, `ChatComposer`, `ChatProducts`, `ReadAloudButton` và hook `useFollowLatest`.
- **`App.jsx`:** gọi `useAssistantChat({ active: chatOpen })` trong `Site` rồi truyền xuống.

## Result
Chạy ngay sau refactor, trên build mới:
```
== mobile-regress (tail)
PASS 1280px no tab bar, floating buttons shown
PASS 1280px assistant opens as the floating panel: {"top":120,"bottom":720,"left":16,"right":416}
PASS no console errors
ALL PASS
== mimi-test
PASS the robot is gone everywhere: 0 robot elements
PASS launcher shows a live Mimi: mm-root in launcher
PASS opening the chat: Mimi greets beside the panel: greet
PASS she stands right of the panel, inside the screen, level with its bottom: {"gap":10,"right":606,"bottomDiff":0,"w":180}
PASS after the greeting she goes back to idle: idle
PASS typing → listening, sent → thinking → searching, a match → happy: {"typing":"listening","thinking":"thinking","searching":"searching","reaction":"happy"}
PASS only suggestions → wink: {"typing":"listening","thinking":"thinking","searching":"searching","reaction":"wink"}
PASS nothing found → sad: {"typing":"listening","thinking":"thinking","searching":"searching","reaction":"sad"}
PASS a thank-you → love: {"typing":"listening","thinking":"thinking","searching":"searching","reaction":"love"}
PASS an error → error: {"typing":"listening","thinking":"thinking","searching":"searching","reaction":"error"}
PASS every assistant message has a still Mimi face (no live engines in the list): {"bubbles":5,"faces":5,"liveInMessages":0,"header":true}
PASS closing the chat removes the standing Mimi: none
PASS 390px phone tab shows Mimi in her own colours: {"w":34,"stroke":"none","fill":"rgb(0, 0, 0)"}
PASS 390px phone: no standing Mimi over the full-screen chat, no sideways scroll: {"stand":"none","overflow":0}
PASS 360px phone tab shows Mimi in her own colours: {"w":34,"stroke":"none","fill":"rgb(0, 0, 0)"}
PASS 360px phone: no standing Mimi over the full-screen chat, no sideways scroll: {"stand":"none","overflow":0}
PASS a minute without activity → sleep: sleep
PASS no console errors: none
ALL PASS
```
Đầy đủ 29/29 mobile-regress chạy lại trên build cuối, xem worklog [2026-10-27-lalaflow-assistant-page.md](2026-10-27-lalaflow-assistant-page.md).

**R1: PASS.**

Đính chính: các worklog Mimi trước ghi mobile-regress có 30 kiểm tra và mimi-notes có 16. Đếm lại theo output thì đúng là 29 và 15.

## Status
DONE
