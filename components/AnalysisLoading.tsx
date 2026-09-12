import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function AnalysisLoading({ text, previewUrl, onCancel }: { text: string; previewUrl: string | null; onCancel: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <section className="paper loading-paper">
    <Loader2 className="loading-icon" size={32} />
    <div role="status"><h1>풀이를 살펴보고 있어요</h1><p>입력한 수식과 풀이 과정을 분석하고 있습니다.</p></div>
    <p className="elapsed">경과 시간 {elapsed}초</p>
    {elapsed >= 30 && <p className="muted">분석이 길어지고 있어요. 기다리거나 취소 후 입력 내용을 줄여 다시 시도할 수 있습니다.</p>}
    <details><summary>보낸 내용 확인하기</summary>{previewUrl && <img className="original-image" src={previewUrl} alt="분석 중인 풀이 원본" />}<pre>{text}</pre></details>
    <button className="secondary" onClick={onCancel}>분석 취소</button>
    <p className="small muted">취소하면 입력 화면으로 돌아갑니다. 서버의 처리와 비용 발생은 중단되지 않을 수 있습니다.</p>
  </section>;
}
