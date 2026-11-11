import { useEffect, useRef, useState } from "react";
import { compileSpokenWords, parseSpokenWords, SPOKEN_WORDS_KEY } from "../../components/spokenWords.js";
import { fetchSpeech, speakable } from "../../components/useVoice.js";
import { request, useApi } from "../client.js";
import { Field, LoadState, Panel, useAdmin } from "../ui.jsx";

const SAMPLE = "Chào bạn, mình là **Mimi** của LaLaHome! Giấy A4/A3 giá 85.000đ/ram.";

const isComplete = (row) => row.match.trim() !== "";

export default function SpokenWords() {
  const { run, notify } = useAdmin();
  const remote = useApi("/site-content");
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [sample, setSample] = useState(SAMPLE);
  const [playing, setPlaying] = useState(false);
  const player = useRef(null);

  useEffect(() => {
    if (remote.data) setRows(parseSpokenWords(remote.data[SPOKEN_WORDS_KEY]));
  }, [remote.data]);

  useEffect(() => () => player.current?.pause(), []);

  const update = (index, field, value) => setRows(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  const remove = (index) => setRows(rows.filter((_, i) => i !== index));
  const add = () => setRows([...rows, { match: "", say: "" }]);

  const words = rows.filter(isComplete).map((row) => ({ match: row.match.trim(), say: row.say.trim() }));
  const preview = speakable(sample, compileSpokenWords(words));
  const duplicates = new Set(words.map((row) => row.match.toLowerCase()).filter((match, i, all) => all.indexOf(match) !== i));

  async function save(event) {
    event.preventDefault();
    if (duplicates.size) return notify("error", `Trùng dòng "Khi gặp": ${[...duplicates].join(", ")}`);
    setSaving(true);
    const ok = await run(
      () => request(`/site-content/${SPOKEN_WORDS_KEY}`, { method: "PUT", body: { words } }),
      "Đã lưu từ điển giọng đọc. Khách thấy thay đổi khi tải lại trang.",
    );
    setSaving(false);
    if (ok) remote.reload();
  }

  async function listen() {
    if (!preview) return;
    player.current?.pause();
    setPlaying(true);
    try {
      const audio = new Audio(URL.createObjectURL(await fetchSpeech(preview)));
      player.current = audio;
      audio.onended = () => { URL.revokeObjectURL(audio.src); setPlaying(false); };
      await audio.play();
    } catch (error) {
      setPlaying(false);
      notify("error", `Không nghe thử được: ${error.message}`);
    }
  }

  return (
    <LoadState resource={remote}>
      <form className="stack" onSubmit={save}>
        <Panel
          title="Từ điển giọng đọc"
          subtitle="Khi trợ lý đọc thành tiếng gặp chữ ở cột trái, nó đọc theo cột phải. Để trống cột phải để bỏ qua (không đọc)."
          actions={<button type="button" className="btn btn-paper btn-small" onClick={add}>+ Thêm dòng</button>}
        >
          <p className="muted-line">
            Chữ cái khớp nguyên từ, không phân biệt hoa thường ("Mimi" không khớp "Mimis"). Dấu cách khớp cả khi viết liền:
            "La La Home" khớp LaLaHome, Lala Home. Ký hiệu (*, /, &amp;…) khớp ở mọi chỗ. Dấu / ngay sau giá luôn đọc là "một"
            (85.000đ/ram → 85000 đồng một ram).
          </p>
          <div className="table-wrap">
            <table className="ledger-table">
              <thead><tr><th>Khi gặp</th><th>Đọc thành</th><th /></tr></thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td><input aria-label="Khi gặp" value={row.match} onChange={(e) => update(index, "match", e.target.value)} placeholder="vd. LaLaHome" /></td>
                    <td><input aria-label="Đọc thành" value={row.say} onChange={(e) => update(index, "say", e.target.value)} placeholder="(bỏ qua)" /></td>
                    <td className="row-actions"><button type="button" className="btn btn-paper btn-small" onClick={() => remove(index)}>Xoá</button></td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan="3" className="muted-line">Chưa có dòng nào — giọng đọc sẽ đọc nguyên văn.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Nghe thử" subtitle="Dùng bảng đang sửa (chưa cần lưu).">
          <div className="form-grid">
            <Field label="Câu mẫu" wide><textarea rows="2" value={sample} onChange={(e) => setSample(e.target.value)} /></Field>
            <Field label="Giọng sẽ đọc" wide><output>{preview || "—"}</output></Field>
          </div>
          <button type="button" className="btn btn-paper" onClick={listen} disabled={playing || !preview}>{playing ? "Đang đọc…" : "▶ Nghe thử"}</button>
        </Panel>
        <div className="sticky-save">
          <button type="submit" className="btn btn-door btn-large" disabled={saving}>{saving ? "Đang lưu…" : "Lưu từ điển"}</button>
        </div>
      </form>
    </LoadState>
  );
}
